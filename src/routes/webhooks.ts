import { Router, Request, Response } from "express";
import { z } from "zod";
import { agentStore, presenceStore } from "../store";
import { PresenceState } from "../types";

const router = Router();

const MessageEventSchema = z.object({
  agentId: z.string(),
  timestamp: z.string().datetime(),
});

const PresenceEventSchema = z.object({
  agentId: z.string(),
  state: z.enum(["online", "away", "offline"]),
  timestamp: z.string().datetime(),
});

/**
 * POST /webhooks/presence — Requirement #3
 * ChatApp pushes real-time state changes here; WFM updates its presence store
 * so the dashboard always reflects ChatApp's ground truth.
 */
router.post("/presence", (req: Request, res: Response) => {
  const parsed = PresenceEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload", detail: parsed.error.format() });
  }

  const { agentId, state, timestamp } = parsed.data;
  const eventTime = new Date(timestamp);

  // Ignore events for unknown agents — log for ops visibility
  if (!agentStore.get(agentId)) {
    console.warn(`[webhook] presence event for unknown agent ${agentId}`);
    // Return 200 so ChatApp doesn't retry indefinitely
    return res.status(200).json({ ok: true, warning: "unknown agent" });
  }

  const current = presenceStore.get(agentId);

  // Discard stale out-of-order events
  if (current && eventTime <= current.lastStateChange) {
    return res.status(200).json({ ok: true, discarded: "stale event" });
  }

  const prevState: PresenceState = current?.state ?? "offline";
  const newState = state as PresenceState;

  presenceStore.update(agentId, {
    state: newState,
    lastStateChange: eventTime,
    // Track when the agent first came online (for longest-online assignment logic)
    onlineSince:
      newState === "online" && prevState !== "online"
        ? eventTime
        : newState !== "online"
        ? null
        : current?.onlineSince ?? eventTime,
  });

  console.log(`[webhook] ${agentId} → ${newState} at ${timestamp}`);
  res.status(200).json({ ok: true });
});

router.post("/message", (req: Request, res: Response) => {
  const parsed = MessageEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload", detail: parsed.error.format() });
  }
  const { agentId } = parsed.data;
  if (!agentStore.get(agentId)) {
    return res.status(200).json({ ok: true, warning: "unknown agent" });
  }
  presenceStore.incrementMessages(agentId);
  res.status(200).json({ ok: true });
});

export default router;
