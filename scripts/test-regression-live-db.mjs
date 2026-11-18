// scripts/test-regression-live-db.mjs
// Regression test against real Supabase database products for AGM Assistant

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  classifyUserIntent,
  mergeConversationContext,
  filterAndRankCatalogProducts,
  generateGroundedResponse,
  isOutOfScopeProduct
} from '../api/ai/intelligence.ts';

// Read .env for live Supabase credentials
const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const envMap = Object.fromEntries(
  envContent
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const supabaseUrl = envMap.VITE_SUPABASE_URL || envMap.SUPABASE_URL;
const supabaseKey = envMap.SUPABASE_WORKER_KEY || envMap.VITE_SUPABASE_ANON_KEY;

console.log('=== AGM Assistant Regression Tests with Live Supabase Data ===\n');

async function fetchLiveProducts() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not found in .env; skipping live fetch.');
    return [];
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/products?select=id,name,category,subcategory,description,price,discount,stock,unit,arrival_type,image_url,images&limit=100`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch products from Supabase: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.map(p => ({
    id: p.id,
    name: p.name || '',
    category: p.category || '',
    subcategory: p.subcategory || '',
    description: p.description || '',
    price: Number(p.price) || 0,
    discount: Number(p.discount) || 0,
    final_price: Math.max(0, (Number(p.price) || 0) - (Number(p.discount) || 0)),
    stock: Number(p.stock) || 0,
    unit: p.unit || 'Pcs',
    arrival_type: p.arrival_type || '',
    image_url: p.image_url || (Array.isArray(p.images) && p.images[0]) || '',
    images: Array.isArray(p.images) ? p.images : []
  }));
}

const liveProducts = await fetchLiveProducts();
console.log(`Loaded ${liveProducts.length} live products from Supabase.\n`);

let conversationContext = undefined;

// Case 1: "Rekomendasi lemari."
console.log('--- Case 1: "Rekomendasi lemari." ---');
const intent1 = classifyUserIntent('Rekomendasi lemari.', conversationContext);
conversationContext = mergeConversationContext(conversationContext, 'Rekomendasi lemari.', intent1);
const res1 = filterAndRankCatalogProducts(liveProducts, conversationContext.constraints);
const answer1 = generateGroundedResponse(intent1, res1, conversationContext.constraints, conversationContext);

console.log(`Intent: ${intent1}`);
console.log(`Found: ${res1.matchedProducts.length} items`);
console.log(`Sample recommendation:\n${answer1.slice(0, 320)}...\n`);
assert.equal(intent1, 'product_recommendation');
assert(res1.matchedProducts.length > 0, 'Must find wardrobe products');
assert(!answer1.includes('Berikut informasi Toko AGM Padang:\n\n- **Lokasi Showroom**'), 'Must NOT return showroom blurb');
assert(answer1.includes('Lemari') || answer1.includes('lemari'), 'Must recommend wardrobe');

// Case 2: "Rekomendasi lemari di bawah 1,5 juta."
console.log('--- Case 2: "Rekomendasi lemari di bawah 1,5 juta." ---');
const intent2 = classifyUserIntent('Rekomendasi lemari di bawah 1,5 juta.', conversationContext);
conversationContext = mergeConversationContext(conversationContext, 'Rekomendasi lemari di bawah 1,5 juta.', intent2);
const res2 = filterAndRankCatalogProducts(liveProducts, conversationContext.constraints);
const answer2 = generateGroundedResponse(intent2, res2, conversationContext.constraints, conversationContext);

console.log(`Intent: ${intent2}`);
console.log(`Ceiling budget: Rp ${conversationContext.constraints.maxPrice}`);
console.log(`Matched within budget: ${res2.matchedProducts.length} items`);
for (const p of res2.matchedProducts.slice(0, 3)) {
  console.log(`  - ${p.name} | Rp ${p.final_price} | stock: ${p.stock}`);
}
console.log(`Response snippet:\n${answer2.slice(0, 320)}...\n`);
assert.equal(intent2, 'product_recommendation');
assert.equal(conversationContext.constraints.maxPrice, 1500000);
assert(!answer2.includes('Berikut informasi Toko AGM Padang:\n\n- **Lokasi Showroom**'), 'Must NOT hijack with showroom info!');
for (const p of res2.matchedProducts) {
  assert(p.final_price <= 1500000, `Item ${p.name} price ${p.final_price} exceeds 1.5M budget ceiling`);
}

// Case 3: Follow-up "Yang dua pintu."
console.log('--- Case 3: Follow-up "Yang dua pintu." ---');
const intent3 = classifyUserIntent('Yang dua pintu.', conversationContext);
conversationContext = mergeConversationContext(conversationContext, 'Yang dua pintu.', intent3);
const res3 = filterAndRankCatalogProducts(liveProducts, conversationContext.constraints);
const answer3 = generateGroundedResponse(intent3, res3, conversationContext.constraints, conversationContext);

console.log(`Intent: ${intent3}`);
console.log(`Context retained: subcategory=${conversationContext.constraints.subcategory}, maxPrice=${conversationContext.constraints.maxPrice}, doors=${conversationContext.constraints.doors}`);
console.log(`Matched: ${res3.matchedProducts.length} items (unmet: ${res3.unmetConstraint})`);
console.log(`Response snippet:\n${answer3.slice(0, 320)}...\n`);
assert.equal(conversationContext.constraints.doors, 2);
assert.equal(conversationContext.constraints.maxPrice, 1500000);
assert(!answer3.includes('Berikut informasi Toko AGM Padang:\n\n- **Lokasi Showroom**'), 'Must NOT return showroom blurb');

// Case 4: "Bahan ACP saja."
console.log('--- Case 4: "Bahan ACP saja." ---');
const intent4 = classifyUserIntent('Bahan ACP saja.', conversationContext);
conversationContext = mergeConversationContext(conversationContext, 'Bahan ACP saja.', intent4);
const res4 = filterAndRankCatalogProducts(liveProducts, conversationContext.constraints);
const answer4 = generateGroundedResponse(intent4, res4, conversationContext.constraints, conversationContext);

console.log(`Context material: ${conversationContext.constraints.material}`);
console.log(`Response snippet:\n${answer4.slice(0, 320)}...\n`);
assert.equal(conversationContext.constraints.material, 'acp');
assert(!answer4.includes('Berikut informasi Toko AGM Padang:\n\n- **Lokasi Showroom**'), 'Must NOT return showroom blurb');

// Case 5: "Ada warna putih?"
console.log('--- Case 5: "Ada warna putih?" ---');
const intent5 = classifyUserIntent('Ada warna putih?', conversationContext);
conversationContext = mergeConversationContext(conversationContext, 'Ada warna putih?', intent5);
const res5 = filterAndRankCatalogProducts(liveProducts, conversationContext.constraints);
const answer5 = generateGroundedResponse(intent5, res5, conversationContext.constraints, conversationContext);

console.log(`Intent: ${intent5}`);
console.log(`Response snippet:\n${answer5.slice(0, 320)}...\n`);
assert.equal(intent5, 'color_inquiry');
assert(answer5.includes('putih'), 'Should address white color');

// Case 6: "Berapa stoknya?"
console.log('--- Case 6: "Berapa stoknya?" ---');
const intent6 = classifyUserIntent('Berapa stoknya?', conversationContext);
// Provide a known item to inspect
const testItem = liveProducts.find(p => p.name.toLowerCase().includes('lemari') && p.stock > 0) || liveProducts[0];
const res6 = { matchedProducts: [testItem] };
const answer6 = generateGroundedResponse(intent6, res6, conversationContext.constraints, conversationContext);

console.log(`Intent: ${intent6}`);
console.log(`Checked product: ${testItem.name} | Real stock: ${testItem.stock}`);
console.log(`Response snippet:\n${answer6.slice(0, 320)}...\n`);
assert.equal(intent6, 'stock_inquiry');
assert(answer6.includes(String(testItem.stock)), `Response must state actual stock (${testItem.stock})`);

// Case 7: "Di mana showroom AGM?"
console.log('--- Case 7: "Di mana showroom AGM?" ---');
const intent7 = classifyUserIntent('Di mana showroom AGM?', undefined);
const res7 = { matchedProducts: [], filteredOutCount: 0, reasoning: '', isBudgetConstrained: false, closestAlternatives: [], unmetConstraint: 'none' };
const answer7 = generateGroundedResponse(intent7, res7, {}, undefined);

console.log(`Intent: ${intent7}`);
console.log(`Response snippet:\n${answer7.slice(0, 320)}...\n`);
assert.equal(intent7, 'showroom_info');
assert(answer7.includes('Kota Padang, Sumatera Barat'));
assert(answer7.includes('0896-9412-7723'));
assert(!answer7.includes('```json_product_recommendations'), 'Showroom inquiry must NOT include product cards');

// Case 8: An unknown product question ("Apakah ada kasur busa inoac atau sofa kulit?")
console.log('--- Case 8: Unknown / Out of Scope Product ---');
const outOfScope = isOutOfScopeProduct('Apakah ada kasur busa inoac atau sofa kulit?');
const intent8 = classifyUserIntent('Apakah ada kasur busa inoac atau sofa kulit?', undefined);
const answer8 = generateGroundedResponse(intent8, { matchedProducts: [] }, {}, undefined);

console.log(`Detected out-of-scope term: ${outOfScope}`);
console.log(`Intent: ${intent8}`);
console.log(`Response snippet:\n${answer8.slice(0, 320)}...\n`);
assert.equal(intent8, 'out_of_scope');
assert(answer8.includes('Mohon maaf'));
assert(answer8.includes('aluminium, kaca, dan panel ACP'));

console.log('=== ALL 8 REGRESSION TESTS WITH LIVE DATABASE DATA PASSED! ===');
