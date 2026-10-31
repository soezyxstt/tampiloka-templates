/** No framework dependency: the same validators run in API handlers, tests and extensions. */
export class DomainError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.code = code;
  }
}
export function fail(status: number, code: string, message: string): never {
  throw new DomainError(status, code, message);
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(422, "INVALID_INPUT", "Expected an object.");
  return value as Record<string, unknown>;
}
export function text(
  value: unknown,
  label: string,
  max = 200,
  required = false,
): string {
  if (value === undefined || value === null) {
    if (required) fail(422, "REQUIRED", `${label} is required.`);
    return "";
  }
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail(422, "INVALID_INPUT", `${label} is invalid.`);
  const result = value.trim();
  if (required && !result) fail(422, "REQUIRED", `${label} is required.`);
  return result;
}
export function integer(
  value: unknown,
  label: string,
  min = 0,
  max = 100_000_000,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    fail(
      422,
      "INVALID_INPUT",
      `${label} must be a whole number between ${min} and ${max}.`,
    );
  return value;
}
export function choice<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T))
    fail(422, "INVALID_CHOICE", `${label} is not supported.`);
  return value as T;
}
export function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean")
    fail(422, "INVALID_INPUT", `${label} must be true or false.`);
  return value;
}
export function id(value: unknown, label = "ID"): string {
  const result = text(value, label, 100, true);
  if (!/^[a-zA-Z0-9_-]+$/.test(result))
    fail(422, "INVALID_INPUT", `${label} is invalid.`);
  return result;
}
export function localized(value: unknown, label: string, max = 3000) {
  const v = object(value);
  return {
    id: text(v.id, `${label} (ID)`, max, true),
    en: text(v.en, `${label} (EN)`, max, true),
  };
}
export function timezone(value: unknown): string {
  const result = text(value, "Timezone", 80, true);
  try {
    new Intl.DateTimeFormat("en", { timeZone: result }).format();
  } catch {
    fail(422, "INVALID_TIMEZONE", "Use an IANA timezone such as Asia/Jakarta.");
  }
  return result;
}
export function imageUrl(value: unknown): string {
  const result = text(value, "Image", 1000);
  if (!result) return "";
  if (/^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(result) && !result.includes(".."))
    return result;
  try {
    const url = new URL(result);
    if (url.protocol === "https:" && !url.username && !url.password)
      return url.href;
  } catch {
    /* reject below */
  }
  return fail(
    422,
    "INVALID_IMAGE",
    "Use a local image path or HTTPS URL without credentials.",
  );
}
export function timestamp(value: unknown): number {
  return integer(value, "Timestamp", 0, 8_640_000_000_000_000);
}
export function minutes(
  value: unknown,
  label: string,
  min = 0,
  max = 480,
): number {
  const n = integer(value, label, min, max);
  if (n % 5)
    fail(422, "INVALID_DURATION", `${label} must use five-minute increments.`);
  return n;
}
export function dateOnly(value: unknown): string {
  const s = text(value, "Date", 10, true);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(`${s}T00:00:00Z`)) ||
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s
  )
    fail(422, "INVALID_DATE", "Use a valid YYYY-MM-DD date.");
  return s;
}
export function customer(value: unknown) {
  const v = object(value),
    name = text(v.name, "Name", 100, true),
    phone = text(v.phone, "Phone", 25, true).replace(/[\s()-]/g, ""),
    email = text(v.email, "Email", 150).toLowerCase();
  if (!/^\+?\d{8,16}$/.test(phone))
    fail(422, "INVALID_PHONE", "Enter a valid phone number.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(422, "INVALID_EMAIL", "Enter a valid email address.");
  return { name, phone, email };
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
