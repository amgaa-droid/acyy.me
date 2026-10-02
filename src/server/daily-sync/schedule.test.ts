import { describe, expect, it } from "vitest";

import { autoSyncDecision, todayAt, type AutoSyncRun } from "./schedule";

// Mongolia is UTC+8: 20:00 there = 12:00 UTC.
const at = (mn: string) => new Date(`${mn}+08:00`);
const run = (mn: string, trigger: AutoSyncRun["trigger"], saved = 36): AutoSyncRun => ({
  at: at(mn),
  trigger,
  saved,
  total: 36,
});

describe("auto sync schedule", () => {
  it("finds today's start time in Mongolia, across the UTC day line", () => {
    expect(todayAt("20:00", at("2026-10-03T20:05:00")).toISOString()).toBe(
      "2026-10-03T12:00:00.000Z",
    );
    // 02:00 in Mongolia is still the previous day in UTC.
    expect(todayAt("01:30", at("2026-10-03T02:00:00")).toISOString()).toBe(
      "2026-10-02T17:30:00.000Z",
    );
  });

  it("waits for the time, then runs once", () => {
    const time = "20:00";
    expect(autoSyncDecision({ now: at("2026-10-03T19:59:00"), time, runs: [] })).toBe(
      "before_time",
    );
    expect(autoSyncDecision({ now: at("2026-10-03T20:00:00"), time, runs: [] })).toBe("due");
    expect(
      autoSyncDecision({
        now: at("2026-10-03T20:05:00"),
        time,
        runs: [run("2026-10-03T20:00:30", "cron")],
      }),
    ).toBe("done");
  });

  it("a complete manual sync after the time counts; one before it doesn't", () => {
    const now = at("2026-10-03T20:10:00");
    expect(
      autoSyncDecision({ now, time: "20:00", runs: [run("2026-10-03T20:01:00", "manual")] }),
    ).toBe("done");
    expect(
      autoSyncDecision({ now, time: "20:00", runs: [run("2026-10-03T15:00:00", "manual")] }),
    ).toBe("due");
  });

  it("retries a partial run an hour later, at most 3 runs a day", () => {
    const time = "20:00";
    const partial = [run("2026-10-03T20:00:00", "cron", 24)];
    expect(autoSyncDecision({ now: at("2026-10-03T20:30:00"), time, runs: partial })).toBe(
      "retry_later",
    );
    expect(autoSyncDecision({ now: at("2026-10-03T21:00:00"), time, runs: partial })).toBe("due");
    const three = [
      run("2026-10-03T20:00:00", "cron", 0),
      run("2026-10-03T21:00:00", "cron", 0),
      run("2026-10-03T22:00:00", "cron", 12),
    ];
    expect(autoSyncDecision({ now: at("2026-10-03T23:30:00"), time, runs: three })).toBe(
      "max_runs",
    );
  });
});
