import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { StaffSnapshot } from "../domain/model";
import { localTime, utcCandidates } from "../domain/time";
import { api } from "../lib/api";
import { useBooking } from "../lib/store";
import {
  Action,
  Dialog,
  ErrorNote,
  Field,
  Input,
  Picker,
  dateTime,
} from "../components/ui";
/** Reject DST gaps; when a local time repeats, the form exposes the UTC offset choice. */
export function localCandidates(value: string, zone: string) {
  const [date, time] = value.split("T");
  if (!date || !time) return [];
  return utcCandidates(date, zone, 5).filter(
    (x) => localTime(x, zone).label === time,
  );
}
export function TimeOff({
  snapshot,
  reload,
}: {
  snapshot: StaffSnapshot;
  reload: () => Promise<void>;
}) {
  const { t, route, notify } = useBooking(),
    [open, setOpen] = useState(false),
    [target, setTarget] = useState(
      snapshot.resources[0]?.id || `loc:${snapshot.locations[0].id}`,
    ),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [startChoice, setStartChoice] = useState(""),
    [endChoice, setEndChoice] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const location = target.startsWith("loc:")
      ? snapshot.locations.find((l) => l.id === target.slice(4))
      : snapshot.locations.find(
          (l) =>
            l.id ===
            snapshot.resources.find((r) => r.id === target)?.locationId,
        ),
    zone = location?.timezone || snapshot.config.timezone;
  const starts = localCandidates(start, zone),
    ends = localCandidates(end, zone),
    owner = snapshot.role === "owner";
  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!starts.length || !ends.length) {
      setError(
        new Error(
          t(
            "Waktu lokal tidak sah pada zona ini.",
            "The local time does not exist in this timezone.",
          ),
        ),
      );
      return;
    }
    setBusy(true);
    try {
      await api("/api/staff/blackouts", "POST", {
        revision: snapshot.revision,
        resourceId: target.startsWith("loc:") ? "" : target,
        locationId: target.startsWith("loc:") ? target.slice(4) : "",
        start: Number(startChoice) || starts[0],
        end: Number(endChoice) || ends[0],
        reason,
      });
      await reload();
      setOpen(false);
      notify(t("Waktu tidak tersedia tersimpan.", "Time off saved."));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/staff/blackouts/${id}`, "DELETE", {
        revision: snapshot.revision,
      });
      await reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="b-time-off">
      <div className="b-section-heading">
        <div>
          <h2>{t("Waktu tidak tersedia", "Time off")}</h2>
          <p>
            {t(
              "Jam libur dan waktu yang tidak menerima janji.",
              "Holidays and periods that cannot accept appointments.",
            )}
          </p>
        </div>
        {owner && (
          <Action
            variant="outline"
            onClick={() => {
              setOpen(true);
              setError(null);
            }}
          >
            <Plus size={16} />
            {t("Tambah waktu", "Add time off")}
          </Action>
        )}
      </div>
      {!snapshot.blackouts.length ? (
        <p className="b-muted">
          {t("Belum ada waktu libur tambahan.", "No additional time off.")}
        </p>
      ) : (
        snapshot.blackouts.map((off) => (
          <div className="b-time-off-row" key={off.id}>
            <div>
              <strong>
                {snapshot.resources.find((r) => r.id === off.resourceId)
                  ?.name ||
                  snapshot.locations.find((l) => l.id === off.locationId)?.name}
              </strong>
              <p>
                {dateTime(off.start, snapshot.config.timezone, route.lang)} -{" "}
                {dateTime(off.end, snapshot.config.timezone, route.lang)}
              </p>
              <small>{off.reason}</small>
            </div>
            {owner && (
              <Action
                variant="ghost"
                size="icon"
                busy={busy}
                aria-label={t("Hapus waktu libur", "Remove time off")}
                onClick={() => void remove(off.id)}
              >
                <Trash2 size={17} />
              </Action>
            )}
          </div>
        ))
      )}
      <ErrorNote error={error} />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Tambah waktu tidak tersedia", "Add time off")}
      >
        <form onSubmit={save} className="b-stack">
          <Field label={t("Lokasi atau sumber daya", "Location or resource")}>
            <Picker
              label={t("Lokasi atau sumber daya", "Location or resource")}
              value={target}
              options={[
                ...snapshot.locations.map((l) => ({
                  value: `loc:${l.id}`,
                  label: `${t("Lokasi", "Location")}: ${l.name}`,
                })),
                ...snapshot.resources.map((r) => ({
                  value: r.id,
                  label: r.name,
                })),
              ]}
              onChange={(v) => {
                setTarget(v);
                setStartChoice("");
                setEndChoice("");
              }}
            />
          </Field>
          <p className="b-muted">{zone}</p>
          <Field label={t("Mulai", "Start")}>
            <Input
              required
              type="datetime-local"
              step={300}
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setStartChoice("");
              }}
            />
          </Field>
          {starts.length > 1 && (
            <Picker
              label={t("Zona waktu mulai", "Start time offset")}
              value={startChoice || String(starts[0])}
              options={starts.map((n) => ({
                value: String(n),
                label: localTime(n, zone).offset,
              }))}
              onChange={setStartChoice}
            />
          )}
          <Field label={t("Selesai", "End")}>
            <Input
              required
              type="datetime-local"
              step={300}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setEndChoice("");
              }}
            />
          </Field>
          {ends.length > 1 && (
            <Picker
              label={t("Zona waktu akhir", "End time offset")}
              value={endChoice || String(ends[0])}
              options={ends.map((n) => ({
                value: String(n),
                label: localTime(n, zone).offset,
              }))}
              onChange={setEndChoice}
            />
          )}
          <Field label={t("Alasan", "Reason")}>
            <Input
              required
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <ErrorNote error={error} />
          <Action type="submit" busy={busy}>
            {t("Simpan waktu libur", "Save time off")}
          </Action>
        </form>
      </Dialog>
    </section>
  );
}
