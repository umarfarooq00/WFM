# WFM ↔ ChatApp Integration — Solution

---

## 1. Questions & Assumptions

### Questions I'd ask before writing more code

**Shift times — timezone?**
The spec says sites span three timezones (Manila UTC+8, Cebu UTC+8, Morocco UTC+1, Madagascar UTC+3) but the shift field is just `"09:00-17:00"` with no timezone annotation. I've assumed **shifts are stored and compared in UTC**. If they're in site-local time, the scheduler needs to know each site's offset (and handle DST for Morocco). This is the single highest-risk ambiguity in the spec.

**"Online the longest" — does it reset on away?**
Req #4 says assign new chats to the agent online the longest. Does an `away` state break the clock? I've implemented `onlineSince` as the timestamp when the agent last transitioned from non-online → online. `away` doesn't reset it. If you want `away` to count as a break, `onlineSince` should be cleared on `away` too.

**Scheduler tick — idempotency / at-least-once delivery?**
The spec says the cron runs every 60 s. If ChatApp's activate/deactivate returns a transient error, the scheduler will retry on the next tick — which is fine. But if ChatApp goes down for several minutes, agents will pile up waiting to be activated. Should WFM queue and retry faster than 60 s in that case? I've logged failures and let the next tick handle it, which is the simplest safe behaviour.

**Webhook authentication?**
The spec describes the `POST /webhooks/presence` signature but says nothing about auth. In production you'd want at least a shared HMAC secret (like GitHub webhooks) to prevent spoofed presence events. I've left a `// TODO: verify HMAC signature` comment placeholder but haven't implemented it here.

**Multiple scheduler instances?**
At 600 agents a single Node process is fine, but if you run WFM behind a load balancer with N replicas, every replica will fire the cron and send N activate calls per agent per minute. The fix is a distributed lock (Redis SETNX / Postgres advisory lock) so only one replica runs the tick. I've noted this in risks.

**`messagesHandled` — who increments it?**
Req #5 mentions "messages handled per hour" per agent. ChatApp presumably knows this; WFM doesn't observe individual messages in the spec, only presence events. I've added a `POST /webhooks/message` stub to the type model (and an `incrementMessages` helper in the store), but wired it up minimally. In a real system ChatApp would push a message event or WFM would poll a ChatApp API.

**`PATCH /agents/:id` ownership**
Req #6 says ChatApp can patch WFM's agent record (name, site, status, payRate). This is a two-master write pattern — WFM also presumably allows ops to edit agents directly. Who wins on a conflict? I've assumed last-write-wins and validated the ChatApp payload with Zod so it can only touch the four listed fields.

---

### Assumptions made

