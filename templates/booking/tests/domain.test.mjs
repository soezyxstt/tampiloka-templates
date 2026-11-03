import test from "node:test";
import assert from "node:assert/strict";
import { capabilities, LEVELS, PRESETS } from "../src/domain/model.ts";
import { adapters, defaultOptions } from "../src/domain/adapters.ts";
import { assertTransition } from "../src/domain/state.ts";
import {
  utcCandidates,
  localTime,
  scheduleContains,
} from "../src/domain/time.ts";
import { existsSync } from "node:fs";
import { presetContent } from "../content/presets.ts";
import {
  settingsInput,
  serviceInput,
  resourceInput,
  locationInput,
} from "../src/domain/content-validation.ts";

test("four independent levels have exact transaction boundaries", () => {
  assert.deepEqual(
    LEVELS.map((l) => [capabilities(l).booking, capabilities(l).payments]),
    [
      [false, false],
      [false, false],
      [true, false],
      [true, true],
    ],
  );
});
test("every preset validates its seed and uses distinct domain fields and resources", () => {
  for (const preset of PRESETS) {
    const c = presetContent(preset);
    assert.doesNotThrow(() => settingsInput(c.config, c.config));
    for (const s of c.services) assert.deepEqual(serviceInput(s, preset), s);
    for (const r of c.resources) assert.deepEqual(resourceInput(r, preset), r);
    for (const l of c.locations) assert.deepEqual(locationInput(l, preset), l);
    const opts = defaultOptions(preset);
    if (preset === "detailing") opts.vehicleModel = "Example";
    assert.deepEqual(adapters[preset].validateOptions(opts), opts);
  }
  assert.throws(() =>
    adapters.medical.validateOptions({ diagnosis: "Do not collect this" }),
  );
  assert.deepEqual(adapters.consulting.resourceKinds({ format: "remote" }), [
    "professional",
  ]);
  assert.deepEqual(adapters.consulting.resourceKinds({ format: "onsite" }), [
    "professional",
    "room",
  ]);
});
test("every booking service has a distinct local photo in its standalone preset", () => {
  for (const preset of PRESETS) {
    const { config, services } = presetContent(preset);
    const photos = services.map((s) => s.image);
    assert.equal(new Set(photos).size, services.length);
    for (const path of [...photos, config.brand.heroImage, config.brand.visitPhoto.image]) {
      assert.ok(path.startsWith(`/images/${preset}`), path);
      assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), path);
    }
  }
});
test("vehicle category changes duration and server price", () => {
  const s = presetContent("detailing").services[0];
  const a = adapters.detailing.quote(s, {
    vehicle: "suv",
    vehicleModel: "Example",
  });
  assert.equal(a.duration, s.duration + 15);
  assert.equal(a.price, s.price + 50000);
});
test("terminal booking states cannot be revived", () => {
  for (const state of ["completed", "cancelled", "expired", "no_show"])
    assert.throws(() => assertTransition(state, "confirmed"));
  assert.doesNotThrow(() => assertTransition("confirmed", "checked_in"));
});
test("DST repeated wall times remain distinct, missing wall times are absent", () => {
  const autumn = utcCandidates("2026-11-01", "America/New_York");
  const repeated = autumn.filter(
    (t) => localTime(t, "America/New_York").label === "01:30",
  );
  assert.equal(repeated.length, 2);
  assert.notEqual(
    localTime(repeated[0], "America/New_York").offset,
    localTime(repeated[1], "America/New_York").offset,
  );
  const spring = utcCandidates("2026-03-08", "America/New_York");
  assert.equal(
    spring.filter((t) => localTime(t, "America/New_York").label === "02:30")
      .length,
    0,
  );
});
