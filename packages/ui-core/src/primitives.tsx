"use client";

import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import {
  Select as UiSelectRoot,
  SelectContent as UiSelectContent,
  SelectGroup as UiSelectGroup,
  SelectGroupLabel as UiSelectGroupLabel,
  SelectItem as UiSelectItem,
  SelectItemIndicator as UiSelectItemIndicator,
  SelectLabel as UiSelectLabel,
  SelectSeparator as UiSelectSeparator,
  SelectTrigger as UiSelectTrigger,
  SelectValue as UiSelectValue,
} from '@ui-sdk/react/select';
import {
  Dialog as UiDialogRoot,
  DialogBackdrop as UiDialogBackdrop,
  DialogClose as UiDialogClose,
  DialogContent as UiDialogContent,
  DialogDescription as UiDialogDescription,
  DialogTitle as UiDialogTitle,
  DialogTrigger as UiDialogTrigger,
} from '@ui-sdk/react/dialog';
import {
  Drawer as UiDrawerRoot,
  DrawerBackdrop as UiDrawerBackdrop,
  DrawerClose as UiDrawerClose,
  DrawerContent as UiDrawerContent,
  DrawerDescription as UiDrawerDescription,
  DrawerTitle as UiDrawerTitle,
  DrawerTrigger as UiDrawerTrigger,
} from '@ui-sdk/react/drawer';
import { Checkbox as UiCheckbox, CheckboxIndicator as UiCheckboxIndicator } from '@ui-sdk/react/checkbox';
import { Switch as UiSwitch, SwitchThumb as UiSwitchThumb } from '@ui-sdk/react/switch';
import { Radio as UiRadio, RadioGroup as UiRadioGroup, RadioIndicator as UiRadioIndicator } from '@ui-sdk/react/radio';
import {
  Slider as UiSlider,
  SliderControl as UiSliderControl,
  SliderIndicator as UiSliderIndicator,
  SliderThumb as UiSliderThumb,
  SliderTrack as UiSliderTrack,
  SliderValue as UiSliderValue,
} from '@ui-sdk/react/slider';
import { Tabs as UiTabs, TabsList as UiTabsList, TabsPanel as UiTabsPanel, TabsTab as UiTabsTab } from '@ui-sdk/react/tabs';
import {
  SegmentedControl as UiSegmentedControl,
  SegmentedControlIndicator as UiSegmentedControlIndicator,
  SegmentedControlItem as UiSegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import {
  Collapsible as UiCollapsible,
  CollapsiblePanel as UiCollapsiblePanel,
  CollapsibleTrigger as UiCollapsibleTrigger,
} from '@ui-sdk/react/collapsible';
import {
  Accordion as UiAccordion,
  AccordionHeader as UiAccordionHeader,
  AccordionItem as UiAccordionItem,
  AccordionPanel as UiAccordionPanel,
  AccordionTrigger as UiAccordionTrigger,
} from '@ui-sdk/react/accordion';
import {
  Menu as UiMenu,
  MenuContent as UiMenuContent,
  MenuGroup as UiMenuGroup,
  MenuGroupLabel as UiMenuGroupLabel,
  MenuItem as UiMenuItem,
  MenuSeparator as UiMenuSeparator,
  MenuTrigger as UiMenuTrigger,
} from '@ui-sdk/react/menu';
import { Separator as UiSeparator } from '@ui-sdk/react/separator';
import { Field as UiField, FieldDescription as UiFieldDescription, FieldError as UiFieldError, FieldLabel as UiFieldLabel } from '@ui-sdk/react/field';
import { Label as UiLabel } from '@ui-sdk/react/label';

export const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

function mergeClassName<S>(base: string, className?: string | ((state: S) => string | undefined)) {
  if (typeof className === 'function') return (state: S) => cx(base, className(state));
  return cx(base, className);
}

/* ─── Button ─────────────────────────────────────────────────────────────────── */
export type ButtonVariant = 'solid' | 'outline' | 'soft' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'solid', size = 'md', fullWidth = false, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('tl-button', `tl-button-${variant}`, `tl-button-${size}`, fullWidth && 'tl-button-full', className)}
      {...props}
    />
  );
});

/* ─── Inputs & Fields ────────────────────────────────────────────────────────── */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx('tl-input', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cx('tl-input', 'tl-textarea', className)} {...props} />;
});

export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cx('tl-input', 'tl-select', className)} {...props} />;
});

export function Label({ className, ...props }: ComponentPropsWithoutRef<typeof UiLabel>) {
  return <UiLabel className={mergeClassName('tl-label', className)} {...props} />;
}

