import { createApp } from "./app";
import { startScheduler } from "./scheduler";

const PORT = process.env.PORT ?? 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[wfm] listening on :${PORT}`);
  startScheduler();
});
