# Shared motion and component ownership

The template already uses shadcn-style source components backed by Radix for Button composition, Checkbox, Select and Dialog. It is not a screen made exclusively from a packaged shadcn library. Operational controls, the catalog, navigation strips and order views are domain components composed from those primitives.

## Defaults

`components/ui/motion.tsx` supplies MotionProvider, MotionPanel, MotionItem and RevealText. `components/ui/motion.css` owns CSS entrance/exit effects and shared duration variables. Both Next.js and the Cloudflare showcase use the provider. The five structural themes keep the same motion behavior; brand color and geometry remain separate.

- Screen panels enter in 220 ms and exit in 120 ms. Exiting screens are inert and hidden from assistive technology. Only the screen key changes; background polling does not remount the workspace or erase forms.
- Headings reveal as intact text over 280 ms, not letters announced one by one. Text remains real, selectable text and CSS has no permanently hidden base style.
- DialogModal composes `components/ui/dialog.tsx`. The overlay fades and the panel slides from the bottom on phones, with a smaller offset/scale on larger screens. Radix retains closed content while its CSS exit runs. Focus trapping, Escape, outside dismissal and focus restoration remain functional.
- ChoiceStrip moves one shared active indicator, instead of separate implementations for categories, staff navigation and filters. Resize and font loading remeasure the selected button. Keyboard navigation scrolls only the strip.
- Menu rows use stable item keys for bounded entry staggering and position changes. Buttons, fields, notices and new operational records share short feedback transitions.
- Money and stock values remain immediately readable. No count-up animation, typewriter delay, bouncing transaction button or waiting for a decorative effect before submitting a command.

`prefers-reduced-motion` disables the new transforms and CSS reveals. MotionConfig also applies the preference to existing Motion components. No theme can override it.

## Native select boundary

`SelectField` intentionally remains a native select with shared shadcn-style field styling. Its operating-system picker is not a custom DOM popover and cannot be given a web entrance/exit animation. `SelectContent` is the Radix-based custom variant and uses the shared popover motion. Do not replace an accessible native mobile picker merely to add animation.

## Verification

`tests/demos-motion.mjs` runs with motion enabled, plus a separate reduced-motion context. It checks actual animation events/intermediate positions, dialog focus/closing behavior, rapid tab switching, form persistence across refresh and every staff preset. It records screenshots and short videos under ignored test-results/motion. The existing compact-layout, all-preset and full lifecycle suites stay enabled. Public verification runs against isolated browser-local data only and blocks network mutations.

Run `npm run demos:build && npm run test:demo-all`. Production-host checks run automatically after a main release through `scripts/demos-live-verify.mjs`.
