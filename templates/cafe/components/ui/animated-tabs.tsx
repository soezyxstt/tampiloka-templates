'use client';

import { ChoiceStrip, type ChoiceItem } from './choice-strip';
export type AnimatedTabItem<T extends string> = ChoiceItem<T>;
/** Compatibility entry points. Rendering, spacing and keyboard behavior have
 * one source: ChoiceStrip. layoutId remains accepted for existing templates.
 */
export function AnimatedUnderlineTabs<T extends string>({ items, activeId, onSelect, ariaLabel='Navigasi tab', className }: { items: Array<ChoiceItem<T>>; activeId:T; onSelect:(id:T)=>void; layoutId?:string; ariaLabel?:string; className?:string }) {
  return <ChoiceStrip items={items} value={activeId} onChange={onSelect} kind="navigation" variant="underline" ariaLabel={ariaLabel} className={className} />;
}
export function AnimatedSegmentedControl<T extends string>({ options, value, onChange, ariaLabel='Pilih mode', className }: { options:Array<{ value:T; label:string; count?:number }>; value:T; onChange:(value:T)=>void; layoutId?:string; ariaLabel?:string; className?:string }) {
  return <ChoiceStrip items={options.map(option=>({ id:option.value, label:option.label, count:option.count }))} value={value} onChange={onChange} kind="filter" variant="segmented" ariaLabel={ariaLabel} className={className} />;
}
