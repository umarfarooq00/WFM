import cron from "node-cron";
import { agentStore, presenceStore, schedulerLogStore } from "./store";
import { activateAgent, deactivateAgent } from "./chatapp";
import { isWithinShift } from "./shift";
import { PresenceState } from "./types";

/**
 * Requirement #2: every 60 seconds WFM compares each active agent's shift
 * against the current UTC time, then calls activate or deactivate on ChatApp
 * for agents whose desired state differs from their known live state.
 *
 * Only agents with status "active" are managed. Suspended agents are ignored.
 */
async function runSchedulerTick(): Promise<void> {
  const now = new Date();
  const agents = agentStore.getAll().filter((a) => a.status === "active");

  await Promise.allSettled(
    agents.map(async (agent) => {
      const shouldBeOnline = isWithinShift(agent, now);
      const presence = presenceStore.get(agent.id);
      const currentState: PresenceState = presence?.state ?? "offline";
      const isCurrentlyOnline = currentState === "online";

      if (shouldBeOnline === isCurrentlyOnline) return; // no change needed

      const action = shouldBeOnline ? "activate" : "deactivate";
      let success = false;
      let error: string | undefined;

      try {
        if (shouldBeOnline) {
          await activateAgent(agent.id);
        } else {
          await deactivateAgent(agent.id);
        }
        success = true;
        console.log(`[scheduler] ${action}d ${agent.id} (${agent.name})`);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] failed to ${action} ${agent.id}: ${error}`);
      }

      schedulerLogStore.append({ agentId: agent.id, action, at: now, success, error });
    })
  );
}

export function startScheduler(): void {
  // Run on every UTC minute that is divisible by 1 (i.e. every minute)
  cron.schedule("* * * * *", () => {
    runSchedulerTick().catch((err) =>
      console.error("[scheduler] unhandled error in tick:", err)
    );
  });

  console.log("[scheduler] started — running every 60 s");

  // Also run immediately on startup so state is correct within the first minute
  runSchedulerTick().catch((err) =>
    console.error("[scheduler] startup tick failed:", err)
  );
}

// Exported for tests
export { runSchedulerTick };
