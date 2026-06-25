import { createApp } from "./app";
import { startScheduler } from "./scheduler";

const app = createApp();

// Vercel exports the app as a serverless function
// Local dev still listens on a port
if (process.env.VERCEL !== "1") {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => {
    console.log(`[wfm] listening on :${PORT}`);
    startScheduler();
  });
}

export default app;
