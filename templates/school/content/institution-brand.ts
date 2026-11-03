import configured from '../config/institution.json' with { type: 'json' };
export const demoInstitutionName = 'SMP Nusa Cendekia';

const imageKeys = ['activities', 'extracurricular', 'immersion', 'journeyMain', 'journeyDetail', 'achievement', 'immersionFeature', 'invitation'] as const;
const plainText = (value: unknown, max: number) => typeof value === 'string' && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim().slice(0, max) : '';

/** Public asset references can be local images or HTTPS URLs, never executable URLs. */
export function safeInstitutionAsset(value: unknown): string {
    const path = plainText(value, 2048);
    if (!path || /[\\\s]/.test(path)) return '';
    if (/^\/api\/media\/[A-Za-z0-9_-]+$/.test(path)) return path;
    if (path.startsWith('/images/') && !/[?#%]/.test(path) && !path.split('/').some(part => part === '.' || part === '..')) return path;
    try {
        const url = new URL(path);
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}

export function sanitizeInstitutionBrand(input: unknown) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
    const rawImages = source.images && typeof source.images === 'object' && !Array.isArray(source.images) ? source.images as Record<string, unknown> : {};
    const email = plainText(source.email, 254);
    return {
        name: plainText(source.name, 100),
        address: plainText(source.address, 300),
        email: /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email) ? email : '',
        logo: safeInstitutionAsset(source.logo),
        heroImage: safeInstitutionAsset(source.heroImage),
        teacherImage: safeInstitutionAsset(source.teacherImage),
        images: Object.fromEntries(imageKeys.map(key => [key, safeInstitutionAsset(rawImages[key])])) as Record<typeof imageKeys[number], string>,
    };
}

export const institutionBrand = sanitizeInstitutionBrand(configured);
