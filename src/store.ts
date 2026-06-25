import { Agent, AgentPresence, SchedulerAction } from "./types";
import agentsJson from "../data/agents.json";

// In-memory store — replace backing with Postgres in production

const agents = new Map<string, Agent>(
  (agentsJson as Agent[]).map((a) => [a.id, { ...a }])
);

const presence = new Map<string, AgentPresence>(
  (agentsJson as Agent[]).map((a) => [
    a.id,
    {
      agentId: a.id,
      state: "offline",
      lastStateChange: new Date(0), // epoch so any real event supersedes it
      onlineSince: null,
      messagesHandled: 0,
      lastMessageAt: null,
    },
  ])
);

const schedulerLog: SchedulerAction[] = [];

export const agentStore = {
  getAll(): Agent[] {
    return [...agents.values()];
  },

  get(id: string): Agent | undefined {
    return agents.get(id);
  },

  upsert(agent: Agent): void {
    agents.set(agent.id, agent);
    if (!presence.has(agent.id)) {
      presence.set(agent.id, {
        agentId: agent.id,
        state: "offline",
        lastStateChange: new Date(0),
        onlineSince: null,
        messagesHandled: 0,
        lastMessageAt: null,
      });
    }
  },

  patch(id: string, patch: Partial<Agent>): Agent | undefined {
    const existing = agents.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    agents.set(id, updated);
    return updated;
  },
};

export const presenceStore = {
  get(agentId: string): AgentPresence | undefined {
    return presence.get(agentId);
  },

  getAll(): AgentPresence[] {
    return [...presence.values()];
  },

  update(agentId: string, update: Partial<AgentPresence>): AgentPresence | undefined {
    const existing = presence.get(agentId);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    presence.set(agentId, updated);
    return updated;
  },

  incrementMessages(agentId: string): void {
    const p = presence.get(agentId);
    if (!p) return;
    presence.set(agentId, {
      ...p,
      messagesHandled: p.messagesHandled + 1,
      lastMessageAt: new Date(),
    });
  },
};

export const schedulerLogStore = {
  append(entry: SchedulerAction): void {
    schedulerLog.push(entry);
    // keep last 1000 entries in memory
    if (schedulerLog.length > 1000) schedulerLog.splice(0, schedulerLog.length - 1000);
  },

  recent(n = 50): SchedulerAction[] {
    return schedulerLog.slice(-n);
  },
};
