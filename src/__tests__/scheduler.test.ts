import { runSchedulerTick } from "../scheduler";
import { presenceStore, schedulerLogStore } from "../store";
import * as chatapp from "../chatapp";

jest.mock("../chatapp");

const mockActivate = chatapp.activateAgent as jest.MockedFunction<typeof chatapp.activateAgent>;
const mockDeactivate = chatapp.deactivateAgent as jest.MockedFunction<typeof chatapp.deactivateAgent>;

beforeEach(() => {
  jest.clearAllMocks();
  mockActivate.mockResolvedValue(undefined);
  mockDeactivate.mockResolvedValue(undefined);
});

describe("runSchedulerTick", () => {
  test("activates an agent whose shift has started and is currently offline", async () => {
    // agt_101 has shift 09:00-17:00 UTC. Simulate 10:00 UTC.
    presenceStore.update("agt_101", { state: "offline", onlineSince: null });

    jest.useFakeTimers().setSystemTime(new Date("2026-06-25T10:00:00Z"));
    await runSchedulerTick();
    jest.useRealTimers();

    expect(mockActivate).toHaveBeenCalledWith("agt_101");
    expect(mockDeactivate).not.toHaveBeenCalledWith("agt_101");
  });

  test("deactivates an agent whose shift has ended and is currently online", async () => {
    // agt_101 has shift 09:00-17:00. Simulate 18:00 UTC.
    presenceStore.update("agt_101", {
      state: "online",
      onlineSince: new Date("2026-06-25T09:00:00Z"),
    });

    jest.useFakeTimers().setSystemTime(new Date("2026-06-25T18:00:00Z"));
    await runSchedulerTick();
    jest.useRealTimers();

    expect(mockDeactivate).toHaveBeenCalledWith("agt_101");
    expect(mockActivate).not.toHaveBeenCalledWith("agt_101");
  });

  test("does not call ChatApp when state already matches shift", async () => {
    // agt_101 at 10:00 UTC should be online — and already is
    presenceStore.update("agt_101", {
      state: "online",
      onlineSince: new Date("2026-06-25T09:00:00Z"),
    });

    jest.useFakeTimers().setSystemTime(new Date("2026-06-25T10:00:00Z"));
    await runSchedulerTick();
    jest.useRealTimers();

    expect(mockActivate).not.toHaveBeenCalledWith("agt_101");
    expect(mockDeactivate).not.toHaveBeenCalledWith("agt_101");
  });

  test("does not activate a suspended agent", async () => {
    // agt_106 is suspended (status: "suspended")
    presenceStore.update("agt_106", { state: "offline", onlineSince: null });

    jest.useFakeTimers().setSystemTime(new Date("2026-06-25T13:00:00Z")); // within 12:00-20:00 shift
    await runSchedulerTick();
    jest.useRealTimers();

    expect(mockActivate).not.toHaveBeenCalledWith("agt_106");
  });

  test("logs a failed ChatApp call", async () => {
    presenceStore.update("agt_101", { state: "offline", onlineSince: null });
    mockActivate.mockRejectedValueOnce(new Error("ChatApp unreachable"));

    jest.useFakeTimers().setSystemTime(new Date("2026-06-25T10:00:00Z"));
    await runSchedulerTick();
    jest.useRealTimers();

    const log = schedulerLogStore.recent(10);
    const entry = log.find((e) => e.agentId === "agt_101" && e.action === "activate");
    expect(entry?.success).toBe(false);
    expect(entry?.error).toMatch(/unreachable/);
  });
});
