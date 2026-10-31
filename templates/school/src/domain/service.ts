import type { Command, Context, ContentData, ContentRecord, Enrollment, EnrollmentStatus, Field, Json, SchoolState, Snapshot, Preset, ClassSession, Cohort, MediaAsset, LearningMaterial } from './types.ts';
import { check, integer, text, date, need, isStaff, canEdit, capabilities, has, reservedStatuses } from './capabilities.ts';
import { cms, validateFields, validateFieldDefinitions } from '../cms/registry.ts';
export const freeSeats = (s: SchoolState, c: string) => Math.max(0, (s.cohorts.find(x => x.id === c)?.capacity ?? 0) - s.enrollments.filter(e => e.cohortId === c && reservedStatuses.has(e.status)).length);
export const owns = (ctx: Context, studentId: string) => ctx.actor?.studentIds.includes(studentId) ?? false;
export function mayTeach(s: SchoolState, ctx: Context, cohortId: string) { return ctx.actor?.role === 'tutor' && s.sessions.some(x => x.cohortId === cohortId && x.tutorId === ctx.actor?.tutorId); }
function staff(ctx: Context) { check(isStaff(ctx.actor?.role), 'forbidden', 403); }
function admin(ctx: Context) { check(ctx.actor?.role === 'admin', 'forbidden', 403); }
function academic(s: SchoolState, ctx: Context, cohortId: string) { check(isStaff(ctx.actor?.role) || mayTeach(s, ctx, cohortId), 'forbidden', 403); }
function label(v: unknown) { check(v && typeof v === 'object', 'invalid_translation'); const x = v as Record<string, unknown>; return { id: text(x.id, 1000), en: text(x.en, 1000) }; }
function safeUrl(v: unknown) { const x = typeof v === 'string' ? v : ''; check(!x || /^\/api\/media\/[a-zA-Z0-9-]+$|^\/images\/[a-zA-Z0-9._-]+$/.test(x) || /^https:\/\/[^\s<>]+$/.test(x), 'invalid_media'); return x; }
function enrolled(s: SchoolState, studentId: string, cohortId: string) { return s.enrollments.some(e => e.studentId === studentId && e.cohortId === cohortId && ['active', 'completed'].includes(e.status)); }
function event(s: SchoolState, e: Enrollment, status: EnrollmentStatus, ctx: Context, note = '') {
    e.status = status;
    e.updatedAt = ctx.now;
    e.version++;
    s.events.push({ id: `${ctx.id}-${s.events.length}`, enrollmentId: e.id, status, at: ctx.now, by: ctx.actor?.id ?? 'provider', note });
    if (s.modules.notifications)
        s.outbox.push({ id: `notice-${ctx.id}-${s.outbox.length}`, event: status, enrollmentId: e.id, createdAt: ctx.now, status: 'pending', attempts: 0 });
}
export function activate(s: SchoolState, e: Enrollment, ctx: Context) {
    const cohort = s.cohorts.find(c => c.id === e.cohortId)!;
    if (!['accepted', 'awaiting_payment'].includes(e.status))
        return;
    const invoice = s.invoices.find(i => i.enrollmentId === e.id && i.status !== 'void');
    if (ctx.level === 'full' && cohort.requiresPayment && (cohort.tuitionIdr + cohort.registrationIdr) > 0 && invoice?.status !== 'paid') {
        if (!invoice)
            s.invoices.push({ id: `inv-${e.id}`, enrollmentId: e.id, studentId: e.studentId, lines: [{ label: 'Tuition / Biaya program', amountIdr: cohort.tuitionIdr }, { label: 'Registration / Pendaftaran', amountIdr: cohort.registrationIdr }], totalIdr: integer(cohort.tuitionIdr + cohort.registrationIdr), status: 'unpaid', issuedAt: ctx.now });
        if (e.status !== 'awaiting_payment')
            event(s, e, 'awaiting_payment', ctx);
    }
    else
        event(s, e, 'active', ctx);
}
const transitions: Record<EnrollmentStatus, EnrollmentStatus[]> = { draft: ['submitted', 'cancelled'], submitted: ['under_review', 'accepted', 'rejected', 'waitlisted', 'cancelled'], under_review: ['accepted', 'rejected', 'waitlisted', 'cancelled'], waitlisted: ['under_review', 'accepted', 'rejected', 'cancelled'], accepted: ['cancelled'], awaiting_payment: ['cancelled'], active: ['cancelled', 'completed'], rejected: [], cancelled: [], completed: [] };
export function applyPayment(s: SchoolState, ctx: Context, invoiceId: string, reference: string, amount: number, provider: 'manual' | 'demo' | 'midtrans', status: 'paid' | 'pending' | 'failed' | 'expired' | 'refunded' = 'paid') {
    need(ctx.level, 'finance');
    const invoice = s.invoices.find(x => x.id === invoiceId);
    check(invoice, 'not_found', 404);
    check(integer(amount) === invoice.totalIdr, 'amount_mismatch', 409);
    const previous = s.payments.find(x => x.reference === reference && x.provider === provider);
    check(!previous || previous.invoiceId === invoiceId, 'payment_conflict', 409);
    if (previous?.status === 'paid' && status !== 'refunded')
        return invoice.id;
    if (previous?.status === 'refunded')
        return invoice.id;
    if (previous)
        previous.status = status;
    else
        s.payments.push({ id: `pay-${ctx.id}`, invoiceId, amountIdr: amount, reference, provider, status, at: ctx.now });
    if (status === 'paid') {
        if (invoice.status === 'void') {
            invoice.needsReview = true;
            return invoice.id;
        }
        if (invoice.status === 'paid' && !previous) {
            invoice.needsReview = true;
            return invoice.id;
        }
        invoice.status = 'paid';
        invoice.paidAt = ctx.now;
        const e = s.enrollments.find(x => x.id === invoice.enrollmentId)!;
        activate(s, e, ctx);
    }
    else if (status === 'refunded') {
        invoice.needsReview = true;
    }
    return invoice.id;
}
export function command(s: SchoolState, ctx: Context, cmd: Command): Json {
    check(ctx.actor && !ctx.actor.disabled, 'login_required', 401);
    check(typeof cmd.key === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(cmd.key), 'invalid_idempotency');
    check(cmd.payload && typeof cmd.payload === 'object' && !Array.isArray(cmd.payload), 'invalid_payload');
    const fingerprint = JSON.stringify({ action: cmd.action, payload: cmd.payload });
    const key = `${ctx.actor.id}:${cmd.key}`;
    const prior = s.idempotency[key];
    if (prior) {
        check(prior.fingerprint === fingerprint, 'idempotency_conflict', 409);
        return prior.result;
    }
    const p = cmd.payload;
    let result: Json = null;
    const findEnrollment = () => { const e = s.enrollments.find(x => x.id === p.id); check(e, 'not_found', 404); return e; };
    switch (cmd.action) {
        case 'application.save':
        case 'application.submit': {
            need(ctx.level, 'enrollment');
            check(['student', 'guardian', 'admin', 'staff'].includes(ctx.actor.role), 'forbidden', 403);
            const studentId = text(p.studentId, 100);
            check(owns(ctx, studentId) || isStaff(ctx.actor.role), 'forbidden', 403);
            check(s.students.some(x => x.id === studentId), 'not_found', 404);
            const cohort = s.cohorts.find(x => x.id === p.cohortId);
            check(cohort, 'cohort_unavailable', 404);
            const program = s.programs.find(x => x.id === cohort.programId);
            check(program && s.content.find(x => x.id === program.contentId)?.published, 'cohort_unavailable');
            check(Date.parse(ctx.now) >= Date.parse(cohort.opensAt) && Date.parse(ctx.now) <= Date.parse(cohort.closesAt), 'window_closed', 409);
            const existing = s.enrollments.find(x => x.studentId === studentId && x.cohortId === cohort.id && !['rejected', 'cancelled', 'completed'].includes(x.status));
            check(!existing || existing.status === 'draft', 'already_applied', 409);
            const values = p.answers ?? {};
            check(values && typeof values === 'object' && !Array.isArray(values), 'invalid_fields');
            const fields = [...s.registrationFields, ...cms.registrationFields];
            const answers = validateFields(cmd.action === 'application.save' ? fields.map(f => ({ ...f, required: false })) : fields, values as Record<string, unknown>);
            for (const hook of cms.beforeEnrollment)
                hook(s, ctx, answers);
            const e = existing ?? { id: `enr-${ctx.id}`, studentId, cohortId: cohort.id, status: 'draft' as const, answers: {}, createdAt: ctx.now, updatedAt: ctx.now, version: 0 };
            e.answers = answers;
            if (!existing)
                s.enrollments.push(e);
            if (cmd.action === 'application.submit') {
                event(s, e, freeSeats(s, cohort.id) > 0 ? 'submitted' : 'waitlisted', ctx);
                if (e.status === 'submitted' && !cohort.requiresApproval) {
                    event(s, e, 'accepted', ctx);
                    activate(s, e, ctx);
                }
            }
            else
                event(s, e, 'draft', ctx);
            result = e.id;
            break;
        }
        case 'application.review': {
            need(ctx.level, 'enrollment');
            staff(ctx);
            const e = findEnrollment();
            check(e.version === p.version, 'stale_record', 409);
            const target = p.status as EnrollmentStatus;
            check(transitions[e.status]?.includes(target) && target !== 'submitted', 'invalid_transition', 409);
            if (reservedStatuses.has(target) && !reservedStatuses.has(e.status))
                check(freeSeats(s, e.cohortId) > 0, 'capacity_full', 409);
            const note = p.note ? text(p.note, 1000) : '';
            event(s, e, target, ctx, note);
            if (target === 'accepted')
                activate(s, e, ctx);
            if (target === 'cancelled' || target === 'rejected')
                for (const i of s.invoices.filter(i => i.enrollmentId === e.id)) {
                    if (i.status === 'unpaid')
                        i.status = 'void';
                    else if (i.status === 'paid')
                        i.needsReview = true;
                }
            result = e.id;
            break;
        }
        case 'application.cancel': {
            need(ctx.level, 'enrollment');
            const e = findEnrollment();
            check(owns(ctx, e.studentId) || isStaff(ctx.actor.role), 'forbidden', 403);
            check(transitions[e.status].includes('cancelled'), 'invalid_transition', 409);
            event(s, e, 'cancelled', ctx);
            for (const i of s.invoices.filter(i => i.enrollmentId === e.id)) {
                if (i.status === 'unpaid')
                    i.status = 'void';
                else if (i.status === 'paid')
                    i.needsReview = true;
            }
            result = e.id;
            break;
        }
        case 'payment.record': {
            need(ctx.level, 'finance');
            staff(ctx);
            const invoice = s.invoices.find(x => x.id === p.id);
            check(invoice && invoice.status === 'unpaid', 'invoice_unavailable', 409);
            result = applyPayment(s, ctx, invoice.id, text(p.reference, 100), integer(p.amountIdr), 'manual');
            break;
        }
        case 'payment.simulate': {
            need(ctx.level, 'finance');
            check(ctx.demo, 'demo_only', 403);
            const i = s.invoices.find(x => x.id === p.id);
            check(i && i.status === 'unpaid', 'invoice_unavailable', 409);
            check(owns(ctx, i.studentId) || isStaff(ctx.actor.role), 'forbidden', 403);
            result = applyPayment(s, ctx, i.id, `demo-${i.id}`, i.totalIdr, 'demo');
            break;
        }
        case 'content.save':
        case 'content.publish':
        case 'content.restore': {
            check(canEdit(ctx.actor.role), 'forbidden', 403);
            const id = text(p.id, 100);
            let record = s.content.find(x => x.id === id);
            check(!record || record.version === p.version, 'stale_record', 409);
            if (cmd.action === 'content.restore') {
                check(record, 'not_found', 404);
                const rev = record.revisions.find(x => x.version === p.revision);
                check(rev, 'not_found', 404);
                record.draft = structuredClone(rev.data);
                record.version++;
                result = id;
                break;
            }
            const data = p.data as ContentData;
            check(data && typeof data === 'object', 'invalid_content');
            for (const field of ['title', 'summary', 'body', 'seoTitle', 'seoDescription'] as const) {
                check(data[field] && typeof data[field].id === 'string' && typeof data[field].en === 'string', 'invalid_translation');
                check(data[field].id.length <= 12000 && data[field].en.length <= 12000, 'content_too_long');
            }
            check(data.title.id && data.title.en, 'invalid_title');
            data.image = safeUrl(data.image);
            check(Array.isArray(data.blocks) && data.blocks.length <= 30, 'invalid_blocks');
            for (const b of data.blocks) {
                const def = cms.blocks.get(b.type);
                check(def, 'unknown_block');
                def.validate(b);
                b.image = safeUrl(b.image);
            }
            check(data.attributes && typeof data.attributes === 'object' && !Array.isArray(data.attributes), 'invalid_attributes');
            check(JSON.stringify(data.attributes).length <= 10000, 'content_too_long');
            if (!record) {
                const collection = text(p.collection, 100);
                check(cms.collections.has(collection), 'unknown_collection');
                check(/^[a-z0-9-]+$/.test(id), 'invalid_slug');
                record = { id, collection, slug: id, draft: data, published: null, version: 0, revisions: [] };
                s.content.push(record);
            }
            validateFields(cms.collections.get(record.collection)?.fields ?? [], data.attributes);
            record.revisions.push({ version: record.version, at: ctx.now, by: ctx.actor.id, data: structuredClone(record.draft) });
            record.revisions = record.revisions.slice(-20);
            record.draft = structuredClone(data);
            record.version++;
            if (cmd.action === 'content.publish')
                record.published = structuredClone(data);
            result = id;
            break;
        }
        case 'content.unpublish': {
            check(canEdit(ctx.actor.role), 'forbidden', 403);
            const record = s.content.find(x => x.id === p.id);
            check(record, 'not_found', 404);
            check(record.version === p.version, 'stale_record', 409);
            record.published = null;
            record.version++;
            result = record.id;
            break;
        }
        case 'course.save': {
            staff(ctx);
            const id = text(p.id);
            check(s.programs.some(x => x.id === p.programId), 'invalid_relation');
            check(Array.isArray(p.outcomes) && p.outcomes.length <= 20, 'invalid_outcomes');
            const value = { id, programId: text(p.programId), title: label(p.title), outcomes: p.outcomes.map(label) };
            s.courses = s.courses.filter(x => x.id !== id);
            s.courses.push(value);
            result = id;
            break;
        }
        case 'tutor.save': {
            check(canEdit(ctx.actor.role), 'forbidden', 403);
            const id = text(p.id);
            const value = { id, name: text(p.name), bio: label(p.bio), specialty: label(p.specialty), image: safeUrl(p.image) };
            s.tutors = s.tutors.filter(x => x.id !== id);
            s.tutors.push(value);
            result = id;
            break;
        }
        case 'program.save': {
            staff(ctx);
            const id = text(p.id, 100);
            check(/^[a-z0-9-]+$/.test(id), 'invalid_id');
            const type = text(p.type, 100);
            check(cms.programTypes.has(type), 'unknown_program_type');
            const contentId = text(p.contentId, 100);
            check(s.content.some(c => c.id === contentId && c.collection === 'programs'), 'content_required');
            const format = p.format as 'online' | 'onsite' | 'hybrid';
            check(['online', 'onsite', 'hybrid'].includes(format), 'invalid_format');
            const tutorIds = p.tutorIds as string[];
            check(Array.isArray(tutorIds) && tutorIds.every(t => s.tutors.some(x => x.id === t)), 'invalid_tutor');
            const value = { id, contentId, type, subject: text(p.subject, 100), duration: label(p.duration), format, tutorIds };
            s.programs = s.programs.filter(x => x.id !== id);
            s.programs.push(value);
            result = id;
            break;
        }
        case 'cohort.save': {
            staff(ctx);
            const id = text(p.id, 100);
            check(s.programs.some(x => x.id === p.programId) && s.branches.some(x => x.id === p.branchId), 'invalid_relation');
            const capacity = integer(p.capacity, 1, 500);
            check(capacity >= s.enrollments.filter(e => e.cohortId === id && reservedStatuses.has(e.status)).length, 'capacity_below_reserved', 409);
            const value: Cohort = { id, programId: text(p.programId), branchId: text(p.branchId), name: text(p.name), capacity, opensAt: date(p.opensAt), closesAt: date(p.closesAt), startsAt: date(p.startsAt), endsAt: date(p.endsAt), tuitionIdr: integer(p.tuitionIdr), registrationIdr: integer(p.registrationIdr), requiresApproval: p.requiresApproval !== false, requiresPayment: p.requiresPayment !== false };
            check(value.opensAt < value.closesAt && value.startsAt < value.endsAt && value.closesAt <= value.endsAt, 'invalid_dates');
            integer(value.tuitionIdr + value.registrationIdr);
            const old = s.cohorts.find(x => x.id === id);
            if (old && s.enrollments.some(x => x.cohortId === id))
                check(old.programId === value.programId && old.branchId === value.branchId, 'cohort_in_use', 409);
            s.cohorts = s.cohorts.filter(x => x.id !== id);
            s.cohorts.push(value);
            result = id;
            break;
        }
        case 'session.save': {
            staff(ctx);
            const id = text(p.id, 100);
            check(s.cohorts.some(x => x.id === p.cohortId) && s.tutors.some(x => x.id === p.tutorId), 'invalid_relation');
            const value: ClassSession = { id, cohortId: text(p.cohortId), tutorId: text(p.tutorId), title: label(p.title), startsAt: date(p.startsAt), endsAt: date(p.endsAt), location: text(p.location) };
            check(value.startsAt < value.endsAt, 'invalid_dates');
            check(!s.sessions.some(x => x.id !== id && (x.tutorId === value.tutorId || x.cohortId === value.cohortId) && x.startsAt < value.endsAt && x.endsAt > value.startsAt), 'schedule_conflict', 409);
            const old = s.sessions.find(x => x.id === id);
            if (old && s.attendance.some(x => x.sessionId === id))
                check(old.cohortId === value.cohortId, 'session_in_use', 409);
            s.sessions = s.sessions.filter(x => x.id !== id);
            s.sessions.push(value);
            result = id;
            break;
        }
        case 'attendance.save': {
            need(ctx.level, 'attendance');
            const session = s.sessions.find(x => x.id === p.sessionId);
            check(session, 'not_found', 404);
            academic(s, ctx, session.cohortId);
            if (ctx.actor.role === 'tutor')
                check(session.tutorId === ctx.actor.tutorId, 'forbidden', 403);
            const studentId = text(p.studentId);
            check(enrolled(s, studentId, session.cohortId), 'not_enrolled', 403);
            check(['present', 'absent', 'excused'].includes(String(p.status)), 'invalid_status');
            const id = `${session.id}:${studentId}`;
            s.attendance = s.attendance.filter(x => x.id !== id);
            s.attendance.push({ id, sessionId: session.id, studentId, status: p.status as 'present' | 'absent' | 'excused', by: ctx.actor.id, at: ctx.now });
            result = id;
            break;
        }
        case 'progress.save': {
            need(ctx.level, 'progress');
            const cohortId = text(p.cohortId), studentId = text(p.studentId);
            academic(s, ctx, cohortId);
            check(enrolled(s, studentId, cohortId), 'not_enrolled', 403);
            const id = `progress-${ctx.id}`;
            s.progress.push({ id, cohortId, studentId, topic: text(p.topic), note: text(p.note, 2000), percent: integer(p.percent, 0, 100), by: ctx.actor.id, at: ctx.now });
            result = id;
            break;
        }
        case 'material.save': {
            need(ctx.level, 'materials');
            const cohortId = text(p.cohortId);
            academic(s, ctx, cohortId);
            check(s.cohorts.some(x => x.id === cohortId), 'not_found', 404);
            const assetId = text(p.assetId);
            check(s.media.some(x => x.id === assetId && !x.public), 'private_asset_required');
            const id = text(p.id);
            const old = s.materials.find(x => x.id === id);
            if (old)
                academic(s, ctx, old.cohortId);
            const value: LearningMaterial = { id, cohortId, title: label(p.title), description: label(p.description), assetId };
            s.materials = s.materials.filter(x => x.id !== id);
            s.materials.push(value);
            result = id;
            break;
        }
        case 'media.add': {
            check(canEdit(ctx.actor.role) || ctx.actor.role === 'tutor', 'forbidden', 403);
            const media = p.media as MediaAsset;
            check(media && typeof media.id === 'string', 'invalid_media');
            check(!s.media.some(x => x.id === media.id), 'duplicate_media');
            if (ctx.actor.role === 'tutor')
                check(!media.public, 'forbidden', 403);
            s.media.push(media);
            result = media.id;
            break;
        }
        case 'student.create': {
            need(ctx.level, 'records');
            check(ctx.actor.role === 'guardian' || isStaff(ctx.actor.role), 'forbidden', 403);
            const id = `student-${ctx.id}`;
            s.students.push({ id, name: ctx.demo ? 'New learner · Fictional demo' : text(p.name, 100), email: ctx.demo ? 'demo@example.test' : String(p.email ?? '').slice(0, 200) });
            if (ctx.actor.role === 'guardian')
                s.users.find(x => x.id === ctx.actor!.id)!.studentIds.push(id);
            result = id;
            break;
        }
        case 'guardian.link': {
            need(ctx.level, 'records');
            staff(ctx);
            const user = s.users.find(x => x.id === p.userId && x.role === 'guardian');
            check(user && s.students.some(x => x.id === p.studentId), 'invalid_relation');
            const id = text(p.studentId);
            user.studentIds = [...new Set([...user.studentIds, id])];
            result = user.id;
            break;
        }
        case 'settings.save': {
            admin(ctx);
            s.institution.name = text(p.name, 100);
            s.institution.address = String(p.address ?? '').slice(0, 500);
            s.institution.email = String(p.email ?? '').slice(0, 200);
            const whatsapp = String(p.whatsapp ?? '');
            check(!whatsapp || /^62\d{8,13}$/.test(whatsapp), 'invalid_phone');
            s.institution.whatsapp = whatsapp;
            if (p.navigation) {
                check(Array.isArray(p.navigation) && p.navigation.length <= 8, 'invalid_navigation');
                s.institution.navigation = p.navigation.map((v: unknown) => { const r = v as {
                    page: string;
                    label: unknown;
                }; check(['home', 'programs', 'teachers', 'schedule', 'about', 'announcements'].includes(r.page) || s.content.some(c => c.collection === 'pages' && c.id === r.page && c.published), 'invalid_page'); return { page: r.page, label: label(r.label) }; });
            }
            result = 'settings';
            break;
        }
        case 'fields.save': {
            admin(ctx);
            const fields = p.fields as Field[];
            validateFieldDefinitions(fields);
            s.registrationFields = fields;
            result = 'fields';
            break;
        }
        case 'module.toggle': {
            admin(ctx);
            const id = text(p.id);
            const mod = cms.modules.get(id);
            check(mod, 'module_not_installed');
            if (mod.minimum === 'full')
                need(ctx.level, 'portal');
            else if (mod.minimum === 'enrollment')
                need(ctx.level, 'enrollment');
            s.modules[id] = p.enabled === true;
            result = id;
            break;
        }
        case 'branch.save': {
            admin(ctx);
            check(s.modules['additional-branches'], 'module_disabled', 403);
            const id = text(p.id);
            s.branches = s.branches.filter(x => x.id !== id);
            s.branches.push({ id, name: text(p.name), address: text(p.address, 500) });
            result = id;
            break;
        }
        default: {
            const mod = cms.modules.get(cmd.action);
            check(mod?.command && s.modules[mod.id], 'unknown_action');
            if (mod.minimum === 'full')
                need(ctx.level, 'portal');
            else if (mod.minimum === 'enrollment')
                need(ctx.level, 'enrollment');
            result = mod.command(s, ctx, p);
        }
    }
    s.idempotency[key] = { fingerprint, result };
    return result;
}
export function snapshot(s: SchoolState, ctx: Context, preset: Preset): Snapshot {
    const role = ctx.actor?.role, staffAccess = isStaff(role), editor = canEdit(role), full = has(ctx.level, 'portal'), records = has(ctx.level, 'enrollment');
    const authorized = (studentId: string, cohortId: string) => staffAccess || owns(ctx, studentId) || (full && mayTeach(s, ctx, cohortId));
    const enrollments = records ? s.enrollments.filter(e => authorized(e.studentId, e.cohortId)).map(e => role === 'tutor' ? { ...e, answers: {} } : e) : [];
    const ids = new Set(enrollments.map(e => e.id));
    const studentIds = new Set([...ctx.actor?.studentIds ?? [], ...enrollments.map(e => e.studentId)]);
    const accessibleCohort = (c: string) => staffAccess || mayTeach(s, ctx, c) || s.enrollments.some(e => owns(ctx, e.studentId) && e.cohortId === c && ['active', 'completed'].includes(e.status));
    const content = s.content.filter(c => editor || c.published).map(c => editor ? c : { ...c, draft: c.published!, revisions: [] });
    const programIds = new Set(content.filter(c => c.collection === 'programs').map(c => c.id));
    const visiblePrograms = s.programs.filter(p => editor || programIds.has(p.contentId));
    const cohortIds = new Set(s.cohorts.filter(c => visiblePrograms.some(p => p.id === c.programId)).map(c => c.id));
    const { passwordHash: _, ...actor } = ctx.actor ?? {} as NonNullable<Context['actor']>;
    return { paymentProvider: 'manual', demo: ctx.demo, level: ctx.level, preset, actor: ctx.actor ? actor : null, institution: s.institution, capabilities: capabilities(ctx.level), branches: s.branches, programs: visiblePrograms, courses: s.courses.filter(c => visiblePrograms.some(p => p.id === c.programId)), cohorts: s.cohorts.filter(c => editor || cohortIds.has(c.id)), availability: Object.fromEntries(s.cohorts.filter(c => cohortIds.has(c.id)).map(c => [c.id, freeSeats(s, c.id)])), sessions: s.sessions.filter(c => cohortIds.has(c.cohortId) && (role !== 'tutor' || c.tutorId === ctx.actor?.tutorId)), tutors: s.tutors, students: records ? s.students.filter(x => staffAccess || studentIds.has(x.id)).map(x => role === 'tutor' ? { ...x, email: '' } : x) : [], users: (role === 'admin' || staffAccess && records) ? s.users.map(({ passwordHash, ...u }) => u) : [], enrollments, events: s.events.filter(e => ids.has(e.enrollmentId)), invoices: full && role !== 'tutor' ? s.invoices.filter(x => staffAccess || owns(ctx, x.studentId)) : [], payments: full && role !== 'tutor' ? s.payments.filter(x => s.invoices.some(i => i.id === x.invoiceId && (staffAccess || owns(ctx, i.studentId)))) : [], attendance: full ? s.attendance.filter(x => staffAccess || owns(ctx, x.studentId) || s.sessions.some(c => c.id === x.sessionId && c.tutorId === ctx.actor?.tutorId)) : [], progress: full ? s.progress.filter(x => authorized(x.studentId, x.cohortId)) : [], materials: full ? s.materials.filter(x => accessibleCohort(x.cohortId)).map(({ sampleText, ...m }) => m) : [], media: editor ? s.media : [], content, modules: s.modules, registrationFields: s.registrationFields, outbox: staffAccess ? s.outbox.map(x => ({ ...x })) : [] };
}
export function canDownload(s: SchoolState, ctx: Context, materialId: string) { need(ctx.level, 'materials'); const m = s.materials.find(x => x.id === materialId); check(m, 'not_found', 404); check(isStaff(ctx.actor?.role) || mayTeach(s, ctx, m.cohortId) || s.enrollments.some(e => owns(ctx, e.studentId) && e.cohortId === m.cohortId && ['active', 'completed'].includes(e.status)), 'forbidden', 403); return m; }
