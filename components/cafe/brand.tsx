import { cafeConfig } from '@/src/config/cafe';

export function BrandMark({ className = '' }: { className?: string }) {
  return cafeConfig.brand.logo ? (
    // A client logo may be a local public file or a configured HTTPS asset.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cafeConfig.brand.logo} alt={cafeConfig.brand.name} className={`brand-mark object-contain ${className}`} />
  ) : (
    <span aria-hidden="true" className={`brand-mark inline-flex items-center justify-center bg-[var(--primary)] text-[var(--primary-foreground)] font-heading font-bold ${className}`}>{cafeConfig.brand.shortName}</span>
  );
}
