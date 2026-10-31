import assert from 'node:assert/strict';
import { join } from 'node:path';

export async function latencyChecks({ browser, out, check, boot }) {
  await check('Role change hides stale owner controls while the real staff snapshot is delayed', async () => {
    const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let received;
    const delayed = new Promise(resolve => { received = resolve; });
    let held = false;
    try {
      await boot(page, { preset: 'medical', level: 'full', view: 'staff', page: 'settings' });
      const name = page.getByLabel('Business name', { exact: true });
      await name.waitFor();
      assert.equal(await name.isEnabled(), true);
      await page.route('**/api/staff/snapshot', async route => {
        const response = await route.fetch();
        const data = await response.json();
        if (!held && data.role === 'viewer') {
          held = true;
          received();
          await gate;
        }
        await route.fulfill({ response });
      });
      await page.getByRole('button', { name: 'Customize demo' }).click();
      await page.getByRole('combobox', { name: 'Demo staff role', exact: true }).click();
      await page.getByRole('option', { name: 'Viewer', exact: true }).click();
      await page.getByRole('listbox').waitFor({ state: 'detached' });
      await page.keyboard.press('Escape');
      let timeout;
      try { await Promise.race([delayed, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Viewer snapshot did not reach the response gate')), 25000); })]); }
      finally { clearTimeout(timeout); }
      assert.equal(await name.count(), 0, 'Do not render the old owner form during role refresh');
      assert.equal(await page.getByRole('button', { name: 'Save settings', exact: true }).count(), 0);
      await page.locator('.b-staff-content .b-loading').waitFor();
      release();
      await name.waitFor();
      await page.waitForFunction(el => el.matches(':disabled'), await name.elementHandle());
      assert.equal(await name.isDisabled(), true);
      await page.screenshot({ path: join(out, 'viewer-role-390.png'), fullPage: true });
    } finally {
      release();
      await context.close();
    }
  });
}
