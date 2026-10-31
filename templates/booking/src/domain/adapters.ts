import type { Localized, Preset, ResourceKind, Service } from "./model.ts";
import { choice, fail, object, text } from "./validation.ts";
export interface PresetField {
  key: string;
  label: Localized;
  type: "select" | "text";
  required: boolean;
  options?: { value: string; label: Localized }[];
  maxLength?: number;
}
export interface DomainAdapter {
  id: Preset;
  name: Localized;
  selection: "practitioner" | "treatment" | "vehicle" | "consultation";
  professionalLabel: Localized;
  steps: Localized[];
  fields: PresetField[];
  validateOptions(value: unknown): Record<string, string>;
  quote(
    service: Service,
    options: Record<string, string>,
  ): { price: number; duration: number };
  resourceKinds(options: Record<string, string>): ResourceKind[];
}
const l = (id: string, en: string): Localized => ({ id, en });
function adapter(input: Omit<DomainAdapter, "validateOptions">): DomainAdapter {
  return {
    ...input,
    validateOptions(value) {
      const raw = object(value ?? {}),
        result: Record<string, string> = {};
      for (const key of Object.keys(raw))
        if (!input.fields.some((f) => f.key === key))
          fail(
            422,
            "UNKNOWN_FIELD",
            `Unsupported appointment field: ${key}. Do not submit clinical information.`,
          );
      for (const f of input.fields) {
        const value = text(
          raw[f.key],
          f.label.en,
          f.maxLength ?? 120,
          f.required,
        );
        result[f.key] =
          f.type === "select" && value
            ? choice(
                value,
                f.options!.map((x) => x.value),
                f.label.en,
              )
            : value;
      }
      return result;
    },
  };
}
const basicQuote = (s: Service) => ({ price: s.price, duration: s.duration });
export const adapters: Record<Preset, DomainAdapter> = {
  medical: adapter({
    id: "medical",
    name: l("Dokter", "Medical"),
    selection: "practitioner",
    professionalLabel: l("Dokter", "Practitioner"),
    steps: [
      l("Dokter atau spesialisasi", "Practitioner or specialty"),
      l("Jadwal konsultasi", "Consultation time"),
      l("Kontak dan ringkasan", "Contact and summary"),
    ],
    fields: [],
    quote: basicQuote,
    resourceKinds: () => ["practitioner"],
  }),
  aesthetic: adapter({
    id: "aesthetic",
    name: l("Perawatan", "Aesthetic"),
    selection: "treatment",
    professionalLabel: l("Terapis", "Therapist"),
    steps: [
      l("Pilih perawatan", "Choose a treatment"),
      l("Terapis dan waktu", "Therapist and time"),
      l("Ringkasan perawatan", "Treatment summary"),
    ],
    fields: [
      {
        key: "preference",
        label: l("Pilihan sesi", "Session preference"),
        type: "select",
        required: true,
        options: [
          { value: "quiet", label: l("Sesi tenang", "Quiet session") },
          { value: "guided", label: l("Dengan panduan", "Guided session") },
        ],
      },
    ],
    quote: basicQuote,
    resourceKinds: () => ["therapist", "room"],
  }),
  detailing: adapter({
    id: "detailing",
    name: l("Detailing mobil", "Auto detailing"),
    selection: "vehicle",
    professionalLabel: l("Tim perawatan", "Detailing team"),
    steps: [
      l("Kendaraan dan paket", "Vehicle and package"),
      l("Jadwal area kerja", "Service bay time"),
      l("Detail kendaraan", "Vehicle details"),
    ],
    fields: [
      {
        key: "vehicle",
        label: l("Jenis kendaraan", "Vehicle category"),
        type: "select",
        required: true,
        options: [
          { value: "compact", label: l("City car / sedan", "Compact / sedan") },
          { value: "suv", label: l("SUV / MPV", "SUV / MPV") },
          { value: "large", label: l("SUV besar / van", "Large SUV / van") },
        ],
      },
      {
        key: "vehicleModel",
        label: l("Merek dan model", "Make and model"),
        type: "text",
        required: true,
        maxLength: 80,
      },
      {
        key: "plate",
        label: l("Nomor kendaraan (opsional)", "Plate number (optional)"),
        type: "text",
        required: false,
        maxLength: 20,
      },
    ],
    quote(s, o) {
      const extra =
        o.vehicle === "large" ? 100000 : o.vehicle === "suv" ? 50000 : 0;
      return {
        price: s.price + extra,
        duration:
          s.duration +
          (o.vehicle === "large" ? 30 : o.vehicle === "suv" ? 15 : 0),
      };
    },
    resourceKinds: () => ["bay"],
  }),
  consulting: adapter({
    id: "consulting",
    name: l("Konsultasi", "Consulting"),
    selection: "consultation",
    professionalLabel: l("Konsultan", "Professional"),
    steps: [
      l("Jenis dan format", "Type and format"),
      l("Konsultan dan waktu", "Professional and time"),
      l("Kontak dan ringkasan", "Contact and summary"),
    ],
    fields: [
      {
        key: "format",
        label: l("Format pertemuan", "Meeting format"),
        type: "select",
        required: true,
        options: [
          { value: "remote", label: l("Online", "Remote") },
          { value: "onsite", label: l("Di kantor", "On site") },
        ],
      },
      {
        key: "topic",
        label: l("Topik singkat", "Brief topic"),
        type: "text",
        required: false,
        maxLength: 200,
      },
    ],
    quote: basicQuote,
    resourceKinds: (o) =>
      o.format === "onsite" ? ["professional", "room"] : ["professional"],
  }),
};
export const defaultOptions = (preset: Preset): Record<string, string> =>
  Object.fromEntries(
    adapters[preset].fields.map((f) => [
      f.key,
      f.type === "select" ? f.options![0].value : "",
    ]),
  );
