import { useEffect, useRef, useState, type ChangeEvent } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Upload } from "lucide-react";
import type { Booking } from "../domain/model";
import { api } from "../lib/api";
import { useBooking } from "../lib/store";
import {
  Action,
  ErrorNote,
  Field,
  Textarea,
  dateTime,
  Status,
} from "../components/ui";
interface Validation {
  valid: boolean;
  canCheckIn?: boolean;
  alreadyCheckedIn?: boolean;
  checkedIn?: boolean;
  booking: Booking;
}
export function TicketScanner() {
  const { data, route, t } = useBooking(),
    [payload, setPayload] = useState(""),
    [result, setResult] = useState<Validation | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [camera, setCamera] = useState(false);
  const mounted = useRef(true);
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    interval = useRef<ReturnType<typeof setInterval> | undefined>(undefined),
    file = useRef<HTMLInputElement>(null);
  function stop() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    clearInterval(interval.current);
    setCamera(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      clearInterval(interval.current);
    };
  }, []);
  async function validate(checkIn = false) {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api("/api/staff/tickets/validate", "POST", { payload, checkIn }),
      );
    } catch (e) {
      setError(e);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }
  function decode(source: CanvasImageSource, width: number, height: number) {
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 1000 / width, 1000 / height);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    return (
      jsQR(pixels.data, pixels.width, pixels.height, {
        inversionAttempts: "attemptBoth",
      })?.data || null
    );
  }
  async function openCamera() {
    setError(null);
    setResult(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          t(
            "Kamera tidak tersedia. Pakai gambar atau pemindai.",
            "Camera access is unavailable. Use an image or scanner instead.",
          ),
        );
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      setCamera(true);
      setTimeout(() => {
        if (!video.current) return;
        video.current.srcObject = stream.current;
        void video.current.play().catch(setError);
        interval.current = setInterval(() => {
          if (!video.current?.videoWidth) return;
          const text = decode(
            video.current,
            video.current.videoWidth,
            video.current.videoHeight,
          );
          if (text) {
            setPayload(text);
            setResult(null);
            stop();
          }
        }, 300);
      }, 0);
    } catch (e) {
      stop();
      setError(e);
    }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    if (!f) return;
    setError(null);
    setResult(null);
    try {
      if (f.size > 8 * 1024 * 1024)
        throw new Error(
          t("Ukuran gambar maksimal 8 MB.", "Maximum image size is 8 MB."),
        );
      const bitmap = await createImageBitmap(f);
      const text = decode(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      if (!text)
        throw new Error(
          t(
            "Kode QR tidak terbaca. Pakai gambar yang lebih jelas.",
            "No readable QR code found. Use a clearer image.",
          ),
        );
      setPayload(text);
    } catch (e) {
      setError(e);
    } finally {
      event.target.value = "";
    }
  }
  return (
    <>
      <div className="b-section-heading">
        <div>
          <h1>{t("Periksa tiket", "Verify ticket")}</h1>
          <p>
            {t(
              "Pindai tiket, periksa status server, lalu catat kehadiran.",
              "Scan a ticket, check its server status, then record arrival.",
            )}
          </p>
        </div>
      </div>
      <div className="b-scanner-grid">
        <section className="b-stack">
          <div className="b-actions">
            <Action
              variant="outline"
              onClick={() => (camera ? stop() : void openCamera())}
            >
              {camera ? <CameraOff size={18} /> : <Camera size={18} />}
              {camera
                ? t("Hentikan kamera", "Stop camera")
                : t("Pindai dengan kamera", "Scan with camera")}
            </Action>
            <Action variant="outline" onClick={() => file.current?.click()}>
              <Upload size={18} />
              {t("Baca gambar QR", "Read QR image")}
            </Action>
            <input
              className="b-sr-only"
              ref={file}
              type="file"
              accept="image/*"
              aria-label={t("Unggah gambar QR", "Upload QR image")}
              onChange={(e) => void upload(e)}
            />
          </div>
          {camera && (
            <video
              className="b-camera"
              ref={video}
              muted
              playsInline
              aria-label={t("Pratinjau kamera", "Camera preview")}
            />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void validate();
            }}
            className="b-stack"
          >
            <Field
              label={t("Isi kode tiket", "Ticket code")}
              help={t(
                "Pemindai USB juga dapat mengisi kolom ini. Kode tidak memuat nama atau data pelanggan.",
                "A USB scanner can also fill this field. The code contains no customer name or personal data.",
              )}
            >
              <Textarea
                required
                value={payload}
                onChange={(e) => {
                  setPayload(e.target.value);
                  setResult(null);
                }}
                rows={4}
              />
            </Field>
            <Action type="submit" busy={busy}>
              {t("Periksa keabsahan tiket", "Verify ticket")}
            </Action>
          </form>
          <ErrorNote error={error} />
        </section>
        <section aria-live="polite">
          {result ? (
            <div className="b-verification">
              <h2>
                {result.alreadyCheckedIn
                  ? t("Tiket sudah digunakan", "Ticket already used")
                  : result.checkedIn
                    ? t("Kehadiran tercatat", "Arrival recorded")
                    : t("Tiket sah", "Valid ticket")}
              </h2>
              <strong>{result.booking.customer.name}</strong>
              <p>{result.booking.item.name[route.lang]}</p>
              <p>
                {dateTime(
                  result.booking.startsAt,
                  result.booking.timezone,
                  route.lang,
                )}
              </p>
              <Status value={result.booking.status} />
              {result.valid &&
                !result.checkedIn &&
                !result.alreadyCheckedIn && (
                  <>
                    <p>
                      {result.canCheckIn
                        ? t(
                            "Waktu check-in telah dimulai.",
                            "The check-in window is open.",
                          )
                        : t(
                            "Waktu check-in belum dimulai.",
                            "The check-in window has not started.",
                          )}
                    </p>
                    <Action
                      disabled={!result.canCheckIn || data!.role === "viewer"}
                      busy={busy}
                      onClick={() => void validate(true)}
                    >
                      {t("Catat kehadiran", "Check in")}
                    </Action>
                  </>
                )}
            </div>
          ) : (
            <div className="b-empty">
              <h2>{t("Hasil pemeriksaan", "Verification result")}</h2>
              <p>
                {t(
                  "Data janji hanya muncul setelah server memeriksa tiket.",
                  "Appointment details appear only after server verification.",
                )}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
