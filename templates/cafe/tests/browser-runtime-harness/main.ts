import { getBrowserSnapshot, installBrowserDemoFetch } from '../../src/demo-runtime/index.ts';

installBrowserDemoFetch();
try {
  const snapshot = await getBrowserSnapshot({ surface: 'staff' });
  document.body.dataset.demoRuntime = 'ready';
  document.querySelector('#status')!.textContent = `Demo lokal siap: ${snapshot.outlet.name}`;
} catch (error) {
  document.body.dataset.demoRuntime = 'failed';
  document.querySelector('#status')!.textContent = error instanceof Error ? error.message : String(error);
  console.error(error);
}
