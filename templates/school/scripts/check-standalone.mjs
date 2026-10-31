import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(process.cwd(), '../..');
const temp = await mkdtemp(join(tmpdir(), 'tampiloka-school-independent-'));
function run(cmd, args, cwd) { const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' }, timeout: 180000 }); if (r.error || r.status !== 0)
    throw r.error ?? new Error(`${cmd} ${args.join(' ')} failed (${r.status})`); }
try {
    run(process.execPath, [join(root, 'packages/cli/bin/tampiloka.mjs'), 'create', 'independent-school', '--template', 'school', '--preset', 'language', '--level', 'full', '--layout', 'institutional', '--theme', 'burgundy', '--typography', 'humanist', '--yes', '--out', temp], root);
    const output = join(temp, 'independent-school');
    const pkg = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'));
    if (JSON.stringify(pkg).includes('workspace:'))
        throw new Error('Unresolved workspace dependency');
    run('pnpm', ['install', '--no-frozen-lockfile'], output);
    run('pnpm', ['typecheck'], output);
    run('pnpm', ['build'], output);
    run('pnpm', ['test'], output);
    run(process.execPath, [join(root, 'packages/cli/bin/tampiloka.mjs'), 'doctor', '--dir', output], root);
    console.log('Standalone school install, typecheck, build, server tests and doctor PASS');
}
finally {
    await rm(temp, { force: true, recursive: true });
}
