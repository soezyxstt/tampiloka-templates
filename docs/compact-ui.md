# Compact UI and catalog requests

The catalog preset now enables catalog + ordering. Guests retain a list tied to their own customer context and submit it to the existing staff inbox. Staff accept or decline it, serve it, and confirm an offline external-register receipt with a reference. The catalog has no POS, online-payment adapter or kitchen screen. With kitchen enabled, accepted orders use the existing kitchen pipeline. The old order-at-cashier preset remains a compatibility alias; do not sell these as two different feature tiers.

A strictly read-only, database-free menu is still available with --modules catalog. Selecting the catalog preset now requires the same server/runtime as ordering. No live shared backend or provider is implied by the public browser-local showcase.

## Component ownership

- ChoiceStrip: horizontal navigation and single-choice filters. Underline and segmented are variants, not independent implementations. Existing AnimatedUnderlineTabs/AnimatedSegmentedControl entry points delegate to it.
- FilterToggle: independent yes/no filters, built on Button.
- SelectField: native form selection, including staff, tables, reports and scenario selection. Shared fieldStyles also styles Input and custom SelectTrigger. A button opening a multi-step dialog is not a native select.
- InlineNotice: long feedback and error text; wraps locally and has status/alert semantics. StatusLabel is for short state names.
- StatStrip: compact operational totals with separators, not a card per metric.
- Surface: plain, ruled and panel variants. Use panels for a distinct task such as checkout, not every heading or number.
- PageHeader: one title/action layout for customer and staff views.

Shape comes from theme tokens. Workspace density stays compact without reducing primary touch controls below 44 px. Text wrapping and min-width fixes live on the affected components; the document never hides horizontal overflow to conceal defects.

Keep evidence outside source control. UI tests must include feedback after payment creation, rejected actions, long names, scrolling, keyboard use and both sides of responsive breakpoints, not only the initial screen.
