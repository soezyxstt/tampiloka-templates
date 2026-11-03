import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { choose, sampleText, t } from '../lib/language';
import { money } from '../lib/format';
import type { Category, Product } from '../shared/contracts';
import { Button as PlainButton } from './shadcn/button';
import { Button, ProductImage } from './ui';
import './hero-carousel.css';

interface OpeningProps {
  products: Product[];
  categories: Category[];
  preset: string;
  brand: string;
  search: ReactNode;
  onBrowse: (category?: string) => void;
  onProduct: (product: Product) => void;
}

type ProductAction = OpeningProps['onProduct'];

function productLabel(product: Product) {
  const name = sampleText(product.name);
  return choose(`Lihat detail ${name}`, `View ${name} details`);
}

function Campaign({ slides, onProduct }: { slides: Product[]; onProduct: ProductAction }) {
  const [index, setIndex] = useState(0);
  const active = index % slides.length;
  const item = slides[active];
  const change = (by: number) => setIndex((active + by + slides.length) % slides.length);
  return <section className="shop-hero retail-campaign" aria-label={t("Produk pilihan")} aria-roledescription={choose('karusel', 'carousel')}>
    <div className="campaign-frame" role="group" aria-roledescription={choose('salindia', 'slide')}
      aria-label={choose(`${active + 1} dari ${slides.length}`, `${active + 1} of ${slides.length}`)}>
      <ProductImage key={item.id} className="campaign-photo" src={item.images.find(Boolean)} alt="" loading="eager" />
      <div className="campaign-copy">
        <h1>{sampleText(item.name)}</h1>
        <p>{sampleText(item.material)}<span>{money(item.price)}</span></p>
        <PlainButton variant="unstyled" size="none" className="campaign-action" onClick={() => onProduct(item)}>{choose('Lihat produk', 'View product')}<span className="sr-only"> {sampleText(item.name)}</span></PlainButton>
      </div>
    </div>
    {slides.length > 1 && <div className="campaign-controls">
      <PlainButton variant="unstyled" size="none" aria-label={t('Foto sebelumnya')} onClick={() => change(-1)}><ChevronLeft /></PlainButton>
      <span className="campaign-count" aria-live="polite" aria-atomic="true">
        <span className="sr-only">{sampleText(item.name)}. </span>{String(active + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
      </span>
      <PlainButton variant="unstyled" size="none" aria-label={t('Foto berikutnya')} onClick={() => change(1)}><ChevronRight /></PlainButton>
    </div>}
  </section>;
}

function MarketOpening({ products, categories, onBrowse }: Pick<OpeningProps, 'products' | 'categories' | 'onBrowse'>) {
  const sections = categories.flatMap(category => {
    const items = products.filter(product => product.category === category.id);
    if (!items.length) return [];
    const withPhoto = items.filter(product => product.images.some(Boolean));
    const lead = withPhoto.find(product => product.featured) ?? withPhoto[0];
    return [{ category, count: items.length, image: lead?.images.find(Boolean) }];
  });
  if (!sections.length) return null;
  return <section className="shop-hero retail-market" aria-label={choose('Jelajahi kategori', 'Explore categories')}>
    <h1>{choose('Belanja menurut kategori', 'Shop by category')}</h1>
    <div className="market-departments">
      {sections.slice(0, 4).map(({ category, count, image }) => <PlainButton key={category.id} variant="unstyled" size="none"
        className="market-department" onClick={() => onBrowse(category.id)}>
        <ProductImage src={image} alt="" loading="eager" />
        <span><strong>{sampleText(category.name)}</strong><small>{choose(`${count} produk`, `${count} ${count === 1 ? 'product' : 'products'}`)}</small></span>
      </PlainButton>)}
    </div>
  </section>;
}

function AtelierOpening({ item, onProduct }: { item: Product; onProduct: ProductAction }) {
  const [main, detail] = item.images.filter(Boolean);
  return <section className="shop-hero retail-atelier" aria-label={choose('Studi produk', 'Object study')}>
    <div className="atelier-mast"><h1>{choose('Studi bahan', 'Material study')}</h1><p>{sampleText(item.material)}</p></div>
    <PlainButton variant="unstyled" size="none" className="atelier-specimen" aria-label={productLabel(item)} onClick={() => onProduct(item)}>
      <span className={detail ? 'atelier-plates' : 'atelier-plates single-plate'}>
        <ProductImage src={main} alt="" loading="eager" />
        {detail && <ProductImage src={detail} alt="" loading="eager" />}
      </span>
      <span className="atelier-caption"><strong>{sampleText(item.name)}</strong><span>{money(item.price)}</span><span className="atelier-inspect">{choose('Lihat detail', 'View details')}</span></span>
    </PlainButton>
  </section>;
}

function CompactOpening({ items, brand, search, onProduct }: { items: Product[]; brand: string; search: ReactNode; onProduct: ProductAction }) {
  return <section className="shop-hero retail-compact">
    <div className="compact-mast"><h1>{choose(`Katalog ${brand}`, `${brand} catalogue`)}</h1>{search}</div>
    {items.length > 0 && <ul className="compact-index" aria-label={choose('Pilihan toko', 'Shop picks')}>
      {items.map(product => <li key={product.id}><PlainButton variant="unstyled" size="none" aria-label={productLabel(product)} onClick={() => onProduct(product)}>
        <ProductImage src={product.images.find(Boolean)} alt="" loading="eager" />
        <span><strong>{sampleText(product.name)}</strong><small>{money(product.price)}</small></span>
      </PlainButton></li>)}
    </ul>}
  </section>;
}

export function HeroCarousel({ products, categories, preset, brand, search, onBrowse, onProduct }: OpeningProps) {
  const published = products.filter(product => product.active);
  const pictured = published.filter(product => product.images.some(Boolean));
  const featured = pictured.filter(product => product.featured);
  const selection = featured.length ? featured : pictured;
  const inStock = selection.filter(product => product.variants.some(variant => variant.stock > 0));
  const candidates = inStock.length ? inStock : selection;

  if (preset === 'compact') {
    const picks = [...candidates].sort((a, b) => a.price - b.price).slice(0, 3);
    return <CompactOpening items={picks} brand={brand} search={search} onProduct={onProduct} />;
  }
  if (preset === 'market' && published.some(product => categories.some(category => category.id === product.category))) {
    return <MarketOpening products={published} categories={categories} onBrowse={onBrowse} />;
  }
  if (!candidates.length) return <section className="shop-hero retail-empty">
    <h1>{choose(`Koleksi ${brand}`, `The ${brand} collection`)}</h1>
    <Button onClick={() => onBrowse()}>{t('Lihat koleksi')}</Button>
  </section>;
  if (preset === 'atelier') {
    const [study] = [...candidates].sort((a, b) => b.images.filter(Boolean).length - a.images.filter(Boolean).length || b.price - a.price);
    return <AtelierOpening item={study} onProduct={onProduct} />;
  }
  return <Campaign slides={candidates.slice(0, 5)} onProduct={onProduct} />;
}