| # | Assumption |
|---|------------|
| A1 | Shift times are UTC |
| A2 | `away` does not reset the "online since" clock for assignment purposes |
| A3 | `suspended` agents are never activated, even if their shift is active |
| A4 | Unknown-agent presence events return 200 (don't make ChatApp retry) |
| A5 | Out-of-order / replayed presence events are discarded by comparing timestamps |
| A6 | The `messagesHandled` metric is incremented via a `/webhooks/message` event from ChatApp |
| A7 | A single WFM replica for now; distributed locking is a noted follow-up |

---

## 2. API Contract

### State ownership

| Piece of state | Owner | How the other side learns about it |
|----------------|-------|------------------------------------|
| Agent schedule (shift, site, status, payRate) | **WFM** | ChatApp reads via `GET /agents/:id` or is pushed via `PATCH /agents/:id` |
| Live presence (online/away/offline) | **ChatApp** | WFM receives via `POST /webhooks/presence` |
| Scheduler intent (should-be-online) | **WFM** | WFM acts on it by calling ChatApp's activate/deactivate |
| Message counts | **ChatApp** | WFM receives via `POST /webhooks/message` (or polls ChatApp) |

### WFM endpoints

```
GET    /agents                 List all agent records
GET    /agents/:id             Single agent record
PATCH  /agents/:id             Update agent record (ChatApp → WFM, req #6)

POST   /webhooks/presence      Receive live state from ChatApp (req #3)
POST   /webhooks/message       Receive message-handled event from ChatApp (req #5 support)

GET    /dashboard              Live ops view — all agents (req #5)
GET    /dashboard/:id          Single-agent live view

POST   /assignment/next        Return agent who has been online the longest (req #4)

GET    /health                 Liveness probe
GET    /scheduler/log          Recent scheduler actions (ops/debugging)
```

### PATCH /agents/:id  (ChatApp → WFM)

```
Request body (all fields optional):
{
  "name":    string,
  "site":    "manila" | "cebu" | "morocco" | "madagascar",
  "status":  "active" | "suspended",
  "payRate": number (positive)
}

Response 200: updated Agent record
Response 400: validation error
Response 404: agent not found
```

### POST /webhooks/presence

```
Request body:
{
  "agentId":   string,
  "state":     "online" | "away" | "offline",
  "timestamp": ISO 8601 string
}

Response 200: { "ok": true }
            | { "ok": true, "discarded": "stale event" }
            | { "ok": true, "warning": "unknown agent" }
Response 400: validation error
```

Always 200 to avoid ChatApp retrying non-actionable errors.

### GET /dashboard

```
Response 200: Array of:
{
  "agent": { id, name, site, shift, payRate, status },
  "presence": {
    "state":                "online" | "away" | "offline",
    "lastStateChange":      ISO 8601,
    "onlineDurationSeconds": number | null
  },
  "metrics": {
    "messagesPerHour": number,
    "idleMinutes":     number | null,   // null when offline
    "idleAlert":       boolean          // true if idle >= 10 min
  }
}
```

### POST /assignment/next

```
Response 200: { "agentId": string, "name": string, "site": string }
Response 503: { "error": "no agents currently online" }
```

---

## 3. Implemented endpoint — Requirement #2: Shift scheduler

**Files:**
- `src/scheduler.ts` — the cron job
- `src/shift.ts` — shift window logic (handles overnight shifts)
- `src/chatapp.ts` — thin client wrapping ChatApp's activate/deactivate
- `src/__tests__/scheduler.test.ts` — unit tests with mocked ChatApp
- `src/__tests__/shift.test.ts` — shift boundary tests

**How it works:**

Every 60 seconds (UTC cron `* * * * *`), `runSchedulerTick` iterates all `active` agents and compares:
- **desired state**: `isWithinShift(agent, now)` — pure function, handles overnight windows (e.g. `22:00–06:00`)
- **known live state**: last presence recorded by WFM from ChatApp's webhooks

If they differ, WFM calls ChatApp's `/agents/:id/activate` or `/agents/:id/deactivate`. Failures are caught per-agent (via `Promise.allSettled`) so one bad agent doesn't block the rest, and every attempt is written to a scheduler log for ops visibility.

**On startup** the tick runs immediately so state is consistent within the first minute, not after a full 60 s wait.

I chose requirement #2 over #3 because the scheduler contains the interesting decision logic (shift window arithmetic, overnight shifts, idempotency), while the webhook (req #3) is also implemented fully in `src/routes/webhooks.ts` with its own test suite.

---

## 4. Risks & what I'd change in production

### Timezone ambiguity is a silent correctness bug
If shifts are in local time but compared as UTC, agents in Madagascar (UTC+3) get activated and deactivated 3 hours off. This produces incorrect coverage with no error, just a wrong schedule. **Fix:** store an explicit `shiftTimezone` on the agent record and convert to UTC before comparison.

### In-memory store loses all state on restart
Every deployment wipes presence state, scheduler logs, and message counts. The scheduler's startup tick will re-activate agents in-shift, so functional correctness recovers quickly — but you lose metrics history and the "online since" timestamps, which breaks the load-balancing assignment until ChatApp replays its state. **Fix:** Postgres for agents/presence (with an upsert path for ChatApp presence pushes), Redis for ephemeral session state.

### No webhook authentication
Any caller can POST to `/webhooks/presence` and move an agent offline. **Fix:** shared HMAC secret, verified with `crypto.timingSafeEqual` before processing the payload.

### Scheduler fan-out under load
At 600 agents, every tick fires up to 600 HTTP calls to ChatApp. Most ticks will have few or zero state changes, but shift boundaries (e.g. 09:00 UTC when Manila day shift starts) could trigger a burst. **Fix:** batch activate/deactivate if ChatApp supports it; otherwise rate-limit outbound calls with a concurrency cap (e.g. `p-limit(20)`).

### Multi-replica cron collision
Two WFM replicas both run the 60 s tick and both call activate for the same agent. ChatApp's activate endpoint is presumably idempotent, but the log will show duplicates and you burn double the API quota. **Fix:** Redis `SET NX EX 55` distributed lock at the top of `runSchedulerTick`; only the replica that wins the lock executes the tick.

### `messages/hour` denominator
Currently I divide total messages by online duration. If an agent has been online 8 hours with all messages in the last hour, the rate is diluted. A rolling 1-hour window (ring buffer of timestamps) would be more accurate for the alert threshold. Acceptable trade-off for now given the timebox.

### "Online the longest" assignment doesn't account for workload
An agent who has been online 4 hours but has handled 60 chats gets the next chat before an agent who came online 30 minutes ago with 0 chats. The spec says "longest online" so I've implemented that literally, but in practice a hybrid of online duration + current queue depth is more balanced. Worth raising with product.
