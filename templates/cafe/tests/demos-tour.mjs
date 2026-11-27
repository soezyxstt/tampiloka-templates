import assert from 'node:assert/strict';
import { chooseDemoStaff } from './demo-controls.mjs';
import { chromium } from 'playwright';

const base = (process.env.CAFE_DEMO_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const executablePath = process.env.CAFE_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch({ headless: true, ...(executablePath && { executablePath }) });
const context = await browser.newContext({ locale: 'en-GB', viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const target = (page, name) => page.locator(`[data-demo-target="${name}"]`);
const guide = (page, role) => page.getByRole('region', { name: `Demo guide · ${role}` });
const heading = (guide, name) => guide.getByRole('heading', { name, exact: true }).waitFor();
const openGuide = page => page.getByRole('button', { name: 'Demo guide', exact: true }).click({ timeout: 90000 });

try {
  await page.goto(`${base}/p/full/?lang=en`);
  const customer = guide(page, 'Customer');
  await page.getByRole('button', { name: 'Start guide' }).click();
  await heading(customer, 'Start at a table');
  await page.getByRole('combobox', { name: 'Choose a table' }).click();
  await page.getByRole('option', { name: /^Table M02/ }).click();
  await page.getByRole('link', { name: 'Open table menu' }).click();
  await heading(customer, 'Choose a dish');
  await page.getByRole('button', { name: 'View Iced Palm Sugar Milk Coffee', exact: true }).click();
  const requiredGroup = page.locator('[role="dialog"] [data-demo-tour-prompt]').first();
  await requiredGroup.waitFor();
  while (await requiredGroup.count()) {
    await heading(customer, await requiredGroup.getAttribute('data-demo-tour-prompt'));
    await requiredGroup.locator('input:not(:checked):not(:disabled)').first().check();
  }
  await heading(customer, 'Add to cart');
  assert.equal(await customer.evaluate(card => card.matches(':popover-open') && getComputedStyle(card).position === 'fixed'), true);
  await target(page, 'customer-add').click();
  await heading(customer, 'Open the cart');
  await target(page, 'customer-cart').click();
  await heading(customer, 'Enter your name');
  await page.locator('#guest-name-input').fill('Tour Guest');
  await heading(customer, 'Review the order');
  await target(page, 'customer-review').click();
  await heading(customer, 'Submit the order');
  await target(page, 'customer-submit').click();
  await heading(customer, 'Open the order bill');

  const staffPage = context.waitForEvent('page');
  await customer.getByRole('link', { name: 'Open staff in a new tab' }).click();
  const staff = await staffPage;
  staff.setDefaultTimeout(25000);
  staff.on('pageerror', error => errors.push(error.message));
  await staff.setViewportSize({ width: 1024, height: 850 });
  const cashier = guide(staff, 'Cashier');
  await heading(cashier, 'Open incoming orders');
  await staff.locator('#staff-content [data-choice="orders"]').click();
  await heading(cashier, 'Accept an order');
  const customerPopup = context.waitForEvent('page');
  await cashier.getByRole('link', { name: 'Open customer in a new tab' }).click();
  const nextCustomer = await customerPopup;
  await heading(guide(nextCustomer, 'Customer'), 'Start at a table');
  assert.equal(new URL(nextCustomer.url()).searchParams.has('guide'), false);
  await nextCustomer.reload();
  await nextCustomer.getByRole('button', { name: 'Demo guide', exact: true }).waitFor();
  assert.equal(await guide(nextCustomer, 'Customer').count(), 0);
  await nextCustomer.close();
  await heading(cashier, 'Accept an order');
  const request = staff.locator('#incoming-orders [data-request-id]').filter({ hasText: 'Tour Guest' });
  await target(request, 'cashier-accept').click();
  await heading(cashier, 'Enter a counter order');
  await cashier.getByRole('button', { name: 'End guide', exact: true }).click();

  await target(page, 'customer-order-bill').click();
  await heading(customer, 'Create payment instructions');
  await target(page, 'customer-create-payment').click();
  await heading(customer, 'Open payment simulation');
  await target(page, 'demo-options').click();
  await heading(customer, 'Simulate payment');
  const billId = await page.locator('[data-customer-bill-id]').getAttribute('data-customer-bill-id');
  await page.locator(`[data-demo-target="demo-settle"][data-demo-tour-key="${billId}"]`).click();
  await heading(customer, 'Return to the bill');
  await target(page, 'demo-options-close').click();
  await heading(customer, 'Track the order');
  await target(page, 'customer-receipt').waitFor();
  await page.locator('[data-demo-screen="pesanan"]').click();
  await heading(customer, 'Wait for the order to be served');

  const customerOrder = page.locator('[data-demo-fulfillment]');
  const orderId = await customerOrder.getAttribute('data-order-id');
  const unitId = await staff.evaluate(async orderId => {
    const { data } = await (await fetch('/api/v1/snapshot?surface=staff')).json();
    return data.orderUnits.find(unit => unit.orderId === orderId)?.id;
  }, orderId);
  assert.ok(unitId);

  const fulfillmentPage = context.waitForEvent('page');
  await customer.getByRole('link', { name: 'Open staff in a new tab' }).click();
  const barPage = await fulfillmentPage;
  barPage.on('pageerror', error => errors.push(error.message));
  await barPage.setViewportSize({ width: 1024, height: 850 });
  await heading(guide(barPage, 'Cashier'), 'Open incoming orders');
  await chooseDemoStaff(barPage, 'staff_bar');
  const bar = guide(barPage, 'Bar');
  for (const [name, status] of [['Start preparing', 'PREPARING'], ['Mark ready', 'READY'], ['Hand over the item', 'DELIVERED']]) {
    await heading(bar, name);
    await barPage.locator(`[data-demo-next-status="${status}"][data-demo-tour-key="${unitId}"]`).click();
  }
  await heading(bar, 'Guide complete');
  await barPage.close();
  await heading(customer, 'Guide complete');
  await customer.getByRole('button', { name: 'Finish', exact: true }).click();
  await customer.waitFor({ state: 'hidden' });
  assert.equal(await customerOrder.getAttribute('data-demo-fulfillment'), 'complete');
  console.log('Customer checkout, cashier acceptance, simulated payment, and bar fulfillment passed.');

  await staff.goto(`${base}/p/full/staff?staff=staff_cashier&lang=en`);
  await openGuide(staff);
  await staff.locator('#staff-content [data-choice="orders"]').click();
  await heading(cashier, 'Accept an order');
  if (await target(staff, 'cashier-accept').count()) await target(staff, 'cashier-accept').first().click();
  else await cashier.getByRole('button', { name: 'Skip this step' }).click();
  await heading(cashier, 'Enter a counter order');
  await target(staff, 'cashier-new-order').click();
  await heading(cashier, 'Choose an item');
  await staff.locator('#pos-name').fill('Tour POS');
  await target(staff, 'pos-item').filter({ hasText: /Teh Melati Dingin Daun Asli|Iced Jasmine Leaf Tea/ }).click();
  for (const action of ['pos-add', 'pos-review', 'pos-submit']) await target(staff, action).click();
  await heading(cashier, 'Select cash');
  assert.equal(await staff.locator('[data-selected-bill-id] h2').textContent().then(text => text.includes('Tour POS')), true);
  await staff.locator('.cafe-tender-method [data-choice="CASH"]').click();
  await heading(cashier, 'Enter cash received');
  await target(staff, 'cashier-exact').click();
  await heading(cashier, 'Record the cash payment');
  await target(staff, 'cashier-receive-cash').click();
  await heading(cashier, 'Guide complete');
  assert.equal(await target(staff, 'cashier-receive-cash').count(), 0);
  console.log('Counter order and cash payment passed.');

  await staff.goto(`${base}/p/full/staff?staff=staff_waiter&lang=id`);
  await staff.getByRole('button', { name: 'Panduan demo', exact: true }).click();
  const waiter = staff.getByRole('region', { name: 'Panduan demo · Pelayan' });
  await heading(waiter, 'Buka panggilan pelayan');
  await staff.locator('#staff-content [data-choice="PANGGILAN"]').click();
  await heading(waiter, 'Tangani permintaan');
  const guestRequest = staff.locator('[data-service-request-id="sreq_m01_napkin"]');
  await target(guestRequest, 'waiter-acknowledge').click();
  await heading(waiter, 'Selesaikan panggilan');
  await target(guestRequest, 'waiter-resolve').click();
  await heading(waiter, 'Periksa antrean');
  await staff.locator('#staff-content [data-choice="ANTREAN"]').click();
  const party = staff.locator('[data-waitlist-id="wl_01"]');
  const table = party.locator('select');
  await table.selectOption({ index: 1 });
  await heading(waiter, 'Panggil tamu');
  await target(party, 'waiter-call').click();
  await heading(waiter, 'Tempatkan tamu');
  await target(party, 'waiter-seat').click();
  await heading(waiter, 'Panduan selesai');
  assert.deepEqual(errors, []);
  console.log('Waiter request and waitlist handoff passed.');
} finally {
  await browser.close();
}
