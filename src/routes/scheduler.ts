import { Router, Request, Response } from "express";
import { schedulerLogStore } from "../store";

const router = Router();

router.get("/log", (req: Request, res: Response) => {
  const n = Math.min(parseInt((req.query["n"] as string) ?? "50", 10) || 50, 500);
  res.json(schedulerLogStore.recent(n));
});

export default router;
