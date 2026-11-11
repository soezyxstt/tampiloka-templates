# Client setup

## Generated project

Use Node 22.18+ and pnpm 10.28.2. From the generated directory:

```sh
pnpm install
cp .dev.vars.example .dev.vars
# Set a long, unique staff owner password in .dev.vars before staff sign-in.
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

The dev script applies migrations automatically for the configured database. `pnpm db:migrate` also applies them explicitly. Local data lives in `.wrangler/` and never belongs in Git. A generated project defaults to `DEMO_MODE=false` even during development; no public role switch or simulated payment endpoint becomes available. Use the monorepo's separate demo for payment simulation.

## Configure the business

Edit `config/booking.json` before the first database initialization: preset, level, independent layout/palette, default language, typography, business timezone, brand, FAQs and policy. The generated `content/client.json` contains only the selected preset. Replace its example services, categories, locations and people with the client's real content. Do not claim that example clinicians have been verified. The application verifies schedule availability, not licenses or medical qualifications.

The staff workspace edits services/prices, categories, resources/profiles, weekly intervals, time off, locations/capacity, public copy, images and appearance. Save uses a content revision; stale edits return a conflict. Archive services/resources by turning off active instead of deleting appointment history. Existing reservations must be moved or cancelled before a schedule edit makes their time unavailable.

Use the resource editor to assign exactly which services a practitioner/professional/therapist can deliver. Rooms and bays are resources with a capacity. A resource with no profile does not appear in the public directory. The service editor manages location assignment, duration, buffers, maximum concurrent appointments and package inclusions. A package is one appointment, not multiple independently scheduled visits.

## Brand controls

Layouts change navigation, hierarchy, content density and mobile composition. Palettes change tokens without changing feature levels or service rules. The `typography` setting switches the display treatment; the body uses a locally bundled font dependency. Replace font imports in `src/main.tsx` with client-licensed assets when needed.

Photographs live under `public/images/`; service and hero URLs can reference owned local files or HTTPS assets. Replace illustrative images for a real business. Use meaningful alternative text for the hero. The staff editor accepts image URLs. An authenticated staff media API is available separately; it does not add an upload control to the editor.

For colors beyond the four samples, edit `src/styles/brand.css`. Override the semantic tokens declared in `tokens.css` under a customer-only selector. Keep staff tokens neutral. For example, use `html[data-view="customer"] { --action: ...; --on-action: ...; }`, using the actual token names in `tokens.css`. Verify 4.5:1 normal text, 3:1 large text and control/focus contrast. Do not put secret data in frontend configuration.

## Operating rules

Each location has its own IANA timezone. Staff hours use local times in five-minute increments. Available start choices use fifteen-minute increments. Include setup/cleanup in service buffers. Appointments require enough room for the complete duration and buffers within all applicable schedules. Time off can block a resource or location. The server rejects edits that conflict with outstanding reservations.

Policy text and numeric rules must agree. The seed is an example, not legal advice. Set the cancellation deadline, refund percentage, confirmation hold, payment hold, minimum notice, booking horizon and deposit rule to the client's agreed policy. Existing bookings retain their creation-time policy snapshot.

## Customer access and staff accounts

Customers receive private session history and a reference/access-key recovery option. Advise customers to save both after creating an appointment; sharing them grants control of that one appointment. These are bearer credentials, not a verified identity account. Staff initially uses owner/operations/viewer server secrets. A studio with individual staff accountability or MFA should replace the supplied identity adapter before launch.

`pnpm tampiloka doctor --dir ...` checks structure and config. Warnings about placeholder DB IDs, sample content, missing WhatsApp numbers or payment credentials are launch blockers to resolve; a valid structural result does not certify live deployment.

## Database and object storage

The public demo continues to use the D1 `DB` binding. Generated projects select providers in `config/storage.json`; Wrangler variables configure the running Worker. For Turso set `DATABASE_PROVIDER=turso`, `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as Worker secrets, and run `pnpm db:migrate` with the same values in the environment or `.dev.vars`. Explicit process environment values override `.dev.vars` for migrations; Wrangler reads its configured vars and `.dev.vars`, so keep the running Worker provider in sync. D1 uses `pnpm db:migrate` for local and `pnpm db:migrate:remote` for remote. Coordinate migration execution before deploying traffic. A PostgreSQL migration set is provided and can be applied with `DATABASE_PROVIDER=postgresql DATABASE_URL=... pnpm db:migrate`. The PostgreSQL migrations and core booking flow are exercised locally with PGlite through the shared adapter. Validate the target PostgreSQL service and deployment configuration before production use.

For object storage set `OBJECT_STORAGE_PROVIDER` to `s3` or `uploadthing`. S3 needs `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optionally `S3_REGION` and `S3_PUBLIC_URL`; UploadThing needs `UPLOADTHING_TOKEN`. Set credentials as Worker secrets. Staff can POST JSON `{ "contentType": "image/png", "data": "<base64>" }` to `/api/staff/media` (JPEG, PNG or WebP, up to 45 KB); the returned URL supports authenticated staff GET and DELETE. Only owners and operations may upload/delete; viewers may read. This API is private and its URLs are not suitable for public storefront images. Keep the same provider configured for existing media. Uploads are disabled in demo sessions.
