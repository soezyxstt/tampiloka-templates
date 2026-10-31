import { adapters } from "../../src/domain/adapters.ts";
import {
  capabilities,
  type BlackoutPeriod,
  type Bootstrap,
  type Quote,
  type Resource,
  type Selection,
  type Service,
  type Slot,
} from "../../src/domain/model.ts";
import {
  choice,
  dateOnly,
  fail,
  id,
  object,
  timestamp,
} from "../../src/domain/validation.ts";
import {
  localTime,
  scheduleContains,
  TICK,
  utcCandidates,
} from "../../src/domain/time.ts";
import { all, bootstrap, expire } from "../db.ts";
import { requireCapability } from "../security.ts";
import type { Env, Session } from "../types.ts";
import { now } from "../types.ts";
export interface Assignment {
  resource: string;
  unit: number;
}
export interface AvailableSlot extends Slot {
  assignments: Assignment[];
  occupiedStart: number;
  occupiedEnd: number;
}
export interface Availability {
  slots: AvailableSlot[];
  quote: Quote;
  selection: Selection;
  service: Service;
  data: Bootstrap;
}
export function parseSelection(value: unknown, data: Bootstrap): Selection {
  const raw = object(value),
    serviceId = id(raw.serviceId, "Service"),
    locationId = id(raw.locationId, "Location");
  const practitionerId = raw.practitionerId
    ? id(raw.practitionerId, "Practitioner")
    : "";
  return {
    serviceId,
    locationId,
    practitionerId,
    options: adapters[data.config.preset].validateOptions(raw.options ?? {}),
  };
}
export function quoteSelection(
  data: Bootstrap,
  selection: Selection,
): { quote: Quote; service: Service } {
  const service = data.services.find(
    (s) => s.id === selection.serviceId && s.active,
  );
  if (!service || !service.locationIds.includes(selection.locationId))
    fail(
      422,
      "SERVICE_UNAVAILABLE",
      "This service is not available at the selected location.",
    );
  const location = data.locations.find(
    (l) => l.id === selection.locationId && l.active,
  );
  if (!location)
    fail(422, "LOCATION_UNAVAILABLE", "This location is not available.");
  const calculated = adapters[data.config.preset].quote(
    service,
    selection.options,
  );
  const paymentRequired =
    data.capabilities.payments &&
    calculated.price > 0 &&
    data.config.policy.onlineRequired;
  return {
    service,
    quote: {
      total: calculated.price,
      duration: calculated.duration,
      dueNow: data.capabilities.payments
        ? Math.ceil(
            (calculated.price * data.config.policy.depositPercent) / 100,
          )
        : 0,
      paymentRequired,
    },
  };
}
export async function availability(
  env: Env,
  s: Session,
  input: unknown,
  ignoreBooking = "",
): Promise<Availability> {
  await expire(env, s);
  const data = await bootstrap(env, s);
  requireCapability(data.capabilities, "booking");
  const raw = object(input),
    selection = parseSelection(raw, data),
    { quote, service } = quoteSelection(data, selection),
    date = dateOnly(raw.date),
    location = data.locations.find((l) => l.id === selection.locationId)!;
  const day = Date.parse(`${date}T12:00:00Z`),
    stamp = now(env);
  if (
    day < stamp - 86400000 ||
    day > stamp + (data.config.policy.horizonDays + 1) * 86400000
  )
    fail(
      422,
      "DATE_OUTSIDE_WINDOW",
      "The selected date is outside the booking window.",
    );
  const bounds = [
    Date.parse(`${date}T00:00:00Z`) - 14 * 3600000,
    Date.parse(`${date}T00:00:00Z`) + 39 * 3600000,
  ];
  const occupied = await all<{ resource: string; unit: number; tick: number }>(
    env,
    "SELECT resource,unit,tick FROM allocations WHERE scope=? AND tick>=? AND tick<=? AND booking_id<>?",
    s.scope,
    Math.floor(bounds[0] / TICK),
    Math.ceil(bounds[1] / TICK),
    ignoreBooking,
  );
  const used = new Set(
    occupied.map((x) => `${x.resource}|${x.unit}|${x.tick}`),
  );
  const blackouts = await all<{
    resource_id: string;
    location_id: string;
    starts_at: number;
    ends_at: number;
  }>(
    env,
    "SELECT resource_id,location_id,starts_at,ends_at FROM blackouts WHERE scope=? AND preset=? AND starts_at<? AND ends_at>?",
    s.scope,
    data.config.preset,
    bounds[1],
    bounds[0],
  );
  const kinds = adapters[data.config.preset].resourceKinds(selection.options);
  const candidates = data.resources.filter(
    (r) =>
      r.locationId === location.id &&
      r.serviceIds.includes(service.id) &&
      r.active,
  );
  if (
    selection.practitionerId &&
    !candidates.some(
      (r) =>
        r.id === selection.practitionerId &&
        ["practitioner", "therapist", "professional"].includes(r.kind),
    )
  )
    fail(
      422,
      "PRACTITIONER_UNAVAILABLE",
      "The selected practitioner does not provide this service at this location.",
    );
  const availableUnit = (
    resource: string,
    capacity: number,
    start: number,
    end: number,
  ) => {
    for (let unit = 0; unit < capacity; unit++) {
      let free = true;
      for (let tick = start / TICK; tick < end / TICK; tick++)
        if (used.has(`${resource}|${unit}|${tick}`)) {
          free = false;
          break;
        }
      if (free) return unit;
    }
    return -1;
  };
  const slots: AvailableSlot[] = [];
  for (const start of utcCandidates(date, location.timezone)) {
    if (
      start < stamp + data.config.policy.minNoticeMinutes * 60000 ||
      start > stamp + data.config.policy.horizonDays * 86400000
    )
      continue;
    const end = start + quote.duration * 60000,
      occupiedStart = start - service.bufferBefore * 60000,
      occupiedEnd = end + service.bufferAfter * 60000;
    if (
      !scheduleContains(
        location.schedule,
        occupiedStart,
        occupiedEnd,
        location.timezone,
      )
    )
      continue;
    if (
      blackouts.some(
        (b) =>
          !b.resource_id &&
          (!b.location_id || b.location_id === location.id) &&
          b.starts_at < occupiedEnd &&
          b.ends_at > occupiedStart,
      )
    )
      continue;
    const lu = availableUnit(
        `loc:${location.id}`,
        location.capacity,
        occupiedStart,
        occupiedEnd,
      ),
      su = availableUnit(
        `svc:${service.id}`,
        service.capacity,
        occupiedStart,
        occupiedEnd,
      );
    if (lu < 0 || su < 0) continue;
    const assignments: Assignment[] = [
      { resource: `loc:${location.id}`, unit: lu },
      { resource: `svc:${service.id}`, unit: su },
    ];
    let valid = true;
    let professional: Resource | undefined;
    for (const kind of kinds) {
      let selected: Resource | undefined;
      let unit = -1;
      for (const resource of candidates.filter((r) => r.kind === kind)) {
        if (
          selection.practitionerId &&
          ["practitioner", "therapist", "professional"].includes(kind) &&
          resource.id !== selection.practitionerId
        )
          continue;
        if (
          !scheduleContains(
            resource.schedule,
            occupiedStart,
            occupiedEnd,
            location.timezone,
          ) ||
          blackouts.some(
            (b) =>
              b.resource_id === resource.id &&
              b.starts_at < occupiedEnd &&
              b.ends_at > occupiedStart,
          )
        )
          continue;
        unit = availableUnit(
          resource.id,
          resource.capacity,
          occupiedStart,
          occupiedEnd,
        );
        if (unit >= 0) {
          selected = resource;
          break;
        }
      }
      if (!selected) {
        valid = false;
        break;
      }
      assignments.push({ resource: selected.id, unit });
      if (selected.profile) professional = selected;
    }
    if (valid) {
      const local = localTime(start, location.timezone);
      slots.push({
        startsAt: start,
        endsAt: end,
        label: local.label,
        offset: local.offset,
        practitionerId: professional?.id ?? "",
        practitionerName: professional?.name ?? "",
        assignments,
        occupiedStart,
        occupiedEnd,
      });
    }
  }
  return { slots, quote, selection, service, data };
}
export async function selectedSlot(
  env: Env,
  s: Session,
  input: Record<string, unknown>,
  ignoreBooking = "",
) {
  const startsAt = timestamp(input.startsAt),
    data = await bootstrap(env, s),
    location = data.locations.find((l) => l.id === input.locationId);
  if (!location)
    fail(422, "LOCATION_UNAVAILABLE", "Choose an available location.");
  const result = await availability(
    env,
    s,
    { ...input, date: localTime(startsAt, location.timezone).date },
    ignoreBooking,
  );
  const slot = result.slots.find((x) => x.startsAt === startsAt);
  if (!slot)
    fail(
      409,
      "SLOT_UNAVAILABLE",
      "This time is no longer available. Choose another time.",
    );
  return { ...result, slot };
}
