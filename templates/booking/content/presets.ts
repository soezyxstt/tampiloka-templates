import type {
  BusinessSettings,
  Location,
  Localized,
  Preset,
  Resource,
  Service,
  ServiceCategory,
} from "../src/domain/model.ts";
import { weekSchedule } from "../src/domain/time.ts";
const l = (id: string, en: string): Localized => ({ id, en });
export interface PresetContent {
  config: BusinessSettings;
  categories: ServiceCategory[];
  services: Service[];
  resources: Resource[];
  locations: Location[];
}
const brands = {
  medical: {
    name: "Nova Clinic",
    headline: l("Waktu untuk kesehatan Anda.", "Care that fits your day."),
    description: l(
      "Pilih layanan dan dokter, lalu atur waktu kunjungan Anda. Seluruh profil di situs contoh ini bersifat fiktif.",
      "Choose a service and practitioner, then arrange your visit. All profiles on this example website are fictional.",
    ),
    heroImage: "/images/medical.webp",
    heroAlt: l(
      "Ruang layanan kesehatan, foto ilustrasi",
      "A healthcare space, illustrative photo",
    ),
  },
  aesthetic: {
    name: "Atelier Care",
    headline: l(
      "Perawatan yang memberi ruang untuk diri.",
      "A little time, entirely yours.",
    ),
    description: l(
      "Temukan perawatan wajah dan tubuh dalam sesi yang tenang. Pilih perawatan, terapis, dan waktu yang sesuai.",
      "Explore considered face and body treatments in a calm setting. Choose your treatment, therapist, and time.",
    ),
    heroImage: "/images/aesthetic.webp",
    heroAlt: l(
      "Handuk dan perlengkapan perawatan",
      "Towels and treatment supplies",
    ),
  },
  detailing: {
    name: "Forma Auto",
    headline: l(
      "Pilih perawatan kendaraan dan waktu yang sesuai.",
      "Choose vehicle care at a time that works for you.",
    ),
    description: l(
      "Pilih paket sesuai kendaraan Anda. Lihat harga, durasi, dan ketersediaan area kerja sebelum datang.",
      "Choose a package for your vehicle. See the price, duration, and service bay availability before you arrive.",
    ),
    heroImage: "/images/detailing.webp",
    heroAlt: l(
      "Perawatan kendaraan di area kerja",
      "Vehicle care in a service bay",
    ),
  },
  consulting: {
    name: "Northline Advisory",
    headline: l(
      "Buat langkah berikutnya lebih jelas.",
      "Make your next decision clearer.",
    ),
    description: l(
      "Sesi terarah untuk usaha, karier, dan tim. Temui konsultan secara online atau di kantor.",
      "Focused sessions for your business, career, and team. Meet a professional remotely or in our office.",
    ),
    heroImage: "/images/consulting.webp",
    heroAlt: l("Ruang pertemuan profesional", "A professional meeting space"),
  },
};
const catalog: Record<
  Preset,
  Array<[string, string, string, string, number, number]>
