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
    visitPhoto: { image: "/images/medical-detail.webp", alt: l("Meja penerimaan klinik di samping lorong menuju ruang periksa.", "A clinic reception desk beside the hallway to the consultation rooms.") },
    heroImage: "/images/medical-welcome.webp",
    heroAlt: l(
      "Seorang dokter berbincang dengan pengunjung di ruang konsultasi.",
      "A practitioner talking with a visitor in a consultation room.",
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
    visitPhoto: { image: "/images/aesthetic-consult.webp", alt: l("Tempat tidur perawatan dan meja persiapan di ruang studio.", "A treatment bed and preparation counter in the studio.") },
    heroImage: "/images/aesthetic-welcome.webp",
    heroAlt: l(
      "Terapis meneteskan serum dari pipet sambil memegang kuas di atas wajah.",
      "A therapist dispenses serum from a dropper while holding a brush above the face.",
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
    visitPhoto: { image: "/images/detailing.webp", alt: l("Area pencucian dengan mobil yang sedang dibersihkan.", "A car being washed in the service bay.") },
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
    visitPhoto: { image: "/images/consulting.webp", alt: l("Meja pertemuan di tepi jendela besar ruang kantor.", "A meeting table beside the large office windows.") },
    heroImage: "/images/consulting-welcome.webp",
    heroAlt: l("Tim membahas rencana bersama di ruang rapat.", "A team discussing a plan around an office table."),
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
const descriptions: Record<Preset, Record<string, Localized>> = {
  medical: {
    general: l("Temui dokter umum untuk membahas keluhan dan langkah selanjutnya.", "Meet a general practitioner to discuss your concerns and next steps."),
    family: l("Jadwalkan waktu lebih panjang untuk membahas kesehatan anggota keluarga bersama dokter.", "Book a longer visit to discuss a family member’s health with a practitioner."),
    dental: l("Bicarakan keluhan gigi dan mulut dengan dokter gigi saat pemeriksaan awal.", "Discuss dental concerns with a dentist during an initial examination."),
    "dental-review": l("Kembali ke dokter gigi untuk meninjau kunjungan sebelumnya.", "Return to the dentist to review your previous visit."),
    skin: l("Konsultasikan perubahan pada kulit atau kulit kepala secara langsung.", "Discuss changes to your skin or scalp in person."),
    intro: l("Tanyakan pilihan layanan, biaya, dan hal yang perlu disiapkan sebelum kunjungan.", "Ask about services, fees and what to prepare before your visit."),
  },
  aesthetic: {
    facial: l("Sesi pembersihan wajah, pijat ringan, dan masker bersama terapis.", "A cleansing facial with gentle massage and a mask applied by your therapist."),
    hydration: l("Nikmati kompres hangat, aplikasi serum, dan masker pelembap dalam satu sesi.", "Settle in for a warm compress, serum application and a hydrating mask."),
    massage: l("Pilih tekanan pijat yang nyaman untuk punggung, bahu, dan tubuh Anda.", "Choose the massage pressure that feels right for your back, shoulders and body."),
    scalp: l("Sesi khusus kulit kepala dengan pembilasan dan pijat lembut.", "A dedicated scalp session with a rinse and gentle massage."),
    ritual: l("Gabungkan facial dan pijat tubuh dalam satu kunjungan panjang.", "Enjoy a facial and a body massage in one extended visit."),
    consult: l("Bicarakan rutinitas dan pilihan perawatan dengan terapis sebelum memesan.", "Discuss your routine and treatment options with a therapist before booking."),
  },
  detailing: {
    wash: l("Pencucian eksterior, pembersihan roda, dan pengeringan dengan kain mikrofiber.", "An exterior wash, wheel cleaning and a microfiber towel dry."),
    interior: l("Bersihkan jok, karpet, dan bagian kabin yang sering disentuh.", "Clean the upholstery, carpets and frequently touched cabin surfaces."),
    polish: l("Pemolesan satu tahap untuk merapikan tampilan permukaan cat.", "A single machine-polishing pass to refine the paint finish."),
    glass: l("Pembersihan kaca depan, belakang, dan samping, termasuk tepinya.", "A detailed clean of the windscreen, rear and side windows, including the edges."),
    complete: l("Satu paket untuk pencucian eksterior, perawatan cat, dan kabin.", "An extended session covering the exterior, paint finish and cabin."),
    inspect: l("Tinjau kondisi kendaraan bersama tim sebelum memilih paket pengerjaan.", "Walk around the vehicle with the team before choosing a package."),
  },
  consulting: {
    business: l("Tinjau angka dan kegiatan usaha untuk memilih hal yang perlu dibenahi lebih dulu.", "Review business figures and operations to decide what needs attention first."),
    strategy: l("Susun pilihan, tentukan prioritas, dan buat rencana tindakan bersama konsultan.", "Compare options, set priorities and build an action plan with a consultant."),
    career: l("Bahas pengalaman, minat, dan pilihan peran untuk langkah karier berikutnya.", "Discuss your experience, interests and possible roles for your next career step."),
    portfolio: l("Tinjau contoh karya Anda dan pilih cara menjelaskan proses serta hasilnya.", "Review work samples and choose how to present your process and results."),
    team: l("Petakan tugas, pembagian peran, dan jadwal kerja bersama anggota tim.", "Map tasks, responsibilities and a working schedule with your team."),
    intro: l("Kenali cara kerja konsultan dan tentukan topik untuk pertemuan berikutnya.", "Meet a consultant and choose a topic for a follow-up session."),
  },
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
    typography: preset === "aesthetic" || preset === "consulting" ? "serif" : "sans",
    timezone: "Asia/Jakarta",
    currency: "IDR",
    brand: {
      ...brand,
      email: "",
      whatsapp: "",
      address: { medical: "Jl. Sora No. 12, Bandung", aesthetic: "Jl. Arum No. 8, Bandung", detailing: "Jl. Reka No. 26, Bandung", consulting: "Jl. Reka No. 16, Bandung" }[preset],
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
      description: descriptions[preset][slug],
      image: `/images/${preset}-${slug}.webp`,
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
          bio: {
            general: l("Menerima kunjungan umum dan keluarga. Pilih sesi keluarga untuk waktu yang lebih panjang.", "Welcomes general and family visits. Choose a family session for a longer appointment."),
            dental: l("Melayani pemeriksaan awal gigi dan kunjungan lanjutan setelah perawatan.", "Offers initial dental consultations and follow-up visits after treatment."),
            skin: l("Menyediakan sesi tatap muka untuk membahas keluhan kulit dan kulit kepala.", "Offers in-person appointments to discuss skin and scalp concerns."),
          }[category],
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
        bio: suffix === "maya"
          ? l("Memandu sesi wajah dan membantu memilih rangkaian perawatan.", "Guides facial sessions and helps visitors choose a treatment sequence.")
          : l("Memandu sesi relaksasi tubuh dan perawatan kulit kepala.", "Guides body relaxation and scalp-care sessions."),
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
        bio: suffix === "dian"
          ? l("Membahas arah usaha, prioritas, dan pembagian kerja tim.", "Discusses business direction, priorities and team responsibilities.")
          : l("Mendampingi sesi karier, tinjauan portofolio, dan persiapan pertemuan kerja.", "Guides career planning, portfolio reviews and preparation for work meetings."),
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
