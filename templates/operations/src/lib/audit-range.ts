/** Audit uses immutable recorded time, with explicit UTC calendar-day boundaries. */
export function auditRange(from: string, to: string) {
 const day = (value: string) => {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value ? time : NaN;
 };
 const start=day(from), end=day(to);
 const valid=(start===undefined||Number.isFinite(start))&&(end===undefined||Number.isFinite(end))&&(start===undefined||end===undefined||start<=end);
 return {valid, includes(recordedAt: string) {
  const time=Date.parse(recordedAt);
  return valid&&Number.isFinite(time)&&(start===undefined||time>=start)&&(end===undefined||time<end+86400000);
 }};
}
