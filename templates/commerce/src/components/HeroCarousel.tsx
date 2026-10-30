import { t, sampleText, choose } from '../lib/language';
import { useState } from 'react';
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '../shared/contracts';
import { money } from '../lib/format';
import { Button, ProductImage } from './ui';
import { Button as ShadcnButton } from './shadcn/button';
import './hero-carousel.css';

export function HeroCarousel({ products, preset, brand, onBrowse, onProduct }: {
  products: Product[];
  preset: string;
  brand: string;
  onBrowse: () => void;
  onProduct: (product: Product) => void;
}) {
  const [index, setIndex] = useState(0);
  const available = products.filter(product => product.active && product.images.some(Boolean));
  const featured = available.filter(product => product.featured);
  const slides = (featured.length ? featured : available).slice(0, 5);
  const current = slides[index % (slides.length || 1)];
  const activeIndex = slides.length ? index % slides.length : 0;
  const step = (direction: number) => setIndex((activeIndex + direction + slides.length) % slides.length);

  return <section className={`shop-hero shop-hero-${preset}`} aria-label={t("Sorotan toko")}>
    <div className="shop-hero-copy">
      <span className="shop-hero-eyebrow">{t("Koleksi ")}{brand}</span>
      <h1>{preset === 'market' ? t("Temukan pilihan untuk setiap hari") : preset === 'compact' ? t("Temukan produk yang dibutuhkan") : preset === 'atelier' ? <>{t("Pilihan untuk ")}<em>{t("keseharian")}</em></> : <>{t("Jelajahi koleksi ")}<em>{brand}</em></>}</h1>
      <p>{preset === 'compact' ? t("Cari produk, periksa pilihannya, lalu pilih jumlah yang dibutuhkan.") : choose(`Jelajahi produk ${brand}, lihat detailnya, dan temukan pilihan yang sesuai.`, `Explore ${brand} products, review the details, and find your fit.`)}</p>
      <Button onClick={onBrowse}>{t("Lihat koleksi ")}<ArrowDown size={17} /></Button>
    </div>
    {current && <div className="shop-hero-gallery" role="region" aria-roledescription={choose("karusel", "carousel")} aria-label={t("Produk pilihan")}>
      <div className="shop-hero-slide" role="group" aria-roledescription="slide" aria-label={choose(`${activeIndex + 1} dari ${slides.length}`, `${activeIndex + 1} of ${slides.length}`)}>
        <ShadcnButton variant="unstyled" size="none" className="shop-hero-product" onClick={() => onProduct(current)} aria-label={choose(`Lihat detail ${sampleText(current.name)}`, `View ${sampleText(current.name)} details`)}>
          <ProductImage src={current.images.find(Boolean)} alt="" loading="eager" className="shop-hero-image" />
          <span className="shop-hero-product-caption"><span><small>{t("Produk pilihan")}</small><strong>{sampleText(current.name)}</strong></span><span>{money(current.price)} <ArrowUpRight size={18} aria-hidden="true" /></span></span>
        </ShadcnButton>
      </div>
      {slides.length > 1 && <div className="shop-hero-controls">
        <div className="shop-hero-dots" aria-label={t("Pilih foto produk")}>{slides.map((product, slideIndex) => <ShadcnButton variant="unstyled" size="none" key={product.id} className={slideIndex === activeIndex ? 'active' : ''} aria-label={choose(`Tampilkan ${sampleText(product.name)}`, `Show ${sampleText(product.name)}`)} aria-current={slideIndex === activeIndex ? 'true' : undefined} onClick={() => setIndex(slideIndex)}><span /></ShadcnButton>)}</div>
        <span className="shop-hero-count" aria-live="polite">{String(activeIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
        <div className="shop-hero-arrows"><ShadcnButton variant="unstyled" size="none" onClick={() => step(-1)} aria-label={t("Foto sebelumnya")}><ChevronLeft size={19} /></ShadcnButton><ShadcnButton variant="unstyled" size="none" onClick={() => step(1)} aria-label={t("Foto berikutnya")}><ChevronRight size={19} /></ShadcnButton></div>
      </div>}
    </div>}
  </section>;
}
