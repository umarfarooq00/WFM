import { Agent } from "./types";

/**
 * Parse a shift string like "09:00-17:00" or "22:00-06:00" (overnight).
 * All times are treated as UTC.
 * Returns whether the given UTC date falls within the shift window.
 */
export function isWithinShift(agent: Agent, now: Date): boolean {
  const [startStr, endStr] = agent.shift.split("-");
  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (startMinutes < endMinutes) {
    // same-day shift e.g. 09:00–17:00
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  } else {
    // overnight shift e.g. 22:00–06:00
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}
