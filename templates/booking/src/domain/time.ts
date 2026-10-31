import type { AvailabilityRule } from "./model.ts";
import { dateOnly, fail, integer, object } from "./validation.ts";
export const TICK = 5 * 60_000;
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string) {
  if (!formatters.has(zone))
    formatters.set(
      zone,
      new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZoneName: "shortOffset",
      }),
    );
  return formatters.get(zone)!;
}
export function localTime(ms: number, zone: string) {
  const p = Object.fromEntries(
    formatter(zone)
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  const date = `${p.year}-${p.month}-${p.day}`;
  return {
    date,
    minute: Number(p.hour) * 60 + Number(p.minute),
    weekday: new Date(`${date}T12:00:00Z`).getUTCDay(),
    label: `${p.hour}:${p.minute}`,
    offset: p.timeZoneName,
  };
}
export function utcCandidates(
  date: string,
  zone: string,
  interval = 15,
): number[] {
  dateOnly(date);
  const midnight = Date.parse(`${date}T00:00:00Z`),
    out: number[] = [];
  // Enumerating UTC instants preserves both repeated DST hours and skips nonexistent times.
  for (
    let ms = midnight - 14 * 3600000;
    ms < midnight + 38 * 3600000;
    ms += TICK
  ) {
    const local = localTime(ms, zone);
    if (local.date === date && local.minute % interval === 0) out.push(ms);
  }
  return out;
}
export function scheduleContains(
  schedule: AvailabilityRule[],
  start: number,
  end: number,
  zone: string,
) {
  for (let t = start; t < end; t += TICK) {
    const p = localTime(t, zone);
    if (
      !schedule.some(
        (r) =>
          r.weekday === p.weekday &&
          p.minute >= r.start &&
          p.minute + 5 <= r.end,
      )
    )
      return false;
  }
  return true;
}
export function validateSchedule(value: unknown): AvailabilityRule[] {
  if (!Array.isArray(value) || value.length > 28)
    fail(
      422,
      "INVALID_SCHEDULE",
      "Use at most four working intervals per day.",
    );
  const rows = value.map((v) => {
    const r = object(v);
    return {
      weekday: integer(r.weekday, "Weekday", 0, 6),
      start: integer(r.start, "Start minute", 0, 1435),
      end: integer(r.end, "End minute", 5, 1440),
    };
  });
  for (const [i, r] of rows.entries())
    if (
      r.start >= r.end ||
      r.start % 5 ||
      r.end % 5 ||
      rows.some(
        (x, j) =>
          j !== i &&
          x.weekday === r.weekday &&
          x.start < r.end &&
          x.end > r.start,
      )
    )
      fail(
        422,
        "INVALID_SCHEDULE",
        "Working intervals must not overlap and must use five-minute increments.",
      );
  return rows;
}
export const weekSchedule = (
  start = 9 * 60,
  end = 17 * 60,
): AvailabilityRule[] =>
  [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start, end }));
