import { statusLabels } from "../lib/labels";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Layers3,
  LogOut,
  MapPin,
  Receipt,
  RefreshCw,
  Search,
  Settings2,
  Ticket,
  Users,
} from "lucide-react";
import type { Booking, BookingPage, StaffSnapshot } from "../domain/model";
import { BOOKING_STATES } from "../domain/model";
import { localTime, utcCandidates } from "../domain/time";
import { api } from "../lib/api";
import type { Page } from "../lib/navigation";
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
  Status,
  dateTime,
  money,
} from "../components/ui";
import { BookingDetail } from "../components/BookingDetail";
import { ContentManager, SiteSettings } from "./StaffContent";
import { TimeOff } from "./StaffSchedule";
import { TicketScanner } from "./TicketScanner";

function StaffLogin() {
  const { t, refresh } = useBooking(),
    [role, setRole] = useState("owner"),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/staff/login", "POST", { role, password });
      setPassword("");
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="b-login">
      <form onSubmit={submit} className="b-stack">
        <Users size={30} />
        <h1>{t("Masuk ruang staf", "Staff sign-in")}</h1>
        <p>
          {t(
            "Akses ini hanya untuk pengelola usaha.",
            "This workspace is for business staff only.",
          )}
        </p>
        <Field label={t("Peran", "Role")}>
          <Picker
            label={t("Peran staf", "Staff role")}
            value={role}
            options={[
              { value: "owner", label: t("Pemilik", "Owner") },
              { value: "operations", label: t("Operasional", "Operations") },
              { value: "viewer", label: t("Pembaca", "Viewer") },
            ]}
            onChange={setRole}
          />
        </Field>
        <Field label={t("Kata sandi", "Password")}>
          <Input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorNote error={error} />
        <Action type="submit" busy={busy}>
          {t("Masuk", "Sign in")}
        </Action>
        <RouteLink to={{ view: "customer", page: "home" }}>
          {t("Kembali ke situs pelanggan", "Back to customer site")}
        </RouteLink>
      </form>
    </section>
  );
}
export function StaffWorkspace() {
  const { data, route, t, refresh, navigate, loading } = useBooking(),
    [snapshot, setSnapshot] = useState<StaffSnapshot | null>(null),
    [error, setError] = useState<unknown>(null),
    [revision, setRevision] = useState(0);
  const reload = useCallback(async () => {
    const next = await api<StaffSnapshot>("/api/staff/snapshot");
    setSnapshot(next);
    setRevision((v) => v + 1);
    await refresh();
  }, [refresh]);
  useEffect(() => {
    if (!data || data.role === "customer") {
      setSnapshot(null);
      return;
    }
    let active = true;
    setSnapshot(null);
    setError(null);
    api<StaffSnapshot>("/api/staff/snapshot")
      .then((v) => {
        if (active) setSnapshot(v);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [data?.config.preset, data?.config.level, data?.role, data?.revision]);
  if (!data) return <Loading />;
  if (data.role === "customer") return <StaffLogin />;
  const entries: [Page, string, string, typeof CalendarDays][] = [
    ...(data.capabilities.booking
      ? ([
          ["calendar", "Kalender", "Calendar", CalendarDays],
          ["bookings", "Daftar janji", "Appointments", ClipboardList],
        ] as [Page, string, string, typeof CalendarDays][])
      : []),
    ["content", "Layanan & harga", "Services & pricing", Layers3],
    ["resources", "Tim & jadwal", "Team & schedules", Users],
    ["locations", "Lokasi", "Locations", MapPin],
    ...(data.capabilities.payments
      ? ([
          ["payments", "Pembayaran", "Payments", Receipt],
          ["tickets", "Periksa tiket", "Verify ticket", Ticket],
        ] as [Page, string, string, typeof CalendarDays][])
      : []),
    ["settings", "Situs & pengaturan", "Site & settings", Settings2],
  ];
  const page = entries.some(([id]) => id === route.page)
    ? route.page
    : data.capabilities.booking
      ? "calendar"
      : "content";
  return (
    <div className="b-staff">
      <aside className="b-staff-sidebar">
        <div className="b-staff-brand">
          <strong>{data.config.brand.name}</strong>
          <span>{t("Ruang kerja staf", "Staff workspace")}</span>
        </div>
        <nav
          aria-label={t("Navigasi ruang staf", "Staff workspace navigation")}
        >
          {entries.map(([id, idLabel, enLabel, Icon]) => (
            <RouteLink
              key={id}
              to={{ page: id, booking: "" }}
              className={page === id ? "is-active" : ""}
            >
              <Icon size={18} />
              <span>{t(idLabel, enLabel)}</span>
            </RouteLink>
          ))}
        </nav>
        <div className="b-staff-bottom">
          <span>
            {t("Peran", "Role")}: {data.role}
          </span>
          {!data.demo && (
            <Action
              variant="ghost"
              onClick={() => {
                void api("/api/logout", "POST", {})
                  .then(refresh)
                  .catch(setError);
              }}
            >
              <LogOut size={16} />
              {t("Keluar", "Sign out")}
            </Action>
          )}
          <RouteLink to={{ view: "customer", page: "home", booking: "" }}>
            {t("Lihat situs pelanggan", "View customer site")}
          </RouteLink>
        </div>
      </aside>
      <div className="b-staff-main">
        <header className="b-staff-top">
          <span>
            {t("Operasional", "Operations")} /{" "}
            <strong>
              {t(
                entries.find(([id]) => id === page)![1],
                entries.find(([id]) => id === page)![2],
              )}
            </strong>
          </span>
          <span>{data.config.timezone}</span>
          {!data.demo && (
            <Action
              className="b-mobile-logout"
              variant="ghost"
              size="sm"
              onClick={() => {
                void api("/api/logout", "POST", {})
                  .then(refresh)
                  .catch(setError);
              }}
            >
              <LogOut size={16} />
              {t("Keluar", "Sign out")}
            </Action>
          )}
        </header>
        <main id="main-content" className="b-staff-content b-page-content" key={route.page}>
          <ErrorNote error={error} />
          {Boolean(error) && (
            <Action
              variant="outline"
              onClick={() => void reload().catch(setError)}
            >
              {t("Coba lagi", "Retry")}
            </Action>
          )}
          {loading || !snapshot ||
          snapshot.config.preset !== data.config.preset ||
          snapshot.config.level !== data.config.level ||
          snapshot.role !== data.role ||
          snapshot.revision !== data.revision ||
          (data.demo && (route.role !== data.role || route.preset !== data.config.preset || route.level !== data.config.level)) ? (
            <Loading />
          ) : (
            <>
              {(["calendar", "bookings", "payments"] as Page[]).includes(
                page,
              ) && (
                <BookingOperations
                  snapshot={snapshot}
                  page={page}
                  revision={revision}
                  reload={reload}
                />
              )}
              {page === "content" && (
                <ContentManager
                  key={`content-${snapshot.config.preset}`}
                  snapshot={snapshot}
                  reload={reload}
                  initialKind="service"
                />
              )}
              {page === "resources" && (
                <>
                  <ContentManager
                    key={`resource-${snapshot.config.preset}`}
                    snapshot={snapshot}
                    reload={reload}
                    initialKind="resource"
                  />
                  <TimeOff snapshot={snapshot} reload={reload} />
                </>
              )}
              {page === "locations" && (
                <ContentManager
                  key={`location-${snapshot.config.preset}`}
                  snapshot={snapshot}
                  reload={reload}
                  initialKind="location"
                />
              )}
              {page === "settings" && (
                <SiteSettings
                  key={`${snapshot.config.preset}-${snapshot.config.level}`}
                  snapshot={snapshot}
                  reload={reload}
                />
              )}
              {page === "tickets" && <TicketScanner />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
function dayShift(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
function BookingOperations({
  snapshot,
  page,
  revision,
  reload,
}: {
  snapshot: StaffSnapshot;
  page: Page;
  revision: number;
  reload: () => Promise<void>;
}) {
  const { route, t, navigate } = useBooking(),
    [date, setDate] = useState(
      () => localTime(Date.now(), snapshot.config.timezone).date,
    ),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [fromDate, setFromDate] = useState(""),
    [toDate, setToDate] = useState(""),
    [offset, setOffset] = useState(0),
    [list, setList] = useState<BookingPage | null>(null),
    [error, setError] = useState<unknown>(null);
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay(),
    monday = dayShift(date, -((dayOfWeek + 6) % 7)),
    days = Array.from({ length: 7 }, (_, i) => dayShift(monday, i));
  const query = new URLSearchParams({
    limit: page === "calendar" ? "100" : "25",
    offset: String(page === "calendar" ? 0 : offset),
    q: search,
    status,
  });
  if (page === "calendar") {
    query.set(
      "from",
      String(utcCandidates(monday, snapshot.config.timezone)[0]),
    );
    query.set(
      "to",
      String(utcCandidates(dayShift(monday, 7), snapshot.config.timezone)[0]),
    );
  }
  if (page !== "calendar") {
    if (fromDate)
      query.set(
        "from",
        String(utcCandidates(fromDate, snapshot.config.timezone)[0]),
      );
    if (toDate)
      query.set(
        "to",
        String(utcCandidates(dayShift(toDate, 1), snapshot.config.timezone)[0]),
      );
  }
  const queryString = query.toString();
  useEffect(() => {
    setList(null);
    setError(null);
    const controller = new AbortController();
    api<BookingPage>(
      `/api/staff/bookings?${queryString}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then(setList)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => controller.abort();
  }, [queryString, revision, snapshot.config.preset, snapshot.config.level]);
  useEffect(() => {
    setOffset(0);
    setSearch("");
    setStatus("all");
  }, [page, snapshot.config.preset]);
  const metrics = snapshot.metrics,
    payments = page === "payments",
    calendar = page === "calendar";
  return (
    <>
      <div className="b-section-heading">
        <div>
          <h1>
            {calendar
              ? t("Kalender janji", "Appointment calendar")
              : payments
                ? t("Pembayaran & laporan", "Payments & reporting")
                : t("Daftar janji", "Appointments")}
          </h1>
          <p>
            {calendar
              ? t(
                  "Lihat jadwal mingguan dan kelola setiap kunjungan.",
                  "Review the week and manage each visit.",
                )
              : payments
                ? t(
                    "Nilai penerimaan berasal dari catatan pembayaran yang telah diverifikasi.",
                    "Received amounts come from verified payment records.",
                  )
                : t(
                    "Cari pelanggan, buka detail, dan ubah status janji.",
                    "Find customers, open details, and update appointment status.",
                  )}
          </p>
        </div>
        <div className="b-actions">
          <Action
            variant="outline"
            aria-label={t("Muat ulang ruang kerja", "Refresh workspace")}
            onClick={() => void reload().catch(setError)}
          >
            <RefreshCw size={16} />
            {t("Perbarui", "Refresh")}
          </Action>
          {payments && (
            <a
              className="b-link-button b-link-outline"
              href="/api/staff/report.csv"
              download
            >
              <Download size={16} />
              {t("Ekspor CSV", "Export CSV")}
            </a>
          )}
        </div>
      </div>
      <div className="b-metrics">
        {(payments
          ? [
              [
                t("Penerimaan", "Received"),
                money(metrics.received, route.lang),
              ],
              [
                t("Dana kembali", "Refunded"),
                money(metrics.refunded, route.lang),
              ],
              [
                t("Perlu pengembalian", "Refund due"),
                money(metrics.refundDue, route.lang),
              ],
            ]
          : [
              [t("Total janji", "Total appointments"), metrics.appointments],
              [t("Terkonfirmasi", "Confirmed"), metrics.confirmed],
              [t("Menunggu tindakan", "Awaiting action"), metrics.pending],
            ]
        ).map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="b-operation-filters">
        {calendar ? (
          <div className="b-calendar-date">
            <Action
              variant="outline"
              size="icon"
              aria-label={t("Minggu sebelumnya", "Previous week")}
              onClick={() => setDate(dayShift(date, -7))}
            >
              <ChevronLeft size={18} />
            </Action>
            <Input
              type="date"
              value={date}
              aria-label={t("Tanggal kalender", "Calendar date")}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
            <Action
              variant="outline"
              size="icon"
              aria-label={t("Minggu berikutnya", "Next week")}
              onClick={() => setDate(dayShift(date, 7))}
            >
              <ChevronRight size={18} />
            </Action>
            <Action
              variant="ghost"
              onClick={() =>
                setDate(localTime(Date.now(), snapshot.config.timezone).date)
              }
            >
              {t("Hari ini", "Today")}
            </Action>
          </div>
        ) : (
          <div className="b-search">
            <Search size={17} />
            <Input
              aria-label={t("Cari janji", "Search appointments")}
              placeholder={t("Nama atau referensi...", "Name or reference...")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
          </div>
        )}
        {!calendar && (
          <>
            <Field label={t("Dari tanggal", "From date")}>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setOffset(0);
                }}
              />
            </Field>
            <Field label={t("Sampai tanggal", "Through date")}>
              <Input
                type="date"
                min={fromDate || undefined}
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setOffset(0);
                }}
              />
            </Field>
          </>
        )}
        <Picker
          label={t("Filter status janji", "Appointment status filter")}
          value={status}
          options={[
            { value: "all", label: t("Semua status", "All statuses") },
            ...BOOKING_STATES.map((value) => ({
              value,
              label: t(...statusLabels[value]),
            })),
          ]}
          onChange={(v) => {
            setStatus(v);
            setOffset(0);
          }}
        />
      </div>
      <ErrorNote error={error} />
      {!list && !error ? (
        <Loading />
      ) : calendar && list ? (
        <>
          <div className="b-week-calendar">
            {days.map((day) => {
              const entries = list.bookings
                .filter((b) => localTime(b.startsAt, b.timezone).date === day)
                .sort((a, b) => a.startsAt - b.startsAt);
              return (
                <section
                  key={day}
                  className={day === date ? "is-selected" : ""}
                >
                  <h2>
                    {new Intl.DateTimeFormat(
                      route.lang === "id" ? "id-ID" : "en-GB",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      },
                    ).format(new Date(day + "T12:00:00Z"))}
                  </h2>
                  <div>
                    {entries.map((b) => (
                      <button
                        type="button"
                        key={b.id}
                        className={`b-calendar-event b-event-${b.status}`}
                        onClick={() => navigate({ booking: b.id })}
                      >
                        <time>{localTime(b.startsAt, b.timezone).label}</time>
                        <strong>{b.customer.name}</strong>
                        <span>{b.item.name[route.lang]}</span>
                        <Status value={b.status} />
                      </button>
                    ))}
                    {!entries.length && (
                      <p>{t("Tidak ada janji", "No appointments")}</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          {list.total > list.bookings.length && (
            <p className="b-callout">
              {t(
                "Kalender menampilkan 100 janji. Buka daftar janji untuk melihat semua data.",
                "The calendar shows 100 appointments. Open the appointment list to see every record.",
              )}
            </p>
          )}
        </>
      ) : list?.bookings.length ? (
        <div className="b-table-scroll">
          <table className="b-table">
            <thead>
              <tr>
                <th>{t("Janji", "Appointment")}</th>
                <th>{t("Pelanggan", "Customer")}</th>
                <th>{t("Waktu", "Time")}</th>
                <th>{t("Status", "Status")}</th>
                {payments && (
                  <>
                    <th>{t("Diterima", "Received")}</th>
                    <th>{t("Dana kembali", "Refunded")}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {list.bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <button
                      type="button"
                      className="b-table-link"
                      onClick={() => navigate({ booking: b.id })}
                    >
                      {b.reference}
                    </button>
                    <small>{b.item.name[route.lang]}</small>
                  </td>
                  <td>
                    <strong>{b.customer.name}</strong>
                    <small>{b.customer.phone}</small>
                  </td>
                  <td>
                    {dateTime(b.startsAt, b.timezone, route.lang)}
                    <small>{b.practitionerName || b.locationName}</small>
                  </td>
                  <td>
                    <Status value={payments ? b.paymentStatus : b.status} />
                  </td>
                  {payments && (
                    <>
                      <td>{money(b.paidAmount, route.lang)}</td>
                      <td>{money(b.refundedAmount, route.lang)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !error && (
          <Empty
            title={t("Tidak ada janji yang sesuai", "No matching appointments")}
          >
            <p>
              {t(
                "Ubah pencarian atau coba alur pemesanan pelanggan.",
                "Change the filters or try the customer booking flow.",
              )}
            </p>
          </Empty>
        )
      )}
      {!calendar && list && (
        <div className="b-pagination">
          <span>
            {list.total} {t("janji", "appointments")} · {t("Halaman", "Page")}{" "}
            {Math.floor(offset / 25) + 1}
          </span>
          <div>
            <Action
              variant="outline"
              size="sm"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 25))}
            >
              {t("Sebelumnya", "Previous")}
            </Action>
            <Action
              variant="outline"
              size="sm"
              disabled={offset + 25 >= list.total}
              onClick={() => setOffset(offset + 25)}
            >
              {t("Berikutnya", "Next")}
            </Action>
          </div>
        </div>
      )}
      <BookingDetail staff onChanged={() => void reload().catch(setError)} />
    </>
  );
}
