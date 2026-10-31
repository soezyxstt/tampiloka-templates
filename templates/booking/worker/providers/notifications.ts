import { all, q } from "../db.ts";
import { now, type BookingRow, type Env } from "../types.ts";

export interface NotificationMessage {
  key: string;
  to: string;
  subject: string;
  text: string;
}
export interface NotificationChannel {
  send(message: NotificationMessage): Promise<"accepted">;
}
/** An accepted provider request is not a claim of delivery. Add SMS/WhatsApp adapters here. */
export function emailChannel(env: Env): NotificationChannel | null {
  if (!env.NOTIFICATION_API_KEY || !env.NOTIFICATION_FROM) return null;
  return {
    async send(message) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.NOTIFICATION_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.key,
        },
        body: JSON.stringify({
          from: env.NOTIFICATION_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error("Notification provider did not accept the request");
      return "accepted";
    },
  };
}
export async function deliverNotifications(
  env: Env,
  channel = emailChannel(env),
) {
  if (!channel) return; // Keep queued: no delivery claim and no discarded message.
  const jobs = await all<{
    id: string;
    scope: string;
    booking_id: string;
    event: string;
    attempts: number;
  }>(
    env,
    "SELECT n.* FROM notification_jobs n JOIN scopes s ON s.id=n.scope WHERE s.demo=0 AND n.status IN('queued','retry','sending') AND n.attempts<5 AND n.next_at<=? ORDER BY n.next_at LIMIT 20",
    now(env),
  );
  for (const job of jobs) {
    const lease = await q(
      env,
      "UPDATE notification_jobs SET status='sending',attempts=attempts+1,next_at=? WHERE id=? AND next_at<=? AND attempts=?",
      now(env) + 60000,
      job.id,
      now(env),
      job.attempts,
    ).run();
    if (!lease.meta?.changes) continue;
    const booking = await q(
      env,
      "SELECT * FROM bookings WHERE scope=? AND id=?",
      job.scope,
      job.booking_id,
    ).first<BookingRow>();
    const customer = booking ? JSON.parse(booking.customer_json) : null;
    if (!booking || !customer?.email) {
      await q(
        env,
        "UPDATE notification_jobs SET status='skipped' WHERE id=?",
        job.id,
      ).run();
      continue;
    }
    try {
      await channel.send({
        key: job.id,
        to: customer.email,
        subject: `Appointment ${booking.reference}: ${job.event.replaceAll("_", " ")}`,
        text: `Reference: ${booking.reference}\nStatus: ${booking.status}\nAppointment: ${new Date(booking.starts_at).toISOString()} (UTC)\nPayment status: ${booking.payment_status}\nUse your saved access key to view your appointment. This message contains no clinical information.`,
      });
      await q(
        env,
        "UPDATE notification_jobs SET status='accepted' WHERE id=?",
        job.id,
      ).run();
    } catch {
      await q(
        env,
        "UPDATE notification_jobs SET status='retry',next_at=? WHERE id=?",
        now(env) + 2 ** job.attempts * 60000,
        job.id,
      ).run();
    }
  }
}