export function Field({ className, ...props }: ComponentPropsWithoutRef<typeof UiField>) {
  return <UiField className={mergeClassName('tl-field', className)} {...props} />;
}

export function FieldLabel({ className, ...props }: ComponentPropsWithoutRef<typeof UiFieldLabel>) {
  return <UiFieldLabel className={mergeClassName('tl-label', className)} {...props} />;
}

export function FieldDescription({ className, ...props }: ComponentPropsWithoutRef<typeof UiFieldDescription>) {
  return <UiFieldDescription className={mergeClassName('tl-field-description', className)} {...props} />;
}

export function FieldError({ className, ...props }: ComponentPropsWithoutRef<typeof UiFieldError>) {
  return <UiFieldError className={mergeClassName('tl-field-error', className)} {...props} />;
}

/* ─── Select (@ui-sdk/react/select) ──────────────────────────────────────────── */
const ChevronDownSvg = () => (
  <svg className="tl-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CheckSvg = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const SelectRoot = UiSelectRoot;
export const SelectLabel = UiSelectLabel;
export const SelectGroup = UiSelectGroup;

export function SelectTrigger({
  className,
  children,
  hideChevron = false,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof UiSelectTrigger>, 'children'> & { children?: ReactNode; hideChevron?: boolean }) {
  return (
    <UiSelectTrigger className={mergeClassName('tl-select-trigger', className)} {...props}>
      {children}
      {!hideChevron && <ChevronDownSvg />}
    </UiSelectTrigger>
  );
}

export function SelectValue({ className, ...props }: ComponentPropsWithoutRef<typeof UiSelectValue>) {
  return <UiSelectValue className={mergeClassName('tl-select-value', className)} {...props} />;
}

export function SelectContent({ className, ...props }: ComponentPropsWithoutRef<typeof UiSelectContent>) {
  return <UiSelectContent className={mergeClassName('tl-select-content', className)} {...props} />;
}

export function SelectItem({
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof UiSelectItem>, 'children'> & { children?: ReactNode }) {
  return (
    <UiSelectItem className={mergeClassName('tl-select-item', className)} {...props}>
      <span>{children}</span>
      <UiSelectItemIndicator className="tl-select-indicator">
        <CheckSvg />
      </UiSelectItemIndicator>
    </UiSelectItem>
  );
}

export function SelectGroupLabel({ className, ...props }: ComponentPropsWithoutRef<typeof UiSelectGroupLabel>) {
  return <UiSelectGroupLabel className={mergeClassName('tl-select-group-label', className)} {...props} />;
}

export function SelectSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof UiSelectSeparator>) {
  return <UiSelectSeparator className={mergeClassName('tl-select-separator', className)} {...props} />;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SimpleSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  disabled,
  name,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  triggerClassName,
  contentClassName,
}: SimpleSelectProps) {
  return (
    <UiSelectRoot
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange?.(next);
      }}
      items={options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
      placeholder={placeholder}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} aria-labelledby={ariaLabelledby} className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </UiSelectRoot>
  );
}

/* ─── Checkbox, Switch, Radio (@ui-sdk/react) ────────────────────────────────── */
export function Checkbox({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof UiCheckbox>) {
  return (
    <UiCheckbox className={mergeClassName('tl-checkbox', className)} {...props}>
      <UiCheckboxIndicator className="tl-checkbox-indicator">
        <CheckSvg />
      </UiCheckboxIndicator>
    </UiCheckbox>
  );
}

export function Switch({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof UiSwitch>) {
  return (
    <UiSwitch className={mergeClassName('tl-switch', className)} {...props}>
      <UiSwitchThumb className="tl-switch-thumb" />
    </UiSwitch>
  );
}

export function RadioGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof UiRadioGroup>) {
  return <UiRadioGroup className={mergeClassName('tl-radio-group', className)} {...props} />;
}

export function RadioItem({
  className,
  render,
  ...props
}: ComponentPropsWithoutRef<typeof UiRadio>) {
  return (
    <UiRadio
      className={mergeClassName('tl-radio', className)}
      data-value={props.value}
      render={render ?? <button value={props.value} />}
      {...props}
    >
      <UiRadioIndicator className="tl-radio-indicator" />
    </UiRadio>
  );
}

/* ─── Slider (@ui-sdk/react/slider) ──────────────────────────────────────────── */
export interface SliderProps extends ComponentPropsWithoutRef<typeof UiSlider> {
  thumbLabel?: string;
  showValue?: boolean;
}

export function Slider({
  className,
  thumbLabel = 'Value',
  showValue = false,
  ...props
}: SliderProps) {
  return (
    <UiSlider className={mergeClassName('tl-slider', className)} {...props}>
      {showValue && <UiSliderValue />}
      <UiSliderControl className="tl-slider-control">
        <UiSliderTrack className="tl-slider-track">
          <UiSliderIndicator className="tl-slider-indicator" />
          <UiSliderThumb className="tl-slider-thumb" aria-label={thumbLabel} />
        </UiSliderTrack>
      </UiSliderControl>
    </UiSlider>
  );
}

/* ─── Tabs & SegmentedControl (@ui-sdk/react) ────────────────────────────────── */
export const Tabs = UiTabs;

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof UiTabsList>) {
  return <UiTabsList className={mergeClassName('tl-tabs-list', className)} {...props} />;
}

