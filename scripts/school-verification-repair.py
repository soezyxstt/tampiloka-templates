from pathlib import Path
root = Path('.')
def edit(file, old, new, count=1):
    p = root / file
    s = p.read_text()
    assert s.count(old) == count, (file, old[:80], s.count(old))
    p.write_text(s.replace(old, new))
base = 'templates/school/src/'
edit(base+'ui.tsx', "export function SectionTitle({ title, children }: {\n    title: string;\n    children?: ReactNode;\n}) { return <div className=\"section-title\"><h2>{title}</h2>{children}</div>; }", "export function SectionTitle({ title, children, as: Heading = 'h2' }: {\n    title: string;\n    children?: ReactNode;\n    as?: 'h1' | 'h2';\n}) { return <div className=\"section-title\"><Heading>{title}</Heading>{children}</div>; }")
edit(base+'ui.tsx', '<Select.Trigger className=', '<Select.Trigger type="button" className=')
for title in ["t('Kelas & angkatan', 'Classes & intakes')", "t('Jadwal pertemuan', 'Class sessions')", "t('Program & kurikulum', 'Programs & curriculum')", "t('Profil pengajar', 'Teacher profiles')", "t('Akun & akses', 'Accounts & access')", "t('Siswa & wali', 'Learners & guardians')"]:
    edit(base+'staff.tsx', '<SectionTitle title={'+title+'}', '<SectionTitle as="h1" title={'+title+'}')
edit(base+'staff.tsx', '{row.map(e => <tr key={e.id}>', '{row.map(e => <tr key={e.id} data-enrollment-id={e.id}>')
edit(base+'public.tsx', "function Announcements() { const { s, lang } = useApp();", "function Announcements() { const { s, lang, params } = useApp();")
edit(base+'public.tsx', "<SectionTitle title={t('Kabar & informasi', 'News & notices')}/>", "<SectionTitle as={params.get('page') === 'announcements' ? 'h1' : 'h2'} title={t('Kabar & informasi', 'News & notices')}/>")
edit(base+'public.tsx', "const d = p ? s.content.find(c => c.id === p.contentId)?.published : null;", "const record = p ? s.content.find(c => c.id === p.contentId) : null; const d = params.get('preview') === 'true' ? record?.draft : record?.published;")
edit(base+'public.tsx', "}) { const { s, lang, mutate, request, setMessage } = useApp(); const t = useText(); const c = s.cohorts.find(c => c.id === e.cohortId)!;", "}) { const { s, lang, mutate, request, setMessage } = useApp(); const t = useText(); const [cancelOpen, setCancelOpen] = useState(false); const c = s.cohorts.find(c => c.id === e.cohortId)!;")
edit(base+'public.tsx', '<article className="enrollment-card">', '<article className="enrollment-card" data-enrollment-id={e.id}>')
edit(base+'public.tsx', "<AsyncButton variant=\"ghost\" action={() => mutate('application.cancel', { id: e.id })}>{t('Batalkan pengajuan', 'Cancel application')}</AsyncButton>", "<Button variant=\"ghost\" onClick={() => setCancelOpen(true)}>{t('Batalkan pengajuan', 'Cancel application')}</Button>")
edit(base+'public.tsx', "</div></article>; }\nexport function AccountControls", """</div><Dialog open={cancelOpen} onOpenChange={setCancelOpen} title={t('Batalkan pengajuan?', 'Cancel this application?')} description={t('Kursi Anda akan dilepas. Pembayaran yang telah diterima memerlukan tinjauan staf; pembatalan tidak mengirim pengembalian dana otomatis.', 'Your seat will be released. Staff must review any payment already received; cancellation does not send an automatic refund.')} closeLabel={t('Tutup', 'Close')}><div className="button-row"><Button variant="outline" onClick={() => setCancelOpen(false)}>{t('Tetap lanjutkan', 'Keep application')}</Button><AsyncButton variant="danger" action={async () => { await mutate('application.cancel', { id: e.id }); setCancelOpen(false); }}>{t('Konfirmasi pembatalan', 'Confirm cancellation')}</AsyncButton></div></Dialog></article>; }
export function AccountControls""")
edit(base+'main.tsx', "data-layout={params.get('layout')}", "data-layout={params.get('layout')} data-role={s.actor?.role ?? 'visitor'} data-level={s.level}")
b = 'templates/school/tests/browser.mjs'
edit(b, "async function ready(page) { await page.locator('.school').waitFor(); await page.locator('#main-content').waitFor(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300); }", """async function ready(page) {
  const p = new URL(page.url()).searchParams;
  const view = p.get('view') || 'visitor';
  const role = p.get('preview') === 'true' ? 'admin' : view === 'staff' ? p.get('role') || 'admin' : view;
  await page.locator(`.school[data-role="${role}"][data-level="${p.get('level') || 'full'}"]`).waitFor();
  await page.locator('#main-content').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}""")
