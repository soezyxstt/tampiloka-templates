import {
  LAYOUTS,
  PALETTES,
  type BusinessSettings,
  type Location,
  type Preset,
  type Resource,
  type Service,
} from "./model.ts";
import {
  bool,
  choice,
  fail,
  id,
  imageUrl,
  integer,
  localized,
  minutes,
  object,
  text,
  timezone,
} from "./validation.ts";
import { validateSchedule } from "./time.ts";
function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 100)
    fail(422, "INVALID_INPUT", `${label} must be an array of at most 100 IDs.`);
  return [...new Set(value.map((x) => id(x, label)))];
}
export function serviceInput(value: unknown, preset: Preset): Service {
  const v = object(value);
  if (!Array.isArray(v.packageItems) || v.packageItems.length > 12)
    fail(422, "INVALID_PACKAGES", "Use at most twelve package inclusions.");
  const price = integer(v.price, "Price"),
    max =
      v.priceMax === undefined
        ? undefined
        : integer(v.priceMax, "Maximum price", price);
  return {
    id: id(v.id),
    preset,
    category: id(v.category, "Category"),
    name: localized(v.name, "Name", 150),
    description: localized(v.description, "Description", 3000),
    image: imageUrl(v.image),
    duration: minutes(v.duration, "Duration", 5, 480),
    bufferBefore: minutes(v.bufferBefore, "Buffer before", 0, 120),
    bufferAfter: minutes(v.bufferAfter, "Buffer after", 0, 120),
    price,
    ...(max === undefined ? {} : { priceMax: max }),
    capacity: integer(v.capacity, "Service capacity", 1, 50),
    locationIds: strings(v.locationIds, "Locations"),
    active: bool(v.active, "Active"),
    featured: bool(v.featured, "Featured"),
    packageItems: v.packageItems.map((x) => localized(x, "Inclusion", 150)),
  };
}
export function locationInput(value: unknown, preset: Preset): Location {
  const v = object(value);
  return {
    id: id(v.id),
    preset,
    name: text(v.name, "Location name", 100, true),
    address: text(v.address, "Address", 500, true),
    timezone: timezone(v.timezone),
    capacity: integer(v.capacity, "Location capacity", 1, 50),
    schedule: validateSchedule(v.schedule),
    active: bool(v.active, "Active"),
  };
}
export function resourceInput(value: unknown, preset: Preset): Resource {
  const v = object(value),
    profile = v.profile === undefined ? undefined : object(v.profile);
  return {
    id: id(v.id),
    preset,
    name: text(v.name, "Resource name", 100, true),
    kind: choice(
      v.kind,
      ["practitioner", "therapist", "room", "bay", "professional"] as const,
      "Resource kind",
    ),
    locationId: id(v.locationId, "Location"),
    serviceIds: strings(v.serviceIds, "Services"),
    capacity: integer(v.capacity, "Resource capacity", 1, 50),
    schedule: validateSchedule(v.schedule),
    active: bool(v.active, "Active"),
    ...(profile
      ? {
          profile: {
            name: text(profile.name, "Profile name", 100, true),
            specialty: localized(profile.specialty, "Specialty", 100),
            bio: localized(profile.bio, "Biography", 1000),
            initials: text(profile.initials, "Initials", 5, true),
            example: bool(profile.example, "Example profile"),
          },
        }
      : {}),
  };
}
/** Administrative content cannot alter the deployed preset or capability level. */
export function settingsInput(
  value: unknown,
  current: BusinessSettings,
): BusinessSettings {
  const v = object(value),
    b = object(v.brand),
    p = object(v.policy);
  if (v.preset !== current.preset || v.level !== current.level)
    fail(
      403,
      "FEATURES_LOCKED",
      "Change the business preset and level through deployment configuration, not the content editor.",
    );
  const email = text(b.email, "Business email", 150),
    whatsapp = text(b.whatsapp, "WhatsApp", 16);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(422, "INVALID_EMAIL", "Enter a valid business email.");
  if (whatsapp && !/^[1-9]\d{7,15}$/.test(whatsapp))
    fail(
      422,
      "INVALID_PHONE",
      "Use country code and digits without + for WhatsApp.",
    );
  if (!Array.isArray(b.faqs) || b.faqs.length > 20)
    fail(422, "INVALID_FAQS", "Use at most twenty FAQs.");
  return {
    ...current,
    layout: choice(v.layout, LAYOUTS, "Layout"),
    palette: choice(v.palette, PALETTES, "Palette"),
    language: choice(v.language, ["id", "en"] as const, "Language"),
    typography: choice(v.typography, ["sans", "serif"] as const, "Typography"),
    timezone: timezone(v.timezone),
    currency: "IDR",
    brand: {
      name: text(b.name, "Business name", 100, true),
      headline: localized(b.headline, "Headline", 180),
      description: localized(b.description, "About", 3000),
      email,
      whatsapp,
      heroImage: imageUrl(b.heroImage),
      heroAlt: localized(b.heroAlt, "Image description", 200),
      address: text(b.address, "Business address", 500),
      example: bool(b.example, "Example business"),
      faqs: b.faqs.map((x) => {
        const f = object(x);
        return {
          question: localized(f.question, "Question", 200),
          answer: localized(f.answer, "Answer", 1000),
        };
      }),
    },
    policy: {
      manualConfirmation: bool(p.manualConfirmation, "Manual confirmation"),
      holdMinutes: integer(p.holdMinutes, "Confirmation hold", 5, 1440),
      paymentMinutes: integer(p.paymentMinutes, "Payment hold", 5, 1440),
      minNoticeMinutes: integer(p.minNoticeMinutes, "Minimum notice", 0, 43200),
      horizonDays: integer(p.horizonDays, "Booking horizon", 1, 365),
      cancellationHours: integer(
        p.cancellationHours,
        "Cancellation deadline",
        0,
        720,
      ),
      refundPercent: integer(p.refundPercent, "Refund percentage", 0, 100),
      checkInEarlyMinutes: integer(
        p.checkInEarlyMinutes,
        "Early check-in",
        0,
        1440,
      ),
      depositPercent: integer(p.depositPercent, "Deposit percentage", 1, 100),
      onlineRequired: bool(p.onlineRequired, "Online payment required"),
      text: localized(p.text, "Policy", 3000),
    },
  };
}