export function TabsTab({ className, ...props }: ComponentPropsWithoutRef<typeof UiTabsTab>) {
  return <UiTabsTab className={mergeClassName('tl-tabs-tab', className)} {...props} />;
}

export function TabsPanel({ className, ...props }: ComponentPropsWithoutRef<typeof UiTabsPanel>) {
  return <UiTabsPanel className={mergeClassName('tl-tabs-panel', className)} {...props} />;
}

export function SegmentedControl({
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof UiSegmentedControl>, 'children'> & { children?: ReactNode }) {
  return (
    <UiSegmentedControl className={mergeClassName('tl-segmented', className)} {...props}>
      <UiSegmentedControlIndicator className="tl-segmented-indicator" />
      {children}
    </UiSegmentedControl>
  );
}

export function SegmentedControlItem({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof UiSegmentedControlItem>) {
  return <UiSegmentedControlItem className={mergeClassName('tl-segmented-item', className)} {...props} />;
}

/* ─── Dialog (@ui-sdk/react/dialog) ──────────────────────────────────────────── */
export const DialogRoot = UiDialogRoot;
export const DialogTrigger = UiDialogTrigger;
export const DialogClose = UiDialogClose;

export function DialogBackdrop({ className, ...props }: ComponentPropsWithoutRef<typeof UiDialogBackdrop>) {
  return <UiDialogBackdrop className={mergeClassName('tl-dialog-overlay', className)} {...props} />;
}

export function DialogContent({ className, ...props }: ComponentPropsWithoutRef<typeof UiDialogContent>) {
  return <UiDialogContent className={mergeClassName('tl-dialog', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentPropsWithoutRef<typeof UiDialogTitle>) {
  return <UiDialogTitle className={mergeClassName('tl-dialog-title', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentPropsWithoutRef<typeof UiDialogDescription>) {
  return <UiDialogDescription className={mergeClassName('tl-dialog-description', className)} {...props} />;
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  closeLabel?: string;
  overlay?: ReactNode;
  style?: CSSProperties;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  closeLabel = 'Tutup dialog',
  overlay,
  style,
}: DialogProps) {
  const descriptionId = useId();
  return (
    <UiDialogRoot open={open} onOpenChange={(next) => onOpenChange(next)}>
      <UiDialogBackdrop className={cx('tl-dialog-overlay', overlay != null && 'tl-dialog-overlay-custom')}>
        {overlay}
      </UiDialogBackdrop>
      <UiDialogContent
        className={cx('tl-dialog', className)}
        style={style}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="tl-dialog-header">
          <UiDialogTitle className="tl-dialog-title">{title}</UiDialogTitle>
          {description && (
            <UiDialogDescription id={descriptionId} className="tl-dialog-description">
              {description}
            </UiDialogDescription>
          )}
          <UiDialogClose className="tl-dialog-close" aria-label={closeLabel}>
            ×
          </UiDialogClose>
        </header>
        <div className="tl-dialog-body">{children}</div>
        {footer && <footer className="tl-dialog-footer">{footer}</footer>}
      </UiDialogContent>
    </UiDialogRoot>
  );
}

/* ─── Drawer / Sheet (@ui-sdk/react/drawer) ──────────────────────────────────── */
export const DrawerRoot = UiDrawerRoot;
export const DrawerTrigger = UiDrawerTrigger;
export const DrawerClose = UiDrawerClose;

export function DrawerBackdrop({ className, ...props }: ComponentPropsWithoutRef<typeof UiDrawerBackdrop>) {
  return <UiDrawerBackdrop className={mergeClassName('tl-drawer-backdrop', className)} {...props} />;
}

export function DrawerContent({ className, ...props }: ComponentPropsWithoutRef<typeof UiDrawerContent>) {
  return <UiDrawerContent className={mergeClassName('tl-drawer-content', className)} {...props} />;
}

export function DrawerTitle({ className, ...props }: ComponentPropsWithoutRef<typeof UiDrawerTitle>) {
  return <UiDrawerTitle className={mergeClassName('tl-drawer-title', className)} {...props} />;
}

export function DrawerDescription({ className, ...props }: ComponentPropsWithoutRef<typeof UiDrawerDescription>) {
  return <UiDrawerDescription className={mergeClassName('tl-drawer-description', className)} {...props} />;
}

export function DrawerHandle() {
  return <div className="tl-drawer-handle" aria-hidden="true" />;
}

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'bottom' | 'right' | 'left' | 'top';
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  closeLabel?: string;
  showHandle?: boolean;
}

export function Drawer({
  open,
  onOpenChange,
  side = 'bottom',
  title,
  description,
  children,
  footer,
  className,
  closeLabel = 'Tutup',
  showHandle = side === 'bottom',
}: DrawerProps) {
  return (
    <UiDrawerRoot open={open} onOpenChange={(next) => onOpenChange(next)} side={side}>
      <DrawerBackdrop />
      <DrawerContent className={className}>
        {showHandle && <DrawerHandle />}
        {title && (
          <header className="tl-drawer-header">
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
            <UiDrawerClose className="tl-drawer-close" aria-label={closeLabel}>
              ×
            </UiDrawerClose>
          </header>
        )}
        <div className="tl-drawer-body">{children}</div>
        {footer && <footer className="tl-drawer-footer">{footer}</footer>}
      </DrawerContent>
    </UiDrawerRoot>
  );
}

/* ─── Collapsible & Accordion (@ui-sdk/react) ────────────────────────────────── */
export const Collapsible = UiCollapsible;

export function CollapsibleTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof UiCollapsibleTrigger>) {
  return <UiCollapsibleTrigger className={mergeClassName('tl-collapsible-trigger', className)} {...props} />;
}

export function CollapsiblePanel({ className, ...props }: ComponentPropsWithoutRef<typeof UiCollapsiblePanel>) {
  return <UiCollapsiblePanel className={mergeClassName('tl-collapsible-panel', className)} {...props} />;
}

export const Accordion = UiAccordion;

export function AccordionItem({ className, ...props }: ComponentPropsWithoutRef<typeof UiAccordionItem>) {
  return <UiAccordionItem className={mergeClassName('tl-accordion-item', className)} {...props} />;
}

export function AccordionHeader({ className, ...props }: ComponentPropsWithoutRef<typeof UiAccordionHeader>) {
  return <UiAccordionHeader className={mergeClassName('tl-accordion-header', className)} {...props} />;
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof UiAccordionTrigger>, 'children'> & { children?: ReactNode }) {
  return (
    <UiAccordionTrigger className={mergeClassName('tl-accordion-trigger', className)} {...props}>
      <span>{children}</span>
      <svg className="tl-accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </UiAccordionTrigger>
  );
}

export function AccordionPanel({ className, ...props }: ComponentPropsWithoutRef<typeof UiAccordionPanel>) {
  return <UiAccordionPanel className={mergeClassName('tl-accordion-panel', className)} {...props} />;
}

/* ─── Menu (@ui-sdk/react/menu) ──────────────────────────────────────────────── */
export const Menu = UiMenu;
export const MenuTrigger = UiMenuTrigger;
export const MenuGroup = UiMenuGroup;
export const MenuGroupLabel = UiMenuGroupLabel;

export function MenuContent({ className, ...props }: ComponentPropsWithoutRef<typeof UiMenuContent>) {
  return <UiMenuContent className={mergeClassName('tl-menu-content', className)} {...props} />;
}

export function MenuItem({ className, ...props }: ComponentPropsWithoutRef<typeof UiMenuItem>) {
  return <UiMenuItem className={mergeClassName('tl-menu-item', className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof UiMenuSeparator>) {
  return <UiMenuSeparator className={mergeClassName('tl-menu-separator', className)} {...props} />;
}

/* ─── Separator (@ui-sdk/react/separator) ────────────────────────────────────── */
export function Separator({ className, ...props }: ComponentPropsWithoutRef<typeof UiSeparator>) {
  return <UiSeparator className={mergeClassName('tl-separator', className)} {...props} />;
}
