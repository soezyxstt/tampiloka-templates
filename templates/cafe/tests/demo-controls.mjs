/** Shared browser helpers for the production-like showcase shell. */
export async function chooseDemoStaff(page, id = 'staff_owner') {
  const staff = await page.evaluate(async () => {
    const response = await fetch('/api/v1/snapshot?surface=staff');
    const body = await response.json();
    if (!response.ok || !body.data?.runtime?.localOnly) throw new Error('Expected local Cafe demo');
    return body.data.staffRoles || body.data.staffAccounts || [];
  });
  const person = staff.find(entry => entry.id === id);
  if (!person) throw new Error(`Missing demo identity: ${id}`);
  const picker = page.getByRole('combobox', { name: /^(Identitas staf demo|Demo staff identity)$/ });
  await picker.click();
  await page.getByRole('option').filter({ hasText: person.userName }).click();
  // These existing journeys exercise cashier tasks explicitly; owner landing is reports.
  const cashier = page.getByRole('navigation', { name: /^Navigasi operasional (kafe|desktop)$/ }).getByRole('button', { name: /^Kasir & Pesanan|^Pesanan masuk/ });
  if (await cashier.count()) await cashier.click();
}

export async function enterTableMenu(page) {
  const open = page.getByRole('link', { name: /^(Buka menu meja|Open table menu)$/ });
  if (await open.count()) {
    await open.click();
    await page.locator('[data-ui="customer-header"]').waitFor({ timeout: 120000 });
  }
}

export async function openDemoOptions(page) {
  await page.getByRole('button', { name: /^(Opsi demo|Demo options)$/ }).click();
  await page.getByRole('dialog').waitFor();
}
