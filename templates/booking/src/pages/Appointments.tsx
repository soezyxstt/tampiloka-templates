import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, KeyRound, RefreshCw } from "lucide-react";
import type { Booking, BookingPage } from "../domain/model";
import { api } from "../lib/api";
import { useBooking } from "../lib/store";
import {
  Action,
  Empty,
  ErrorNote,
  Field,
  Input,
  Loading,
  RouteLink,
  Status,
  dateTime,
  money,
  Disclosure,
} from "../components/ui";
import { BookingDetail } from "../components/BookingDetail";
import { ATTEMPT_KEY, saveAccess } from "./BookingForm";
export function PendingAttempt() {
  const { data, route, navigate, notify, t } = useBooking(),
    [attempt, setAttempt] = useState<{
      preset: string;
      payload: Record<string, unknown>;
    } | null>(() => {
      try {
        return JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || "null");
      } catch {
        return null;
      }
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [missing, setMissing] = useState(false);
  if (
    !data?.capabilities.booking ||
    !attempt ||
    attempt.preset !== data.config.preset
  )
    return null;
  async function recover(retry = false) {
    setBusy(true);
    setError(null);
    try {
      const found = retry
        ? {
            booking: await api<Booking>(
              "/api/bookings",
              "POST",
              attempt!.payload,
            ),
          }
        : await api<{ booking: Booking | null }>(
            `/api/bookings/attempt/${attempt!.payload.idempotencyKey}`,
          );
      if (found.booking) {
        saveAccess(found.booking);
        sessionStorage.removeItem(ATTEMPT_KEY);
        setAttempt(null);
        navigate({ page: "appointments", booking: found.booking.id });
        notify(
          t(
            "Permintaan sebelumnya ditemukan.",
            "Your previous request was recovered.",
          ),
        );
      } else setMissing(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="b-recovery"
      aria-label={t("Pulihkan permintaan janji", "Recover appointment request")}
    >
      <p>
        {t(
          "Ada permintaan yang belum mendapat jawaban. Periksa sebelum membuat janji baru.",
          "A previous request has no confirmed response. Check it before creating another appointment.",
        )}
      </p>
      <div className="b-actions">
        <Action variant="outline" busy={busy} onClick={() => void recover()}>
          {t("Periksa permintaan sebelumnya", "Check previous request")}
        </Action>
        {missing && (
          <>
            <Action busy={busy} onClick={() => void recover(true)}>
              {t(
                "Coba lagi dengan permintaan yang sama",
                "Retry the same request",
              )}
            </Action>
            <Action
              variant="ghost"
              disabled={busy}
              onClick={() => {
                sessionStorage.removeItem(ATTEMPT_KEY);
                setAttempt(null);
              }}
            >
              {t("Buang draf yang belum tersimpan", "Discard unsaved draft")}
            </Action>
          </>
        )}
      </div>
      <ErrorNote error={error} />
    </section>
  );
}
export function Appointments() {
  const { data, route, t, navigate, notify } = useBooking(),
    [result, setResult] = useState<BookingPage | null>(null),
    [error, setError] = useState<unknown>(null),
    [revision, setRevision] = useState(0),
    [offset, setOffset] = useState(0),
    [reference, setReference] = useState(""),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [restoreError, setRestoreError] = useState<unknown>(null);
  useEffect(() => {
    if (!data!.capabilities.booking) return;
    const controller = new AbortController();
    setResult(null);
    setError(null);
    api<BookingPage>(
      `/api/bookings?limit=20&offset=${offset}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then(setResult)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => controller.abort();
  }, [revision, offset, data!.config.preset, data!.config.level]);
  async function restore(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setRestoreError(null);
    try {
      const b = await api<Booking>("/api/access", "POST", { reference, token });
      setRevision((v) => v + 1);
      navigate({ booking: b.id });
      setToken("");
      notify(t("Akses janji dipulihkan.", "Appointment access restored."));
    } catch (e) {
      setRestoreError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!data!.capabilities.booking)
    return (
      <Empty
        title={t(
          "Riwayat janji tidak tersedia pada tingkat ini",
          "Appointment history is not available at this level",
        )}
      />
    );
  return (
    <section className="b-section b-appointments">
      <div className="b-section-heading">
        <div>
          <h1>{t("Janji Anda.", "Your appointments.")}</h1>
          <p>
            {t(
              "Periksa status, ubah jadwal, atau lihat tiket dalam satu tempat.",
              "Check status, change your time, or view your ticket in one place.",
            )}
          </p>
        </div>
        <Action variant="outline" onClick={() => setRevision((v) => v + 1)}>
          <RefreshCw size={17} />
          {t("Perbarui", "Refresh")}
        </Action>
      </div>
      <Disclosure className="b-restore" title={<>
          <KeyRound size={18} />
          {t(
            "Buka janji dari perangkat lain",
            "Open an appointment from another device",
          )}
        </>}>
        <form onSubmit={restore} className="b-form-grid">
          <Field label={t("Nomor referensi", "Reference number")}>
            <Input
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label={t("Kunci akses", "Access key")}>
            <Input
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Action type="submit" busy={busy}>
            {t("Buka janji", "Open appointment")}
          </Action>
          <ErrorNote error={restoreError} />
        </form>
      </Disclosure>
      <ErrorNote error={error} />
      {!result && !error ? (
        <Loading />
      ) : result?.bookings.length ? (
        <div className="b-appointment-list">
          {result.bookings.map((b) => (
            <RouteLink
              key={b.id}
              to={{ booking: b.id }}
              className="b-appointment-row"
            >
              <div className="b-appointment-date">
                <CalendarDays size={21} />
                <span>
                  {new Intl.DateTimeFormat(
                    route.lang === "id" ? "id-ID" : "en-GB",
                    { day: "numeric", month: "short", timeZone: b.timezone },
                  ).format(b.startsAt)}
                </span>
              </div>
              <div>
                <strong>{b.item.name[route.lang]}</strong>
                <p>
                  {dateTime(b.startsAt, b.timezone, route.lang)} ·{" "}
                  {b.locationName}
                </p>
                <small>{b.reference}</small>
              </div>
              <div>
                <Status value={b.status} />
                {data!.capabilities.payments && (
                  <Status value={b.paymentStatus} />
                )}
              </div>
              <strong>{money(b.total, route.lang)}</strong>
            </RouteLink>
          ))}
        </div>
      ) : (
        !error && (
          <Empty title={t("Belum ada janji", "No appointments yet")}>
            <p>
              {t(
                "Janji yang Anda simpan akan tampil di sini.",
                "Appointments you save will appear here.",
              )}
            </p>
            <RouteLink
              to={{ page: "services", booking: "" }}
              className="b-link-button"
            >
              {t("Lihat layanan", "Explore services")}
            </RouteLink>
          </Empty>
        )
      )}
      {result && result.total > 20 && (
        <div className="b-pagination">
          <Action
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            {t("Sebelumnya", "Previous")}
          </Action>
          <span>
            {offset + 1} - {Math.min(offset + 20, result.total)} /{" "}
            {result.total}
          </span>
          <Action
            variant="outline"
            disabled={offset + 20 >= result.total}
            onClick={() => setOffset(offset + 20)}
          >
            {t("Berikutnya", "Next")}
          </Action>
        </div>
      )}
      <BookingDetail onChanged={() => setRevision((v) => v + 1)} />
    </section>
  );
}
