import type { BookingStatus } from "./model.ts";
import { fail } from "./validation.ts";
export const transitions: Record<BookingStatus, readonly BookingStatus[]> = {
  requested: [
    "pending_confirmation",
    "awaiting_payment",
    "confirmed",
    "cancelled",
    "expired",
  ],
  pending_confirmation: [
    "awaiting_payment",
    "confirmed",
    "cancelled",
    "expired",
  ],
  awaiting_payment: ["confirmed", "cancelled", "expired"],
  confirmed: ["pending_confirmation", "checked_in", "cancelled", "no_show"],
  checked_in: ["completed"],
  completed: [],
  cancelled: [],
  expired: [],
  no_show: [],
};
export function assertTransition(from: BookingStatus, to: BookingStatus) {
  if (from !== to && !transitions[from]?.includes(to))
    fail(409, "INVALID_TRANSITION", `Cannot change ${from} to ${to}.`);
}
export const terminal = (s: BookingStatus) =>
  ["cancelled", "expired", "completed", "no_show"].includes(s);
export const reschedulable = (s: BookingStatus) =>
  ["pending_confirmation", "awaiting_payment", "confirmed"].includes(s);
