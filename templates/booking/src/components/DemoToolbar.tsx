import { useState } from "react";
import { DemoToolbarShell } from "@tampiloka/ui-core/demo";
import {
  CalendarDays,
  LayoutGrid,
  Settings2,
  Users,
  RotateCcw,
} from "lucide-react";
import { adapters } from "../domain/adapters";
import {
  LAYOUTS,
  LEVELS,
  PALETTES,
  PRESETS,
  type Bootstrap,
  type Layout,
  type Palette,
  type Level,
  type Preset,
  type Role,
} from "../domain/model";
import { useBooking } from "../lib/store";
import { api } from "../lib/api";
import { Action, Dialog, ErrorNote, Field, Picker } from "./ui";
import { layoutLabels, levelLabels } from "../lib/labels";
export function DemoToolbar() {
  const { data, route, navigate, refresh, loading, t, notify } = useBooking();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [confirmReset, setConfirmReset] = useState(false);
  if (!data?.demo) return null;
  async function scenario(reset = false) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Bootstrap | { created: number }>(
        `/api/demo/${reset ? "reset" : "scenario"}`,
        "POST",
        {},
      );
      if (reset) {
        sessionStorage.removeItem("tl-booking-attempt");
        navigate({
          view: "customer",
          page: "home",
          booking: "",
          service: "",
          preset: "medical",
          level: "full",
          layout: "appointment-first",
          palette: "sage",
        });
        setConfirmReset(false);
      }
      await refresh();
      notify(
        reset
          ? t("Data sesi ini direset.", "This session has been reset.")
          : t(
              `${"created" in r ? r.created : 0} janji contoh ditambahkan.`,
              `${"created" in r ? r.created : 0} example appointments added.`,
            ),
      );
      setOpen(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <DemoToolbarShell
        family="booking"
        label={t("Pengaturan demo Tampiloka", "Tampiloka demo settings")}
        galleryLabel={t(
          "Kembali ke template Tampiloka",
          "Back to Tampiloka templates",
        )}
        galleryUrl={
          route.lang === "en"
            ? "https://tampiloka.site/en/templates"
            : "https://tampiloka.site/templates"
        }
        controls={
          <>
            <Picker
              compact
              label={t("Tema demo", "Demo theme")}
              value={route.palette}
              options={PALETTES.map((value) => ({
                value,
                label: value[0].toUpperCase() + value.slice(1),
              }))}
              disabled={loading}
              onChange={(v) => navigate({ palette: v as Palette })}
            />
            <Picker
              compact
              label={t("Mode demo", "Demo mode")}
              value={route.level}
              options={LEVELS.map((value) => ({
                value,
                label: t(...levelLabels[value]),
              }))}
              disabled={loading}
              onChange={(v) =>
                navigate({
                  level: v as Level,
                  page: route.view === "staff" ? "calendar" : "home",
                  booking: "",
                  service: "",
                })
              }
            />
            <Picker
              compact
              label={t("Jenis usaha", "Business type")}
              value={route.preset}
              options={PRESETS.map((value) => ({
                value,
                label: adapters[value].name[route.lang],
              }))}
              disabled={loading}
              onChange={(v) =>
                navigate({
                  preset: v as Preset,
                  page: route.view === "staff" ? "calendar" : "home",
                  service: "",
                  practitioner: "",
                  booking: "",
                })
              }
            />
          </>
        }
        activeView={route.view}
        viewLabel={t("Tampilan demo", "Demo view")}
        views={[
          {
            id: "customer",
            label: t("Pelanggan", "Customer"),
            icon: <CalendarDays size={16} />,
            onSelect: () =>
              navigate({ view: "customer", page: "home", booking: "" }),
          },
          {
            id: "staff",
            label: t("Staf", "Staff"),
            icon: <Users size={16} />,
            onSelect: () =>
              navigate({ view: "staff", page: "calendar", booking: "" }),
          },
        ]}
        actions={
          <button
            type="button"
            aria-label={t("Sesuaikan demo", "Customize demo")}
            title={t("Sesuaikan demo", "Customize demo")}
            onClick={() => setOpen(true)}
          >
            <Settings2 size={16} />
          </button>
        }
      />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("Sesuaikan demo", "Customize demo")}
        description={t(
          "Tata letak, warna, fitur, dan jenis usaha dapat dipilih terpisah.",
          "Layout, color, features, and business type are independent.",
        )}
      >
        <div className="b-stack">
          <div className="b-layout-options">
            {LAYOUTS.map((layout) => (
              <button
                type="button"
                key={layout}
                aria-pressed={route.layout === layout}
                onClick={() => navigate({ layout })}
                disabled={loading}
              >
                <span
                  className={`b-layout-icon b-layout-icon-${layout}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                </span>
                <strong>{t(...layoutLabels[layout])}</strong>
              </button>
            ))}
          </div>
          <Field label={t("Palet warna", "Color palette")}>
            <Picker
              label={t("Palet warna", "Color palette")}
              value={route.palette}
              options={PALETTES.map((value) => ({
                value,
                label: value[0].toUpperCase() + value.slice(1),
              }))}
              onChange={(v) => navigate({ palette: v as Palette })}
            />
          </Field>
          {route.view === "staff" && (
            <Field label={t("Peran staf demo", "Demo staff role")}>
              <Picker
                label={t("Peran staf demo", "Demo staff role")}
                value={route.role}
                options={[
                  { value: "owner", label: t("Pemilik", "Owner") },
                  {
                    value: "operations",
                    label: t("Operasional", "Operations"),
                  },
                  { value: "viewer", label: t("Pembaca", "Viewer") },
                ]}
                onChange={(v) =>
                  navigate({ role: v as Exclude<Role, "customer"> })
                }
              />
            </Field>
          )}
          <p className="b-muted">
            {t(
              "Ini usaha fiktif. Pembayaran hanya simulasi. Data pelanggan dan staf hanya berlaku dalam sesi Anda.",
              "This is a fictional business. Payments are simulated. Customer and staff data belongs only to your session.",
            )}
          </p>
          <div className="b-actions">
            {data.capabilities.booking && (
              <Action
                variant="outline"
                busy={busy}
                onClick={() => void scenario()}
              >
                <CalendarDays size={16} />
                {t("Isi janji contoh", "Add sample appointments")}
              </Action>
            )}
            <Action variant="ghost" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={16} />
              {t("Reset sesi", "Reset session")}
            </Action>
          </div>
          {confirmReset && (
            <div className="b-callout">
              <p>
                {t(
                  "Hapus semua data pada sesi demo ini?",
                  "Delete all data in this demo session?",
                )}
              </p>
              <div className="b-actions">
                <Action
                  variant="danger"
                  busy={busy}
                  onClick={() => void scenario(true)}
                >
                  {t("Hapus data sesi", "Delete session data")}
                </Action>
                <Action variant="ghost" onClick={() => setConfirmReset(false)}>
                  {t("Batal", "Cancel")}
                </Action>
              </div>
            </div>
          )}
          <ErrorNote error={error} />
        </div>
      </Dialog>
    </>
  );
}
