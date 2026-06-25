import { Router, Request, Response } from "express";
import { agentStore, presenceStore } from "../store";
import { DashboardEntry } from "../types";

const router = Router();

const IDLE_ALERT_MINUTES = 10;

/**
 * GET /dashboard — Requirement #5
 * Live per-agent view: current state, messages/hour, idle alert.
 */
router.get("/", (_req: Request, res: Response) => {
  const now = new Date();
  const agents = agentStore.getAll();

  const entries: DashboardEntry[] = agents.map((agent) => {
    const p = presenceStore.get(agent.id)!;

    const onlineDurationSeconds =
      p.onlineSince !== null
        ? Math.floor((now.getTime() - p.onlineSince.getTime()) / 1000)
        : null;

    // messages/hour: based on online duration to avoid inflated rates after long idle periods
    const messagesPerHour =
      onlineDurationSeconds && onlineDurationSeconds > 0
        ? Math.round((p.messagesHandled / onlineDurationSeconds) * 3600 * 10) / 10
        : 0;

    const idleMinutes =
      p.state !== "offline" && p.lastMessageAt !== null
        ? Math.floor((now.getTime() - p.lastMessageAt.getTime()) / 60000)
        : p.state !== "offline" && p.onlineSince !== null
        ? Math.floor((now.getTime() - p.onlineSince.getTime()) / 60000) // never had a message
        : null;

    return {
      agent,
      presence: {
        state: p.state,
        lastStateChange: p.lastStateChange.toISOString(),
        onlineDurationSeconds,
      },
      metrics: {
        messagesPerHour,
        idleMinutes,
        idleAlert: idleMinutes !== null && idleMinutes >= IDLE_ALERT_MINUTES,
      },
    };
  });

  res.json(entries);
});

/**
 * GET /dashboard/:id — single-agent view
 */
router.get("/:id", (req: Request, res: Response) => {
  const agent = agentStore.get(req.params["id"] as string);
  if (!agent) return res.status(404).json({ error: "agent not found" });

  const now = new Date();
  const p = presenceStore.get(agent.id)!;

  const onlineDurationSeconds =
    p.onlineSince !== null
      ? Math.floor((now.getTime() - p.onlineSince.getTime()) / 1000)
      : null;

  const messagesPerHour =
    onlineDurationSeconds && onlineDurationSeconds > 0
      ? Math.round((p.messagesHandled / onlineDurationSeconds) * 3600 * 10) / 10
      : 0;

  const idleMinutes =
    p.state !== "offline" && p.lastMessageAt !== null
      ? Math.floor((now.getTime() - p.lastMessageAt.getTime()) / 60000)
      : p.state !== "offline" && p.onlineSince !== null
      ? Math.floor((now.getTime() - p.onlineSince.getTime()) / 60000)
      : null;

  const entry: DashboardEntry = {
    agent,
    presence: {
      state: p.state,
      lastStateChange: p.lastStateChange.toISOString(),
      onlineDurationSeconds,
    },
    metrics: {
      messagesPerHour,
      idleMinutes,
      idleAlert: idleMinutes !== null && idleMinutes >= IDLE_ALERT_MINUTES,
    },
  };

  res.json(entry);
});

export default router;
