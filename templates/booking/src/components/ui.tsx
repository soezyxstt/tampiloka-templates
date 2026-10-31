import { statusLabels } from "../lib/labels";
import { useId, type ReactNode, type ComponentProps } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Dialog as SharedDialog,
  Reveal,
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
  return (
    <label className={`b-field ${className}`}>
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
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
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  compact?: boolean;
  id?: string;
}) {
  const generated = useId(),
    id = givenId || generated;
  return (
    <Select.Root
      value={value || "_all"}
      onValueChange={(v) => onChange(v === "_all" ? "" : v)}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        className={compact ? "b-select tl-demo-select" : "b-select"}
        aria-label={label}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className={
            compact ? "b-select-menu tl-demo-select-menu" : "b-select-menu"
          }
        >
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value || "_all"}
                className="b-select-option"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={15} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
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
