import { capabilities } from "../../src/domain/model.ts";
import { bool, fail, object, text } from "../../src/domain/validation.ts";
import { configFor, q } from "../db.ts";
import { equal, requireCapability, requireStaff } from "../security.ts";
import type { BookingRow, Env, Session, TicketRow } from "../types.ts";
import { now } from "../types.ts";
import { bookingAction, mapBooking, ticketPayload } from "./bookings.ts";
export async function validateTicket(env: Env, s: Session, input: unknown) {
  requireStaff(s);
  requireCapability(capabilities((await configFor(env, s)).level), "tickets");
  const raw = object(input),
    payload = text(raw.payload, "QR payload", 240, true),
    checkIn = raw.checkIn === undefined ? false : bool(raw.checkIn, "Check in");
  if (checkIn) requireStaff(s, true);
  const parts = payload.match(
    /^tampiloka-ticket:v1:(tk_[a-f0-9]{32}):([a-f0-9]{64})$/,
  );
  if (!parts)
    fail(
      422,
      "INVALID_TICKET",
      "This QR code is not a valid appointment ticket.",
    );
  const ticket = await q(
    env,
    "SELECT * FROM tickets WHERE id=? AND scope=?",
    parts[1],
    s.scope,
  ).first<TicketRow>();
  if (
    !ticket ||
    ticket.revoked ||
    !equal(await ticketPayload(env, s, ticket), payload)
  )
    fail(404, "INVALID_TICKET", "Ticket not found or revoked.");
  const row = await q(
    env,
    "SELECT * FROM bookings WHERE scope=? AND id=?",
    s.scope,
    ticket.booking_id,
  ).first<BookingRow>();
  if (
    !row ||
    !["confirmed", "checked_in"].includes(row.status) ||
    now(env) > row.ends_at + 86400000
  )
    fail(409, "INVALID_TICKET", "This appointment is not valid for check-in.");
  if (ticket.used_at || row.status === "checked_in")
    return {
      valid: false,
      alreadyCheckedIn: true,
      booking: mapBooking(row),
      usedAt: ticket.used_at,
    };
  if (checkIn)
    return {
      valid: true,
      checkedIn: true,
      booking: await bookingAction(
        env,
        s,
        row.id,
        { action: "checked_in", version: row.version },
        true,
      ),
    };
  return {
    valid: true,
    checkedIn: false,
    booking: mapBooking(row),
    canCheckIn:
      now(env) >=
      row.starts_at - JSON.parse(row.policy_json).checkInEarlyMinutes * 60000,
  };
}
