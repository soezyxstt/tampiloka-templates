import {
  LAYOUTS,
  LEVELS,
  PALETTES,
  PRESETS,
  type Layout,
  type Level,
  type Palette,
  type Preset,
  type Language,
  type Role,
} from "../domain/model.ts";
export type Page =
  | "home"
  | "services"
  | "professionals"
  | "about"
  | "book"
  | "appointments"
  | "calendar"
  | "bookings"
  | "content"
  | "resources"
  | "locations"
  | "settings"
  | "payments"
  | "tickets";
export interface RouteState {
  preset: Preset;
  level: Level;
  layout: Layout;
  palette: Palette;
  view: "customer" | "staff";
  lang: Language;
  page: Page;
  role: Exclude<Role, "customer">;
  service: string;
  practitioner: string;
  booking: string;
  channel: "booking" | "whatsapp";
}
export const pages: Page[] = [
  "home",
  "services",
  "professionals",
  "about",
  "book",
  "appointments",
  "calendar",
  "bookings",
  "content",
  "resources",
  "locations",
  "settings",
  "payments",
  "tickets",
];
const pick = <T extends string>(
  x: string | null,
  values: readonly T[],
  fallback: T,
): T => (values.includes(x as T) ? (x as T) : fallback);
export function readRoute(url: URL, preferredLanguage = "id"): RouteState {
  const p = url.searchParams,
    view = pick(p.get("view"), ["customer", "staff"] as const, "customer");
  return {
    preset: pick(p.get("preset"), PRESETS, "medical"),
    level: pick(p.get("level"), LEVELS, "full"),
    layout: pick(p.get("layout"), LAYOUTS, "appointment-first"),
    palette: pick(p.get("palette") || p.get("theme"), PALETTES, "sage"),
    view,
    lang: pick(
      p.get("lang"),
      ["id", "en"] as const,
      preferredLanguage === "id" ? "id" : "en",
    ),
    page: pick(p.get("page"), pages, view === "staff" ? "calendar" : "home"),
    role: pick(
      p.get("role"),
      ["owner", "operations", "viewer"] as const,
      "owner",
    ),
    channel: pick(
      p.get("channel"),
      ["booking", "whatsapp"] as const,
      "booking",
    ),
    service: p.get("service") || "",
    practitioner: p.get("practitioner") || "",
    booking: p.get("booking") || "",
  };
}
export function routeUrl(
  current: URL,
  state: RouteState,
  publicDemo = true,
): string {
  const url = new URL(current);
  for (const [key, value] of Object.entries(state)) {
    if (
      !publicDemo &&
      ["preset", "level", "layout", "palette", "role"].includes(key)
    ) {
      url.searchParams.delete(key);
      continue;
    }
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  url.searchParams.delete("theme");
  return url.pathname + url.search + url.hash;
}
