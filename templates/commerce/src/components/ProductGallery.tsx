import { useState } from 'react';
import { choose, sampleText } from '../lib/language';
import { sampleFinishes } from '../../content/finishes';
import type { Product, Variant } from '../shared/contracts';
import { Button } from './shadcn/button';
import { ProductImage } from './ui';

const demoCaptions: Record<string, [string, string]> = {
  'photo-1596755094514-f87e34085b2c': ['Kemeja biru bermotif, tampak depan', 'Blue patterned shirt, front view'],
  'shirt-placket': ['Kerah, kancing, dan motif kain', 'Collar, buttons and fabric pattern'],
  'tee-sunlit': ['Kaus putih dengan saku dada', 'White tee with a chest pocket'],
  'tee-neckline': ['Detail kerah bulat dan jahitan', 'Crew neck and stitching detail'],
  'canvas-tote': ['Pouch kanvas warna khaki', 'Khaki canvas book pouch'],
  'pouch-fastening': ['Bukaan pouch dengan pengunci kancing', 'Pouch opening with a snap closure'],
  'leather-sling': ['Tas merah marun dengan pegangan pendek', 'Burgundy bag with a short handle'],
  'bag-clasp': ['Pengunci putar dan motif timbul', 'Turn-lock clasp and embossed finish'],
  'wallet-closed': ['Dompet cokelat dalam genggaman', 'Closed brown wallet held in one hand'],
  'wallet-open': ['Slot kartu di bagian dalam dompet', 'Card slots inside the wallet'],
  'photo-1473966968600-fa801b869a1a': ['Celana khaki saat dipakai', 'Khaki trousers worn outdoors'],
  'trousers-seam': ['Potongan ramping pada paha dan lutut', 'Slim fit through the thigh and knee'],
  'photo-1514228742587-6b1558fcca3d': ['Cangkir keramik putih', 'White ceramic cup'],
  'cup-glaze': ['Glasir putih dan bentuk gagang', 'White glaze and handle profile'],
  'woven-throw': ['Selimut warna natural di atas tempat tidur', 'Natural knit throw across a bed'],
  'throw-stitch': ['Detail benang dan pola rajutan', 'Yarn and knit pattern detail'],
};

function captionFor(src: string | undefined) {
  const id = /^\/images\/([\w-]+)\.webp$/.exec(src ?? '')?.[1];
  const captions = id && demoCaptions[id];
  return captions ? choose(...captions) : '';
}

export function GalleryFinishNote({ product, variant }: { product: Product; variant?: Variant }) {
  const finish = sampleFinishes[product.id];
  const color = variant?.options.Warna;
  if (!finish || !color || color === finish.name || product.images.length !== finish.images.length ||
      product.images.some((url, i) => url !== finish.images[i])) return null;
  const pictured = sampleText(finish.name);
  const selected = sampleText(color);
  return <p className="gallery-finish-note" role="status">
    {choose(`Foto menampilkan warna ${pictured}. Foto untuk pilihan ${selected} belum tersedia.`,
      `The photos show the ${pictured} finish. A photo of the ${selected} option is unavailable.`)}
  </p>;
}

export function ProductGallery({ product }: { product: Product }) {
  const [index, setIndex] = useState(0);
  const src = product.images[index] ?? product.images[0];
  const name = sampleText(product.name);
  const caption = captionFor(src);
  return <div className="product-gallery">
    <figure>
      <ProductImage src={src} alt={caption || name} loading="eager" className="product-main-image" />
      {caption && <figcaption className="gallery-caption" aria-hidden="true">{caption}</figcaption>}
    </figure>
    {product.images.length > 1 && <div className="product-thumbnails">
      {product.images.map((url, i) => (
        <Button key={i} variant="unstyled" size="none" className={index === i ? 'selected' : ''}
          aria-label={[choose(`Lihat foto ${i + 1}`, `View photo ${i + 1}`), captionFor(url)].filter(Boolean).join(', ')}
          aria-pressed={index === i} onClick={() => setIndex(i)}>
          <ProductImage src={url} alt="" />
        </Button>
      ))}
    </div>}
  </div>;
}
