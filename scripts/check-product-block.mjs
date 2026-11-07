// Cek blok json_product_recommendations terurai benar & dibersihkan dari teks tampil.
const FENCE = '```';
const BLOCK = new RegExp(FENCE + 'json_product_recommendations\\s*([\\s\\S]*?)\\s*' + FENCE);

const parse = (text) => {
  const m = text.match(BLOCK);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[1]);
    return Array.isArray(arr)
      ? arr.filter(p => p && typeof p.name === 'string' && p.name.trim() && p.image_url).slice(0, 3)
      : [];
  } catch { return []; }
};

const sample = [
  'Berikut rekomendasi lemari.',
  '',
  '- **Lemari Pakaian 3 Pintu** - Rp 2.200.000 - stok 4',
  '',
  FENCE + 'json_product_recommendations',
  '[',
  ' {"id":"a","name":"Lemari Pakaian 3 Pintu","price":2400000,"discount":200000,"final_price":2200000,"stock":4,"unit":"Pcs","image_url":"https://res.cloudinary.com/x/upload/a.jpg"},',
  ' {"id":"b","name":"Lemari Tanpa Foto","price":1000,"final_price":1000,"stock":1,"image_url":""}',
  ']',
  FENCE,
  '',
  'Ada lagi yang bisa dibantu?',
].join('\n');

const clean = sample.replace(BLOCK, '').trim();
const items = parse(sample);

console.assert(items.length === 1, 'harus 1 produk valid (yang tanpa gambar dibuang)');
console.assert(items[0].final_price === 2200000, 'harga final benar');
console.assert(!clean.includes('json_product_recommendations'), 'blok wajib hilang dari teks tampil');
console.assert(clean.includes('Ada lagi yang bisa dibantu?'), 'teks asli tetap utuh');
console.assert(parse('teks tanpa blok').length === 0, 'tanpa blok -> kosong');
console.assert(parse(FENCE + 'json_product_recommendations\n{bukan array}\n' + FENCE).length === 0, 'JSON invalid aman');

console.log('OK: blok rekomendasi produk terurai, maksimal 3, tanpa gambar dibuang');
