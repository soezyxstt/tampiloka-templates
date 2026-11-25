import { statusLabels } from "../lib/labels";
import { useId, cloneElement, isValidElement, type ReactElement, type ReactNode, type ComponentProps } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import {
  Button,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  Input,
  Textarea,
  Dialog as SharedDialog,
  Reveal,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "@tampiloka/ui-core";
import { useBooking, useErrorText } from "../lib/store";
export { Input, Textarea, Reveal };
export function Dialog(props: ComponentProps<typeof SharedDialog>) {
  const { t } = useBooking();
  return (
    <SharedDialog {...props} closeLabel={t("Tutup dialog", "Close dialog")} />
  );
}
export function Action({
  busy,
  children,
  ...props
}: ComponentProps<typeof Button> & { busy?: boolean }) {
  return (
    <Button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <LoaderCircle className="b-spin" size={18} />}
      {children}
    </Button>
  );
}
export function Field({
  label,
  help,
  children,
  className = "",
}: {
  label: string;
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  const generatedId = useId();
  const child = isValidElement(children) ? children as ReactElement<Record<string, unknown>> : null;
  const controlId = String(child?.props.id || generatedId);
  const helpId = `${controlId}-help`;
  return (
    <div className={`b-field ${className}`}>
      <label htmlFor={controlId}>{label}</label>
      {child ? cloneElement(child, {id: controlId, ...(help ? {"aria-describedby": helpId} : {})}) : children}
      {help && <small id={helpId}>{help}</small>}
    </div>
  );
}
export function Picker({
  label,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  id: givenId,
  "aria-describedby": describedBy,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
  id?: string;
  "aria-describedby"?: string;
}) {
  const generated = useId(),
    id = givenId || generated;
  return (
    <SelectRoot
      value={value || "_all"}
      onValueChange={(v) => onChange(v === "_all" || typeof v !== "string" ? "" : v)}
      items={options.map((option) => ({ value: option.value || "_all", label: option.label }))}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={compact ? "b-select tl-demo-select" : "b-select"}
        aria-label={label}
        aria-describedby={describedBy}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        sideOffset={6}
        className={
          compact ? "b-select-menu tl-demo-select-menu" : "b-select-menu"
        }
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value || "_all"}
            className="b-select-option"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}
export function Disclosure({ title, children, className = "" }: { title: ReactNode; children: ReactNode; className?: string }) {
  return <Collapsible className={`b-disclosure ${className}`}>
    <CollapsibleTrigger className="b-disclosure-trigger"><span>{title}</span><ChevronDown size={18} aria-hidden="true" /></CollapsibleTrigger>
    <CollapsiblePanel className="b-disclosure-content">{children}</CollapsiblePanel>
  </Collapsible>;
}
export function ErrorNote({ error }: { error: unknown }) {
  const text = useErrorText(error);
  return text ? (
    <p className="b-error" role="alert">
      {text}
    </p>
  ) : null;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="b-empty">
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  );
}
export function Loading() {
  const { t } = useBooking();
  return (
    <div className="b-loading" role="status">
      <LoaderCircle size={22} className="b-spin" />
      {t("Memuat...", "Loading...")}
    </div>
  );
}
export function RouteLink({
  to,
  children,
  className = "",
}: {
  to: Parameters<ReturnType<typeof useBooking>["navigate"]>[0];
  children: ReactNode;
  className?: string;
}) {
  const { href, navigate } = useBooking();
  return (
    <a
      href={href(to)}
      className={className}
      onClick={(event) => {
        if (
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          event.button === 0
        ) {
          event.preventDefault();
          navigate(to);
        }
      }}
    >
      {children}
    </a>
  );
}
export function Status({ value }: { value: string }) {
  const { t } = useBooking();
  const pair = statusLabels[value] || [
    value.replaceAll("_", " "),
    value.replaceAll("_", " "),
  ];
  return <span className={`b-status b-status-${value}`}>{t(...pair)}</span>;
}
export const money = (n: number, lang = "id") =>
  new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
export const dateTime = (n: number, zone: string, lang = "id") =>
  new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(n);
