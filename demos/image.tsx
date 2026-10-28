import type { ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | { src: string };
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};

/** The Pages showcase serves the same local SVGs and QR data URLs directly. */
export default function Image({ src, fill, priority, unoptimized: _unoptimized, style, alt, ...props }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- This entry is served by Vite/Pages, without a Next image server.
  return <img {...props} src={typeof src === 'string' ? src : src.src} alt={alt || ''} loading={priority ? 'eager' : props.loading || 'lazy'} style={fill ? { ...style, position: 'absolute', inset: 0, width: '100%', height: '100%' } : style} />;
}
