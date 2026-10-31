# Extensions

Register extensions once at startup, in a shared module imported by both `worker/api.ts` and the UI entrypoint. Never put client secrets in that module. Domain hooks run in a retried transaction and must be pure: do not send emails, write files, charge cards or call external APIs inside them.

```ts
import {registerExtension} from '../src/cms/registry.ts';
registerExtension({
  programTypes: ['music'],
  collections: [{
    id: 'workshops',
    label: {id: 'Lokakarya', en: 'Workshops'},
    fields: [{name: 'instrument', type: 'text', required: true,
      label: {id: 'Alat musik', en: 'Instrument'}}],
  }],
  registrationFields: [{name: 'experience', type: 'textarea', maxLength: 300,
    label: {id: 'Pengalaman', en: 'Experience'}}],
});
```

Collection fields live in `ContentData.attributes`. The editor renders registered fields; the server validates them on save/publish. Core content fields remain typed bilingual values. A custom page can be published and then added to Settings > Site navigation. Program content documents and program IDs may differ; link them through `contentId`.

## Blocks

Add a `BlockDefinition` with an ID, bilingual label and validation function. Register a corresponding renderer with `customBlocks.set(id, renderer)` in `src/public.tsx`. Blocks use stable IDs and can be reordered in the editor. Validate URLs and all custom field limits on the server. Render text as React text, never untrusted HTML.

The built-in block types are text, image/text, FAQ, outcomes, facilities and fictional sample testimonial. Client content replaces these examples. New structured block data should extend the `PageBlock` discriminated union and keep migration/version handling explicit.

## Form fields

Built-in types are text, email, number, select, checkbox and textarea. Fields support required, length/range bounds and conditions such as `when: {field: 'placement', equals: true}`. Invisible fields are excluded from saved answers. Use `fields.save` to edit the institution's registration schema. Extension fields append to that schema and appear in the learner form and staff review. The snapshot identifies extension-owned names separately; institution settings edit only institution-owned fields. Duplicate names across either source are rejected, including collisions introduced by configuration. Do not use prototype properties as field IDs.

To add a new input widget, extend the `Field` type, `FieldInput` and server `validateFields` together. A UI-only validator is insufficient. Add domain and browser tests for the new type and its keyboard behavior.

## Modules and views

`registerExtension({modules:[...]})` declares a module ID, label, minimum level and optional command handler. `module.toggle` only enables installed modules and validates the level. An enabled module command must enforce its own role and record access using the supplied context. Add an `adminViews` definition plus an implementation in the UI `adminViews` map. Hidden navigation is not authorization.

Available optional modules:

| ID | Minimum | Behavior |
| --- | --- | --- |
| `progress-reports` | Full | Printable authorized learning notes/progress |
| `additional-branches` | Profile | Branch editor; intakes connect to branches |
| `notifications` | Enrollment | Signed provider outbox and delivery/retry |

Assignments, quizzes, certificates, trial booking and recurring billing are not prebuilt modules. Keep them independent when implemented. For example, a trial booking module should introduce its own time slots and attendance rather than treating an inquiry as accepted enrollment. Certificates must not imply accreditation or completion that the system has not verified.

## Storage, payments and identity adapters

`Store` defines atomic mutation semantics over D1. `scripts/sqlite.mjs` adapts SQLite for local tests. Replace storage only with an adapter that passes the concurrency and retry tests.

A new payment provider should create payments outside transactions, use unique order IDs, verify signatures and canonical status server-side, and call `applyPayment` inside a successful atomic mutation. Keep immutable invoices and separate payment states.

Identity provider integration must produce a server-verified `User` and preserve household/tutor relations. Never accept a production role, student ID list or tutor assignment directly from an untrusted request.
