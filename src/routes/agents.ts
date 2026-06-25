import { Router, Request, Response } from "express";
import { z } from "zod";
import { agentStore } from "../store";
import { AgentPatch } from "../types";

const router = Router();

const AgentPatchSchema = z.object({
  name: z.string().min(1).optional(),
  site: z.enum(["manila", "cebu", "morocco", "madagascar"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  payRate: z.number().positive().optional(),
});

// GET /agents — list all agents
router.get("/", (_req: Request, res: Response) => {
  res.json(agentStore.getAll());
});

// GET /agents/:id
router.get("/:id", (req: Request, res: Response) => {
  const agent = agentStore.get(req.params["id"] as string);
  if (!agent) return res.status(404).json({ error: "agent not found" });
  res.json(agent);
});

// PATCH /agents/:id — ChatApp keeps agent record in sync (req #6)
router.patch("/:id", (req: Request, res: Response) => {
  const parsed = AgentPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload", detail: parsed.error.format() });
  }

  const updated = agentStore.patch(req.params["id"] as string, parsed.data as AgentPatch);
  if (!updated) return res.status(404).json({ error: "agent not found" });

  res.json(updated);
});

export default router;
