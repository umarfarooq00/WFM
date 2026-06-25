// In-memory chat session store

export interface ChatMessage {
  id: string;
  sessionId: string;
  from: "customer" | "agent";
  senderName: string;
  text: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  customerName: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  status: "waiting" | "active" | "closed";
  createdAt: Date;
  messages: ChatMessage[];
}

const sessions = new Map<string, ChatSession>();
let msgCounter = 0;

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const chatStore = {
  createSession(customerName: string): ChatSession {
    const session: ChatSession = {
      id: genId("sess"),
      customerName,
      assignedAgentId: null,
      assignedAgentName: null,
      status: "waiting",
      createdAt: new Date(),
      messages: [],
    };
    sessions.set(session.id, session);
    return session;
  },

  get(id: string): ChatSession | undefined {
    return sessions.get(id);
  },

  getAll(): ChatSession[] {
    return [...sessions.values()];
  },

  assign(sessionId: string, agentId: string, agentName: string): ChatSession | undefined {
    const s = sessions.get(sessionId);
    if (!s) return undefined;
    s.assignedAgentId = agentId;
    s.assignedAgentName = agentName;
    s.status = "active";
    return s;
  },

  addMessage(sessionId: string, from: "customer" | "agent", senderName: string, text: string): ChatMessage | undefined {
    const s = sessions.get(sessionId);
    if (!s) return undefined;
    const msg: ChatMessage = {
      id: `msg_${++msgCounter}`,
      sessionId,
      from,
      senderName,
      text,
      timestamp: new Date(),
    };
    s.messages.push(msg);
    return msg;
  },

  close(sessionId: string): void {
    const s = sessions.get(sessionId);
    if (s) s.status = "closed";
  },

  getByAgent(agentId: string): ChatSession[] {
    return [...sessions.values()].filter(
      (s) => s.assignedAgentId === agentId && s.status === "active"
    );
  },
};