> = {
  medical: [
    [
      "general",
      "Konsultasi umum",
      "General consultation",
      "general",
      30,
      150000,
    ],
    [
      "family",
      "Konsultasi keluarga",
      "Family consultation",
      "general",
      45,
      225000,
    ],
    ["dental", "Konsultasi gigi", "Dental consultation", "dental", 30, 180000],
    [
      "dental-review",
      "Kunjungan lanjutan gigi",
      "Dental follow-up",
      "dental",
      20,
      100000,
    ],
    ["skin", "Konsultasi kulit", "Skin consultation", "skin", 30, 250000],
    ["intro", "Informasi layanan", "Service orientation", "general", 15, 0],
  ],
  aesthetic: [
    ["facial", "Essential facial", "Essential facial", "face", 60, 350000],
    ["hydration", "Hydration ritual", "Hydration ritual", "face", 75, 450000],
    ["massage", "Relaksasi tubuh", "Body relaxation", "body", 90, 550000],
    ["scalp", "Perawatan kepala", "Scalp care", "body", 45, 250000],
    [
      "ritual",
      "Face & body ritual",
      "Face & body ritual",
      "packages",
      150,
      850000,
    ],
    [
      "consult",
      "Konsultasi perawatan",
      "Treatment consultation",
      "face",
      20,
      0,
    ],
  ],
  detailing: [
    ["wash", "Signature wash", "Signature wash", "wash", 60, 150000],
    ["interior", "Interior reset", "Interior reset", "interior", 120, 500000],
    ["polish", "Poles satu tahap", "Single-stage polish", "paint", 180, 900000],
    ["glass", "Perawatan kaca", "Glass care", "paint", 90, 350000],
    [
      "complete",
      "Complete detail",
      "Complete detail",
      "packages",
      300,
      1500000,
    ],
    ["inspect", "Inspeksi awal", "Initial inspection", "wash", 30, 0],
  ],
  consulting: [
    ["business", "Tinjauan bisnis", "Business review", "business", 60, 500000],
    ["strategy", "Sesi strategi", "Strategy session", "business", 90, 750000],
    ["career", "Arah karier", "Career direction", "career", 45, 350000],
    [
      "portfolio",
      "Tinjauan portofolio",
      "Portfolio review",
      "career",
      60,
      400000,
    ],
    ["team", "Rencana kerja tim", "Team planning", "team", 120, 1000000],
    ["intro", "Sesi perkenalan", "Introduction call", "business", 20, 0],
  ],
};
const categoryNames: Record<string, Localized> = {
  general: l("Umum", "General"),
  dental: l("Gigi", "Dental"),
  skin: l("Kulit", "Skin"),
  face: l("Wajah", "Face"),
  body: l("Tubuh", "Body"),
  packages: l("Paket", "Packages"),
  wash: l("Cuci & inspeksi", "Wash & inspection"),
  interior: l("Interior", "Interior"),
  paint: l("Cat & kaca", "Paint & glass"),
  business: l("Bisnis", "Business"),
  career: l("Karier", "Career"),
  team: l("Tim", "Team"),
};
export function presetContent(preset: Preset): PresetContent {
  const brand = brands[preset],
    locationId = `${preset}-main`;
  const config: BusinessSettings = {
    preset,
    level: "booking",
    layout: "appointment-first",
    palette: "sage",
    language: "id",
    typography: "sans",
    timezone: "Asia/Jakarta",
    currency: "IDR",
    brand: {
      ...brand,
      email: "",
      whatsapp: "",
      address: "Alamat contoh. Ganti sebelum peluncuran.",
      example: true,
      faqs: [
        {
          question: l(
            "Apakah jadwal langsung terkonfirmasi?",
            "Is my appointment confirmed immediately?",
          ),
          answer: l(
            "Lihat status di halaman janji Anda. Permintaan lewat WhatsApp belum menjadi janji terkonfirmasi.",
            "Check the status on your appointment page. A WhatsApp request is not a confirmed appointment.",
          ),
        },
        {
          question: l(
            "Bagaimana cara mengubah jadwal?",
            "How do I reschedule?",
          ),
          answer: l(
            "Buka Janji saya, pilih janji, lalu pilih Jadwalkan ulang. Batas waktu mengikuti kebijakan yang tampil saat memesan.",
            "Open My appointments, select your appointment, then choose Reschedule. The deadline follows the policy shown when booking.",
          ),
        },
        {
          question: l(
            "Bagaimana pembayaran bekerja?",
            "How does payment work?",
          ),
          answer: l(
            "Layanan gratis dan bayar di lokasi tersedia. Pembayaran online hanya muncul saat bisnis mengaktifkannya.",
            "Free and pay-at-location services are supported. Online payment appears only when the business enables it.",
          ),
        },
      ],
    },
    policy: {
      manualConfirmation: false,
      holdMinutes: 120,
      paymentMinutes: 20,
      minNoticeMinutes: 60,
      horizonDays: 60,
      cancellationHours: 12,
      refundPercent: 100,
      checkInEarlyMinutes: 60,
      depositPercent: 30,
      onlineRequired: false,
      text: l(
        "Ubah atau batalkan hingga 12 jam sebelum jadwal. Pengembalian dana mengikuti jumlah yang telah dibayar dan persetujuan staf.",
        "Change or cancel up to 12 hours before your appointment. Refunds follow the amount paid and staff review.",
      ),
    },
  };
  const locations: Location[] = [
    {
      id: locationId,
      preset,
      name: {
        medical: "Nova Clinic",
        aesthetic: "Atelier Care Studio",
        detailing: "Forma Auto Workshop",
        consulting: "Northline Office",
      }[preset],
      address: config.brand.address,
      timezone: "Asia/Jakarta",
      capacity: 8,
      schedule: weekSchedule(),
      active: true,
    },
  ];
  const services: Service[] = catalog[preset].map(
    ([slug, id, en, category, duration, price], index) => ({
      id: `${preset}-${slug}`,
      preset,
      name: l(id, en),
      category,
      description:
        preset === "medical"
          ? l(
              "Kunjungan terjadwal dengan dokter pilihan. Situs ini hanya mengatur janji, bukan rekam medis. Jangan masukkan data klinis.",
              "A scheduled visit with your chosen practitioner. This website handles appointments, not medical records. Do not enter clinical information.",
            )
          : preset === "detailing"
            ? l(
                "Paket mencakup pemeriksaan singkat, pengerjaan sesuai pilihan, dan pemeriksaan hasil bersama. Durasi serta harga menyesuaikan jenis kendaraan.",
                "Includes a brief inspection, the selected service, and a handover check. Duration and price depend on the vehicle category.",
              )
            : preset === "aesthetic"
              ? l(
                  "Sesi perawatan dengan waktu khusus, ruang yang telah disiapkan, dan terapis yang tersedia. Silakan hubungi tim untuk pertanyaan sebelum kunjungan.",
                  "A dedicated treatment session with a prepared room and an available therapist. Contact the team with questions before your visit.",
                )
              : l(
                  "Sesi terarah dengan satu konsultan. Tentukan format pertemuan dan topik singkat. Detail pertemuan online akan disampaikan oleh tim.",
                  "A focused session with one professional. Choose your meeting format and a brief topic. The team will share remote meeting details.",
                ),
      image:
        preset === "medical" && category !== "dental"
          ? "/images/medical-detail.webp"
          : preset === "consulting" && index % 2
            ? "/images/consulting-detail.webp"
            : preset === "aesthetic" && slug === "scalp"
              ? "/images/aesthetic-detail.webp"
              : brand.heroImage,
      duration,
      bufferBefore: 0,
      bufferAfter: preset === "medical" ? 5 : 15,
      price,
      capacity: 6,
      locationIds: [locationId],
      active: true,
      featured: index < 3,
      packageItems:
        category === "packages"
          ? [
              l("Sesi layanan utama", "Main service session"),
              l("Pemeriksaan hasil", "Completion review"),
            ]
          : [],
    }),
  );
  const all = services.map((s) => s.id),
    resources: Resource[] = [];
  const add = (
    suffix: string,
    name: string,
    kind: Resource["kind"],
    capacity = 1,
    serviceIds = all,
    profile?: Resource["profile"],
  ) =>
    resources.push({
      id: `${preset}-${suffix}`,
      preset,
      name,
      kind,
      capacity,
      serviceIds,
      locationId,
      schedule: weekSchedule(),
      active: true,
      ...(profile ? { profile } : {}),
    });
  if (preset === "medical") {
    const people = [
      ["dr-ayu", "Dr. Ayu Pramesti", "general", "AP"],
      ["dr-raka", "Dr. Raka Aditya", "dental", "RA"],
      ["dr-nara", "Dr. Nara Putri", "skin", "NP"],
    ] as const;
    for (const [suffix, name, category, initials] of people)
      add(
        suffix,
        name,
        "practitioner",
        1,
        services.filter((s) => s.category === category).map((s) => s.id),
        {
          name,
          specialty: categoryNames[category],
          initials,
          example: true,
          bio: l(
            "Profil fiktif untuk contoh pemesanan. Bukan dokter yang dapat dihubungi.",
            "Fictional profile demonstrating appointment booking. Not a practitioner available for contact.",
          ),
        },
      );
  } else if (preset === "aesthetic") {
    for (const [suffix, name, initials] of [
      ["maya", "Maya", "MA"],
      ["sari", "Sari", "SA"],
    ])
      add(suffix, name, "therapist", 1, all, {
        name,
        specialty: l("Perawatan wajah & tubuh", "Face & body treatments"),
        initials,
        example: true,
        bio: l("Profil terapis contoh.", "Example therapist profile."),
      });
    add("treatment-room", "Treatment room", "room", 2);
  } else if (preset === "detailing") {
    add("bay", "Service bay", "bay", 2);
  } else {
    for (const [suffix, name, initials] of [
      ["dian", "Dian Laras", "DL"],
      ["arif", "Arif Tama", "AT"],
    ])
      add(suffix, name, "professional", 1, all, {
        name,
        specialty: l(
          "Bisnis & pengembangan tim",
          "Business & team development",
        ),
        initials,
        example: true,
        bio: l(
          "Profil konsultan fiktif untuk menunjukkan alur penjadwalan.",
          "A fictional professional profile demonstrating scheduling.",
        ),
      });
    add("meeting-room", "Meeting room", "room", 1);
  }
  return {
    config,
    categories: [...new Set(services.map((s) => s.category))].map((id) => ({
      id,
      name: categoryNames[id],
    })),
    services,
    resources,
    locations,
  };
}
