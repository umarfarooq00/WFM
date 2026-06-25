/**
 * Thin client for ChatApp's control API.
 * Base URL is injected via env so it can point at a mock in tests.
 */

const CHATAPP_BASE = process.env.CHATAPP_BASE_URL ?? "http://localhost:4000";

async function post(path: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${CHATAPP_BASE}${path}`, { method: "POST" });
  return { ok: res.ok, status: res.status };
}

export async function activateAgent(agentId: string): Promise<void> {
  const { ok, status } = await post(`/agents/${agentId}/activate`);
  if (!ok) throw new Error(`ChatApp activate failed for ${agentId}: HTTP ${status}`);
}

export async function deactivateAgent(agentId: string): Promise<void> {
  const { ok, status } = await post(`/agents/${agentId}/deactivate`);
  if (!ok) throw new Error(`ChatApp deactivate failed for ${agentId}: HTTP ${status}`);
}
