import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readRoute, routeUrl } from "../src/lib/navigation.ts";
import { LAYOUTS, PALETTES, PRESETS, LEVELS } from "../src/domain/model.ts";
test("URL choices round-trip independently across every business, level, layout and palette", () => {
  for (const preset of PRESETS)
    for (const level of LEVELS)
      for (const layout of LAYOUTS)
        for (const palette of PALETTES) {
          const state = {
            ...readRoute(new URL("https://demo.example/?keep=yes#visit")),
            preset,
            level,
            layout,
            palette,
            view: "staff",
            page: "bookings",
            role: "viewer",
            lang: "en",
            channel: "whatsapp",
          };
          const url = new URL(
            routeUrl(new URL("https://demo.example/?keep=yes#visit"), state),
            "https://demo.example",
          );
          assert.deepEqual(readRoute(url), state);
          assert.equal(url.searchParams.get("keep"), "yes");
          assert.equal(url.hash, "#visit");
        }
});
test("invalid URL state is normalized; theme aliases palette; production URLs omit demo authority", () => {
  const bad = readRoute(
    new URL(
      "https://demo.example/?preset=unknown&level=root&theme=rose&view=invalid&lang=fr&role=admin",
    ),
    "en",
  );
  assert.equal(bad.preset, "medical");
  assert.equal(bad.level, "full");
  assert.equal(bad.palette, "rose");
  assert.equal(bad.lang, "en");
  assert.equal(bad.view, "customer");
  assert.equal(bad.role, "owner");
  const url = new URL(
    routeUrl(
      new URL("https://client.example/?theme=rose"),
      { ...bad, view: "staff", page: "settings" },
      false,
    ),
    "https://client.example",
  );
  for (const k of ["preset", "level", "layout", "palette", "role", "theme"])
    assert.equal(url.searchParams.has(k), false);
  assert.equal(url.searchParams.get("view"), "staff");
});
function luminance(hex) {
  const linear = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return linear.reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const [lo, hi] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (hi + 0.05) / (lo + 0.05);
}
test("sample palettes and neutral staff tokens meet text and control contrast thresholds", () => {
  const css = readFileSync(
    new URL("../src/styles/tokens.css", import.meta.url),
    "utf8",
  );
  let checked = 0;
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const values = Object.fromEntries(
      [...body.matchAll(/--([\w-]+):\s*(#[a-fA-F0-9]{6})/g)].map((x) => [
        x[1],
        x[2],
      ]),
    );
    if (!values.canvas) continue;
    checked++;
    for (const [a, b, min] of [
      ["ink", "canvas", 4.5],
      ["muted", "canvas", 4.5],
      ["on-action", "action", 4.5],
      ["control-border", "canvas", 3],
    ])
      assert.ok(
        contrast(values[a], values[b]) >= min,
        `${selector}: ${a}/${b}`,
      );
  }
  assert.equal(checked, 5);
});
