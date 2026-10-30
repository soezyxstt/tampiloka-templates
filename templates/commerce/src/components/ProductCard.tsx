import { Button as ShadcnButton } from './shadcn/button';
import { ArrowUpRight, Heart, Plus } from 'lucide-react';
import type { Product } from '../shared/contracts';
import { useCommerce } from '../lib/store';
import { money } from '../lib/format';
import { api } from '../lib/api';
import { IconButton, ProductImage } from './ui';

export function ProductCard({ product, index = 0, row = false }: { product: Product; index?: number; row?: boolean }) {
  const { data, setProduct, notify, refresh, appearance } = useCommerce(); const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0); const wished = data?.wishlist.includes(product.id);
  const toggleWishlist = async () => { try { await api.wishlist(product.id); await refresh(); notify(wished ? 'Produk dihapus dari simpanan.' : 'Produk disimpan.'); } catch (error) { notify(error instanceof Error ? error.message : 'Produk belum tersimpan.', 'error'); } };
  return <article className={`product-card product-card-${appearance.card} ${row ? 'product-row' : ''}`}><ShadcnButton variant="unstyled" size="none" className="product-image-button" onClick={() => setProduct(product)} aria-label={`Lihat ${product.name}${!stock ? ' · Stok habis' : ''}`}><ProductImage src={product.images[0]} alt={product.name} loading={index < 4 ? 'eager' : 'lazy'} />{!stock && <span className="stock-note">Stok habis</span>}</ShadcnButton>{data?.capabilities.wishlist && <IconButton label={wished ? `Hapus ${product.name} dari simpanan` : `Simpan ${product.name}`} className={`product-save ${wished ? 'is-saved' : ''}`} onClick={() => void toggleWishlist()}><Heart size={17} fill={wished ? 'currentColor' : 'none'} /></IconButton>}<div className="product-card-info"><div><ShadcnButton variant="unstyled" size="none" className="product-name" onClick={() => setProduct(product)}>{product.name}</ShadcnButton><p className="product-meta">{product.material}</p></div><p className="product-price">{money(product.price)}{product.compareAtPrice && product.compareAtPrice > product.price && <del>{money(product.compareAtPrice)}</del>}</p></div>{row && <span className="row-stock">{stock ? `${stock} tersedia` : 'Stok habis'}</span>}<ShadcnButton variant="unstyled" size="none" className="product-view" onClick={() => setProduct(product)} aria-label={`Pilih produk ${product.name}`}>{row ? <><span>Pilih produk</span><ArrowUpRight size={17} /></> : <Plus size={17} />}</ShadcnButton></article>;
}
