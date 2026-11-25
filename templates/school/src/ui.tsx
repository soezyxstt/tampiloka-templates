import { createContext, isValidElement, useContext, useId, type ReactElement, type ReactNode, type MouseEventHandler } from 'react';
import { ChevronDown, Menu as MenuIcon } from 'lucide-react';
import {
    Button,
    Collapsible as UiCollapsible,
    CollapsiblePanel,
    CollapsibleTrigger,
    Input,
    Menu,
    MenuContent,
    MenuItem,
    MenuTrigger,
    SelectContent,
    SelectItem,
    SelectRoot,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@tampiloka/ui-core';
import type { Field, Locale, Snapshot, Text } from './domain/types.ts';
import { visible } from './cms/registry.ts';
export interface AppContext {
    s: Snapshot;
    lang: Locale;
    params: URLSearchParams;
    href: (patch: Record<string, string>) => string;
    go: (patch: Record<string, string>) => void;
    request: <T = unknown>(path: string, body?: unknown) => Promise<T>;
    mutate: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
    refresh: () => Promise<void>;
    busy: boolean;
    message: string;
    setMessage: (value: string) => void;
}
export const App = createContext<AppContext | null>(null);
export function useApp() { const value = useContext(App); if (!value)
    throw new Error('School context missing'); return value; }
export function useText() { const { lang } = useApp(); return (id: string, en: string) => lang === 'id' ? id : en; }
export const local = (text: Text | undefined, lang: Locale) => text?.[lang] ?? '';
export const money = (amount: number, lang: Locale = 'id') => new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
export const when = (s: string, lang: Locale = 'id') => new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(s));
export function Link({ to, children, className, onClick, ...rest }: {
    to: Record<string, string>;
    children: ReactNode;
    className?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    [key: string]: unknown;
}) { const { href, go } = useApp(); return <a {...rest} className={className} href={href(to)} onClick={e => { onClick?.(e); if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    go(to);
} }}>{children}</a>; }
export function Pick({ label, value, options, onChange, demo = false, required = false, placeholder }: {
    label: string;
    value: string;
    options: {
        value: string;
        label: string;
    }[];
    onChange: (v: string) => void;
    demo?: boolean;
    required?: boolean;
    placeholder?: string;
}) {
    const id = useId();
    return <div className={demo ? 'school-demo-pick' : 'field'}>{!demo && <label id={id}>{label}</label>}<SelectRoot value={value} onValueChange={v => { if (typeof v === 'string') onChange(v); }} items={options} placeholder={placeholder} required={required}><SelectTrigger type="button" className={demo ? 'tl-demo-select' : 'school-select'} aria-label={label} aria-labelledby={demo ? undefined : id}><SelectValue /></SelectTrigger><SelectContent className="tl-demo-select-menu school-select-popup" sideOffset={6}>{options.map(x => <SelectItem className="tl-demo-select-item" value={x.value} key={x.value}>{x.label}</SelectItem>)}</SelectContent></SelectRoot></div>;
}
export function Collapsible({ title, children }: { title: ReactNode; children: ReactNode }) {
    return <UiCollapsible className="school-disclosure"><CollapsibleTrigger className="school-disclosure-trigger"><span>{title}</span><ChevronDown aria-hidden="true" size={20}/></CollapsibleTrigger><CollapsiblePanel className="school-disclosure-content">{children}</CollapsiblePanel></UiCollapsible>;
}
export function NavigationMenu({ label, children }: { label: string; children: ReactNode }) {
    return <Menu><MenuTrigger render={<Button className="mobile-menu" variant="ghost" size="icon" aria-label={label}><MenuIcon /></Button>} /><MenuContent className="school-navigation-menu" align="end" sideOffset={6}>{children}</MenuContent></Menu>;
}
export function NavigationMenuItem({ asChild, children, value }: { asChild?: boolean; children: ReactNode; value?: string }) {
    const fallbackId = useId();
    if (asChild && isValidElement(children)) {
        return <MenuItem value={value ?? fallbackId} render={children as ReactElement} />;
    }
    return <MenuItem value={value ?? fallbackId}>{children}</MenuItem>;
}
export function FieldInput({ field, values, set }: {
    field: Field;
    values: Record<string, unknown>;
    set: (key: string, value: unknown) => void;
}) {
    const { lang } = useApp();
    const id = useId();
    if (!visible(field, values))
        return null;
    const name = field.label[lang];
    const value = values[field.name];
    if (field.type === 'checkbox')
        return <label className="check-field"><input type="checkbox" checked={value === true} required={field.required} onChange={e => set(field.name, e.target.checked)}/><span>{name}{field.required ? ' *' : ''}</span></label>;
    if (field.type === 'select')
        return <Pick label={name + (field.required ? ' *' : '')} required={field.required} placeholder={lang === 'id' ? 'Pilih' : 'Choose'} value={String(value ?? '')} options={[...(!field.required ? [{ value: '__empty', label: lang === 'id' ? 'Pilih' : 'Choose' }] : []), ...field.options!.map(v => ({ value: v, label: v }))]} onChange={v => set(field.name, v === '__empty' ? '' : v)}/>;
    return <label className="field" htmlFor={id}>{name}{field.required ? ' *' : ''}{field.type === 'textarea' ? <Textarea id={id} value={String(value ?? '')} required={field.required} maxLength={field.maxLength ?? 500} onChange={e => set(field.name, e.target.value)}/> : <Input id={id} type={field.type} required={field.required} value={String(value ?? '')} min={field.min} max={field.max} maxLength={field.maxLength ?? 200} onChange={e => set(field.name, field.type === 'number' ? Number(e.target.value) : e.target.value)}/>}</label>;
}
const statuses: Record<string, [
    string,
    string
]> = { draft: ['Draf', 'Draft'], submitted: ['Diajukan', 'Submitted'], under_review: ['Ditinjau', 'Under review'], waitlisted: ['Daftar tunggu', 'Waitlisted'], accepted: ['Diterima', 'Accepted'], rejected: ['Ditolak', 'Rejected'], awaiting_payment: ['Menunggu pembayaran', 'Awaiting payment'], active: ['Aktif', 'Active'], cancelled: ['Dibatalkan', 'Cancelled'], completed: ['Selesai', 'Completed'], unpaid: ['Belum dibayar', 'Unpaid'], paid: ['Lunas', 'Paid'], void: ['Dibatalkan', 'Void'], present: ['Hadir', 'Present'], absent: ['Tidak hadir', 'Absent'], excused: ['Izin', 'Excused'], pending: ['Menunggu', 'Pending'], sent: ['Terkirim', 'Sent'], failed: ['Gagal', 'Failed'] };
export function Status({ value }: {
    value: string;
}) { const t = useText(); return <span className={`status status-${value}`}><span aria-hidden="true"/>{statuses[value] ? t(...statuses[value]) : value.replaceAll('_', ' ')}</span>; }
export function Empty({ children }: {
    children: ReactNode;
}) { return <div className="empty"><p>{children}</p></div>; }
export function SectionTitle({ title, children, as: Heading = 'h2' }: {
    title: string;
    children?: ReactNode;
    as?: 'h1' | 'h2';
}) { return <div className="section-title"><Heading>{title}</Heading>{children}</div>; }
export function AsyncButton({ action, children, variant = 'solid', ...rest }: {
    action: () => Promise<unknown>;
    children: ReactNode;
    variant?: 'solid' | 'outline' | 'ghost' | 'danger';
    disabled?: boolean;
    [key: string]: unknown;
}) { const { busy, setMessage } = useApp(); return <Button {...rest} variant={variant} disabled={busy || rest.disabled === true} onClick={() => void action().catch(e => setMessage(e.message))}>{children}</Button>; }
