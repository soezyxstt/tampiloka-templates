from pathlib import Path
root=Path('.')
def edit(file, old, new, count=1):
 p=root/file
 s=p.read_text()
 assert s.count(old)==count, (file,old[:80],s.count(old))
 p.write_text(s.replace(old,new))
base='templates/school/src/'
edit(base+'ui.tsx',"export function SectionTitle({ title, children }: {\n    title: string;\n    children?: ReactNode;\n}) { return <div className=\"section-title\"><h2>{title}</h2>{children}</div>; }", "export function SectionTitle({ title, children, as: Heading = 'h2' }: {\n    title: string;\n    children?: ReactNode;\n    as?: 'h1' | 'h2';\n}) { return <div className=\"section-title\"><Heading>{title}</Heading>{children}</div>; }")
edit(base+'ui.tsx','<Select.Trigger className=', '<Select.Trigger type="button" className=')
for title in ["t('Kelas & angkatan', 'Classes & intakes')", "t('Jadwal pertemuan', 'Class sessions')", "t('Program & kurikulum', 'Programs & curriculum')", "t('Profil pengajar', 'Teacher profiles')", "t('Akun & akses', 'Accounts & access')", "t('Siswa & wali', 'Learners & guardians')"]:
 edit(base+'staff.tsx','<SectionTitle title={'+title+'}', '<SectionTitle as="h1" title={'+title+'}')
edit(base+'staff.tsx','{row.map(e => <tr key={e.id}>', '{row.map(e => <tr key={e.id} data-enrollment-id={e.id}>')
edit(base+'public.tsx',"function Announcements() { const { s, lang } = useApp();", "function Announcements() { const { s, lang, params } = useApp();")
edit(base+'public.tsx',"<SectionTitle title={t('Kabar & informasi', 'News & notices')}/>", "<SectionTitle as={params.get('page') === 'announcements' ? 'h1' : 'h2'} title={t('Kabar & informasi', 'News & notices')}/>")
edit(base+'public.tsx',"const d = p ? s.content.find(c => c.id === p.contentId)?.published : null;", "const record = p ? s.content.find(c => c.id === p.contentId) : null; const d = params.get('preview') === 'true' ? record?.draft : record?.published;")
edit(base+'public.tsx',"}) { const { s, lang, mutate, request, setMessage } = useApp(); const t = useText(); const c = s.cohorts.find(c => c.id === e.cohortId)!;", "}) { const { s, lang, mutate, request, setMessage } = useApp(); const t = useText(); const [cancelOpen, setCancelOpen] = useState(false); const c = s.cohorts.find(c => c.id === e.cohortId)!;")
edit(base+'public.tsx','<article className="enrollment-card">','<article className="enrollment-card" data-enrollment-id={e.id}>')
edit(base+'public.tsx',"<AsyncButton variant=\"ghost\" action={() => mutate('application.cancel', { id: e.id })}>{t('Batalkan pengajuan', 'Cancel application')}</AsyncButton>", "<Button variant=\"ghost\" onClick={() => setCancelOpen(true)}>{t('Batalkan pengajuan', 'Cancel application')}</Button>")
edit(base+'public.tsx',"</div></article>; }\nexport function AccountControls", """</div><Dialog open={cancelOpen} onOpenChange={setCancelOpen} title={t('Batalkan pengajuan?', 'Cancel this application?')} description={t('Kursi Anda akan dilepas. Pembayaran yang telah diterima memerlukan tinjauan staf; pembatalan tidak mengirim pengembalian dana otomatis.', 'Your seat will be released. Staff must review any payment already received; cancellation does not send an automatic refund.')} closeLabel={t('Tutup', 'Close')}><div className="button-row"><Button variant="outline" onClick={() => setCancelOpen(false)}>{t('Tetap lanjutkan', 'Keep application')}</Button><AsyncButton variant="danger" action={async () => { await mutate('application.cancel', { id: e.id }); setCancelOpen(false); }}>{t('Konfirmasi pembatalan', 'Confirm cancellation')}</AsyncButton></div></Dialog></article>; }
export function AccountControls""")
edit(base+'main.tsx',"data-layout={params.get('layout')}", "data-layout={params.get('layout')} data-role={s.actor?.role ?? 'visitor'} data-level={s.level}")
b='templates/school/tests/browser.mjs'
edit(b,"    await page.locator('#main-content').waitFor();", """    await page.locator('#main-content').waitFor();
    const params = new URL(page.url()).searchParams;
    const view = params.get('view') || 'visitor';
    const role = params.get('preview') === 'true' ? 'admin' : view === 'staff' ? params.get('role') || 'admin' : view;
    await page.locator(`.school[data-role="${role}"]`).waitFor();""")
