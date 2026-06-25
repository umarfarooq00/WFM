import request from "supertest";
import { createApp } from "../app";
import { presenceStore } from "../store";

const app = createApp();

describe("POST /webhooks/presence", () => {
  test("400 on invalid payload", async () => {
    const res = await request(app)
      .post("/webhooks/presence")
      .send({ agentId: "agt_101" }); // missing state and timestamp
    expect(res.status).toBe(400);
  });

  test("200 with warning for unknown agent", async () => {
    const res = await request(app).post("/webhooks/presence").send({
      agentId: "agt_999",
      state: "online",
      timestamp: "2026-06-25T09:00:00Z",
    });
    expect(res.status).toBe(200);
    expect(res.body.warning).toBeDefined();
  });

  test("stores presence state for known agent", async () => {
    const res = await request(app).post("/webhooks/presence").send({
      agentId: "agt_101",
      state: "online",
      timestamp: "2026-06-25T09:00:00Z",
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const p = presenceStore.get("agt_101");
    expect(p?.state).toBe("online");
    expect(p?.onlineSince).toEqual(new Date("2026-06-25T09:00:00Z"));
  });

  test("clears onlineSince when agent goes offline", async () => {
    // First bring online
    await request(app).post("/webhooks/presence").send({
      agentId: "agt_103",
      state: "online",
      timestamp: "2026-06-25T08:00:00Z",
    });

    // Then go offline
    await request(app).post("/webhooks/presence").send({
      agentId: "agt_103",
      state: "offline",
      timestamp: "2026-06-25T16:01:00Z",
    });

    const p = presenceStore.get("agt_103");
    expect(p?.state).toBe("offline");
    expect(p?.onlineSince).toBeNull();
  });

  test("discards stale out-of-order events", async () => {
    // Set state with a later timestamp first
    await request(app).post("/webhooks/presence").send({
      agentId: "agt_107",
      state: "online",
      timestamp: "2026-06-25T10:00:00Z",
    });

    // Send an earlier timestamp (out of order)
    const res = await request(app).post("/webhooks/presence").send({
      agentId: "agt_107",
      state: "offline",
      timestamp: "2026-06-25T07:00:00Z",
    });

    expect(res.status).toBe(200);
    expect(res.body.discarded).toBeDefined();

    // State should remain "online" from the later event
    const p = presenceStore.get("agt_107");
    expect(p?.state).toBe("online");
  });
});
