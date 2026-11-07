import { useState } from 'react';
import type { FC } from 'react';

export interface AIProductRecommendation {
  id?: string;
  name: string;
  subcategory?: string;
  price?: number;
  discount?: number;
  final_price?: number;
  stock?: number;
  unit?: string;
  image_url?: string;
}

const WHATSAPP_NUMBER = '6289694127723';

const formatRupiah = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? `Rp ${value.toLocaleString('id-ID')}`
    : 'Harga hubungi toko';

const optimizeImageUrl = (url?: string) => {
  const clean = typeof url === 'string' ? url.trim() : '';
  if (!clean) return '';
  return clean.includes('res.cloudinary.com') && clean.includes('/upload/')
    ? clean.replace('/upload/', '/upload/f_auto,q_auto,w_320,c_limit/')
    : clean;
};

const whatsappUrlFor = (product: AIProductRecommendation) => {
  const text = [
    'Halo Toko AGM 2 (Ketapang), saya berminat dan ingin menanyakan detail produk:',
    `- Nama: ${product.name}`,
    `- Kategori: ${product.subcategory || 'Produk katalog'}`,
  ].join('\n');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
};

export const AIProductCard: FC<{ product: AIProductRecommendation }> = ({ product }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = optimizeImageUrl(product.image_url);
  const finalPrice = typeof product.final_price === 'number' ? product.final_price : product.price;
  const hasDiscount = Number(product.discount) > 0 && Number(product.price) > 0;
  const inStock = Number(product.stock) > 0;

  return (
    <article className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-2 transition-colors hover:border-slate-300">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300" aria-label="Foto produk tidak tersedia">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16l2-2a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-slate-900">{product.name}</p>
        {product.subcategory && (
          <p className="mt-0.5 truncate text-[10.5px] uppercase tracking-wide text-slate-400">{product.subcategory}</p>
        )}
        <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
          <span className="text-[12px] font-bold text-slate-900">{formatRupiah(finalPrice)}</span>
          {hasDiscount && <span className="text-[10px] text-slate-400 line-through">{formatRupiah(product.price)}</span>}
        </div>
        <span className={`mt-0.5 inline-block text-[10px] font-medium ${inStock ? 'text-emerald-600' : 'text-amber-600'}`}>
          {inStock ? `Stok ${product.stock} ${product.unit || ''}`.trim() : 'Pre-order'}
        </span>
        <a
          href={whatsappUrlFor(product)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
          aria-label={`Tanya WhatsApp tentang ${product.name}`}
        >
          Tanya WA
        </a>
      </div>
    </article>
  );
};
