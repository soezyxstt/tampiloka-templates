import { adapters } from "../domain/adapters";
import { eventLabels } from "../lib/labels";
import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Clock3,
  Copy,
  MapPin,
  Printer,
  RefreshCw,
  Ticket,
} from "lucide-react";
import type { Booking, Slot } from "../domain/model";
import { reschedulable } from "../domain/state";
import { localTime } from "../domain/time";
import { api } from "../lib/api";
import { useBooking } from "../lib/store";
import {
  Action,
  Dialog,
  ErrorNote,
  Field,
  Input,
  Loading,
  Status,
  Textarea,
  dateTime,
  money,
} from "./ui";
import { TicketQR } from "./QRCode";
interface Receipt {
  reference: string;
  total: number;
  received: number;
  refunded: number;
  balance: number;
  demo: boolean;
}
export function BookingDetail({
  staff = false,
  onChanged,
}: {
  staff?: boolean;
  onChanged?: () => void;
}) {
  const { data, route, navigate, t, notify, refresh } = useBooking(),
    [booking, setBooking] = useState<Booking | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [cancel, setCancel] = useState(false),
    [reschedule, setReschedule] = useState(false),
    [note, setNote] = useState(""),
    [receipt, setReceipt] = useState<Receipt | null>(null);
  const [date, setDate] = useState(""),
    [times, setTimes] = useState<Slot[]>([]),
    [startsAt, setStartsAt] = useState(0),
    [timesLoading, setTimesLoading] = useState(false),
    [reference, setReference] = useState("");
  const key = route.booking,
    base = `/api/${staff ? "staff/" : ""}bookings/${key}`,
    canWrite = staff && data!.role !== "viewer";
  useEffect(() => {
    setBooking(null);
    setError(null);
    setCancel(false);
    setReschedule(false);
    setReceipt(null);
    setNote("");
    if (!key) return;
    const controller = new AbortController();
    api<Booking>(base, "GET", undefined, controller.signal)
      .then(setBooking)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => controller.abort();
  }, [key, staff, data?.config.level]);
  useEffect(() => {
    if (!reschedule || !booking || !date) return;
    const controller = new AbortController();
    setTimesLoading(true);
    setStartsAt(0);
    api<{ slots: Slot[] }>(
      base + "/availability",
      "POST",
      {
        date,
      },
      controller.signal,
    )
      .then((r) => setTimes(r.slots))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTimesLoading(false);
      });
    return () => controller.abort();
  }, [reschedule, date, booking?.id, base]);
  async function run(path: string, payload: unknown) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Booking>(base + path, "POST", payload);
      setBooking(updated);
      setCancel(false);
      setReschedule(false);
      setNote("");
      setReceipt(null);
      notify(t("Janji diperbarui.", "Appointment updated."));
      onChanged?.();
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const act = (action: string, extra: Record<string, unknown> = {}) =>
    void run("/actions", { action, version: booking?.version, ...extra });
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify(t("Disalin.", "Copied."));
    } catch (e) {
      setError(e);
    }
  }
  let access = "";
  try {
    access = sessionStorage.getItem(`tl-booking-access-${key}`) || "";
  } catch {}
  return (
    <Dialog
      open={Boolean(key)}
      onOpenChange={(open) => {
        if (!open) navigate({ booking: "" });
      }}
      title={booking?.reference || t("Detail janji", "Appointment details")}
      description={t(
        "Status ini berasal dari catatan server.",
        "This status comes from the server record.",
      )}
      className="b-detail-dialog"
    >
      <ErrorNote error={error} />
      {!booking && !error ? (
        <Loading />
      ) : (
        booking && (
          <div className="b-booking-detail">
            <div className="b-detail-status">
              <Status value={booking.status} />
              {data!.capabilities.payments && (
                <Status value={booking.paymentStatus} />
              )}
              <Action
                variant="ghost"
                size="sm"
                aria-label={t("Muat ulang detail", "Refresh details")}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void api<Booking>(base)
                    .then(setBooking)
                    .catch(setError)
                    .finally(() => setBusy(false));
                }}
              >
                <RefreshCw size={16} />
                {t("Perbarui", "Refresh")}
              </Action>
            </div>
            <h2>{booking.item.name[route.lang]}</h2>
            <div className="b-detail-facts">
              <p>
                <CalendarDays size={18} />
                {dateTime(booking.startsAt, booking.timezone, route.lang)}
              </p>
              <p>
                <Clock3 size={18} />
                {booking.item.duration} {t("menit", "min")} · {booking.timezone}
              </p>
              <p>
                <MapPin size={18} />
                {booking.locationName}
              </p>
              {booking.practitionerName && <p>{booking.practitionerName}</p>}
            </div>
            <dl className="b-detail-totals">
              <div>
                <dt>{t("Nama", "Name")}</dt>
                <dd>{booking.customer.name}</dd>
              </div>
              <div>
                <dt>{t("Telepon", "Phone")}</dt>
                <dd>{booking.customer.phone}</dd>
              </div>
              {Object.entries(booking.options)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>
                      {adapters[booking.preset].fields.find((f) => f.key === k)
                        ?.label[route.lang] || k}
                    </dt>
                    <dd>
                      {adapters[booking.preset].fields
                        .find((f) => f.key === k)
                        ?.options?.find((o) => o.value === v)?.label[
                        route.lang
                      ] || v}
                    </dd>
                  </div>
                ))}
              <div>
                <dt>{t("Total layanan", "Service total")}</dt>
                <dd>{money(booking.total, route.lang)}</dd>
              </div>
              {data!.capabilities.payments && (
                <>
                  <div>
                    <dt>{t("Diterima", "Received")}</dt>
                    <dd>{money(booking.paidAmount, route.lang)}</dd>
                  </div>
                  <div>
                    <dt>{t("Sisa pembayaran", "Remaining payment")}</dt>
                    <dd>
                      {money(
                        Math.max(0, booking.total - booking.paidAmount),
                        route.lang,
                      )}
                    </dd>
                  </div>
                  {booking.refundedAmount > 0 && (
                    <div>
                      <dt>{t("Dana kembali", "Refunded")}</dt>
                      <dd>{money(booking.refundedAmount, route.lang)}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {booking.expiresAt && (
              <p className="b-callout">
                {t("Reservasi waktu berakhir pada", "Reservation expires at")}{" "}
                {dateTime(booking.expiresAt, booking.timezone, route.lang)}.
              </p>
            )}
            {booking.status === "pending_confirmation" && (
              <p className="b-callout">
                {t(
                  "Permintaan tersimpan. Tunggu staf mengonfirmasi sebelum datang atau membayar.",
                  "Your request is saved. Wait for staff confirmation before visiting or paying.",
                )}
              </p>
            )}
            {data!.capabilities.payments &&
              booking.status === "awaiting_payment" &&
              !staff && (
                <section className="b-payment-panel">
                  <h3>{t("Selesaikan pembayaran", "Complete payment")}</h3>
                  <p>
                    {t("Jumlah yang perlu dibayar", "Amount due")}{" "}
                    <strong>
                      {money(booking.dueNow - booking.paidAmount, route.lang)}
                    </strong>
                  </p>
                  {data!.demo ? (
                    <>
                      <p>
                        {t(
                          "Pembayaran berikut hanya simulasi, tanpa uang nyata.",
                          "These payments are simulated. No real money moves.",
                        )}
                      </p>
                      <div className="b-actions">
                        <Action
                          busy={busy}
                          onClick={() =>
                            void run("/simulate", { status: "paid" })
                          }
                        >
                          {t("Simulasikan berhasil", "Simulate success")}
                        </Action>
                        <Action
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void run("/simulate", { status: "failed" })
                          }
                        >
                          {t("Simulasikan gagal", "Simulate failure")}
                        </Action>
                      </div>
                    </>
                  ) : (
                    <div className="b-actions">
                      {booking.payments.find((p) => p.checkoutUrl)
                        ?.checkoutUrl ? (
                        <a
                          className="b-link-button"
                          href={
                            booking.payments.find((p) => p.checkoutUrl)!
                              .checkoutUrl!
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t("Lanjut ke Midtrans", "Continue to Midtrans")}
                        </a>
                      ) : (
                        <Action
                          busy={busy}
                          onClick={() => void run("/payment", {})}
                        >
                          {t("Siapkan pembayaran", "Prepare payment")}
                        </Action>
                      )}
                      <Action
                        variant="outline"
                        disabled={busy}
                        onClick={() => void run("/reconcile", {})}
                      >
                        {t("Periksa status pembayaran", "Check payment status")}
                      </Action>
                    </div>
                  )}
                </section>
              )}
            {booking.ticket && (
              <section className="b-ticket">
                <div>
                  <Ticket size={22} />
                  <h3>{t("Tiket janji Anda", "Your appointment ticket")}</h3>
                </div>
                <TicketQR payload={booking.ticket.payload} />
                <p>
                  {t(
                    "Tunjukkan kode ini kepada staf saat datang. Staf memeriksa keabsahannya pada server.",
                    "Show this code on arrival. Staff validates it against the server.",
                  )}
                </p>
                {booking.ticket.usedAt && <Status value="checked_in" />}
                <Action
                  variant="outline"
                  onClick={() => void copy(booking.ticket!.payload)}
                >
                  <Copy size={16} />
                  {t("Salin kode tiket", "Copy ticket code")}
                </Action>
              </section>
            )}
            {!staff && access && (
              <details className="b-access">
                <summary>
                  {t(
                    "Simpan akses untuk perangkat lain",
                    "Save access for another device",
                  )}
                </summary>
                <p>
                  {t(
                    "Simpan nomor referensi dan kunci ini. Siapa pun yang memiliki keduanya dapat melihat dan mengelola janji ini.",
                    "Save the reference and this key. Anyone with both can view and manage this appointment.",
                  )}
                </p>
                <Input
                  readOnly
                  aria-label={t("Kunci akses janji", "Appointment access key")}
                  value={access}
                />
                <Action
                  variant="outline"
                  onClick={() => void copy(`${booking.reference}\n${access}`)}
                >
                  {t("Salin referensi dan kunci", "Copy reference and key")}
                </Action>
              </details>
            )}
            <div className="b-actions b-detail-actions">
              {(!staff || canWrite) && reschedulable(booking.status) && (
                <>
                  <Action
                    variant="outline"
                    onClick={() => {
                      setReschedule(!reschedule);
                      setCancel(false);
                      setDate(
                        localTime(booking.startsAt, booking.timezone).date,
                      );
                    }}
                  >
                    {t("Jadwalkan ulang", "Reschedule")}
                  </Action>
                  <Action
                    variant="ghost"
                    onClick={() => {
                      setCancel(!cancel);
                      setReschedule(false);
                    }}
                  >
                    {t("Batalkan janji", "Cancel appointment")}
                  </Action>
                </>
              )}
              {canWrite &&
                ["requested", "pending_confirmation"].includes(
                  booking.status,
                ) && (
                  <Action busy={busy} onClick={() => act("confirm")}>
                    {t("Konfirmasi janji", "Confirm appointment")}
                  </Action>
                )}
              {canWrite && booking.status === "confirmed" && (
                <>
                  <Action busy={busy} onClick={() => act("checked_in")}>
                    {t("Catat kehadiran", "Check in")}
                  </Action>
                  {Date.now() >= booking.endsAt && (
                    <Action variant="outline" onClick={() => act("no_show")}>
                      {t("Tandai tidak hadir", "Mark no-show")}
                    </Action>
                  )}
                </>
              )}
              {canWrite && booking.status === "checked_in" && (
                <Action busy={busy} onClick={() => act("completed")}>
                  {t("Selesaikan janji", "Complete appointment")}
                </Action>
              )}
              {data!.capabilities.payments && booking.paidAmount > 0 && (
                <Action
                  variant="outline"
                  busy={busy}
                  onClick={() => {
                    setBusy(true);
                    void api<Receipt>(base + "/receipt")
                      .then(setReceipt)
                      .catch(setError)
                      .finally(() => setBusy(false));
                  }}
                >
                  <Printer size={16} />
                  {t("Bukti pembayaran", "Receipt")}
                </Action>
              )}
              {staff &&
                canWrite &&
                data!.capabilities.payments &&
                booking.paymentMethod === "online" &&
                !data!.demo && (
                  <Action
                    variant="outline"
                    onClick={() => void run("/reconcile", {})}
                  >
                    {t("Cocokkan pembayaran", "Reconcile payment")}
                  </Action>
                )}
            </div>
            {cancel && (
              <form
                className="b-callout b-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  act("cancel", { note });
                }}
              >
                <h3>{t("Batalkan janji ini?", "Cancel this appointment?")}</h3>
                <p>
                  {t(
                    "Pembatalan melepas jadwal. Dana yang sudah dibayar mengikuti kebijakan dan proses pengembalian.",
                    "Cancellation releases the time. Paid funds follow the refund policy and process.",
                  )}
                </p>
                <Field label={t("Alasan (opsional)", "Reason (optional)")}>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                  />
                </Field>
                <Action type="submit" variant="danger" busy={busy}>
                  {t("Ya, batalkan janji", "Yes, cancel appointment")}
                </Action>
              </form>
            )}
            {reschedule && (
              <section className="b-callout b-stack">
                <h3>{t("Pilih jadwal baru", "Choose a new time")}</h3>
                <Field label={t("Tanggal baru", "New date")}>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
                {timesLoading ? (
                  <Loading />
                ) : (
                  <div className="b-slot-grid">
                    {times.map((slot) => (
                      <button
                        type="button"
                        key={slot.startsAt}
                        aria-pressed={startsAt === slot.startsAt}
                        onClick={() => setStartsAt(slot.startsAt)}
                      >
                        {slot.label}
                        <small>{slot.offset}</small>
                      </button>
                    ))}
                  </div>
                )}
                {!timesLoading && !times.length && (
                  <p>
                    {t(
                      "Pilih tanggal lain. Tidak ada jadwal tersedia.",
                      "Choose another date. No times are available.",
                    )}
                  </p>
                )}
                <Action
                  busy={busy}
                  disabled={!startsAt}
                  onClick={() => act("reschedule", { startsAt })}
                >
                  {t("Simpan jadwal baru", "Save new time")}
                </Action>
              </section>
            )}
            {canWrite &&
              data!.capabilities.payments &&
              ["confirmed", "checked_in", "completed"].includes(
                booking.status,
              ) &&
              booking.paidAmount < booking.total && (
                <form
                  className="b-callout b-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("/payment", {
                      reference,
                      idempotencyKey: `onsite-${booking.id}`,
                    });
                  }}
                >
                  <h3>
                    {t("Catat pembayaran di lokasi", "Record on-site payment")}
                  </h3>
                  <p>
                    {t(
                      "Catat hanya setelah uang benar-benar diterima.",
                      "Record only after receiving the money.",
                    )}
                  </p>
                  <Field
                    label={t(
                      "Referensi bukti penerimaan",
                      "Payment receipt reference",
                    )}
                  >
                    <Input
                      required
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      maxLength={100}
                    />
                  </Field>
                  <Action type="submit" busy={busy}>
                    {t("Catat penerimaan", "Record payment")}{" "}
                    {money(booking.total - booking.paidAmount, route.lang)}
                  </Action>
                </form>
              )}
            {staff &&
              data!.role === "owner" &&
              data!.capabilities.payments &&
              booking.refundEligible > 0 && (
                <form
                  className="b-callout b-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("/refund", { reason: note, reference });
                  }}
                >
                  <h3>{t("Pengembalian dana", "Refund")}</h3>
                  <p>
                    {money(booking.refundEligible, route.lang)} ·{" "}
                    {t(
                      "Gateway menunggu verifikasi penyedia. Pengembalian tunai memerlukan bukti dari luar aplikasi.",
                      "Gateway refunds await provider verification. Offline refunds require an external receipt.",
                    )}
                  </p>
                  <Field label={t("Alasan pengembalian", "Refund reason")}>
                    <Input
                      required
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                    />
                  </Field>
                  <Field
                    label={t(
                      "Referensi bukti pengembalian",
                      "Refund receipt reference",
                    )}
                  >
                    <Input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      maxLength={100}
                    />
                  </Field>
                  <Action type="submit" busy={busy}>
                    {data!.demo
                      ? t("Simulasikan pengembalian", "Simulate refund")
                      : t("Proses pengembalian", "Process refund")}
                  </Action>
                </form>
              )}
            {receipt && (
              <section className="b-receipt">
                <h3>{t("Bukti pembayaran", "Payment receipt")}</h3>
                <p>
                  {data!.config.brand.name} · {receipt.reference}
                </p>
                {receipt.demo && (
                  <p>
                    {t(
                      "Bukti simulasi. Bukan transaksi uang nyata.",
                      "Simulation receipt. Not a real money transaction.",
                    )}
                  </p>
                )}
                <dl>
                  <div>
                    <dt>{t("Diterima", "Received")}</dt>
                    <dd>{money(receipt.received, route.lang)}</dd>
                  </div>
                  <div>
                    <dt>{t("Dikembalikan", "Refunded")}</dt>
                    <dd>{money(receipt.refunded, route.lang)}</dd>
                  </div>
                  <div>
                    <dt>{t("Sisa", "Balance")}</dt>
                    <dd>{money(receipt.balance, route.lang)}</dd>
                  </div>
                </dl>
                <Action variant="outline" onClick={() => window.print()}>
                  <Printer size={16} />
                  {t("Cetak bukti", "Print receipt")}
                </Action>
              </section>
            )}
            {data!.capabilities.payments && booking.payments.length > 0 && (
              <section className="b-payment-history">
                <h3>{t("Riwayat pembayaran", "Payment history")}</h3>
                {booking.payments.map((p) => (
                  <div key={p.id}>
                    <span>
                      {p.provider} · {money(p.amount, route.lang)}
                    </span>
                    <Status value={p.status} />
                  </div>
                ))}
                {booking.refunds.map((r) => (
                  <div key={r.id}>
                    <span>
                      {t("Pengembalian", "Refund")} ·{" "}
                      {money(r.amount, route.lang)}
                    </span>
                    <Status value={r.status} />
                  </div>
                ))}
              </section>
            )}
            <section className="b-timeline">
              <h3>{t("Riwayat janji", "Appointment history")}</h3>
              <ol>
                {booking.events.map((event) => (
                  <li key={event.id}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>
                        {eventLabels[event.action]
                          ? t(...eventLabels[event.action])
                          : event.action.replaceAll("_", " ")}{" "}
                        {event.internal ? `(${t("internal", "internal")})` : ""}
                      </strong>
                      <time>
                        {dateTime(event.at, booking.timezone, route.lang)}
                      </time>
                      {event.note && <p>{event.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            {canWrite && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act("note", { note });
                }}
                className="b-stack"
              >
                <Field
                  label={t("Catatan staf", "Staff note")}
                  help={t(
                    "Catatan operasional saja, tanpa data klinis. Pelanggan tidak melihat catatan ini.",
                    "Operational notes only, no clinical data. Customers cannot view this note.",
                  )}
                >
                  <Textarea
                    required
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                  />
                </Field>
                <Action variant="outline" type="submit" busy={busy}>
                  {t("Simpan catatan", "Save note")}
                </Action>
              </form>
            )}
          </div>
        )
      )}
    </Dialog>
  );
}
