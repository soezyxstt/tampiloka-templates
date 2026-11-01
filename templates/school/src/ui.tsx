import { createContext, useContext, useId, type ReactNode, type MouseEventHandler } from 'react';
import * as Select from '@radix-ui/react-select';
import * as RadixCollapsible from '@radix-ui/react-collapsible';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Check, Menu as MenuIcon } from 'lucide-react';
import { Button, Input, Textarea } from '@tampiloka/ui-core';
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
    return <div className={demo ? 'school-demo-pick' : 'field'}>{!demo && <label id={id}>{label}</label>}<Select.Root value={value} onValueChange={onChange} required={required}><Select.Trigger type="button" className={demo ? 'tl-demo-select' : 'school-select'} aria-label={label} aria-labelledby={demo ? undefined : id}><Select.Value placeholder={placeholder} /><Select.Icon><ChevronDown size={16} aria-hidden/></Select.Icon></Select.Trigger><Select.Portal><Select.Content className="tl-demo-select-menu school-select-popup" position="popper" sideOffset={6}><Select.Viewport>{options.map(x => <Select.Item className="tl-demo-select-item" value={x.value} key={x.value}><Select.ItemText>{x.label}</Select.ItemText><Select.ItemIndicator className="school-select-check"><Check size={16}/></Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal></Select.Root></div>;
}
export function Collapsible({ title, children }: { title: ReactNode; children: ReactNode }) {
    return <RadixCollapsible.Root className="school-disclosure"><RadixCollapsible.Trigger className="school-disclosure-trigger"><span>{title}</span><ChevronDown aria-hidden="true" size={20}/></RadixCollapsible.Trigger><RadixCollapsible.Content className="school-disclosure-content">{children}</RadixCollapsible.Content></RadixCollapsible.Root>;
}
export function NavigationMenu({ label, children }: { label: string; children: ReactNode }) {
    return <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button className="mobile-menu" variant="ghost" size="icon" aria-label={label}><MenuIcon /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="school-navigation-menu" align="end" sideOffset={6}>{children}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>;
}
export const NavigationMenuItem = DropdownMenu.Item;
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
