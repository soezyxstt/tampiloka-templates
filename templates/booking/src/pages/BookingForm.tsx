import { useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { adapters, defaultOptions } from "../domain/adapters";
import type { Booking, BookingInput, Quote, Slot } from "../domain/model";
import { localTime } from "../domain/time";
import { api } from "../lib/api";
import { imageSrc } from "../lib/image-src";
import { useBooking } from "../lib/store";
import {
  Action,
  Empty,
  ErrorNote,
  Field,
  Input,
  Loading,
  Picker,
  RouteLink,
  money,
  dateTime,
} from "../components/ui";
export const ATTEMPT_KEY = "tl-booking-attempt";
export function saveAccess(booking: Booking) {
  if (booking.accessToken)
    try {
      sessionStorage.setItem(
        `tl-booking-access-${booking.id}`,
        booking.accessToken,
      );
    } catch {}
}
export function BookingForm() {
  const { data, route, navigate, t, notify } = useBooking();
  const preset = data!.config.preset,
    adapter = adapters[preset],
    lang = route.lang,
    cap = data!.capabilities,
    isBooking = cap.booking && route.channel !== "whatsapp";
  const [serviceId, setServiceId] = useState(
      route.service || data!.services[0]?.id || "",
    ),
    [practitioner, setPractitioner] = useState(route.practitioner || ""),
    [locationId, setLocationId] = useState(data!.locations[0]?.id || ""),
    [options, setOptions] = useState(defaultOptions(preset));
  const [step, setStep] = useState(0),
    [medicalFlow, setMedicalFlow] = useState("professional"),
    [specialty, setSpecialty] = useState(""),
    [date, setDate] = useState(() => {
      if (!isBooking) return "";
      const location = data!.locations[0];
      for (let i = 0; i < 7; i++) {
        const local = localTime(
          Date.now() +
            data!.config.policy.minNoticeMinutes * 60000 +
            i * 86400000,
          location.timezone,
        );
        if (
          location.schedule.some(
            (r) =>
              r.weekday === local.weekday &&
              (i > 0 || r.end > local.minute + 30),
          )
        )
          return local.date;
      }
      return localTime(Date.now() + 86400000, location.timezone).date;
    }),
    [preferredTime, setPreferredTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]),
    [slot, setSlot] = useState<Slot | null>(null),
    [quote, setQuote] = useState<Quote | null>(null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [method, setMethod] = useState<"location" | "online">(
      data!.config.policy.onlineRequired ? "online" : "location",
    ),
    [accepted, setAccepted] = useState(false),
    [draft, setDraft] = useState<{
      message: string;
      url: string | null;
    } | null>(null);
  const service = data!.services.find((s) => s.id === serviceId),
    selectedResource = data!.resources.find((r) => r.id === practitioner),
    location = data!.locations.find((l) => l.id === locationId);
  const selection = {
    serviceId,
    locationId,
    practitionerId: practitioner,
    options,
  };
  const selectionKey = JSON.stringify(selection);
  const availablePeople = data!.resources.filter(
    (r) =>
      r.profile &&
      r.locationId === locationId &&
      (!serviceId || r.serviceIds.includes(serviceId)),
  );
  const candidateServices = data!.services.filter(
    (s) =>
      (!specialty || s.category === specialty) &&
      (!practitioner || selectedResource?.serviceIds.includes(s.id)),
  );
  const changeService = (value: string) => {
    setServiceId(value);
    setSlot(null);
    setQuote(null);
    if (
      practitioner &&
      !data!.resources
        .find((r) => r.id === practitioner)
        ?.serviceIds.includes(value)
    )
      setPractitioner("");
    const s = data!.services.find((x) => x.id === value);
    if (s && !s.locationIds.includes(locationId))
      setLocationId(s.locationIds[0]);
  };
  useEffect(() => {
    if (step !== 1 || !isBooking) return;
    const controller = new AbortController();
    setLoading(true);
    setSlot(null);
    setError(null);
    api<{ slots: Slot[]; quote: Quote }>(
      "/api/availability",
      "POST",
      { ...selection, date },
      controller.signal,
    )
      .then((result) => {
        setSlots(result.slots);
        setQuote(result.quote);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectionKey, date, step, isBooking]);
  async function next(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (step === 0) {
        adapter.validateOptions(options);
        const q = await api<Quote>("/api/quote", "POST", selection);
        setQuote(q);
        if (!cap.payments || q.total === 0) setMethod("location");
        setStep(1);
      } else if (step === 1) {
        if (isBooking && !slot) return;
        if (!isBooking)
          setDraft(
            await api("/api/whatsapp", "POST", {
              ...selection,
              preferredDate: date,
              preferredTime,
              lang,
            }),
          );
        setStep(2);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!slot || !quote) return;
    setBusy(true);
    setError(null);
    try {
      let prior: { preset: string; payload: BookingInput } | null = null;
      try {
        prior = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || "null");
      } catch {}
      const payload: BookingInput = (prior?.preset === preset
        ? prior.payload
        : null) || {
        ...selection,
        startsAt: slot.startsAt,
        customer: { name, phone, email },
        paymentMethod: method,
        idempotencyKey: crypto.randomUUID(),
        expectedTotal: quote.total,
      };
      try {
        sessionStorage.setItem(
          ATTEMPT_KEY,
          JSON.stringify({ preset, payload }),
        );
      } catch {}
      const booking = await api<Booking>("/api/bookings", "POST", payload);
      saveAccess(booking);
      sessionStorage.removeItem(ATTEMPT_KEY);
      notify(
        t(
          "Permintaan janji tersimpan. Periksa statusnya.",
          "Appointment saved. Please check its status.",
        ),
      );
      navigate({
        page: "appointments",
        booking: booking.id,
        service: "",
        practitioner: "",
      });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!cap.whatsapp)
    return (
      <Empty
        title={t(
          "Pemesanan online belum tersedia",
          "Online booking is not available",
        )}
      >
        <RouteLink to={{ page: "services" }}>
          {t("Lihat layanan", "View services")}
        </RouteLink>
      </Empty>
    );
  if (!service)
    return (
      <Empty title={t("Pilih layanan lebih dulu", "Choose a service first")}>
        <RouteLink to={{ page: "services" }}>
          {t("Lihat layanan", "View services")}
        </RouteLink>
      </Empty>
    );
  return (
    <section className="b-section b-book-page">
      <RouteLink to={{ page: "services", service: "" }} className="b-back-link">
        {t("Kembali ke layanan", "Back to services")}
      </RouteLink>
      <div className="b-book-heading">
        {cap.booking && (
          <RouteLink
            className="b-back-link"
            to={{ channel: isBooking ? "whatsapp" : "booking" }}
          >
            {isBooking
              ? t(
                  "Tanya melalui WhatsApp sebagai pilihan lain",
                  "Request through WhatsApp instead",
                )
              : t("Kembali ke pemesanan online", "Use online booking instead")}
          </RouteLink>
        )}
        <h1>
          {isBooking
            ? t("Atur waktu Anda.", "Make time for you.")
            : t("Mulai percakapan Anda.", "Start your conversation.")}
        </h1>
        <ol
          className="b-steps"
          aria-label={t("Langkah pemesanan", "Booking steps")}
        >
          {adapter.steps.map((label, i) => (
            <li key={i} aria-current={step === i ? "step" : undefined}>
              <span>{step > i ? <Check size={14} /> : i + 1}</span>
              {label[lang]}
            </li>
          ))}
        </ol>
      </div>
      <div className="b-book-grid">
        <div className="b-book-main">
          {step === 0 && (
            <form onSubmit={next} className="b-stack">
              <h2>{adapter.steps[0][lang]}</h2>
              {preset === "medical" && (
                <>
                  <div
                    className="b-segment"
                    aria-label={t(
                      "Cara memilih dokter",
                      "Practitioner selection flow",
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={medicalFlow === "professional"}
                      onClick={() => {
                        setMedicalFlow("professional");
                        setSpecialty("");
                      }}
                    >
                      {t("Pilih dokter", "By practitioner")}
                    </button>
                    <button
                      type="button"
                      aria-pressed={medicalFlow === "specialty"}
                      onClick={() => {
                        setMedicalFlow("specialty");
                        setPractitioner("");
                      }}
                    >
                      {t("Pilih spesialisasi", "By specialty")}
                    </button>
                  </div>
                  {medicalFlow === "professional" ? (
                    <Field label={t("Dokter", "Practitioner")}>
                      <Picker
                        label={t("Dokter", "Practitioner")}
                        value={practitioner}
                        options={[
                          {
                            value: "",
                            label: t(
                              "Dokter yang tersedia",
                              "Any available practitioner",
                            ),
                          },
                          ...data!.resources
                            .filter((r) => r.profile)
                            .map((r) => ({
                              value: r.id,
                              label: `${r.name} · ${r.profile!.specialty[lang]}`,
                            })),
                        ]}
                        onChange={(value) => {
                          setPractitioner(value);
                          const r = data!.resources.find((x) => x.id === value);
                          if (r && !r.serviceIds.includes(serviceId))
                            setServiceId(r.serviceIds[0]);
                        }}
                      />
                    </Field>
                  ) : (
                    <Field label={t("Spesialisasi", "Specialty")}>
                      <Picker
                        label={t("Spesialisasi", "Specialty")}
                        value={specialty}
                        options={[
                          {
                            value: "",
                            label: t("Semua spesialisasi", "All specialties"),
                          },
                          ...data!.categories.map((c) => ({
                            value: c.id,
                            label: c.name[lang],
                          })),
                        ]}
                        onChange={(value) => {
                          setSpecialty(value);
                          setPractitioner("");
                          const s = data!.services.find(
                            (s) => !value || s.category === value,
                          );
                          if (s) setServiceId(s.id);
                        }}
                      />
                    </Field>
                  )}
                  <p className="b-example-note">
                    {data!.config.brand.example &&
                      t(
                        "Profil dokter pada demo ini fiktif. ",
                        "Demo practitioner profiles are fictional. ",
                      )}
                    {t(
                      "Jangan masukkan rekam medis, gejala, atau diagnosis.",
                      "Do not enter medical records, symptoms, or diagnoses.",
                    )}
                  </p>
                </>
              )}
              {preset === "detailing" && (
                <h3>{t("Kendaraan yang akan dirawat", "Your vehicle")}</h3>
              )}
              {adapter.fields.map((field) => (
                <Field key={field.key} label={field.label[lang]}>
                  {field.type === "select" ? (
                    <Picker
                      label={field.label[lang]}
                      value={options[field.key]}
                      options={field.options!.map((o) => ({
                        value: o.value,
                        label: o.label[lang],
                      }))}
                      onChange={(value) =>
                        setOptions({ ...options, [field.key]: value })
                      }
                    />
                  ) : (
                    <Input
                      required={field.required}
                      maxLength={field.maxLength}
                      value={options[field.key]}
                      onChange={(e) =>
                        setOptions({ ...options, [field.key]: e.target.value })
                      }
                    />
                  )}
                </Field>
              ))}
              <Field
                label={
                  preset === "detailing"
                    ? t("Paket perawatan", "Service package")
                    : t("Layanan", "Service")
                }
              >
                <Picker
                  label={t("Layanan yang dipilih", "Selected service")}
                  value={serviceId}
                  options={(preset === "medical"
                    ? candidateServices
                    : data!.services
                  ).map((s) => ({
                    value: s.id,
                    label: `${s.name[lang]} · ${money(s.price, lang)}`,
                  }))}
                  onChange={changeService}
                />
              </Field>
              <Field label={t("Lokasi", "Location")}>
                <Picker
                  label={t("Lokasi", "Location")}
                  value={locationId}
                  options={data!.locations
                    .filter((l) => service.locationIds.includes(l.id))
                    .map((l) => ({ value: l.id, label: l.name }))}
                  onChange={(value) => {
                    setLocationId(value);
                    setPractitioner("");
                  }}
                />
              </Field>
              {preset !== "detailing" &&
                !(preset === "medical" && medicalFlow === "professional") && (
                  <Field
                    label={`${adapter.professionalLabel[lang]} (${t("opsional", "optional")})`}
                  >
                    <Picker
                      label={adapter.professionalLabel[lang]}
                      value={practitioner}
                      options={[
                        {
                          value: "",
                          label: t(
                            "Siapa saja yang tersedia",
                            "Anyone available",
                          ),
                        },
                        ...availablePeople.map((r) => ({
                          value: r.id,
                          label: r.name,
                        })),
                      ]}
                      onChange={setPractitioner}
                    />
                  </Field>
                )}
              <ErrorNote error={error} />
              <Action size="lg" type="submit" busy={busy}>
                {t("Lanjut ke jadwal", "Continue to time selection")}
              </Action>
            </form>
          )}
          {step === 1 && (
            <div className="b-stack">
              <h2>{adapter.steps[1][lang]}</h2>
              <p className="b-muted">
                {location?.timezone} ·{" "}
                {preset === "detailing"
                  ? t(
                      "Jadwal mengikuti durasi paket dan kapasitas area kerja.",
                      "Times account for the service duration and bay capacity.",
                    )
                  : t(
                      "Durasi layanan dan waktu persiapan sudah diperhitungkan.",
                      "Service duration and preparation buffers are included.",
                    )}
              </p>
              <Field
                label={
                  isBooking
                    ? t("Tanggal kunjungan", "Appointment date")
                    : t(
                        "Tanggal pilihan (opsional)",
                        "Preferred date (optional)",
                      )
                }
              >
                <Input
                  type="date"
                  value={date}
                  min={localTime(Date.now(), location!.timezone).date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              {isBooking ? (
                <>
                  {loading ? (
                    <Loading />
                  ) : slots.length ? (
                    <div
                      className="b-slot-grid"
                      role="group"
                      aria-label={t("Waktu yang tersedia", "Available times")}
                    >
                      {slots.map((time) => (
                        <button
                          type="button"
                          key={time.startsAt}
                          aria-pressed={slot?.startsAt === time.startsAt}
                          onClick={() => setSlot(time)}
                        >
                          {time.label}
                          <small>{time.offset}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title={t(
                        "Tidak ada waktu yang tersedia pada tanggal ini",
                        "No appointments available on this date",
                      )}
                    >
                      <p>
                        {t(
                          "Pilih tanggal atau orang lain.",
                          "Choose another date or professional.",
                        )}
                      </p>
                    </Empty>
                  )}
                </>
              ) : (
                <>
                  <Field
                    label={t(
                      "Waktu pilihan (opsional)",
                      "Preferred time (optional)",
                    )}
                  >
                    <Input
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                    />
                  </Field>
                  <p className="b-callout">
                    {t(
                      "Pilihan ini hanya permintaan. Pengelola akan memeriksa jadwal melalui WhatsApp.",
                      "This is a request only. The business will check availability through WhatsApp.",
                    )}
                  </p>
                </>
              )}
              <ErrorNote error={error} />
              <div className="b-actions">
                <Action variant="ghost" onClick={() => setStep(0)}>
                  {t("Kembali", "Back")}
                </Action>
                <Action
                  size="lg"
                  disabled={(isBooking && !slot) || loading}
                  busy={busy}
                  onClick={() => void next()}
                >
                  {t("Periksa ringkasan", "Review appointment")}
                </Action>
              </div>
            </div>
          )}
          {step === 2 &&
            (isBooking ? (
              <form onSubmit={submit} className="b-stack">
                <h2>{adapter.steps[2][lang]}</h2>
                <div className="b-form-grid">
                  <Field label={t("Nama lengkap", "Full name")}>
                    <Input
                      required
                      autoComplete="name"
                      value={name}
                      maxLength={100}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label={t("Nomor telepon", "Phone number")}>
                    <Input
                      required
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={25}
                    />
                  </Field>
                  <Field
                    label={t("Email (opsional)", "Email (optional)")}
                    className="b-span"
                  >
                    <Input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={150}
                    />
                  </Field>
                </div>
                {cap.payments && quote && quote.total > 0 && (
                  <fieldset className="b-payment-options">
                    <legend>{t("Pembayaran", "Payment")}</legend>
                    {!data!.config.policy.onlineRequired && (
                      <label>
                        <input
                          type="radio"
                          name="payment"
                          value="location"
                          checked={method === "location"}
                          onChange={() => setMethod("location")}
                        />
                        <span>
                          <strong>
                            {t("Bayar di lokasi", "Pay at location")}
                          </strong>
                          <small>
                            {t(
                              "Tidak ada pembayaran online saat memesan.",
                              "No online payment when booking.",
                            )}
                          </small>
                        </span>
                      </label>
                    )}
                    <label>
                      <input
                        type="radio"
                        name="payment"
                        value="online"
                        checked={method === "online"}
                        disabled={!data!.paymentConfigured}
                        onChange={() => setMethod("online")}
                      />
                      <span>
                        <strong>
                          {t(
                            `Uang muka ${data!.config.policy.depositPercent}%`,
                            `Deposit ${data!.config.policy.depositPercent}%`,
                          )}
                        </strong>
                        <small>
                          {data!.paymentConfigured
                            ? data!.demo
                              ? t(
                                  "Simulasi. Tidak memindahkan uang nyata.",
                                  "Simulation. No real money moves.",
                                )
                              : t(
                                  "Pembayaran melalui Midtrans.",
                                  "Payment through Midtrans.",
                                )
                            : t(
                                "Pembayaran online belum diatur.",
                                "Online payment is not configured.",
                              )}
                        </small>
                      </span>
                    </label>
                  </fieldset>
                )}
                <label className="b-checkbox">
                  <input
                    type="checkbox"
                    required
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span>
                    {t(
                      "Saya sudah membaca kebijakan perubahan jadwal dan pembatalan.",
                      "I have read the rescheduling and cancellation policy.",
                    )}
                  </span>
                </label>
                <p className="b-muted">{data!.config.policy.text[lang]}</p>
                <ErrorNote error={error} />
                <div className="b-actions">
                  <Action
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setStep(1)}
                  >
                    {t("Kembali", "Back")}
                  </Action>
                  <Action size="lg" type="submit" busy={busy}>
                    {t("Simpan janji", "Save appointment")}
                  </Action>
                </div>
                <small>
                  {t(
                    "Status janji akan tampil setelah server menyimpan permintaan.",
                    "Your appointment status appears after the server saves your request.",
                  )}
                </small>
              </form>
            ) : (
              <div className="b-stack">
                <h2>{t("Periksa pesan Anda", "Review your message")}</h2>
                <p className="b-callout">
                  {t(
                    "Membuka WhatsApp tidak mengonfirmasi janji dan tidak berarti pesan sudah terkirim.",
                    "Opening WhatsApp does not confirm your appointment or mean that the message was delivered.",
                  )}
                </p>
                <textarea
                  className="tl-input b-message-preview"
                  aria-label={t(
                    "Pratinjau pesan WhatsApp",
                    "WhatsApp message preview",
                  )}
                  readOnly
                  value={draft?.message || ""}
                />
                <div className="b-actions">
                  {draft?.url ? (
                    <a
                      className="b-link-button"
                      href={draft.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("Lanjut ke WhatsApp", "Continue to WhatsApp")}
                    </a>
                  ) : (
                    <p className="b-muted">
                      {data!.demo
                        ? t(
                            "Nomor tujuan tidak diatur pada demo. Anda dapat menyalin contoh pesan.",
                            "The demo has no destination number. You can copy the sample message.",
                          )
                        : t(
                            "Nomor WhatsApp belum tersedia. Hubungi pengelola melalui kontak pada situs.",
                            "The WhatsApp number is not configured. Please use the contact details on this site.",
                          )}
                    </p>
                  )}
                  <Action
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(draft?.message || "")
                        .then(() =>
                          notify(t("Pesan disalin.", "Message copied.")),
                        )
                        .catch(setError);
                    }}
                  >
                    <Copy size={16} />
                    {t("Salin pesan", "Copy message")}
                  </Action>
                  <Action variant="ghost" onClick={() => setStep(1)}>
                    {t("Ubah pilihan", "Edit request")}
                  </Action>
                </div>
                <ErrorNote error={error} />
              </div>
            ))}
        </div>
        <aside className="b-book-summary">
          {service.image && <img src={imageSrc(service.image)} alt="" />}
          <div>
            <h2>{service.name[lang]}</h2>
            <p>
              <Clock3 size={17} />
              {quote?.duration || service.duration} {t("menit", "min")}
            </p>
            <p>
              <MapPin size={17} />
              {location?.name}
            </p>
            {(slot?.practitionerName || selectedResource?.name) && (
              <p>{slot?.practitionerName || selectedResource?.name}</p>
            )}
            {slot && (
              <p className="b-summary-date">
                <CalendarDays size={17} />
                {dateTime(slot.startsAt, location!.timezone, lang)}
              </p>
            )}
            <dl>
              <div>
                <dt>{t("Total layanan", "Service total")}</dt>
                <dd>
                  {money(
                    quote?.total ?? adapter.quote(service, options).price,
                    lang,
                  )}
                </dd>
              </div>
              {cap.payments && method === "online" && quote && (
                <>
                  <div>
                    <dt>{t("Uang muka", "Deposit")}</dt>
                    <dd>{money(quote.dueNow, lang)}</dd>
                  </div>
                  <div>
                    <dt>{t("Sisa di lokasi", "Remaining at location")}</dt>
                    <dd>{money(quote.total - quote.dueNow, lang)}</dd>
                  </div>
                </>
              )}
            </dl>
            <small>
              <ShieldCheck size={16} />
              {isBooking
                ? t(
                    "Waktu belum dipesan hingga permintaan tersimpan.",
                    "The time is not reserved until your request is saved.",
                  )
                : t(
                    "Jadwal menunggu konfirmasi pengelola.",
                    "The time requires confirmation from the business.",
                  )}
            </small>
          </div>
        </aside>
      </div>
    </section>
  );
}
