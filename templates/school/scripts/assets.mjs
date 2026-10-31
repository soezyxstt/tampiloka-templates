import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
const sources = JSON.parse(await readFile('content/photo-sources.json', 'utf8'));
await mkdir('public/images', { recursive: true });
for (const [file, url] of Object.entries(sources.files)) {
    const path = `public/images/${file}`;
    try {
        await access(path);
        continue;
    }
    catch { }
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
        throw new Error(`Photo ${file}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes[0] !== 255 || bytes[1] !== 216)
        throw new Error(`Invalid JPEG ${file}`);
    await writeFile(path, bytes);
}
