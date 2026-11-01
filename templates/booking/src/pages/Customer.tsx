import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { adapters } from "../domain/adapters";
import type { Resource, Service } from "../domain/model";
import { useBooking } from "../lib/store";
import {
  Action,
  Empty,
  Field,
  Input,
  Picker,
  Reveal,
  RouteLink,
  money,
  Disclosure,
} from "../components/ui";

export function CustomerHeader() {
  const { data, route, t } = useBooking(),
    [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <header className={`b-customer-header b-header-${data.config.layout}`}>
      <RouteLink
        to={{ page: "home", service: "", booking: "" }}
        className="b-wordmark"
      >
        {data.config.brand.name}
        <span aria-hidden="true">.</span>
      </RouteLink>
      <button
        className="b-mobile-menu"
        type="button"
        aria-label={t("Buka menu", "Open menu")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav
        aria-label={t("Navigasi situs", "Site navigation")}
        className={open ? "is-open" : ""}
        onClick={() => setOpen(false)}
      >
        <RouteLink to={{ page: "services" }}>
          {t("Layanan", "Services")}
        </RouteLink>
        {data.resources.some((r) => r.profile) && (
          <RouteLink to={{ page: "professionals" }}>
            {adapters[data.config.preset].professionalLabel[route.lang]}
          </RouteLink>
        )}
        <RouteLink to={{ page: "about" }}>
          {t("Tentang & lokasi", "About & location")}
        </RouteLink>
        {data.capabilities.booking && (
          <RouteLink
            to={{ page: "appointments", booking: "" }}
            className="b-nav-appointments"
          >
            <CalendarDays size={17} />
            {t("Janji saya", "My appointments")}
          </RouteLink>
        )}
      </nav>
    </header>
  );
}
export function CustomerFooter() {
  const { data, t } = useBooking();
  if (!data) return null;
  return (
    <footer className="b-footer">
      <div>
        <strong>{data.config.brand.name}</strong>
        <p>{data.config.brand.address}</p>
      </div>
      <div>
        <RouteLink to={{ page: "about" }}>
          {t("Jam buka & kontak", "Hours & contact")}
        </RouteLink>
        <RouteLink to={{ view: "staff", page: "calendar", booking: "" }}>
          {t("Ruang staf", "Staff workspace")}
        </RouteLink>
      </div>
      <small>
        {data.config.brand.example
          ? t(
              "Usaha contoh. Seluruh profil bersifat fiktif.",
              "Example business. All profiles are fictional.",
            )
          : `© ${new Date().getFullYear()} ${data.config.brand.name}`}
      </small>
    </footer>
  );
}
function Price({ service }: { service: Service }) {
  const { route, t } = useBooking();
  return (
    <span className="b-price">
      {service.price === 0
        ? t("Gratis", "Free")
        : money(service.price, route.lang)}
      {service.priceMax && service.priceMax > service.price && (
        <small>
          {" "}
          {t("hingga", "to")} {money(service.priceMax, route.lang)}
        </small>
      )}
    </span>
  );
}
function ServiceEntry({
  service,
  index = 0,
  large = false,
}: {
  service: Service;
  index?: number;
  large?: boolean;
}) {
  const { route, data, t, navigate } = useBooking();
  return (
    <article className={`b-service-entry ${large ? "b-service-large" : ""}`}>
      <RouteLink
        to={{ page: "services", service: service.id }}
        className="b-service-picture"
      >
        {service.image && (
          <img
            src={service.image}
            alt={service.name[route.lang]}
            loading="lazy"
          />
        )}
      </RouteLink>
      <div className="b-service-copy">
        <span className="b-service-number" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <RouteLink to={{ page: "services", service: service.id }}>
          <h3>{service.name[route.lang]}</h3>
        </RouteLink>
        <p>{service.description[route.lang]}</p>
        <div className="b-service-meta">
          <span>
            <Clock3 size={15} />
            {service.duration} {t("menit", "min")}
          </span>
          <Price service={service} />
        </div>
        <Action
          variant={large ? "solid" : "outline"}
          onClick={() =>
            navigate({
              page: data!.capabilities.whatsapp ? "book" : "services",
              service: service.id,
              practitioner: "",
            })
          }
        >
          {data!.capabilities.booking
            ? t("Pilih waktu", "Find a time")
            : data!.capabilities.whatsapp
              ? t("Tanya jadwal", "Ask about a time")
              : t("Detail layanan", "Service details")}
        </Action>
      </div>
    </article>
  );
}
function QuickStart() {
  const { data, route, t, navigate } = useBooking();
  const [service, setService] = useState(data!.services[0]?.id || ""),
    [practitioner, setPractitioner] = useState("");
  const resource = data!.resources.find((r) => r.id === practitioner),
    services = data!.services.filter(
      (s) => !resource || resource.serviceIds.includes(s.id),
    );
  return (
    <section
      className="b-quick-start"
      aria-label={t("Mulai pilih layanan", "Start choosing a service")}
    >
      <div className="b-quick-title">
        <CalendarDays size={25} />
        <h2>
          {data!.capabilities.booking
            ? t("Temukan waktu Anda", "Find your time")
            : t("Pilih layanan Anda", "Choose your service")}
        </h2>
      </div>
      <p>
        {data!.capabilities.booking
          ? t(
              "Lihat jadwal yang tersedia, lalu pilih waktu yang sesuai.",
              "See available appointments and choose a time that suits you.",
            )
          : t(
              "Lihat pilihan dan detail layanan sebelum menghubungi kami.",
              "Explore your options before contacting us.",
            )}
      </p>
      <div className="b-stack">
        {data!.config.preset === "medical" && (
          <Field
            label={t("Dokter atau spesialisasi", "Practitioner or specialty")}
          >
            <Picker
              label={t("Dokter atau spesialisasi", "Practitioner or specialty")}
              value={practitioner}
              options={[
                { value: "", label: t("Semua dokter", "All practitioners") },
                ...data!.resources
                  .filter((r) => r.profile)
                  .map((r) => ({
                    value: r.id,
                    label: `${r.name} · ${r.profile!.specialty[route.lang]}`,
                  })),
              ]}
              onChange={(v) => {
                setPractitioner(v);
                const r = data!.resources.find((r) => r.id === v);
                setService(
                  data!.services.find((s) => !r || r.serviceIds.includes(s.id))
                    ?.id || "",
                );
              }}
            />
          </Field>
        )}
        <Field label={t("Layanan", "Service")}>
          <Picker
            label={t("Layanan", "Service")}
            value={service}
            options={services.map((s) => ({
              value: s.id,
              label: s.name[route.lang],
            }))}
            onChange={setService}
          />
        </Field>
        <Action
          size="lg"
          disabled={!service}
          onClick={() =>
            navigate({
              page: data!.capabilities.whatsapp ? "book" : "services",
              service,
              practitioner,
            })
          }
        >
          {data!.capabilities.booking
            ? t("Lihat jadwal", "View availability")
            : t("Lihat layanan", "View service")}
        </Action>
      </div>
      <small>
        <ShieldCheck size={16} />
        {t(
          "Jadwal dan harga jelas sebelum memesan.",
          "Know the time and price before booking.",
        )}
      </small>
    </section>
  );
}
export function ProfessionalList({ compact = false }: { compact?: boolean }) {
  const { data, route, t, navigate } = useBooking();
  const people = data!.resources.filter((r) => r.profile);
  return (
    <div
      className={
        compact ? "b-professionals b-professionals-compact" : "b-professionals"
      }
    >
      {people.map((r, index) => (
        <article className="b-professional" key={r.id}>
          <div className="b-initial-avatar" aria-hidden="true">
            {r.profile!.initials}
          </div>
          <div className="b-profile-info">
            <h3>{r.name}</h3>
            <p className="b-specialty">{r.profile!.specialty[route.lang]}</p>
            {!compact && <p>{r.profile!.bio[route.lang]}</p>}
            {r.profile!.example && (
              <small>
                {t("Profil fiktif untuk demo", "Fictional example profile")}
              </small>
            )}
          </div>
          <Action
            variant="outline"
            onClick={() =>
              navigate({
                page: data!.capabilities.whatsapp ? "book" : "services",
                practitioner: r.id,
                service:
                  data!.services.find((s) => r.serviceIds.includes(s.id))?.id ||
                  "",
              })
            }
          >
            {data!.capabilities.booking
              ? t("Lihat jadwal", "View availability")
              : t("Lihat layanan", "View services")}
          </Action>
        </article>
      ))}
    </div>
  );
}
export function CustomerHome() {
  const { data, route, t, navigate } = useBooking();
  if (!data) return null;
  const { config } = data,
    brand = config.brand,
    layout = config.layout;
  if (layout === "service-market") return <ServiceCatalog home />;
  if (layout === "editorial")
    return (
      <>
        <section className="b-editorial-hero">
          <div className="b-editorial-intro">
            <h1>{brand.headline[route.lang]}</h1>
            <p>{brand.description[route.lang]}</p>
          </div>
          <div className="b-editorial-image">
            <img
              src={brand.heroImage}
              alt={brand.heroAlt[route.lang]}
              fetchPriority="high"
            />
            <div className="b-editorial-book">
              <span>
                {t(
                  "Ruang untuk perawatan yang terencana.",
                  "Make room for thoughtful care.",
                )}
              </span>
              <RouteLink className="b-link-button" to={{ page: "services" }}>
                {t("Jelajahi layanan", "Explore services")}
              </RouteLink>
            </div>
          </div>
        </section>
        <section className="b-section b-editorial-services">
          <div className="b-section-heading">
            <h2>{t("Layanan pilihan", "Selected services")}</h2>
            <RouteLink to={{ page: "services" }}>
              {t("Semua layanan", "All services")}
            </RouteLink>
          </div>
          {data.services
            .filter((s) => s.featured)
            .slice(0, 3)
            .map((s, i) => (
              <Reveal key={s.id}>
                <ServiceEntry service={s} index={i} large />
              </Reveal>
            ))}
        </section>
        <BusinessNote />
      </>
    );
  if (layout === "minimal-professional")
    return (
      <div className="b-professional-composition">
        <aside className="b-professional-rail">
          <span>{brand.name}</span>
          <p>{brand.address}</p>
          <RouteLink to={{ page: "about" }}>
            {t("Kontak & jam buka", "Contact & opening hours")}
          </RouteLink>
          <span className="b-rail-rule" />
        </aside>
        <div>
          <Reveal>
            <section className="b-minimal-hero">
              <h1>{brand.headline[route.lang]}</h1>
              <div className="b-minimal-intro">
                <p>{brand.description[route.lang]}</p>
                <RouteLink className="b-link-button" to={{ page: "services" }}>
                  {t("Pilih layanan", "Choose a service")}
                </RouteLink>
              </div>
            </section>
          </Reveal>
          {data.resources.some((r) => r.profile) ? (
            <section className="b-section b-minimal-people">
              <h2>{t("Kenali tim Anda", "Meet your team")}</h2>
              <ProfessionalList />
            </section>
          ) : (
            <section className="b-section b-minimal-people">
              {data.services.slice(0, 3).map((s, i) => (
                <ServiceEntry key={s.id} service={s} index={i} />
              ))}
            </section>
          )}
          <BusinessNote />
        </div>
      </div>
    );
  return (
    <>
      <section className="b-appointment-hero">
        <Reveal className="b-appointment-intro">
          <h1>{brand.headline[route.lang]}</h1>
          <p>{brand.description[route.lang]}</p>
          <div className="b-hero-photo">
            <img
              src={brand.heroImage}
              alt={brand.heroAlt[route.lang]}
              fetchPriority="high"
            />
            <span>
              <MapPin size={16} />
              {data.locations[0]?.name}
            </span>
          </div>
        </Reveal>
        <QuickStart />
      </section>
      <div className="b-assurance-strip">
        <span>
          <Clock3 size={19} />
          {t("Durasi dan jadwal jelas", "Clear appointment times")}
        </span>
        <span>
          <Check size={19} />
          {t("Pilih layanan yang sesuai", "Services that fit your needs")}
        </span>
        <span>
          <MapPin size={19} />
          {t("Lokasi mudah ditemukan", "Know where to arrive")}
        </span>
      </div>
      <section className="b-section">
        <div className="b-section-heading">
          <h2>
            {data.resources.some((r) => r.profile)
              ? t("Tim yang siap membantu", "People ready to help")
              : t("Pilihan layanan", "Your service options")}
          </h2>
          <RouteLink
            to={{
              page: data.resources.some((r) => r.profile)
                ? "professionals"
                : "services",
            }}
          >
            {t("Lihat semua", "View all")}
          </RouteLink>
        </div>
        {data.resources.some((r) => r.profile) ? (
          <ProfessionalList compact />
        ) : (
          <div className="b-service-grid">
            {data.services.slice(0, 3).map((s, i) => (
              <ServiceEntry key={s.id} service={s} index={i} />
            ))}
          </div>
        )}
      </section>
      <BusinessNote />
    </>
  );
}
function BusinessNote() {
  const { data, route, t } = useBooking();
  return (
    <section className="b-business-note">
      <h2>{t("Rencanakan kunjungan Anda.", "Plan your visit.")}</h2>
      <div>
        <p>{data!.config.policy.text[route.lang]}</p>
        <RouteLink to={{ page: "about" }}>
          {t(
            "Lihat lokasi, jam buka, dan pertanyaan umum",
            "View locations, hours, and common questions",
          )}
        </RouteLink>
      </div>
    </section>
  );
}
export function ServiceCatalog({ home = false }: { home?: boolean }) {
  const { data, route, t, navigate } = useBooking(),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState("featured");
  if (!data) return null;
  const selected = data.services.find((s) => s.id === route.service);
  if (selected && !home) return <ServiceDetail service={selected} />;
  const services = data.services
    .filter(
      (s) =>
        (!category || s.category === category) &&
        `${s.name[route.lang]} ${s.description[route.lang]}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "price"
        ? a.price - b.price
        : sort === "duration"
          ? a.duration - b.duration
          : Number(b.featured) - Number(a.featured),
    );
  return (
    <section
      className={`b-section b-catalog ${data.config.layout === "service-market" ? "b-market" : ""}`}
    >
      <div className="b-catalog-heading">
        <div>
          <h1>
            {home
              ? data.config.brand.headline[route.lang]
              : t("Temukan layanan yang tepat.", "Find the right service.")}
          </h1>
          <p>
            {home
              ? data.config.brand.description[route.lang]
              : t(
                  "Bandingkan durasi, harga, dan pilihan layanan sebelum menentukan jadwal.",
                  "Compare duration, price, and options before choosing a time.",
                )}
          </p>
        </div>
        <div className="b-search">
          <Search size={19} />
          <Input
            aria-label={t("Cari layanan", "Search services")}
            placeholder={t("Cari layanan...", "Search services...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="b-catalog-body">
        <aside className="b-category-nav">
          <h2>{t("Kategori", "Categories")}</h2>
          <nav aria-label={t("Kategori layanan", "Service categories")}>
            {[
              { id: "", name: { id: "Semua layanan", en: "All services" } },
              ...data.categories,
            ].map((c) => (
              <button
                type="button"
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.name[route.lang]}
                <span>
                  {
                    data.services.filter((s) => !c.id || s.category === c.id)
                      .length
                  }
                </span>
              </button>
            ))}
          </nav>
          <p>
            {t(
              "Harga dan durasi dapat berubah sesuai pilihan pada langkah berikutnya.",
              "Price and duration may change with the options chosen in the next step.",
            )}
          </p>
        </aside>
        <div className="b-catalog-results">
          <div className="b-results-bar">
            <span role="status">
              {services.length} {t("layanan", "services")}
            </span>
            <Picker
              label={t("Urutkan layanan", "Sort services")}
              value={sort}
              options={[
                { value: "featured", label: t("Pilihan utama", "Featured") },
                { value: "price", label: t("Harga terendah", "Lowest price") },
                {
                  value: "duration",
                  label: t("Durasi terpendek", "Shortest duration"),
                },
              ]}
              onChange={setSort}
            />
          </div>
          {services.length ? (
            <div className="b-service-grid">
              {services.map((s, i) => (
                <Reveal key={s.id}>
                  <ServiceEntry service={s} index={i} />
                </Reveal>
              ))}
            </div>
          ) : (
            <Empty
              title={t("Tidak ada layanan yang cocok", "No matching services")}
            >
              <p>
                {t(
                  "Coba kata lain atau pilih semua kategori.",
                  "Try another term or select all categories.",
                )}
              </p>
              <Action
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                }}
              >
                {t("Hapus pencarian", "Clear search")}
              </Action>
            </Empty>
          )}
        </div>
      </div>
    </section>
  );
}
function ServiceDetail({ service }: { service: Service }) {
  const { data, route, t, navigate } = useBooking();
  return (
    <section className="b-section b-service-detail">
      <RouteLink to={{ service: "", page: "services" }} className="b-back-link">
        {t("Kembali ke layanan", "Back to services")}
      </RouteLink>
      <div className="b-service-detail-grid">
        <img src={service.image} alt={service.name[route.lang]} />
        <div>
          <h1>{service.name[route.lang]}</h1>
          <div className="b-service-meta">
            <span>
              <Clock3 size={18} />
              {service.duration} {t("menit", "min")}
            </span>
            <Price service={service} />
          </div>
          <p>{service.description[route.lang]}</p>
          {service.packageItems.length > 0 && (
            <div className="b-inclusions">
              <h2>{t("Termasuk dalam layanan", "Included in this service")}</h2>
              {service.packageItems.map((item, i) => (
                <p key={i}>
                  <Check size={17} />
                  {item[route.lang]}
                </p>
              ))}
            </div>
          )}
          <p className="b-muted">{data!.config.policy.text[route.lang]}</p>
          {data!.capabilities.whatsapp && (
            <Action
              size="lg"
              onClick={() =>
                navigate({
                  page: "book",
                  service: service.id,
                  practitioner: "",
                })
              }
            >
              {data!.capabilities.booking
                ? t("Pilih waktu kunjungan", "Choose an appointment time")
                : t("Tanya melalui WhatsApp", "Ask through WhatsApp")}
            </Action>
          )}
          <RouteLink
            to={{ page: "about", service: "" }}
            className="b-back-link"
          >
            {t("Lokasi dan kontak", "Locations and contact")}
          </RouteLink>
        </div>
      </div>
    </section>
  );
}
export function ProfessionalsPage() {
  const { data, t } = useBooking();
  return (
    <section className="b-section b-professionals-page">
      <h1>{t("Kenali tim Anda.", "Meet your team.")}</h1>
      <p className="b-lead">
        {data!.config.preset === "medical"
          ? t(
              "Pilih spesialisasi dan dokter, lalu periksa jadwal konsultasi yang tersedia. Semua profil pada demo ini bersifat fiktif.",
              "Choose a specialty and practitioner, then check available consultation times. All profiles in this demo are fictional.",
            )
          : t(
              "Pilih orang yang sesuai untuk layanan Anda.",
              "Choose the right person for your appointment.",
            )}
      </p>
      {data!.resources.some((r) => r.profile) ? (
        <ProfessionalList />
      ) : (
        <Empty
          title={t(
            "Tim bekerja sesuai penugasan area kerja",
            "The team is assigned by service bay",
          )}
        />
      )}
    </section>
  );
}
export function AboutPage() {
  const { data, route, t } = useBooking();
  if (!data) return null;
  const days =
    route.lang === "id"
      ? ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
      : [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
  const clock = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  return (
    <section className="b-section b-about">
      <div className="b-about-intro">
        <h1>{t("Sebelum Anda datang.", "Before you arrive.")}</h1>
        <p>{data.config.brand.description[route.lang]}</p>
        {data.config.brand.example && (
          <p className="b-example-note">
            {t(
              "Usaha, alamat, harga, dan profil pada demo ini hanya contoh.",
              "The business, addresses, prices, and profiles in this demo are examples.",
            )}
          </p>
        )}
      </div>
      <div className="b-about-locations">
        {data.locations.map((location) => (
          <section key={location.id}>
            <h2>{location.name}</h2>
            <p>
              <MapPin size={18} />
              {location.address}
            </p>
            <dl>
              {days.map((day, index) => (
                <div key={day}>
                  <dt>{day}</dt>
                  <dd>
                    {location.schedule
                      .filter((s) => s.weekday === index)
                      .map((s) => `${clock(s.start)} - ${clock(s.end)}`)
                      .join(", ") || t("Tutup", "Closed")}
                  </dd>
                </div>
              ))}
            </dl>
            <small>{location.timezone}</small>
          </section>
        ))}
        <section>
          <h2>{t("Hubungi kami", "Contact us")}</h2>
          {data.config.brand.email ? (
            <a href={`mailto:${data.config.brand.email}`}>
              {data.config.brand.email}
            </a>
          ) : (
            <p>
              {t(
                "Alamat email belum diatur.",
                "An email address has not been configured.",
              )}
            </p>
          )}
          {data.config.brand.whatsapp ? (
            <a
              href={`https://wa.me/${data.config.brand.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp +{data.config.brand.whatsapp}
            </a>
          ) : (
            <p>
              {t(
                "Demo tidak menghubungi nomor usaha nyata.",
                "The demo does not contact a real business number.",
              )}
            </p>
          )}
          <h3>{t("Kebijakan janji", "Appointment policy")}</h3>
          <p>{data.config.policy.text[route.lang]}</p>
        </section>
      </div>
      <section className="b-faq">
        <h2>{t("Pertanyaan umum", "Common questions")}</h2>
        {data.config.brand.faqs.map((faq, i) => (
          <Disclosure key={i} title={faq.question[route.lang]}>
            <p>{faq.answer[route.lang]}</p>
          </Disclosure>
        ))}
      </section>
    </section>
  );
}
