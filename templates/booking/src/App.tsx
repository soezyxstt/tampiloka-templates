import {
  Component,
  Suspense,
  lazy,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { MotionProvider } from "@tampiloka/ui-core";
import { BookingProvider, useBooking } from "./lib/store";
import { DemoToolbar } from "./components/DemoToolbar";
import { Action, ErrorNote, Loading } from "./components/ui";
import {
  AboutPage,
  CustomerFooter,
  CustomerHeader,
  CustomerHome,
  ProfessionalsPage,
  ServiceCatalog,
} from "./pages/Customer";
import { BookingForm } from "./pages/BookingForm";
import { Appointments, PendingAttempt } from "./pages/Appointments";
const StaffWorkspace = lazy(() =>
  import("./pages/Staff").then((module) => ({
    default: module.StaffWorkspace,
  })),
);
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() {
    return this.state.failed ? (
      <main className="b-fatal">
        <h1>Halaman belum dapat dimuat / Unable to load page</h1>
        <p>Muat ulang untuk mencoba lagi. / Reload to retry.</p>
        <button type="button" onClick={() => location.reload()}>
          Muat ulang / Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Content() {
  const { data, route, loading, error, navigate, t, notice } = useBooking();
  if (!data)
    return (
      <main className="b-fatal">
        {error ? (
          <>
            <ErrorNote error={error} />
            <Action onClick={() => location.reload()}>
              {t("Coba lagi", "Retry")}
            </Action>
          </>
        ) : (
          <Loading />
        )}
      </main>
    );
  const publicDemo = __PUBLIC_DEMO__ && data.demo;
  return (
    <div
      className="booking-app"
      data-preset={data.config.preset}
      data-level={data.config.level}
      data-layout={data.config.layout}
      data-palette={data.config.palette}
      data-view={route.view}
    >
      <a className="b-skip" href="#main-content">
        {t("Lewati ke isi", "Skip to content")}
      </a>
      {publicDemo && <DemoToolbar />}
      {loading && (
        <div className="b-progress" role="status">
          {t("Memperbarui pilihan...", "Updating selection...")}
        </div>
      )}
      {error && (
        <div className="b-global-error">
          <ErrorNote error={error} />
        </div>
      )}
      {route.view === "staff" ? (
        <Suspense fallback={<Loading />}>
          <StaffWorkspace />
        </Suspense>
      ) : (
        <>
          <CustomerHeader />
          <main id="main-content">
            <PendingAttempt
              key={`${route.page}-${route.preset}-${route.level}`}
            />
            {route.page === "book" ? (
              <BookingForm
                key={`${data.config.preset}-${data.config.level}-${route.service}-${route.practitioner}-${route.channel}`}
              />
            ) : route.page === "services" ? (
              <ServiceCatalog />
            ) : route.page === "professionals" ? (
              <ProfessionalsPage />
            ) : route.page === "about" ? (
              <AboutPage />
            ) : route.page === "appointments" ? (
              <Appointments />
            ) : (
              <CustomerHome />
            )}
          </main>
          <CustomerFooter />
        </>
      )}
      {publicDemo && (
        <button
          type="button"
          className="tl-demo-language language-toggle"
          aria-label={
            route.lang === "id"
              ? "Switch to English"
              : "Ganti ke Bahasa Indonesia"
          }
          onClick={() => navigate({ lang: route.lang === "id" ? "en" : "id" })}
        >
          <span className={route.lang === "id" ? "is-active" : ""}>ID</span>
          <span aria-hidden="true">/</span>
          <span className={route.lang === "en" ? "is-active" : ""}>EN</span>
        </button>
      )}
      {!publicDemo && (
        <button
          type="button"
          className="b-client-language"
          aria-label={
            route.lang === "id"
              ? "Switch to English"
              : "Ganti ke Bahasa Indonesia"
          }
          onClick={() => navigate({ lang: route.lang === "id" ? "en" : "id" })}
        >
          {route.lang === "id" ? "English" : "Bahasa Indonesia"}
        </button>
      )}
      <div
        className={notice ? "b-toast is-visible" : "b-toast"}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </div>
  );
}
export default function App() {
  return (
    <Boundary>
      <MotionProvider>
        <BookingProvider>
          <Content />
        </BookingProvider>
      </MotionProvider>
    </Boundary>
  );
}
