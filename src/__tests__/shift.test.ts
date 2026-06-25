import { isWithinShift } from "../shift";
import { Agent } from "../types";

const base: Agent = {
  id: "agt_test",
  name: "Test",
  site: "manila",
  shift: "09:00-17:00",
  payRate: 4.5,
  status: "active",
};

function utcDate(h: number, m = 0): Date {
  const d = new Date("2026-06-25T00:00:00Z");
  d.setUTCHours(h, m, 0, 0);
  return d;
}

describe("isWithinShift — same-day shift 09:00–17:00", () => {
  const agent = { ...base, shift: "09:00-17:00" };

  test("exactly at shift start", () => {
    expect(isWithinShift(agent, utcDate(9, 0))).toBe(true);
  });

  test("mid-shift", () => {
    expect(isWithinShift(agent, utcDate(13, 30))).toBe(true);
  });

  test("one minute before end", () => {
    expect(isWithinShift(agent, utcDate(16, 59))).toBe(true);
  });

  test("exactly at shift end is NOT within shift", () => {
    expect(isWithinShift(agent, utcDate(17, 0))).toBe(false);
  });

  test("before shift", () => {
    expect(isWithinShift(agent, utcDate(8, 59))).toBe(false);
  });

  test("after shift", () => {
    expect(isWithinShift(agent, utcDate(20, 0))).toBe(false);
  });
});

describe("isWithinShift — overnight shift 22:00–06:00", () => {
  const agent = { ...base, shift: "22:00-06:00" };

  test("before midnight", () => {
    expect(isWithinShift(agent, utcDate(23, 0))).toBe(true);
  });

  test("after midnight", () => {
    expect(isWithinShift(agent, utcDate(3, 0))).toBe(true);
  });

  test("exactly at end is NOT within shift", () => {
    expect(isWithinShift(agent, utcDate(6, 0))).toBe(false);
  });

  test("mid-day is out of shift", () => {
    expect(isWithinShift(agent, utcDate(12, 0))).toBe(false);
  });
});
