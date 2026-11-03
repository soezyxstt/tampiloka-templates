import { t, sampleText, choose, useLanguage } from '../lib/language';
import { HeroCarousel } from '../components/HeroCarousel';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../components/shadcn/input-group';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/shadcn/select';
import { Checkbox } from '../components/shadcn/checkbox';
import { Button as ShadcnButton } from '../components/shadcn/button';
import { Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCommerce } from '../lib/store';
import { ProductCard } from '../components/ProductCard';
import { Button, EmptyState, Field, IconButton, PageMotion, ProductImage } from '../components/ui';

export function Storefront({ wishlist = false }: { wishlist?: boolean }) {
  const { language } = useLanguage(); const { data, navigate, setProduct } = useCommerce(); const [category, setCategory] = useState('all'); const [query, setQuery] = useState(''); const [sort, setSort] = useState('featured'); const [inStock, setInStock] = useState(false); const [filters, setFilters] = useState(false); const reduced = useReducedMotion();
  const products = useMemo(() => (data?.products || []).filter(product => product.active && (!wishlist || data?.wishlist.includes(product.id)) && (category === 'all' || product.category === category) && (!inStock || product.variants.some(v => v.stock > 0)) && `${sampleText(product.name)} ${sampleText(product.material)} ${sampleText(product.description)}`.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))).sort((a, b) => sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : sort === 'name' ? a.name.localeCompare(b.name, 'id') : Number(b.featured) - Number(a.featured)), [data, category, query, sort, inStock, wishlist, language]);
  if (!data) return null;
  const preset = data.config.preset; const market = preset === 'market'; const compact = preset === 'compact'; const atelier = preset === 'atelier';
  function browse(id?: string) {
    if (id) { setCategory(id); setQuery(''); setInStock(false); }
    const collection = document.querySelector<HTMLElement>('#collection');
    collection?.focus({ preventScroll: true });
    collection?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' });
  }
  const searchField = <InputGroup className="search-field"><InputGroupAddon><Search size={18} aria-hidden="true" /></InputGroupAddon><InputGroupInput placeholder={t("Cari produk...")} aria-label={t("Cari produk")} value={query} onChange={event => setQuery(event.target.value)} />{query && <InputGroupAddon align="inline-end"><InputGroupButton aria-label={t("Hapus pencarian")} size="icon-xs" onClick={() => setQuery('')}><X size={15} /></InputGroupButton></InputGroupAddon>}</InputGroup>;
  const catalog = data.products.filter(product => product.active && (!wishlist || data.wishlist.includes(product.id)));
  const photographed = catalog.filter(product => product.images[1]);
  const lead = photographed[0];
  const companion = photographed.find(product => product.category !== lead?.category) ?? photographed[1];
  const collectionStudies = [lead, companion].filter(product => product !== undefined);
  const categoryOptions = <><ShadcnButton variant="unstyled" size="none" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>{t("Semua produk")}<span>{catalog.length}</span></ShadcnButton>{data.categories.map(item => <ShadcnButton variant="unstyled" size="none" key={item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{sampleText(item.name)}<span>{catalog.filter(product => product.category === item.id).length}</span></ShadcnButton>)}</>;
  return <PageMotion className={`storefront storefront-${preset} ${wishlist ? 'wishlist-page' : ''}`}>
    {!wishlist && <HeroCarousel key={preset} products={data.products} categories={data.categories} search={searchField} preset={preset} brand={data.config.brand.name} onBrowse={browse} onProduct={setProduct} />}
    <section id="collection" tabIndex={-1} aria-labelledby="collection-title" className="collection-section"><div className="collection-heading"><div><h2 id="collection-title">{wishlist ? t("Produk tersimpan") : compact ? t("Semua produk") : market ? t("Belanja koleksi") : t("Pilihan untuk harimu")}</h2><p>{wishlist ? t("Produk yang disimpan untuk dilihat kembali.") : choose(`${catalog.length} produk untuk dijelajahi.`, `${catalog.length} products to explore.`)}</p></div></div><div className={`catalog-layout ${market ? 'with-sidebar' : ''}`}>
      {market && <aside className="category-sidebar"><h3>{t("Kategori")}</h3><nav aria-label={t("Kategori produk")}>{categoryOptions}</nav><label className="checkbox-label"><Checkbox checked={inStock} onCheckedChange={checked => setInStock(checked === true)} />{t("Stok tersedia")}</label></aside>}
      <div className="catalog-main"><div className="catalog-controls">{(!compact || wishlist) && searchField}<label className="sort-field"><span className="sr-only">{t("Urutkan produk")}</span><Select value={sort} onValueChange={value => setSort(value)}><SelectTrigger aria-label={t("Urutkan produk")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="featured">{t("Pilihan kami")}</SelectItem><SelectItem value="price-asc">{t("Harga terendah")}</SelectItem><SelectItem value="price-desc">{t("Harga tertinggi")}</SelectItem><SelectItem value="name">{t("Nama produk")}</SelectItem></SelectContent></Select></label><IconButton label={t("Filter produk")} className={filters ? 'selected' : ''} onClick={() => setFilters(!filters)}><SlidersHorizontal size={19} /></IconButton></div>
      {(!market || filters) && <nav className="category-tabs" aria-label={t("Kategori produk")}>{categoryOptions}</nav>}{filters && <div className="filter-panel"><label className="checkbox-label"><Checkbox checked={inStock} onCheckedChange={checked => setInStock(checked === true)} />{t("Hanya stok tersedia")}</label><Button variant="quiet" compact onClick={() => { setCategory('all'); setQuery(''); setInStock(false); setSort('featured'); }}>{t("Reset filter")}</Button></div>}
      {(query || category !== 'all' || inStock) && <p className="results-note" role="status">{products.length}{t(" produk ditemukan")}{query && choose(` untuk “${query}”`, ` for “${query}”`)}</p>}
      {products.length ? <motion.div layout={!reduced} className={`product-grid ${compact ? 'product-list' : ''} ${atelier ? 'atelier-grid' : ''}`}><AnimatePresence initial={false}>{products.map((product, index) => <motion.div layout={!reduced} key={product.id} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: .18 }}><ProductCard product={product} index={index} row={compact} /></motion.div>)}</AnimatePresence></motion.div> : <EmptyState icon={wishlist ? <Heart size={32} /> : <Search size={32} />} title={wishlist && !query ? t("Belum ada produk tersimpan") : t("Produk belum ditemukan")} description={wishlist && !query ? t("Tekan ikon hati pada produk untuk menyimpannya di sini.") : t("Coba kata kunci lain atau hapus filter untuk melihat lebih banyak produk.")} action={<Button variant="secondary" onClick={() => { setQuery(''); setCategory('all'); setInStock(false); if (wishlist) navigate('shop'); }}>{wishlist ? t("Lihat koleksi") : t("Hapus filter")}</Button>} />}
      </div></div></section>
    {!wishlist && <section id="about" className="about-section">
      <div className="collection-story">
        <h2>{t("Kenali koleksi")}<br /><em>{t("lebih dekat.")}</em></h2>
        <p>{sampleText(data.config.brand.description)}</p>
      </div>
      {collectionStudies.length > 0 && <div className="material-studies">
        {collectionStudies.map(product => (
          <ShadcnButton key={product.id} variant="unstyled" size="none" className="material-study" onClick={() => setProduct(product)}>
            <ProductImage src={product.images[1]} alt="" />
            <span className="material-study-caption">
              <strong>{sampleText(product.name)}</strong>
              <span>{sampleText(product.material)}</span>
            </span>
          </ShadcnButton>
        ))}
      </div>}
    </section>}
  </PageMotion>;
}
