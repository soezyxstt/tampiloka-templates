# School & Learning Center

A reusable institutional website, admissions workflow and small learning-center workspace. Template ID: `school`.

## Run

Node 22.18+ and pnpm 10.28.2 are required. From the monorepo:

```sh
pnpm install --frozen-lockfile
pnpm dev:school
pnpm test:school
pnpm --filter @tampiloka/template-school typecheck
pnpm build:school
pnpm test:school:browser
```

`dev:school` opens the fictional interactive demo on port 5176. The demo uses a real local SQLite server, not browser-only state. Each browser gets an isolated server namespace. Switching Student, Staff, Guardian and Tutor keeps the same namespace. Different presets have separate data. Reset clears only the current browser's selected preset.

For a standalone client:

```sh
pnpm tampiloka create prima-academy --template school --preset exam-prep --level full --layout course-discovery --theme cobalt --name "Prima Academy" --yes
pnpm tampiloka create lingua-center --template school --preset language --level enrollment --yes
pnpm tampiloka create sekolah-mandiri --template school --preset institution --level profile --yes
pnpm tampiloka doctor --dir ./prima-academy
```

Generated projects contain copied shared packages and `file:` dependencies. They never require this monorepo at runtime. `pnpm demo` runs a local demo; `pnpm dev` runs client mode. Production deployment always defaults to `DEMO_MODE=false` and blank client credentials.

## Independent choices

| Choice | IDs |
| --- | --- |
| Business | `exam-prep`, `language`, `skills`, `institution` |
| Level | `profile`, `whatsapp`, `enrollment`, `full` |
| Layout | `academic-editorial`, `course-discovery`, `contemporary-learning`, `institutional` |
| Sample palette | `cobalt`, `forest`, `neutral`, `burgundy` |
| Typography | `editorial`, `modern`, `humanist` |
| Optional modules | `progress-reports`, `additional-branches`, `notifications` |

Use `--typography` and comma-separated `--features` for the last two options. Modules enforce minimum feature levels. `none` disables all optional modules. New client brand colors belong in semantic CSS tokens, not component overrides.

## Feature levels

| Capability | Profile | WhatsApp | Enrollment | Full |
| --- | :---: | :---: | :---: | :---: |
| Profile, programs, teachers, fees, schedules, news, contact | Yes | Yes | Yes | Yes |
| Content editor, draft/publish/revisions, media, ID/EN | Yes | Yes | Yes | Yes |
| Program/branch/intake WhatsApp summary | No | Yes | Yes | Yes |
| Online applications, protected history, review and waitlist | No | No | Yes | Yes |
| Student/guardian records | No | No | Yes | Yes |
| Invoices, payments and payment-dependent activation | No | No | No | Yes |
| Private schedules/materials, attendance, learning notes | No | No | No | Yes |
| Tutor workspace and operational reporting | No | No | No | Yes |

A server checks every operation. Changing a URL or hiding a button cannot enable production features. WhatsApp is an inquiry, never an enrollment confirmation. Full mode does not imply real online payments: the merchant must select and configure a provider.

## Guides

- [Architecture, state model and permissions](docs/architecture.md)
- [Extension API and content schemas](docs/extensions.md)
- [Client setup, deployment and operational checks](docs/deployment.md)
- [Layout and accessibility design](docs/design.md)
- [Verification and release evidence](docs/verification.md)

The advanced assignment, quiz, certificate, trial-class and recurring-billing modules are extension targets, not advertised working features. Public catalog readiness stays false until live URLs and corresponding previews pass verification.
