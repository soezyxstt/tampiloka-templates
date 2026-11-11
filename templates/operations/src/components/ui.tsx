import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
export { Button, Input, Textarea, Dialog } from '@tampiloka/ui-core';
export function Picker({value, options, onChange, label, compact = false, disabled = false, id, 'aria-describedby': describedBy}: {value: string; options: {value:string;label:string}[]; onChange:(v:string)=>void; label:string;compact?:boolean;disabled?:boolean;id?:string;'aria-describedby'?:string}) {
 return <Select.Root value={value || '__all'} onValueChange={v=>onChange(v==='__all'?'':v)} disabled={disabled}><Select.Trigger id={id} aria-label={label} aria-describedby={describedBy} className={`op-select ${compact?'tl-demo-select':''}`}><Select.Value placeholder={label}/><Select.Icon><ChevronDown size={16} aria-hidden="true"/></Select.Icon></Select.Trigger><Select.Portal><Select.Content position="popper" sideOffset={6} className={`op-select-menu ${compact?'tl-demo-select-menu':''}`}><Select.ScrollUpButton className="op-select-scroll">⌃</Select.ScrollUpButton><Select.Viewport>{options.map(o=><Select.Item key={o.value} value={o.value||'__all'} className="op-select-option"><Select.ItemText>{o.label}</Select.ItemText><Select.ItemIndicator><Check size={16} aria-hidden="true"/></Select.ItemIndicator></Select.Item>)}</Select.Viewport><Select.ScrollDownButton className="op-select-scroll">⌄</Select.ScrollDownButton></Select.Content></Select.Portal></Select.Root>;
}
export function Field({label,help,children}: {label:string;help?:string;children:ReactNode}) { const id=useId(); const child=isValidElement(children)?children as ReactElement<Record<string,unknown>>:null; return <div className="op-field"><label htmlFor={id}>{label}</label>{child?cloneElement(child,{id,...(help?{'aria-describedby':`${id}-help`}:{})}):children}{help&&<small id={`${id}-help`}>{help}</small>}</div>; }
export function Notice({children,kind='info'}:{children:ReactNode;kind?:'info'|'danger'|'warning'|'success'}) {return <div className={`op-notice op-${kind}`} role={kind==='danger'?'alert':'status'}>{children}</div>;}
export function Empty({children}:{children:ReactNode}){return <div className="op-empty">{children}</div>;}
export function Panel({title,children,action,toolbar}:{title:string;children:ReactNode;action?:ReactNode;toolbar?:ReactNode}){return <section className="op-panel"><header><h2>{title}</h2>{action}{toolbar}</header>{children}</section>;}

export function Table({headers,children}:{headers:string[];children:ReactNode}){return <div className="op-table-wrap" tabIndex={0}><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;}

export function Disclosure({title,children,defaultOpen=false}:{title:string;children:ReactNode;defaultOpen?:boolean}) {
 return <Collapsible.Root className="op-disclosure" defaultOpen={defaultOpen}><Collapsible.Trigger className="op-disclosure-trigger"><span>{title}</span><ChevronDown size={16} aria-hidden="true"/></Collapsible.Trigger><Collapsible.Content className="op-disclosure-content">{children}</Collapsible.Content></Collapsible.Root>;
}
