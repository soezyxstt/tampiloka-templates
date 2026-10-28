# Client menu content

These files are public. Do not add passwords, staff accounts, customer details, payment keys or private notes.

- `menu.json`: categories, items, photos, variants, modifier choices and displayed price policy.
- `tables.json`: public table labels and QR link tokens.

Keep `schemaVersion` at 1. Keep IDs stable when renaming items. Every item must name an existing category and have exactly one default variant. Use whole Rupiah numbers, such as `28000`, not a formatted string. An unavailable item uses `available: false`; an item you want to hide uses `active: false`.

The supplied menu is fictional and uses `sample: true`. Set this to `false` only after replacing and checking the client's menu, prices, allergen information, hours, facilities and image rights. Static availability is manual, not a live stock feed.

Photo paths begin with `/images/` or `/brand/` and point into `public/`; public HTTPS image URLs also work. Empty photo arrays render a useful fallback. Do not copy benchmark screenshots into menu photos.

A table link has this form:

```
/t/<tenantSlug>/<outletSlug>/m/<qrToken>
```

The slugs come from `config/cafe.json`. Each table ID, label and token must be unique. Set `active: false` to disable a table's link. QR tokens are public identifiers for reading the menu, not login credentials or proof that someone is at the cafe.

Choose the `catalog` preset and leave `CAFE_DEMO_DB` unset or `0` to serve this menu without a database. Run `npm run dev` for local editing, then `npm run build` and `npm start` for the production server. Menu changes need a rebuild when running a production build.

Validate changes with:

```sh
npm run catalog:validate
npm run test:catalog
npm run typecheck
```

The tests keep their own fixtures separate from your client menu, and also validate your current content. The runtime validates the configured menu before serving it.

To export the public menu from a running local demo, use `npm run catalog:export -- --dry-run`. Run `npm run catalog:export -- --overwrite` to replace these two files after reviewing the output. Export keeps `sample: true` unless you explicitly pass `--sample false`. The export contains no orders, staff accounts or payment credentials. It does not copy images; keep referenced local assets in `public/`.
