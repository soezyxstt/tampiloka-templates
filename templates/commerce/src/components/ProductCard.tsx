import { t, sampleText, choose } from '../lib/language';
import { Button as ShadcnButton } from './shadcn/button';
import { Heart } from 'lucide-react';
import type { Product } from '../shared/contracts';
import { useCommerce } from '../lib/store';
import { money } from '../lib/format';
import { api } from '../lib/api';
import { IconButton, ProductImage } from './ui';

export function ProductCard({ product, index = 0, row = false }: { product: Product; index?: number; row?: boolean }) {
  const { data, setProduct, notify, refresh, appearance } = useCommerce(); const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0); const wished = data?.wishlist.includes(product.id);
  const toggleWishlist = async () => { try { await api.wishlist(product.id); await refresh(); notify(wished ? 'Produk dihapus dari simpanan.' : 'Produk disimpan.'); } catch (error) { notify(error instanceof Error ? error.message : 'Produk belum tersimpan.', 'error'); } };
  const name = sampleText(product.name);
  const openLabel = choose(`Lihat ${name}${stock ? '' : ' · Stok habis'}`, `View ${name}${stock ? '' : ' (Out of stock)'}`);
  return <article className={`product-card product-card-${appearance.card} ${row ? 'product-row' : ''}`}>
    <div className="product-image-button">
      <ProductImage src={product.images[0]} alt="" loading={index < 4 ? 'eager' : 'lazy'} />
      {!stock && <span className="stock-note">{t("Stok habis")}</span>}
    </div>
    <div className="product-card-info">
      <div>
        <ShadcnButton variant="unstyled" size="none" className="product-name" aria-label={openLabel} onClick={() => setProduct(product)}>{name}</ShadcnButton>
        <p className="product-meta">{sampleText(product.material)}</p>
      </div>
      <p className="product-price">{money(product.price)}{product.compareAtPrice && product.compareAtPrice > product.price && <del>{money(product.compareAtPrice)}</del>}</p>
    </div>
    {row && <span className="row-stock">{stock ? choose(`${stock} tersedia`, `${stock} in stock`) : t("Stok habis")}</span>}
    {data?.capabilities.wishlist && <IconButton label={wished ? choose(`Hapus ${name} dari simpanan`, `Remove ${name} from saved items`) : choose(`Simpan ${name}`, `Save ${name}`)} className={`product-save ${wished ? 'is-saved' : ''}`} onClick={() => void toggleWishlist()}><Heart size={17} fill={wished ? 'currentColor' : 'none'} /></IconButton>}
  </article>;
}
