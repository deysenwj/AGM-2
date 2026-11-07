// Self-check: render balasan AI contoh dan pastikan tidak ada sisa penanda markdown.
// Jalankan: node --experimental-strip-types scripts/check-rich-text.mjs
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert';
import { writeFile, rm } from 'node:fs/promises';

const out = await build({
  entryPoints: ['src/components/AIRichText.tsx'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  external: ['react', 'react-dom', 'react-dom/server'],
  jsx: 'automatic',
});

const tmp = new URL('./.rich-text.bundle.mjs', import.meta.url);
await writeFile(tmp, out.outputFiles[0].text);
const mod = await import(tmp.href);
await rm(tmp);

const sample = `Berikut rekomendasi lemari pakaian **3 pintu** dari katalog AGM:

- **Lemari Pakaian Sleding ACP** - Rp 2.450.000 - stok 4
- **Lemari Pakaian Stiker Premium** - Rp 3.100.000 - stok 2

Ukuran standar 150 x 55 x 190 cm dan bisa disesuaikan per cm.

Ada lagi yang bisa dibantu?`;

const html = renderToStaticMarkup(createElement(mod.AIRichText, { text: sample }));

assert.ok(html.includes('<strong'), 'tebal tidak dirender');
assert.ok(html.includes('p-2') || html.includes('li'), 'daftar tidak dirender');
assert.strictEqual((html.match(/\*/g) || []).length, 0, 'masih ada tanda bintang mentah');
assert.ok(!html.includes('&lt;'), 'ada karakter escape tak terduga');

// Baris kosong di tengah daftar tidak boleh memutus penomoran
const listHtml = renderToStaticMarkup(
  createElement(mod.AIRichText, { text: '1. Satu\n\n2. Dua\n3. Tiga' })
);
assert.strictEqual((listHtml.match(/<li/g) || []).length, 3, 'penomoran terputus');
assert.ok(listHtml.includes('3.'), 'nomor ketiga hilang');

console.log('OK: rich text bersih, tebal & daftar terender, tidak ada bintang mentah');
