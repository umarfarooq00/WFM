import { Router, Request, Response } from "express";
import { agentStore, presenceStore } from "../store";

const router = Router();

/**
 * POST /assignment/next — Requirement #4
 * Returns the agent who has been online the longest (earliest onlineSince).
 * Only considers agents whose WFM status is "active" and whose ChatApp state is "online".
 */
router.post("/next", (_req: Request, res: Response) => {
  const candidates = agentStore
    .getAll()
    .filter((a) => a.status === "active")
    .map((a) => ({ agent: a, presence: presenceStore.get(a.id) }))
    .filter(
      (x): x is typeof x & { presence: NonNullable<typeof x.presence> } =>
        x.presence !== undefined &&
        x.presence.state === "online" &&
        x.presence.onlineSince !== null
    );

  if (candidates.length === 0) {
    return res.status(503).json({ error: "no agents currently online" });
  }

  // Assign to the agent with the earliest onlineSince — longest continuous online session
  candidates.sort(
    (a, b) => a.presence.onlineSince!.getTime() - b.presence.onlineSince!.getTime()
  );

  const { agent } = candidates[0];
  res.json({ agentId: agent.id, name: agent.name, site: agent.site });
});

export default router;
