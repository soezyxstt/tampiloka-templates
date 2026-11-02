import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
const sources = JSON.parse(await readFile('content/photo-sources.json', 'utf8'));
await mkdir('public/images', { recursive: true });

async function download(file, url) {
    const path = `public/images/${file}`;
    try {
        await access(path);
        return;
    } catch { }
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
        throw new Error(`Photo ${file}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const valid = file.endsWith('.webp')
        ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        : bytes[0] === 255 && bytes[1] === 216;
    if (!valid) throw new Error(`Invalid image ${file}`);
    await writeFile(path, bytes);
}
for (const [file, url] of Object.entries(sources.files)) await download(file, url);
for (const [name, { photoId }] of Object.entries(sources.activityPhotos)) {
    for (const width of [480, 1120]) {
        const file = width === 480 ? `${name}-480.webp` : `${name}.webp`;
        await download(file, `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?cs=tinysrgb&fm=webp&w=${width}&q=76`);
    }
}
