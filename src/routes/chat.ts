import { Router, Request, Response } from "express";
import { z } from "zod";
import { chatStore } from "../chatStore";
import { agentStore, presenceStore } from "../store";

const router = Router();

// POST /chat/sessions — customer starts a new chat
router.post("/sessions", (req: Request, res: Response) => {
  const { customerName } = z.object({ customerName: z.string().min(1) }).parse(req.body);
  const session = chatStore.createSession(customerName);

  // Auto-assign to longest-online agent
  const candidates = agentStore
    .getAll()
    .filter((a) => a.status === "active")
    .map((a) => ({ agent: a, presence: presenceStore.get(a.id) }))
    .filter((x) => x.presence?.state === "online" && x.presence.onlineSince !== null)
    .sort((a, b) => a.presence!.onlineSince!.getTime() - b.presence!.onlineSince!.getTime());

  if (candidates.length > 0) {
    const { agent } = candidates[0];
    chatStore.assign(session.id, agent.id, agent.name);
    // Tell WFM presence store this agent handled a message
    presenceStore.incrementMessages(agent.id);
  }

  res.status(201).json(chatStore.get(session.id));
});

// GET /chat/sessions — list all sessions (for agent console)
router.get("/sessions", (_req: Request, res: Response) => {
  res.json(chatStore.getAll());
});

// GET /chat/sessions/:id — single session with messages
router.get("/sessions/:id", (req: Request, res: Response) => {
  const s = chatStore.get(req.params["id"] as string);
  if (!s) return res.status(404).json({ error: "session not found" });
  res.json(s);
});

// POST /chat/sessions/:id/messages — send a message
router.post("/sessions/:id/messages", (req: Request, res: Response) => {
  const { from, senderName, text } = z
    .object({
      from: z.enum(["customer", "agent"]),
      senderName: z.string().min(1),
      text: z.string().min(1),
    })
    .parse(req.body);

  const msg = chatStore.addMessage(req.params["id"] as string, from, senderName, text);
  if (!msg) return res.status(404).json({ error: "session not found" });

  if (from === "agent") {
    presenceStore.incrementMessages(msg.sessionId.split("_")[0]);
  }

  res.status(201).json(msg);
});

// POST /chat/sessions/:id/close
router.post("/sessions/:id/close", (req: Request, res: Response) => {
  chatStore.close(req.params["id"] as string);
  res.json({ ok: true });
});

// GET /chat/agent/:agentId — sessions assigned to this agent
router.get("/agent/:agentId", (req: Request, res: Response) => {
  res.json(chatStore.getByAgent(req.params["agentId"] as string));
});

export default router;
