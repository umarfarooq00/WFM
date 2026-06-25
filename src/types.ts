export type Site = "manila" | "cebu" | "morocco" | "madagascar";
export type AgentStatus = "active" | "suspended";
export type PresenceState = "online" | "away" | "offline";

export interface Agent {
  id: string;
  name: string;
  site: Site;
  shift: string; // "HH:MM-HH:MM" in UTC
  payRate: number; // USD/hour
  status: AgentStatus;
}

// Mutable patch subset ChatApp is allowed to send
export type AgentPatch = Partial<Pick<Agent, "name" | "site" | "status" | "payRate">>;

// Live presence tracked by WFM from ChatApp webhooks
export interface AgentPresence {
  agentId: string;
  state: PresenceState;
  lastStateChange: Date;
  onlineSince: Date | null; // set when state first becomes "online", cleared on offline
  messagesHandled: number;
  lastMessageAt: Date | null;
}

// Payload from ChatApp → WFM webhook
export interface PresenceEvent {
  agentId: string;
  state: PresenceState;
  timestamp: string; // ISO 8601
}

// Payload for dashboard response per agent
export interface DashboardEntry {
  agent: Agent;
  presence: {
    state: PresenceState;
    lastStateChange: string;
    onlineDurationSeconds: number | null;
  };
  metrics: {
    messagesPerHour: number;
    idleMinutes: number | null; // null if currently offline
    idleAlert: boolean;
  };
}

// Internal log of scheduler actions (for audit / debugging)
export interface SchedulerAction {
  agentId: string;
  action: "activate" | "deactivate";
  at: Date;
  success: boolean;
  error?: string;
}