edit(b,"    return r.json();", "    const value = await r.json();\n    assert.equal(value.demo, true, 'Never run mutating browser fixtures against production');\n    return value;")
edit(b,"        await page.locator('.tl-demo-views').getByRole('link', { name: 'Student', exact: true }).click();\n        await ready(page);\n        await navigate(page, { page: 'apply' });", """        await current(page, 'visitor');
        await page.getByRole('link', { name: 'Apply to join', exact: true }).first().click();
        await ready(page);
        const intake = page.getByRole('combobox', { name: 'Class & intake', exact: true });
        await intake.scrollIntoViewIfNeeded(); await intake.focus(); await page.keyboard.press('Enter');
        await page.getByRole('listbox').waitFor(); await page.keyboard.press('Escape');
        assert.equal(await intake.evaluate(el => el === document.activeElement), true);
        await intake.click(); await page.getByRole('listbox').waitFor(); await page.keyboard.press('Escape');""")
edit(b,"        await page.getByRole('link', { name: 'Continue application', exact: true }).click();\n        await fillRegistration(page, s);", """        const savedDraft = (await current(page)).enrollments.find(e => e.status === 'draft');
        assert.ok(savedDraft, 'Draft is persisted');
        await page.getByRole('link', { name: 'Continue application', exact: true }).click(); await ready(page);
        for (const f of s.registrationFields.filter(f => f.required)) {
            if (f.type === 'select') assert.equal((await page.getByRole('combobox', { name: f.label.en + ' *', exact: true }).innerText()).trim(), savedDraft.answers[f.name]);
            else if (f.type !== 'checkbox') assert.equal(await page.getByLabel(f.label.en + ' *', { exact: true }).inputValue(), savedDraft.answers[f.name]);
        }
        await fillRegistration(page, s);""")
edit(b,"        const id = snap.enrollments.find(e => e.studentId === 'student-sinta').id;", """        const id = snap.enrollments.find(e => e.studentId === 'student-sinta').id;
        assert.equal(id, savedDraft.id, 'Submitting keeps the draft identity');
        assert.equal(snap.enrollments.some(e => e.id === 'application-sample'), false, 'Other students remain private');""")
edit(b,"        const row = page.getByRole('row').filter({ hasText: 'Sinta' });", """        const row = page.locator(`tr[data-enrollment-id="${id}"]`);""")
for status in ['submitted','awaiting_payment','active']:
 edit(b,f"page.locator('.enrollment-card .status-{status}')",f"page.locator('.enrollment-card .section-title > .status-{status}')")
edit(b,"        await capture(page, { path: `${out}/${preset}-portal-mobile.png`, fullPage: true });", """        const downloaded = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download', exact: true }).first().click();
        assert.equal(await (await downloaded).failure(), null, 'Authorized material download succeeds');
        await page.reload(); await ready(page);
        assert.equal((await current(page)).enrollments.find(e => e.id === id).status, 'active');
        await capture(page, { path: `${out}/${preset}-portal-mobile.png`, fullPage: true });""")
edit(b,"        await page.getByRole('button', { name: 'Cancel application', exact: true }).click();\n        await page.locator('.status-cancelled').first().waitFor();", """        await page.getByRole('button', { name: 'Cancel application', exact: true }).click();
        await page.getByRole('dialog').waitFor();
        assert.equal((await current(page)).enrollments.find(e => e.id === id).status, 'active', 'Opening confirmation must not cancel');
        await page.getByRole('button', { name: 'Keep application', exact: true }).click();
        await page.getByRole('button', { name: 'Cancel application', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
        await page.locator('.enrollment-card .section-title > .status-cancelled').first().waitFor();
        await page.reload(); await ready(page);
        assert.equal(await page.getByRole('button', { name: 'Download', exact: true }).count(), 0, 'Cancelled students lose resource access');""")
edit(b,"        await overflow(page, `staff-${tab}`);", "        await overflow(page, `staff-${tab}`);\n        assert.equal(await page.locator('h1').count(), 1, `${tab} needs one page heading`);")
edit(b,"        const page = await ctx.newPage(); track(page);\n        await page.goto(`${base}/?preset=${preset}", "        await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true });\n        const page = await ctx.newPage(); track(page);\n        await page.goto(`${base}/?preset=${preset}")
edit(b,"        results.push({ preset, flow: 'apply-draft-review-accept-pay-guardian-cancel', passed: true });\n        await ctx.close();", "        results.push({ preset, flow: 'apply-draft-review-accept-pay-guardian-cancel', passed: true });\n        console.log(`PASS enrollment journey: ${preset}`); await ctx.tracing.stop();\n        await ctx.close();")
edit(b,"        await lastPage.screenshot({ path:","        await lastPage.context().tracing.stop({ path: `${out}/failure-trace.zip` }).catch(() => {});\n        await lastPage.screenshot({ path:")
print('School fixes applied without replacing current browser coverage')
