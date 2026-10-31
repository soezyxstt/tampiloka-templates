# Public demo catalog

`tampiloka-templates` owns the public demo inventory. The marketing app reads
`https://catalog.tampiloka.site/catalog.v1.json` at runtime. It does not copy a list
of templates or require a rebuild when a demo is added.

## Sources and publication

- `packages/registry/templates.json` remains the canonical registry for template
  status, preset IDs, mode IDs, and demo addresses. Its existing source parity
  check with `src/index.mjs` still applies.
- `packages/registry/public-demos.json` holds the public selection, bilingual copy,
  thumbnail URLs, feature choices, and routing metadata. Both the family and entry
  must explicitly have `visibility: "public"` and `ready: true`. A template must
  also have `status: "available"` in the canonical registry.
- `node scripts/build-public-catalog.mjs` checks references and generates the
  version 1 JSON plus a small, dependency-free Worker in `packages/registry/dist`.
  It strips every field outside the public contract. Validation errors or an
  accidental empty catalog stop publication before any live update.
- `.github/workflows/publish-catalog.yml` validates pull requests and publishes
  changes on `main`, independently of marketing and demo builds. It uses the
  repository's existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
  Failed builds leave the current Worker version serving the previous catalog.

The Worker accepts GET, HEAD, and OPTIONS. JSON responses include an ETag, public
CORS, `max-age=60`, and up to 120 seconds of stale-while-revalidate. The consumer
validates the schema again and can show a clearly labeled recent cached result
when the feed cannot be reached. Do not use a second hand-maintained list.

## Add a public demo

1. Register the template and preset in the canonical registry and its template
   manifest. Keep stable IDs; changing display names must not change links.
2. Deploy and verify the demo and its public thumbnail first. Private prospect
   demos and unfinished work must remain absent from public metadata or have a
   non-public visibility/readiness value.
3. Add the family or entry to `public-demos.json`. Supply Indonesian and English
   names and descriptions, an absolute HTTPS thumbnail, and an explicit public
   ready state. Use the existing family ID for another preset of that family.
4. For a preset-specific demo host, use `route.base: "preset"`. For a shared host,
   use `route.base: "template"` with `presetParam`. If that family exposes modes,
   supply `modes`, `defaultMode`, and `modeParam`; each mode must exist in the
   registry's `levels`. The producer emits every complete `modeUrls` address.
   Consumers do not know or construct family-specific routing.
5. Run `node --test packages/registry/tests/public-catalog.test.mjs` and
   `node scripts/build-public-catalog.mjs`. Inspect the generated JSON before
   merging. Check the publish workflow and public feed after merging.
6. Open the existing `/templates` gallery and homepage in Indonesian and English.
   The family, demo, thumbnail, and modes should appear without a marketing source
   change or deployment. Check that choosing a mode opens the intended preview.

Thumbnail URLs point at images hosted with the public demos. New families must
publish their thumbnails with the template or catalog before adding those URLs
to the feed; no marketing asset copy is required. Public metadata must never
contain private contacts, credentials, internal service URLs, unpublished client
work, or repository paths.

## Version 1 contract

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-10-30T00:00:00.000Z",
  "families": [{
    "id": "commerce",
    "name": { "id": "Toko online", "en": "Online stores" },
    "modes": [{ "id": "store", "name": { "id": "Toko", "en": "Store" } }],
    "defaultMode": "store"
  }],
  "entries": [{
    "id": "commerce-editorial",
    "family": "commerce",
    "name": { "id": "Editorial", "en": "Editorial" },
    "description": { "id": "Foto produk besar.", "en": "Large product photos." },
    "url": "https://ecommerce.tampiloka.site/?preset=editorial&level=store",
    "imageUrl": "https://ecommerce.tampiloka.site/demo-previews/commerce-editorial.webp",
    "visibility": "public",
    "modeUrls": { "store": "https://ecommerce.tampiloka.site/?preset=editorial&level=store" },
    "featured": true
  }]
}
```

`description` on families/modes, `modes`, `defaultMode`, `modeUrls`, and `featured`
are optional. Each entry has a globally unique stable ID and belongs to a known
family. When a family declares modes, every entry must include the complete
mode URL map. Unknown major schema versions must fail validation. Add compatible
optional fields within v1; publish a new URL/version for breaking changes.

## Preview images

Capture the current public demo at a 1280 × 800 viewport and export an optimized 8:5 WebP. Keep its actual theme, mode, content, and shared toolbar visible. Cafe images live in `templates/cafe/demos/public/demo-previews/` and are served at `https://cafe.tampiloka.site/demo-previews/`. Commerce images live in `templates/commerce/public/demo-previews/` and are served at `https://ecommerce.tampiloka.site/demo-previews/`. These images ship with their demo, and the catalog contains their absolute URLs. Publish the demo and image assets before marking a new entry public and ready. The marketing application does not need an asset copy or a rebuild.

## School readiness

School CLI availability does not publish its demo. The school family starts private, `ready: false`, with no public entries. Publish only after verifying the deployed Worker, independent demo data, and exact 1280×800 previews. CI evidence is not a live public URL.
## Booking publication gate

Booking metadata is registered with `ready: false` until its deployed origin and previews pass verification. Its four use-case entries use independent preset URLs, each preserving a sample layout and palette, and the shared `level` mode parameter. Register actual verified URLs in canonical `templates.json` and the runtime registry before enabling publication. Do not infer readiness from a local build or fabricated preview URL.
