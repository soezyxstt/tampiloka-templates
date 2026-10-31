import assert from 'node:assert/strict';
import { join } from 'node:path';

// Real browser checks against the same Worker used by the customer suite.
export async function workspaceChecks({ browser, base, out, check, boot, geometry }) {
  for (const width of [360, 390, 1024, 1440]) {
    for (const motion of ['reduce', 'no-preference']) {
      await check(`Staff workspace ${width}px motion=${motion}`, async () => {
        const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-GB', reducedMotion: motion });
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          for (const target of ['content', 'resources', 'locations', 'settings', 'payments', 'calendar']) {
            await boot(page, { preset: 'consulting', level: 'full', view: 'staff', page: target });
            await page.locator('.b-staff-content h1').waitFor();
            if (motion === 'no-preference') await page.waitForTimeout(500);
            await geometry(page);
            if (target === 'resources') {
              await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
              const dialog = page.getByRole('dialog');
              await dialog.waitFor();
              await dialog.getByRole('heading', { name: 'Weekly working hours' }).waitFor();
              const row = dialog.locator('.b-schedule-row').first();
              await row.scrollIntoViewIfNeeded();
              assert.equal(await row.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'Schedule controls must fit the editor');
              await page.screenshot({ path: join(out, `schedule-${width}-${motion}.png`), fullPage: true });
              await page.keyboard.press('Escape');
              await dialog.waitFor({ state: 'detached' });
            }
          }
          const theme = page.getByRole('combobox', { name: 'Demo theme', exact: true });
          await theme.focus();
          await page.keyboard.press('Enter');
          await page.getByRole('listbox').waitFor();
          await page.keyboard.press('Escape');
          await page.getByRole('listbox').waitFor({ state: 'detached' });
          assert.equal(await theme.evaluate(el => document.activeElement === el), true, 'Select returns keyboard focus');
          await page.screenshot({ path: join(out, `staff-${width}-${motion}.png`), fullPage: true });
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      });
    }
  }
  await check('Demo reset removes only the current session bookings', async () => {
    const first = await browser.newContext({ locale: 'en-GB' });
    const second = await browser.newContext({ locale: 'en-GB' });
    try {
      const a = await first.newPage(), b = await second.newPage();
      await boot(a, { preset: 'medical', level: 'full' });
      await boot(b, { preset: 'medical', level: 'full' });
      const send = async (ctx, path, method = 'GET') => {
        const response = await ctx.request.fetch(new URL(path, base).href, {
          method, headers: { Origin: new URL(base).origin }, ...(method === 'POST' ? { data: {} } : {}),
        });
        assert.equal(response.ok(), true, await response.text());
        return response.json();
      };
      await send(first, '/api/demo/scenario', 'POST');
      await send(second, '/api/demo/scenario', 'POST');
      const before = await send(second, '/api/bookings');
      assert.ok(before.bookings.length > 0);
      await a.getByRole('button', { name: 'Customize demo' }).click();
      await a.getByRole('button', { name: 'Reset session', exact: true }).click();
      await a.getByRole('button', { name: 'Delete session data', exact: true }).click();
      await a.getByRole('dialog').waitFor({ state: 'detached' });
      await a.locator('.b-progress').waitFor({ state: 'detached' });
      assert.equal((await send(first, '/api/bookings')).bookings.length, 0);
      assert.deepEqual((await send(second, '/api/bookings')).bookings.map(x => x.id), before.bookings.map(x => x.id));
    } finally { await first.close(); await second.close(); }
  });
}
