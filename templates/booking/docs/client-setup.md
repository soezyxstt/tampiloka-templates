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

The dev script applies local migrations automatically. `pnpm db:migrate` also applies them explicitly. Local data lives in `.data/` and never belongs in Git. A generated project defaults to `DEMO_MODE=false` even during development; no public role switch or simulated payment endpoint becomes available. Use the monorepo's separate demo for payment simulation.

## Configure the business

Edit `config/booking.json` before the first database initialization: preset, level, independent layout/palette, default language, typography, business timezone, brand, FAQs and policy. The generated `content/client.json` contains only the selected preset. Replace its example services, categories, locations and people with the client's real content. Do not claim that example clinicians have been verified. The application verifies schedule availability, not licenses or medical qualifications.

The staff workspace edits services/prices, categories, resources/profiles, weekly intervals, time off, locations/capacity, public copy, images and appearance. Save uses a content revision; stale edits return a conflict. Archive services/resources by turning off active instead of deleting appointment history. Existing reservations must be moved or cancelled before a schedule edit makes their time unavailable.

Use the resource editor to assign exactly which services a practitioner/professional/therapist can deliver. Rooms and bays are resources with a capacity. A resource with no profile does not appear in the public directory. The service editor manages location assignment, duration, buffers, maximum concurrent appointments and package inclusions. A package is one appointment, not multiple independently scheduled visits.

## Brand controls

Layouts change navigation, hierarchy, content density and mobile composition. Palettes change tokens without changing feature levels or service rules. The `typography` setting switches the display treatment; the body uses a locally bundled font dependency. Replace font imports in `src/main.tsx` with client-licensed assets when needed.

Photographs live under `public/images/`; service and hero URLs can reference owned local files or HTTPS assets. Replace illustrative images for a real business. Use meaningful alternative text for the hero. The staff editor accepts image URLs; it is not a media-upload/storage service.

For colors beyond the four samples, edit `src/styles/brand.css`. Override the semantic tokens declared in `tokens.css` under a customer-only selector. Keep staff tokens neutral. For example, use `html[data-view="customer"] { --action: ...; --on-action: ...; }`, using the actual token names in `tokens.css`. Verify 4.5:1 normal text, 3:1 large text and control/focus contrast. Do not put secret data in frontend configuration.

## Operating rules

Each location has its own IANA timezone. Staff hours use local times in five-minute increments. Available start choices use fifteen-minute increments. Include setup/cleanup in service buffers. Appointments require enough room for the complete duration and buffers within all applicable schedules. Time off can block a resource or location. The server rejects edits that conflict with outstanding reservations.

Policy text and numeric rules must agree. The seed is an example, not legal advice. Set the cancellation deadline, refund percentage, confirmation hold, payment hold, minimum notice, booking horizon and deposit rule to the client's agreed policy. Existing bookings retain their creation-time policy snapshot.

## Customer access and staff accounts

Customers receive private session history and a reference/access-key recovery option. Advise customers to save both after creating an appointment; sharing them grants control of that one appointment. These are bearer credentials, not a verified identity account. Staff initially uses owner/operations/viewer server secrets. A studio with individual staff accountability or MFA should replace the supplied identity adapter before launch.

`pnpm tampiloka doctor --dir ...` checks structure and config. Warnings about missing Turso credentials, sample content, missing WhatsApp numbers or payment credentials are launch blockers to resolve; a valid structural result does not certify live deployment.
