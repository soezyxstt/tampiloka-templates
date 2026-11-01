import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Bootstrap, Language } from "../domain/model";
import { api, ApiError } from "./api";
import { apiErrorText } from "./error-text";
import { readRoute, routeUrl, type RouteState } from "./navigation";
interface Store {
  data: Bootstrap | null;
  route: RouteState;
  loading: boolean;
  error: unknown;
  notice: string;
  navigate: (patch: Partial<RouteState>) => void;
  href: (patch: Partial<RouteState>) => string;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
  t: (id: string, en: string) => string;
}
const Context = createContext<Store | null>(null);
function language() {
  try {
    return (
      localStorage.getItem("tampiloka-language-choice") ||
      (navigator.language.startsWith("id") ? "id" : "en")
    );
  } catch {
    return "id";
  }
}
export function BookingProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState(() =>
      readRoute(new URL(location.href), language()),
    ),
    [data, setData] = useState<Bootstrap | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  const initialLanguage = useRef(
      (() => {
        try {
          return (
            new URL(location.href).searchParams.has("lang") ||
            Boolean(localStorage.getItem("tampiloka-language-choice"))
          );
        } catch {
          return false;
        }
      })(),
    ),
    languageInitialized = useRef(false);
  const latest = useRef(route),
    queue = useRef(Promise.resolve()),
    sequence = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  latest.current = route;
  const navigate = useCallback((patch: Partial<RouteState>) => {
    const next = { ...latest.current, ...patch };
    history.pushState(
      {},
      "",
      routeUrl(new URL(location.href), next, __PUBLIC_DEMO__),
    );
    setRoute(next);
    if (patch.page) window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const href = (patch: Partial<RouteState>) =>
    routeUrl(new URL(location.href), { ...route, ...patch }, __PUBLIC_DEMO__);
  const notify = (message: string) => {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 6000);
  };
  const refresh = useCallback(async () => {
    const updated = await api<Bootstrap>("/api/bootstrap");
    setData(updated);
  }, []);
  useEffect(() => {
    const pop = () => setRoute(readRoute(new URL(location.href), language()));
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    document.documentElement.lang = route.lang;
    if (__PUBLIC_DEMO__ || data || initialLanguage.current)
      try {
        localStorage.setItem("tampiloka-language-choice", route.lang);
      } catch {}
  }, [route.lang]);
  useEffect(() => {
    const ticket = ++sequence.current;
    setLoading(true);
    setError("");
    // Serialize demo writes so rapid selector changes and browser back cannot race on the server.
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        let next = await api<Bootstrap>("/api/bootstrap");
        if (__PUBLIC_DEMO__ && next.demo) {
          if (
            ["preset", "level", "layout", "palette"].some(
              (k) =>
                next.config[k as keyof typeof next.config] !==
                route[k as keyof RouteState],
            )
          )
            next = await api<Bootstrap>("/api/demo/config", "POST", {
              preset: route.preset,
              level: route.level,
              layout: route.layout,
              palette: route.palette,
            });
          const role = route.view === "staff" ? route.role : "customer";
          if (next.role !== role)
            next = await api<Bootstrap>("/api/demo/role", "POST", { role });
        }
        if (ticket === sequence.current) {
          if (!__PUBLIC_DEMO__ && !languageInitialized.current) {
            languageInitialized.current = true;
            if (!initialLanguage.current)
              setRoute((r) => ({ ...r, lang: next.config.language }));
          }
          setData(next);
        }
      })
      .catch((cause) => {
        if (ticket === sequence.current) setError(cause);
      })
      .finally(() => {
        if (ticket === sequence.current) setLoading(false);
      });
  }, [
    route.preset,
    route.level,
    route.layout,
    route.palette,
    route.view,
    route.role,
  ]);
  useEffect(() => {
    if (!data) return;
    const html = document.documentElement;
    html.dataset.palette = data.config.palette;
    html.dataset.layout = data.config.layout;
    html.dataset.view = route.view;
    html.dataset.font = data.config.typography;
    document.title = `${data.config.brand.name} · ${route.lang === "id" ? "Janji layanan" : "Appointments"}`;
  }, [data, route.view, route.lang]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Context.Provider
      value={{
        data,
        route,
        loading,
        error,
        notice,
        navigate,
        href,
        refresh,
        notify,
        t: (id, en) => (route.lang === "id" ? id : en),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useBooking() {
  const context = useContext(Context);
  if (!context) throw new Error("BookingProvider is missing");
  return context;
}
export function useErrorText(error: unknown) {
  const { t, route } = useBooking();

  return error instanceof ApiError
    ? apiErrorText(error.code, error.message, route.lang)
    : error
      ? t("Terjadi kendala. Coba lagi.", "Something went wrong. Please retry.")
      : "";
}
