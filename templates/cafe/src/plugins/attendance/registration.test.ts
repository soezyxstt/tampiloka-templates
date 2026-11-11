import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttendanceInitializer } from './registration.ts';
import { configureAttendance } from './server-config.ts';

test('server configuration is disabled by default and initializes lazily per instance', async () => {
 assert.equal(configureAttendance(), null);
 let calls = 0;
 const runtime = { handle: async () => new Response() } as never;
 const factory = async () => { calls++; return runtime; };
 const first = createAttendanceInitializer(factory), second = createAttendanceInitializer(factory);
 assert.equal(calls, 0);
 assert.deepEqual(await Promise.all([first(), first()]), [runtime, runtime]);
 assert.equal(calls, 1); await second(); assert.equal(calls, 2);
 let tries = 0;
 const retry = createAttendanceInitializer(() => { if (++tries === 1) throw Error('configuration'); return null; });
 await assert.rejects(retry()); assert.equal(await retry(), null); assert.equal(tries, 2);
});

test('route uses disabled and configured factories', async () => {
 const { createAttendanceRoute } = await import('./route-handler.ts');
 const request = new Request('https://cafe.test/api/attendance');
 const disabled = createAttendanceRoute(createAttendanceInitializer(() => null));
 assert.equal((await (await disabled(request)).json()).error, 'ATTENDANCE_NOT_CONFIGURED');
 const configured = createAttendanceRoute(createAttendanceInitializer(() => ({ handle: async () => Response.json({ host: true }) } as never)));
 assert.deepEqual(await (await configured(request)).json(), { host: true });
});