edit(b, "async function waitStatus(page, value) { await page.locator(`.status-${value}`).first().waitFor(); }", """async function snapshot(page, role) {
  const url = new URL('/api/bootstrap', base); const current = new URL(page.url());
  for (const key of ['preset', 'level']) url.searchParams.set(key, current.searchParams.get(key));
  const response = await page.request.get(url.href, { headers: { 'X-Demo-Role': role } });
  assert.equal(response.status(), 200); const body = await response.json();
  assert.equal(body.demo, true, 'browser fixtures must never mutate production data');
  return body;
}
async function command(page, action, click) {
  const response = page.waitForResponse(r => r.url().includes('/api/command') && r.request().postDataJSON()?.action === action);
  await click(); const r = await response; const body = await r.json();
  assert.equal(r.status(), 200, JSON.stringify(body)); return body;
}
async function waitStatus(page, value, id) {
  const card = page.locator(`.enrollment-card[data-enrollment-id="${id}"]`);
  await card.locator(`.section-title > .status-${value}`).waitFor();
  const state = await snapshot(page, new URL(page.url()).searchParams.get('view') || 'student');
  assert.equal(state.enrollments.find(e => e.id === id)?.status, value, 'server and visible status must agree');
}
async function selectField(page, name, option) {
  const trigger = page.getByRole('combobox', { name, exact: true });
  await trigger.scrollIntoViewIfNeeded(); await trigger.focus(); await page.keyboard.press('Enter');
  await page.getByRole('listbox').waitFor();
  const item = option ? page.getByRole('option', { name: option, exact: true }) : page.getByRole('option').first();
  const label = await item.innerText(); await item.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  assert.ok((await trigger.innerText()).includes(label.trim()), 'selected intake is retained');
}""")
p = root / b
s = p.read_text()
start = s.index('  for (const preset of presets) {')
end = s.index('  const context = await browser.newContext({ viewport: { width: 1024', start)
s = s[:start] + '''  for (const preset of presets) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage(); lastPage = page; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${base}/?preset=${preset}&level=full&layout=academic-editorial&theme=cobalt&lang=en&view=visitor`); await ready(page);
    await snapshot(page, 'visitor');
    await page.getByRole('link', { name: 'Apply to join', exact: true }).first().click(); await ready(page);
    await page.getByRole('heading', { name: 'Start your application', exact: true }).waitFor();
    await selectField(page, 'Class & intake');
    const form = page.locator('form.form-stack');
    if (preset === 'exam-prep') await selectField(page, 'Target exam *', 'UTBK');
    if (preset === 'language') await selectField(page, 'Current level *', 'Pemula / Beginner');
    if (preset === 'skills') await form.getByRole('textbox', { name: 'Your goal *' }).fill('Practice a useful professional skill.');
    if (preset === 'institution') await selectField(page, 'Entry year *', 'Kelas 10');
    await form.locator('input[type=checkbox]').check();
    let draftId;
    if (preset === 'exam-prep') {
      const saved = await command(page, 'application.save', () => page.getByRole('button', { name: 'Save draft', exact: true }).click());
      draftId = saved.result; await waitStatus(page, 'draft', draftId);
      await page.getByRole('link', { name: 'Continue application', exact: true }).click(); await ready(page);
      assert.equal((await page.getByRole('combobox', { name: 'Target exam *' }).innerText()).trim(), 'UTBK');
      await form.locator('input[type=checkbox]').check();
    }
    await capture(page, { path: join(out, `${preset}-application-mobile.png`), fullPage: true });
    const submitted = await command(page, 'application.submit', () => page.getByRole('button', { name: 'Submit application', exact: true }).click());
    const id = submitted.result; assert.equal(typeof id, 'string');
    if (draftId) assert.equal(id, draftId, 'submitting a draft updates the original record');
    await waitStatus(page, 'submitted', id);
    assert.equal((await snapshot(page, 'student')).enrollments.some(e => e.id === 'application-sample'), false, 'students cannot see another learner');
    await clickNav(page, 'Staff'); await page.locator('.workspace-nav').getByRole('link', { name: 'Applications', exact: true }).click(); await ready(page);
    await page.locator(`tr[data-enrollment-id="${id}"]`).getByRole('button', { name: 'Review', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const accepted = await command(page, 'application.review', () => dialog.getByRole('button', { name: 'Accept', exact: true }).click());
    assert.equal(accepted.snapshot.enrollments.find(e => e.id === id)?.status, 'awaiting_payment');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await clickNav(page, 'Student'); await waitStatus(page, 'awaiting_payment', id);
    const paid = await command(page, 'payment.simulate', () => page.getByRole('button', { name: 'Simulate payment', exact: true }).click());
    assert.equal(paid.snapshot.invoices.find(i => i.enrollmentId === id)?.status, 'paid');
    await waitStatus(page, 'active', id);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download', exact: true }).first().click();
    const download = await downloadEvent; assert.equal(await download.failure(), null);
    await page.reload(); await ready(page); await waitStatus(page, 'active', id);
    await check(page); await capture(page, { path: join(out, `${preset}-student-mobile.png`), fullPage: true });
    const before = new URL(page.url()); before.searchParams.set('view', 'guardian'); await page.goto(before.href); await ready(page); await waitStatus(page, 'active', id);
    assert.equal((await snapshot(page, 'guardian')).enrollments.some(e => e.id === 'application-sample'), false);
    await page.getByRole('button', { name: 'Appearance & demo options', exact: true }).click();
    await page.getByRole('button', { name: 'Try as tutor', exact: true }).click(); await ready(page);
    await page.getByRole('heading', { name: 'Classes, attendance & resources', exact: true }).waitFor();
    assert.equal(await page.locator('.workspace-nav').getByRole('link', { name: 'Payments', exact: true }).count(), 0);
    const changeLevel = new URL(page.url()); changeLevel.searchParams.set('level', 'enrollment'); changeLevel.searchParams.set('view', 'student'); changeLevel.searchParams.set('page', 'portal');
    await page.goto(changeLevel.href); await ready(page); await waitStatus(page, 'active', id);
    assert.equal(await page.getByRole('button', { name: 'Simulate payment', exact: true }).count(), 0);
    assert.equal((await snapshot(page, 'student')).invoices.length, 0);
    changeLevel.searchParams.set('level', 'full'); await page.goto(changeLevel.href); await ready(page); await waitStatus(page, 'active', id);
    await page.getByRole('button', { name: 'Cancel application', exact: true }).click();
    assert.equal((await snapshot(page, 'student')).enrollments.find(e => e.id === id)?.status, 'active', 'opening confirmation never cancels');
    await page.getByRole('button', { name: 'Keep application', exact: true }).click(); await waitStatus(page, 'active', id);
    await page.getByRole('button', { name: 'Cancel application', exact: true }).click();
    await command(page, 'application.cancel', () => page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click());
    await waitStatus(page, 'cancelled', id); await page.reload(); await ready(page); await waitStatus(page, 'cancelled', id);
    assert.equal(await page.getByRole('button', { name: 'Download', exact: true }).count(), 0, 'cancelled students lose private resources');
    results.push({ name: `enrollment staff payment guardian tutor cancellation ${preset}`, ok: true });
    console.log(`PASS enrollment journey: ${preset}`); await context.tracing.stop(); await context.close();
  }
''' + s[end:]
p.write_text(s)
edit(b, "name: 'Ask on WhatsApp'", "name: 'Ask about a class'")
edit(b, "['Overview', 'Programs', 'Intakes', 'Schedule', 'Learner records', 'Tuition', 'Learning', 'Accounts & access', 'Settings']", "['Overview', 'Programs', 'Teachers', 'Intakes', 'Schedule', 'Learners & guardians', 'Payments', 'Attendance & resources', 'Accounts & access', 'Settings']")
edit(b, "if(lastPage && !lastPage.isClosed()) {await lastPage.screenshot", "if(lastPage && !lastPage.isClosed()) {await lastPage.context().tracing.stop({path:join(out,'failure-trace.zip')}).catch(()=>{});await lastPage.screenshot")
edit(b, "await ready(p); await check(p); }", "await ready(p); await check(p); await capture(p, { path: join(out, `staff-${name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}-1024.png`), fullPage: true }); }")
edit(b, "results.push({ name: `visual ${layout} ${width} ${reduced}`, ok: true, chrome });", "results.push({ name: `visual ${layout} ${width} ${reduced}`, ok: true, chrome }); console.log(`PASS visual: ${layout} ${width} ${reduced}`);")
print('Applied guarded school UI and browser fixes')
