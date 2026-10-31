export type Locale = 'id' | 'en';
export type Text = Record<Locale, string>;
export type Level = 'profile' | 'whatsapp' | 'enrollment' | 'full';
export type Preset = 'exam-prep' | 'language' | 'skills' | 'institution';
export type Layout = 'academic-editorial' | 'course-discovery' | 'contemporary-learning' | 'institutional';
export type Role = 'visitor' | 'admin' | 'staff' | 'editor' | 'tutor' | 'student' | 'guardian';
export type EnrollmentStatus = 'draft' | 'submitted' | 'under_review' | 'waitlisted' | 'accepted' | 'rejected' | 'awaiting_payment' | 'active' | 'cancelled' | 'completed';
export type Json = null | boolean | number | string | Json[] | {
    [key: string]: Json;
};
export interface Field {
    name: string;
    label: Text;
    type: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'textarea';
    required?: boolean;
    options?: string[];
    maxLength?: number;
    min?: number;
    max?: number;
    when?: {
        field: string;
        equals: string | boolean;
    };
}
export interface PageBlock {
    id: string;
    type: string;
    heading: Text;
    body: Text;
    image?: string;
}
export interface ContentData {
    title: Text;
    summary: Text;
    body: Text;
    image: string;
    seoTitle: Text;
    seoDescription: Text;
    blocks: PageBlock[];
    attributes: Record<string, Json>;
}
export interface ContentRecord {
    id: string;
    collection: string;
    slug: string;
    draft: ContentData;
    published: ContentData | null;
    version: number;
    revisions: {
        version: number;
        at: string;
        by: string;
        data: ContentData;
    }[];
}
export interface Institution {
    name: string;
    description: Text;
    address: string;
    email: string;
    whatsapp: string;
    timezone: string;
    navigation: {
        label: Text;
        page: string;
    }[];
}
export interface Branch {
    id: string;
    name: string;
    address: string;
}
export interface Program {
    id: string;
    contentId: string;
    type: Preset | string;
    subject: string;
    format: 'online' | 'onsite' | 'hybrid';
    duration: Text;
    tutorIds: string[];
}
export interface Course {
    id: string;
    programId: string;
    title: Text;
    outcomes: Text[];
}
export interface Tutor {
    id: string;
    name: string;
    bio: Text;
    specialty: Text;
    image: string;
}
export interface Cohort {
    id: string;
    programId: string;
    branchId: string;
    name: string;
    capacity: number;
    opensAt: string;
    closesAt: string;
    startsAt: string;
    endsAt: string;
    tuitionIdr: number;
    registrationIdr: number;
    requiresApproval: boolean;
    requiresPayment: boolean;
}
export interface ClassSession {
    id: string;
    cohortId: string;
    tutorId: string;
    title: Text;
    startsAt: string;
    endsAt: string;
    location: string;
}
export interface User {
    id: string;
    name: string;
    email: string;
    role: Exclude<Role, 'visitor'>;
    passwordHash?: string;
    studentIds: string[];
    tutorId?: string;
    disabled?: boolean;
}
export interface Student {
    id: string;
    name: string;
    email: string;
}
export interface Enrollment {
    id: string;
    studentId: string;
    cohortId: string;
    status: EnrollmentStatus;
    answers: Record<string, Json>;
    createdAt: string;
    updatedAt: string;
    version: number;
}
export interface EnrollmentEvent {
    id: string;
    enrollmentId: string;
    status: EnrollmentStatus;
    at: string;
    by: string;
    note: string;
}
export interface Invoice {
    id: string;
    enrollmentId: string;
    studentId: string;
    lines: {
        label: string;
        amountIdr: number;
    }[];
    totalIdr: number;
    status: 'unpaid' | 'paid' | 'void';
    issuedAt: string;
    paidAt?: string;
    needsReview?: boolean;
}
export interface Payment {
    id: string;
    invoiceId: string;
    amountIdr: number;
    provider: 'demo' | 'manual' | 'midtrans';
    reference: string;
    status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
    at: string;
    checkoutUrl?: string;
    checkoutExpiresAt?: number;
    startingUntil?: number;
}
export interface Attendance {
    id: string;
    sessionId: string;
    studentId: string;
    status: 'present' | 'absent' | 'excused';
    by: string;
    at: string;
}
export interface Progress {
    id: string;
    cohortId: string;
    studentId: string;
    topic: string;
    note: string;
    percent: number;
    by: string;
    at: string;
}
export interface MediaAsset {
    id: string;
    name: string;
    type: string;
    size: number;
    key: string;
    public: boolean;
}
export interface LearningMaterial {
    id: string;
    cohortId: string;
    title: Text;
    description: Text;
    assetId?: string;
    sampleText?: string;
}
export interface Notice {
    id: string;
    event: string;
    enrollmentId: string;
    createdAt: string;
    status: 'pending' | 'sent' | 'failed';
    attempts: number;
}
export interface SchoolConfig {
    schemaVersion: number;
    preset: Preset;
    level: Level;
    brandName: string;
    whatsapp: string;
    locale: Locale;
    appearance: {
        layout: Layout;
        palette: string;
        typography: string;
    };
    modules: Record<string, boolean>;
    payment: {
        provider: 'manual' | 'midtrans';
    };
    registrationFields: Field[];
}
export interface SchoolState {
    schemaVersion: 1;
    institution: Institution;
    branches: Branch[];
    programs: Program[];
    courses: Course[];
    cohorts: Cohort[];
    sessions: ClassSession[];
    tutors: Tutor[];
    users: User[];
    students: Student[];
    enrollments: Enrollment[];
    events: EnrollmentEvent[];
    invoices: Invoice[];
    payments: Payment[];
    attendance: Attendance[];
    progress: Progress[];
    materials: LearningMaterial[];
    media: MediaAsset[];
    content: ContentRecord[];
    modules: Record<string, boolean>;
    registrationFields: Field[];
    outbox: Notice[];
    idempotency: Record<string, {
        fingerprint: string;
        result: Json;
    }>;
}
export interface Context {
    actor: User | null;
    level: Level;
    demo: boolean;
    now: string;
    id: string;
}
export interface Command {
    action: string;
    payload: Record<string, unknown>;
    key: string;
}
export interface Snapshot {
    paymentProvider: 'manual' | 'midtrans';
    demo: boolean;
    level: Level;
    preset: Preset;
    actor: Omit<User, 'passwordHash'> | null;
    institution: Institution;
    capabilities: string[];
    branches: Branch[];
    programs: Program[];
    courses: Course[];
    cohorts: Cohort[];
    availability: Record<string, number>;
    sessions: ClassSession[];
    tutors: Tutor[];
    students: Student[];
    users: Omit<User, 'passwordHash'>[];
    enrollments: Enrollment[];
    events: EnrollmentEvent[];
    invoices: Invoice[];
    payments: Payment[];
    attendance: Attendance[];
    progress: Progress[];
    materials: LearningMaterial[];
    media: MediaAsset[];
    content: ContentRecord[];
    modules: Record<string, boolean>;
    registrationFields: Field[];
    extensionRegistrationFields: string[];
    outbox: Notice[];
}
