import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  AvailabilityRule,
  BusinessSettings,
  Location,
  Resource,
  Service,
  ServiceCategory,
  StaffSnapshot,
} from "../domain/model";
import { LAYOUTS, PALETTES } from "../domain/model";
import { api } from "../lib/api";
import { useBooking } from "../lib/store";
import {
  Action,
  Dialog,
  Empty,
  ErrorNote,
  Field,
  Input,
  Picker,
  Textarea,
  money,
} from "../components/ui";
import { layoutLabels, levelLabels } from "../lib/labels";
type Entity = Service | Resource | Location | ServiceCategory;
type Collection = "service" | "resource" | "location" | "category";
const timeString = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const minutesOf = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};
export function LocalFields({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: { id: string; en: string };
  onChange: (v: { id: string; en: string }) => void;
  multiline?: boolean;
}) {
  return (
    <div className="b-form-grid">
      {(["id", "en"] as const).map((lang) => (
        <Field key={lang} label={`${label} (${lang.toUpperCase()})`}>
          {multiline ? (
            <Textarea
              value={value[lang]}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
              required
              rows={3}
            />
          ) : (
            <Input
              value={value[lang]}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
              required
            />
          )}
        </Field>
      ))}
    </div>
  );
}
export function ScheduleEditor({
  value,
  onChange,
}: {
  value: AvailabilityRule[];
  onChange: (v: AvailabilityRule[]) => void;
}) {
  const { t } = useBooking(),
    days = t(
      "Minggu,Senin,Selasa,Rabu,Kamis,Jumat,Sabtu",
      "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
    ).split(",");
  const update = (index: number, patch: Partial<AvailabilityRule>) =>
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  return (
    <section className="b-schedule-editor">
      <div className="b-section-heading">
        <h3>{t("Jam kerja mingguan", "Weekly working hours")}</h3>
        <Action
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([...value, { weekday: 1, start: 9 * 60, end: 17 * 60 }])
          }
        >
          <Plus size={16} />
          {t("Tambah jam", "Add hours")}
        </Action>
      </div>
      <p className="b-muted">
        {t(
          "Waktu mengikuti zona lokasi. Gunakan beberapa rentang untuk jeda istirahat. Jam akhir 00:00 berarti tengah malam.",
          "Times use the location timezone. Add separate intervals for breaks. An end time of 00:00 means midnight.",
        )}
      </p>
      {value.map((rule, index) => (
        <div className="b-schedule-row" key={index}>
          <Picker
            label={`${t("Hari", "Day")} ${index + 1}`}
            value={String(rule.weekday)}
            options={days.map((label, value) => ({
              value: String(value),
              label,
            }))}
            onChange={(v) => update(index, { weekday: Number(v) })}
          />
          <div className="b-schedule-times">
            <label className="b-schedule-time">
              <span>{t("Mulai", "Start")}</span>
              <Input
                type="time"
                step={300}
                aria-label={`${t("Jam mulai", "Start time")} ${index + 1}`}
                value={timeString(rule.start)}
                onChange={(e) => update(index, { start: minutesOf(e.target.value) })}
                required
              />
            </label>
            <label className="b-schedule-time">
              <span>{t("Selesai", "End")}</span>
              <Input
                type="time"
                step={300}
                aria-label={`${t("Jam akhir", "End time")} ${index + 1}`}
                value={timeString(rule.end)}
                onChange={(e) => update(index, { end: minutesOf(e.target.value) || 1440 })}
                required
              />
            </label>
          </div>
          <Action
            variant="ghost"
            size="icon"
            aria-label={`${t("Hapus rentang", "Remove interval")} ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <Trash2 size={16} />
          </Action>
        </div>
      ))}
      {!value.length && (
        <p>
          {t(
            "Tidak ada jam buka. Jadwal baru tidak tersedia.",
            "No working hours. New appointments are unavailable.",
          )}
        </p>
      )}
    </section>
  );
}
export function ContentManager({
  snapshot,
  reload,
  initialKind,
}: {
  snapshot: StaffSnapshot;
  reload: () => Promise<void>;
  initialKind: Collection;
}) {
  const { route, t, notify } = useBooking(),
    [kind, setKind] = useState<Collection>(initialKind),
    [editing, setEditing] = useState<Entity | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [isNew, setIsNew] = useState(false);
  const writable = snapshot.role === "owner";
  const collection: Entity[] =
    kind === "service"
      ? snapshot.services
      : kind === "resource"
        ? snapshot.resources
        : kind === "location"
          ? snapshot.locations
          : snapshot.categories;
  const labels: Record<Collection, [string, string]> = {
    service: ["Layanan & harga", "Services & pricing"],
    resource: ["Tim & sumber daya", "Team & resources"],
    location: ["Lokasi & kapasitas", "Locations & capacity"],
    category: ["Kategori layanan", "Service categories"],
  };
  const set = (key: string, value: unknown) =>
    setEditing((previous) => (previous ? { ...previous, [key]: value } : null));
  function add() {
    setError(null);
    setIsNew(true);
    const id = `${snapshot.config.preset}-${kind}-${crypto.randomUUID().slice(0, 8)}`;
    if (kind === "category") setEditing({ id, name: { id: "", en: "" } });
    else if (kind === "service")
      setEditing({
        ...structuredClone(snapshot.services[0]),
        id,
        name: { id: "", en: "" },
        description: { id: "", en: "" },
        price: 0,
        packageItems: [],
        featured: false,
      });
    else if (kind === "resource")
      setEditing({
        id,
        preset: snapshot.config.preset,
        name: "",
        kind: "room",
        locationId: snapshot.locations[0].id,
        serviceIds: [],
        capacity: 1,
        active: true,
        schedule: structuredClone(snapshot.locations[0].schedule),
      });
    else
      setEditing({
        ...structuredClone(snapshot.locations[0]),
        id,
        name: "",
        address: "",
      });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/staff/content/${kind}`, "PUT", {
        revision: snapshot.revision,
        data: editing,
      });
      await reload();
      setEditing(null);
      notify(t("Perubahan tersimpan.", "Changes saved."));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const s = editing as Service,
    r = editing as Resource,
    l = editing as Location;
  return (
    <>
      <div className="b-section-heading">
        <div>
          <h1>{t(...labels[kind])}</h1>
          <p>
            {kind === "resource"
              ? t(
                  "Atur orang, ruangan, area kerja, dan waktu yang tersedia.",
                  "Manage people, rooms, service bays, and their availability.",
                )
              : t(
                  "Perubahan tersimpan ke basis data dan tampil pada situs pelanggan.",
                  "Changes persist in the database and appear on the customer website.",
                )}
          </p>
        </div>
        {writable && (
          <Action onClick={add}>
            <Plus size={17} />
            {t("Tambah", "Add")}
          </Action>
        )}
      </div>
      {initialKind === "service" && (
        <div className="b-segment">
          <button
            type="button"
            aria-pressed={kind === "service"}
            onClick={() => setKind("service")}
          >
            {t("Layanan", "Services")}
          </button>
          <button
            type="button"
            aria-pressed={kind === "category"}
            onClick={() => setKind("category")}
          >
            {t("Kategori", "Categories")}
          </button>
        </div>
      )}
      {collection.length ? (
        <div className="b-table-scroll">
          <table className="b-table">
            <thead>
              <tr>
                <th>{t("Nama", "Name")}</th>
                <th>
                  {kind === "service"
                    ? t("Harga & durasi", "Price & duration")
                    : kind === "category"
                      ? t("ID", "ID")
                      : t("Jenis & kapasitas", "Type & capacity")}
                </th>
                <th>{t("Status", "Status")}</th>
                <th>
                  <span className="b-sr-only">{t("Tindakan", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {collection.map((entity) => (
                <tr key={entity.id}>
                  <td>
                    <strong>
                      {typeof entity.name === "string"
                        ? entity.name
                        : entity.name[route.lang]}
                    </strong>
                    {kind === "service" && (
                      <small>
                        {(entity as Service).description[route.lang].slice(
                          0,
                          90,
                        )}
                      </small>
                    )}
                    {kind === "location" && (
                      <small>{(entity as Location).address}</small>
                    )}
                  </td>
                  <td>
                    {kind === "service" ? (
                      <>
                        {money((entity as Service).price, route.lang)}
                        <small>
                          {(entity as Service).duration} {t("menit", "min")}
                        </small>
                      </>
                    ) : kind === "category" ? (
                      entity.id
                    ) : (
                      <>
                        {kind === "resource"
                          ? (entity as Resource).kind
                          : (entity as Location).timezone}
                        <small>
                          {t("Kapasitas", "Capacity")}:{" "}
                          {(entity as Location).capacity}
                        </small>
                      </>
                    )}
                  </td>
                  <td>
                    {"active" in entity
                      ? entity.active
                        ? t("Aktif", "Active")
                        : t("Nonaktif", "Inactive")
                      : t("Aktif", "Active")}
                  </td>
                  <td>
                    <Action
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(structuredClone(entity));
                        setIsNew(false);
                        setError(null);
                      }}
                    >
                      {writable ? t("Ubah", "Edit") : t("Lihat", "View")}
                    </Action>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={t("Belum ada data", "No records yet")} />
      )}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
        title={`${isNew ? t("Tambah", "Add") : writable ? t("Ubah", "Edit") : t("Lihat", "View")} · ${t(...labels[kind])}`}
        className="b-editor-dialog"
      >
        <form onSubmit={save} className="b-stack">
          <fieldset disabled={!writable || busy} className="b-stack">
            {editing && (kind === "service" || kind === "category") && (
              <LocalFields
                label={t("Nama", "Name")}
                value={editing.name as { id: string; en: string }}
                onChange={(v) => set("name", v)}
              />
            )}
            {editing && kind === "service" && (
              <>
                <LocalFields
                  label={t("Deskripsi", "Description")}
                  multiline
                  value={s.description}
                  onChange={(v) => set("description", v)}
                />
                <div className="b-form-grid">
                  <Field label={t("Kategori", "Category")}>
                    <Picker
                      label={t("Kategori", "Category")}
                      value={s.category}
                      options={snapshot.categories.map((c) => ({
                        value: c.id,
                        label: c.name[route.lang],
                      }))}
                      onChange={(v) => set("category", v)}
                    />
                  </Field>
                  <Field label={t("Harga (Rp)", "Price (IDR)")}>
                    <Input
                      type="number"
                      required
                      min={0}
                      step={1}
                      value={s.price}
                      onChange={(e) => set("price", Number(e.target.value))}
                    />
                  </Field>
                  <Field label={t("Durasi (menit)", "Duration (minutes)")}>
                    <Input
                      type="number"
                      required
                      min={5}
                      max={480}
                      step={5}
                      value={s.duration}
                      onChange={(e) => set("duration", Number(e.target.value))}
                    />
                  </Field>
                  <Field label={t("Kapasitas layanan", "Service capacity")}>
                    <Input
                      type="number"
                      required
                      min={1}
                      max={50}
                      value={s.capacity}
                      onChange={(e) => set("capacity", Number(e.target.value))}
                    />
                  </Field>
                  <Field
                    label={t(
                      "Persiapan sebelum (menit)",
                      "Buffer before (minutes)",
                    )}
                  >
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      step={5}
                      required
                      value={s.bufferBefore}
                      onChange={(e) =>
                        set("bufferBefore", Number(e.target.value))
                      }
                    />
                  </Field>
                  <Field
                    label={t(
                      "Persiapan sesudah (menit)",
                      "Buffer after (minutes)",
                    )}
                  >
                    <Input
                      type="number"
                      min={0}
                      max={120}
                      step={5}
                      required
                      value={s.bufferAfter}
                      onChange={(e) =>
                        set("bufferAfter", Number(e.target.value))
                      }
                    />
                  </Field>
                </div>
                <Field
                  label={t("Alamat gambar", "Image URL")}
                  help={t(
                    "Pakai gambar milik Anda atau gambar dengan izin pakai.",
                    "Use your own images or images with permission.",
                  )}
                >
                  <Input
                    value={s.image}
                    onChange={(e) => set("image", e.target.value)}
                  />
                </Field>
                <fieldset>
                  <legend>{t("Lokasi layanan", "Service locations")}</legend>
                  {snapshot.locations.map((location) => (
                    <label className="b-checkbox" key={location.id}>
                      <input
                        type="checkbox"
                        checked={s.locationIds.includes(location.id)}
                        onChange={(e) =>
                          set(
                            "locationIds",
                            e.target.checked
                              ? [...s.locationIds, location.id]
                              : s.locationIds.filter((x) => x !== location.id),
                          )
                        }
                      />
                      {location.name}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>
                    {t("Isi paket layanan", "Package inclusions")}
                  </legend>
                  {s.packageItems.map((item, index) => (
                    <div className="b-package-row" key={index}>
                      <LocalFields
                        label={`${t("Isi", "Inclusion")} ${index + 1}`}
                        value={item}
                        onChange={(v) =>
                          set(
                            "packageItems",
                            s.packageItems.map((x, i) => (i === index ? v : x)),
                          )
                        }
                      />
                      <Action
                        variant="ghost"
                        size="icon"
                        aria-label={t("Hapus isi paket", "Remove inclusion")}
                        onClick={() =>
                          set(
                            "packageItems",
                            s.packageItems.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </Action>
                    </div>
                  ))}
                  <Action
                    variant="outline"
                    onClick={() =>
                      set("packageItems", [
                        ...s.packageItems,
                        { id: "", en: "" },
                      ])
                    }
                  >
                    {t("Tambah isi paket", "Add inclusion")}
                  </Action>
                </fieldset>
                <label className="b-checkbox">
                  <input
                    type="checkbox"
                    checked={s.featured}
                    onChange={(e) => set("featured", e.target.checked)}
                  />
                  {t("Tampilkan sebagai pilihan utama", "Feature this service")}
                </label>
                {isNew && (
                  <p className="b-callout">
                    {t(
                      "Setelah menyimpan, tambahkan layanan ini ke sumber daya yang sesuai agar jadwal dapat muncul.",
                      "After saving, assign this service to suitable resources so availability can be calculated.",
                    )}
                  </p>
                )}
              </>
            )}
            {editing && (kind === "resource" || kind === "location") && (
              <>
                <Field label={t("Nama", "Name")}>
                  <Input
                    required
                    value={(editing as Resource).name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label={t("Kapasitas", "Capacity")}>
                  <Input
                    type="number"
                    required
                    min={1}
                    max={50}
                    value={(editing as Resource).capacity}
                    onChange={(e) => set("capacity", Number(e.target.value))}
                  />
                </Field>
                {kind === "resource" ? (
                  <>
                    <div className="b-form-grid">
                      <Field label={t("Jenis sumber daya", "Resource type")}>
                        <Picker
                          label={t("Jenis sumber daya", "Resource type")}
                          value={r.kind}
                          options={[
                            {
                              value: "practitioner",
                              label: t("Dokter", "Practitioner"),
                            },
                            {
                              value: "therapist",
                              label: t("Terapis", "Therapist"),
                            },
                            { value: "room", label: t("Ruangan", "Room") },
                            {
                              value: "bay",
                              label: t("Area kerja", "Service bay"),
                            },
                            {
                              value: "professional",
                              label: t("Konsultan", "Professional"),
                            },
                          ]}
                          onChange={(v) => set("kind", v)}
                        />
                      </Field>
                      <Field label={t("Lokasi", "Location")}>
                        <Picker
                          label={t("Lokasi sumber daya", "Resource location")}
                          value={r.locationId}
                          options={snapshot.locations.map((l) => ({
                            value: l.id,
                            label: l.name,
                          }))}
                          onChange={(v) => {
                            set("locationId", v);
                            set("serviceIds", []);
                          }}
                        />
                      </Field>
                    </div>
                    <fieldset>
                      <legend>
                        {t("Layanan yang didukung", "Supported services")}
                      </legend>
                      {snapshot.services
                        .filter((s) => s.locationIds.includes(r.locationId))
                        .map((service) => (
                          <label className="b-checkbox" key={service.id}>
                            <input
                              type="checkbox"
                              checked={r.serviceIds.includes(service.id)}
                              onChange={(e) =>
                                set(
                                  "serviceIds",
                                  e.target.checked
                                    ? [...r.serviceIds, service.id]
                                    : r.serviceIds.filter(
                                        (x) => x !== service.id,
                                      ),
                                )
                              }
                            />
                            {service.name[route.lang]}
                          </label>
                        ))}
                    </fieldset>
                    <label className="b-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(r.profile)}
                        onChange={(e) =>
                          set(
                            "profile",
                            e.target.checked
                              ? {
                                  name: r.name,
                                  specialty: { id: "", en: "" },
                                  bio: { id: "", en: "" },
                                  initials: "",
                                  example: false,
                                }
                              : undefined,
                          )
                        }
                      />
                      {t(
                        "Tampilkan profil pada direktori",
                        "Show a directory profile",
                      )}
                    </label>
                    {r.profile && (
                      <div className="b-stack">
                        <LocalFields
                          label={t("Spesialisasi", "Specialty")}
                          value={r.profile.specialty}
                          onChange={(v) =>
                            set("profile", {
                              ...r.profile,
                              name: r.name,
                              specialty: v,
                            })
                          }
                        />
                        <LocalFields
                          label={t("Profil singkat", "Short profile")}
                          multiline
                          value={r.profile.bio}
                          onChange={(v) =>
                            set("profile", {
                              ...r.profile,
                              name: r.name,
                              bio: v,
                            })
                          }
                        />
                        <Field label={t("Inisial", "Initials")}>
                          <Input
                            maxLength={5}
                            required
                            value={r.profile.initials}
                            onChange={(e) =>
                              set("profile", {
                                ...r.profile,
                                name: r.name,
                                initials: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <label className="b-checkbox">
                          <input
                            type="checkbox"
                            checked={r.profile.example}
                            onChange={(e) =>
                              set("profile", {
                                ...r.profile,
                                example: e.target.checked,
                              })
                            }
                          />
                          {t(
                            "Tandai sebagai profil fiktif",
                            "Mark as a fictional profile",
                          )}
                        </label>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Field label={t("Alamat", "Address")}>
                      <Textarea
                        required
                        value={l.address}
                        onChange={(e) => set("address", e.target.value)}
                      />
                    </Field>
                    <Field
                      label={t("Zona waktu IANA", "IANA timezone")}
                      help="Asia/Jakarta, Asia/Makassar, Asia/Jayapura"
                    >
                      <Input
                        required
                        value={l.timezone}
                        onChange={(e) => set("timezone", e.target.value)}
                      />
                    </Field>
                  </>
                )}
                <ScheduleEditor
                  value={(editing as Resource).schedule}
                  onChange={(v) => set("schedule", v)}
                />
              </>
            )}
            {editing && "active" in editing && (
              <label className="b-checkbox">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) => set("active", e.target.checked)}
                />
                {t("Aktif", "Active")}
              </label>
            )}
          </fieldset>
          <ErrorNote error={error} />
          {writable && (
            <Action type="submit" busy={busy}>
              {t("Simpan perubahan", "Save changes")}
            </Action>
          )}
        </form>
      </Dialog>
    </>
  );
}
export function SiteSettings({
  snapshot,
  reload,
}: {
  snapshot: StaffSnapshot;
  reload: () => Promise<void>;
}) {
  const { route, t, notify, navigate } = useBooking(),
    [draft, setDraft] = useState<BusinessSettings>(() =>
      structuredClone(snapshot.config),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const writable = snapshot.role === "owner";
  const brand = <K extends keyof BusinessSettings["brand"]>(
    key: K,
    value: BusinessSettings["brand"][K],
  ) =>
    setDraft((previous) => ({
      ...previous,
      brand: { ...previous.brand, [key]: value },
    }));
  const policy = <K extends keyof BusinessSettings["policy"]>(
    key: K,
    value: BusinessSettings["policy"][K],
  ) =>
    setDraft((previous) => ({
      ...previous,
      policy: { ...previous.policy, [key]: value },
    }));
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/staff/settings", "PUT", {
        revision: snapshot.revision,
        data: draft,
      });
      await reload();
      if (snapshot.demo)
        navigate({ layout: draft.layout, palette: draft.palette });
      notify(t("Pengaturan tersimpan.", "Settings saved."));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="b-section-heading">
        <div>
          <h1>{t("Situs & pengaturan", "Site & settings")}</h1>
          <p>
            {t("Tingkat fitur", "Feature level")}:{" "}
            {t(...levelLabels[snapshot.config.level])}.{" "}
            {t(
              "Pengembang mengatur tingkat fitur melalui konfigurasi proyek.",
              "The developer controls the feature level through project configuration.",
            )}
          </p>
        </div>
      </div>
      <form onSubmit={save} className="b-settings-form">
        <fieldset disabled={!writable || busy} className="b-stack">
          <section className="b-form-section">
            <h2>{t("Identitas usaha", "Business identity")}</h2>
            <Field label={t("Nama usaha", "Business name")}>
              <Input
                required
                value={draft.brand.name}
                onChange={(e) => brand("name", e.target.value)}
                maxLength={100}
              />
            </Field>
            <LocalFields
              label={t("Judul utama", "Headline")}
              value={draft.brand.headline}
              onChange={(v) => brand("headline", v)}
            />
            <LocalFields
              label={t("Tentang usaha", "About the business")}
              multiline
              value={draft.brand.description}
              onChange={(v) => brand("description", v)}
            />
            <div className="b-form-grid">
              <Field
                label="WhatsApp"
                help={
                  snapshot.demo
                    ? t(
                        "Demo tidak menyimpan nomor tujuan nyata.",
                        "The demo does not retain real destination numbers.",
                      )
                    : t(
                        "Kode negara dan angka, tanpa +.",
                        "Country code and digits, without +.",
                      )
                }
              >
                <Input
                  value={draft.brand.whatsapp}
                  onChange={(e) => brand("whatsapp", e.target.value)}
                  disabled={snapshot.demo}
                  inputMode="tel"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={draft.brand.email}
                  onChange={(e) => brand("email", e.target.value)}
                  disabled={snapshot.demo}
                />
              </Field>
            </div>
            <Field label={t("Alamat usaha", "Business address")}>
              <Input
                value={draft.brand.address}
                onChange={(e) => brand("address", e.target.value)}
              />
            </Field>
            <label className="b-checkbox">
              <input
                type="checkbox"
                checked={draft.brand.example}
                onChange={(e) => brand("example", e.target.checked)}
              />
              {t("Tandai usaha sebagai contoh", "Mark business as an example")}
            </label>
          </section>
          <section className="b-form-section">
            <h2>{t("Tampilan", "Appearance")}</h2>
            <div className="b-form-grid">
              <Field label={t("Tata letak", "Layout")}>
                <Picker
                  label={t("Tata letak situs", "Site layout")}
                  value={draft.layout}
                  options={LAYOUTS.map((value) => ({
                    value,
                    label: t(...layoutLabels[value]),
                  }))}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      layout: v as BusinessSettings["layout"],
                    })
                  }
                />
              </Field>
              <Field label={t("Warna", "Palette")}>
                <Picker
                  label={t("Warna situs", "Site palette")}
                  value={draft.palette}
                  options={PALETTES.map((value) => ({
                    value,
                    label: value[0].toUpperCase() + value.slice(1),
                  }))}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      palette: v as BusinessSettings["palette"],
                    })
                  }
                />
              </Field>
              <Field label={t("Huruf", "Typography")}>
                <Picker
                  label={t("Huruf situs", "Site typography")}
                  value={draft.typography}
                  options={[
                    { value: "sans", label: "Manrope" },
                    {
                      value: "serif",
                      label: t("Serif klasik", "Classic serif"),
                    },
                  ]}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      typography: v as BusinessSettings["typography"],
                    })
                  }
                />
              </Field>
              <Field label={t("Bahasa awal", "Default language")}>
                <Picker
                  label={t("Bahasa awal", "Default language")}
                  value={draft.language}
                  options={[
                    { value: "id", label: "Bahasa Indonesia" },
                    { value: "en", label: "English" },
                  ]}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      language: v as BusinessSettings["language"],
                    })
                  }
                />
              </Field>
            </div>
            <Field label={t("Gambar utama", "Hero image URL")}>
              <Input
                value={draft.brand.heroImage}
                onChange={(e) => brand("heroImage", e.target.value)}
              />
            </Field>
            <LocalFields
              label={t("Deskripsi gambar", "Image description")}
              value={draft.brand.heroAlt}
              onChange={(v) => brand("heroAlt", v)}
            />
          </section>
          <section className="b-form-section">
            <h2>
              {t("Aturan janji & pembayaran", "Appointment & payment rules")}
            </h2>
            <div className="b-form-grid">
              {(
                [
                  [
                    "holdMinutes",
                    "Batas konfirmasi (menit)",
                    "Confirmation hold (minutes)",
                    5,
                    1440,
                  ],
                  [
                    "paymentMinutes",
                    "Batas bayar (menit)",
                    "Payment hold (minutes)",
                    5,
                    1440,
                  ],
                  [
                    "minNoticeMinutes",
                    "Jarak minimum (menit)",
                    "Minimum notice (minutes)",
                    0,
                    43200,
                  ],
                  [
                    "horizonDays",
                    "Jadwal dibuka (hari)",
                    "Booking horizon (days)",
                    1,
                    365,
                  ],
                  [
                    "cancellationHours",
                    "Batas batal sebelum jadwal (jam)",
                    "Cancellation cutoff (hours)",
                    0,
                    720,
                  ],
                  [
                    "checkInEarlyMinutes",
                    "Check-in lebih awal (menit)",
                    "Early check-in (minutes)",
                    0,
                    1440,
                  ],
                  ["depositPercent", "Uang muka (%)", "Deposit (%)", 1, 100],
                  [
                    "refundPercent",
                    "Pengembalian dana (%)",
                    "Refund (%)",
                    0,
                    100,
                  ],
                ] as const
              )
                .filter(
                  ([key]) =>
                    snapshot.capabilities.payments ||
                    !["depositPercent", "refundPercent"].includes(key),
                )
                .map(([key, id, en, min, max]) => (
                  <Field key={key} label={t(id, en)}>
                    <Input
                      type="number"
                      required
                      min={min}
                      max={max}
                      step={1}
                      value={draft.policy[key]}
                      onChange={(e) => policy(key, Number(e.target.value))}
                    />
                  </Field>
                ))}
            </div>
            <label className="b-checkbox">
              <input
                type="checkbox"
                checked={draft.policy.manualConfirmation}
                onChange={(e) => policy("manualConfirmation", e.target.checked)}
              />
              {t(
                "Staf perlu mengonfirmasi setiap janji",
                "Require staff confirmation for each appointment",
              )}
            </label>
            {snapshot.capabilities.payments && (
              <label className="b-checkbox">
                <input
                  type="checkbox"
                  checked={draft.policy.onlineRequired}
                  onChange={(e) => policy("onlineRequired", e.target.checked)}
                />
                {t(
                  "Wajibkan pembayaran online untuk layanan berbayar",
                  "Require online payment for paid services",
                )}
              </label>
            )}
            <LocalFields
              label={t(
                "Kebijakan yang tampil ke pelanggan",
                "Customer-facing policy",
              )}
              multiline
              value={draft.policy.text}
              onChange={(v) => policy("text", v)}
            />
            <p className="b-callout">
              {t(
                "Aturan tersimpan pada tiap janji. Perubahan berlaku untuk janji baru. Pastikan teks kebijakan cocok dengan angka di atas.",
                "Each appointment keeps its policy snapshot. Changes apply to new bookings. Keep the policy wording consistent with the values above.",
              )}
            </p>
          </section>
          <section className="b-form-section">
            <h2>{t("Pertanyaan umum", "Frequently asked questions")}</h2>
            {draft.brand.faqs.map((faq, index) => (
              <div className="b-faq-editor" key={index}>
                <LocalFields
                  label={`${t("Pertanyaan", "Question")} ${index + 1}`}
                  value={faq.question}
                  onChange={(v) =>
                    brand(
                      "faqs",
                      draft.brand.faqs.map((x, i) =>
                        i === index ? { ...x, question: v } : x,
                      ),
                    )
                  }
                />
                <LocalFields
                  label={t("Jawaban", "Answer")}
                  multiline
                  value={faq.answer}
                  onChange={(v) =>
                    brand(
                      "faqs",
                      draft.brand.faqs.map((x, i) =>
                        i === index ? { ...x, answer: v } : x,
                      ),
                    )
                  }
                />
                <Action
                  variant="ghost"
                  onClick={() =>
                    brand(
                      "faqs",
                      draft.brand.faqs.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 size={16} />
                  {t("Hapus pertanyaan", "Remove question")}
                </Action>
              </div>
            ))}
            <Action
              variant="outline"
              onClick={() =>
                brand("faqs", [
                  ...draft.brand.faqs,
                  { question: { id: "", en: "" }, answer: { id: "", en: "" } },
                ])
              }
            >
              <Plus size={16} />
              {t("Tambah pertanyaan", "Add question")}
            </Action>
          </section>
        </fieldset>
        <ErrorNote error={error} />
        {writable ? (
          <Action size="lg" type="submit" busy={busy}>
            {t("Simpan pengaturan", "Save settings")}
          </Action>
        ) : (
          <p>
            {t(
              "Hanya pemilik dapat mengubah pengaturan.",
              "Only the owner can change settings.",
            )}
          </p>
        )}
      </form>
    </>
  );
}
