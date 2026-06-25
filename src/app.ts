import express from "express";
import path from "path";
import agentsRouter from "./routes/agents";
import webhooksRouter from "./routes/webhooks";
import dashboardRouter from "./routes/dashboard";
import assignmentRouter from "./routes/assignment";
import schedulerRouter from "./routes/scheduler";
import chatRouter from "./routes/chat";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use("/agents", agentsRouter);
  app.use("/webhooks", webhooksRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/assignment", assignmentRouter);
  app.use("/scheduler", schedulerRouter);
  app.use("/chat", chatRouter);

  // __dirname is src/ locally and /var/task/src on Vercel
  app.use(express.static(path.join(__dirname, "../public")));
  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  return app;
}
