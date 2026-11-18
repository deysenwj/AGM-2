// scripts/test-ai-intelligence.mjs
// Verification test suite for AGM Assistant AI Intelligence & Retrieval Engine

import assert from 'node:assert/strict';
import {
  parseIndonesianCurrency,
  parseDoorCount,
  parseMaterial,
  parseColor,
  classifyUserIntent,
  extractConstraintsFromMessage,
  mergeConversationContext,
  filterAndRankCatalogProducts,
  generateGroundedResponse,
  isOutOfScopeProduct
} from '../api/ai/intelligence.ts';

console.log('--- Starting AGM Assistant Intelligence Unit Tests ---');

// Mock catalog representing real Supabase items
const MOCK_CATALOG = [
  {
    id: '1',
    name: 'Lemari pakaian 2 pt sleding oval',
    category: 'furniture',
    subcategory: 'Lemari pakaian',
    description: 'Bahan alumunium acp',
    price: 2600000,
    discount: 100000,
    stock: 1,
    unit: 'Pcs',
    image_url: 'https://example.com/img1.jpg'
  },
  {
    id: '2',
    name: 'Lemari kaca',
    category: 'furniture',
    subcategory: 'Lemari pakaian',
    description: 'Barang kaca',
    price: 1550000,
    discount: 50000,
    stock: 1,
    unit: 'Pcs',
    image_url: 'https://example.com/img2.jpg'
  },
  {
    id: '3',
    name: 'Lemari pajang 1 pintu +lampu',
    category: 'furniture',
    subcategory: 'Lemari pajang',
    description: 'Barang kaca',
    price: 1120000,
    discount: 50000,
    stock: 1,
    unit: 'Pcs',
    image_url: 'https://example.com/img3.jpg'
  },
  {
    id: '4',
    name: 'Lemari acp 2 pintu sleding UK 120',
    category: 'furniture',
    subcategory: 'Lemari pakaian',
    description: 'Kaca acp UK 120',
    price: 2900000,
    discount: 100000,
    stock: 2,
    unit: 'Pcs',
    image_url: 'https://example.com/img4.jpg'
  },
  {
    id: '5',
    name: 'Lemari pakaian 3 pt acp',
    category: 'furniture',
    subcategory: 'Lemari pakaian',
    description: 'Bahan alumunium acp',
    price: 2500000,
    discount: 80000,
    stock: 1,
    unit: 'Pcs',
    image_url: 'https://example.com/img5.jpg'
  },
  {
    id: '6',
    name: 'Meja kompor type u tanpa box',
    category: 'furniture',
    subcategory: 'Meja kompor',
    description: 'Barang kaca',
    price: 1850000,
    discount: 60000,
    stock: 1,
    unit: 'Pcs',
    image_url: 'https://example.com/img6.jpg'
  },
  {
    id: '7',
    name: 'Kitchen set 5 pintu kompor tanam',
    category: 'furniture',
    subcategory: 'Kitchen set',
    description: 'Bahan acp aluminium',
    price: 3500000,
    discount: 200000,
    stock: 1,
    unit: 'Pcs',
    image_url: 'https://example.com/img7.jpg'
  }
];

// Test 1: Indonesian Currency Parsing
console.log('Test 1: Indonesian Currency Parsing');
assert.equal(parseIndonesianCurrency('rekomendasi lemari di bawah 1,5 juta').maxPrice, 1500000);
assert.equal(parseIndonesianCurrency('budget 1.5jt').maxPrice, 1500000);
assert.equal(parseIndonesianCurrency('maksimal 2 juta').maxPrice, 2000000);
assert.equal(parseIndonesianCurrency('di bawah 500 rb').maxPrice, 500000);
assert.equal(parseIndonesianCurrency('budget 1.500.000').maxPrice, 1500000);
console.log('✓ Currency parsing passed');

// Test 2: Door count & Attribute parsing
console.log('Test 2: Attribute Parsing');
assert.equal(parseDoorCount('yang 2 pintu saja'), 2);
assert.equal(parseDoorCount('lemari tiga pintu'), 3);
assert.equal(parseDoorCount('meja prasmanan 4 pt'), 4);
assert.equal(parseMaterial('bahan acp saja'), 'acp');
assert.equal(parseMaterial('saya cari yang kaca'), 'kaca');
assert.equal(parseColor('ada warna putih?'), 'putih');
console.log('✓ Attribute parsing passed');

// Test 3: Intent Classification
console.log('Test 3: Intent Classification');
// Showroom should trigger ONLY when no product words
assert.equal(classifyUserIntent('lokasi showroom agm dimana?'), 'showroom_info');
assert.equal(classifyUserIntent('alamat toko agm'), 'showroom_info');
// Budget query with "di bawah 1,5 juta" must NOT be showroom info!
assert.notEqual(classifyUserIntent('rekomendasi lemari di bawah 1,5 juta'), 'showroom_info');
assert.equal(classifyUserIntent('rekomendasi lemari di bawah 1,5 juta'), 'product_recommendation');
assert.equal(classifyUserIntent('apa perbedaan acp dan kaca?'), 'material_comparison');
assert.equal(classifyUserIntent('jam operasional toko buka jam berapa?'), 'operating_hours');
assert.equal(classifyUserIntent('apakah ada kasur busa atau sofa?'), 'out_of_scope');
console.log('✓ Intent classification passed');

// Test 4: Scenario "rekomendasi lemari"
console.log('Test 4: Scenario "rekomendasi lemari"');
const c4 = extractConstraintsFromMessage('rekomendasi lemari');
const res4 = filterAndRankCatalogProducts(MOCK_CATALOG, c4);
assert(res4.matchedProducts.length > 0, 'Should find wardrobe products');
assert(res4.matchedProducts.some(p => p.name.toLowerCase().includes('lemari')));
const text4 = generateGroundedResponse('product_recommendation', res4, c4);
assert(text4.includes('Lemari'), 'Response should mention Lemari');
assert(!text4.includes('Berikut informasi Toko AGM Padang'), 'Must not reply with showroom blurb');
console.log('✓ Scenario 4 passed');

// Test 5: Scenario "rekomendasi lemari di bawah 1,5 juta"
console.log('Test 5: Scenario "rekomendasi lemari di bawah 1,5 juta"');
const c5 = extractConstraintsFromMessage('rekomendasi lemari di bawah 1,5 juta');
assert.equal(c5.maxPrice, 1500000);
const res5 = filterAndRankCatalogProducts(MOCK_CATALOG, c5);
assert(res5.matchedProducts.length > 0, 'Should match Lemari kaca <= 1.5M');
assert(res5.matchedProducts.every(p => (p.final_price || 0) <= 1500000), 'All matched items must be <= 1.5M');
const text5 = generateGroundedResponse('product_recommendation', res5, c5);
assert(text5.includes('Lemari kaca') || text5.includes('Lemari pajang'), 'Should recommend product within budget');
assert(!text5.includes('Berikut informasi Toko AGM Padang:\n\n- **Lokasi Showroom**'), 'Must NOT return showroom blurb');
console.log('✓ Scenario 5 passed');

// Test 6: Multi-turn Follow-up: Turn 1 "rekomendasi lemari" -> Turn 2 "Di bawah 1,5 juta"
console.log('Test 6: Multi-turn follow-up budget');
const ctx1 = mergeConversationContext(undefined, 'rekomendasi lemari', 'product_recommendation');
assert.equal(ctx1.constraints.subcategory, 'lemari');
const ctx2 = mergeConversationContext(ctx1, 'Di bawah 1,5 juta', 'product_recommendation');
assert.equal(ctx2.constraints.subcategory, 'lemari', 'Context must preserve lemari subcategory');
assert.equal(ctx2.constraints.maxPrice, 1500000, 'Context must retain budget');
const res6 = filterAndRankCatalogProducts(MOCK_CATALOG, ctx2.constraints);
assert(res6.matchedProducts.every(p => (p.final_price || 0) <= 1500000));
console.log('✓ Scenario 6 passed');

// Test 7: Multi-turn Follow-up: Turn 3 "Yang dua pintu"
console.log('Test 7: Multi-turn follow-up doors');
const ctx3 = mergeConversationContext(ctx2, 'Yang dua pintu', 'product_recommendation');
assert.equal(ctx3.constraints.doors, 2);
assert.equal(ctx3.constraints.maxPrice, 1500000);
const res7 = filterAndRankCatalogProducts(MOCK_CATALOG, ctx3.constraints);
// In mock, 2 door items: Lemari pakaian 2 pt sleding oval (final 2.5M), Lemari acp 2 pt (final 2.8M)
// Neither is <= 1.5M, so res7.matchedProducts should be empty and unmetConstraint === 'budget'
assert.equal(res7.unmetConstraint, 'budget');
assert(res7.closestAlternatives.length > 0);
const text7 = generateGroundedResponse('product_recommendation', res7, ctx3.constraints);
assert(text7.includes('di atas **Rp 1.500.000**') || text7.includes('custom'), 'Must honestly explain budget ceiling and offer custom');
console.log('✓ Scenario 7 passed');

// Test 8: "Bahan ACP saja"
console.log('Test 8: Material filtering');
const c8 = extractConstraintsFromMessage('rekomendasi lemari pakaian bahan acp saja');
assert.equal(c8.material, 'acp');
const res8 = filterAndRankCatalogProducts(MOCK_CATALOG, c8);
assert(res8.matchedProducts.length > 0);
assert(res8.matchedProducts.every(p => p.description.toLowerCase().includes('acp') || p.name.toLowerCase().includes('acp')));
console.log('✓ Scenario 8 passed');

// Test 9: Real inventory count (Berapa stoknya?)
console.log('Test 9: Real inventory count');
const intent9 = classifyUserIntent('Berapa stoknya?');
assert.equal(intent9, 'stock_inquiry');
const text9 = generateGroundedResponse('stock_inquiry', { matchedProducts: [MOCK_CATALOG[3]] }, {});
assert(text9.includes('ready stock sebanyak **2 Pcs**') || text9.includes('2 Pcs'));
console.log('✓ Scenario 9 passed');

// Test 10: Showroom location
console.log('Test 10: Showroom location inquiry');
const intent10 = classifyUserIntent('Lokasi showroom AGM dimana?');
assert.equal(intent10, 'showroom_info');
const text10 = generateGroundedResponse('showroom_info', { matchedProducts: [] }, {});
assert(text10.includes('Kota Padang, Sumatera Barat'));
assert(!text10.includes('```json_product_recommendations'));
console.log('✓ Scenario 10 passed');

// Test 11: Out of scope product (sofa / kasur)
console.log('Test 11: Out of scope product');
const outProduct = isOutOfScopeProduct('rekomendasi sofa santai');
assert.equal(outProduct, 'sofa');
const intent11 = classifyUserIntent('rekomendasi sofa santai');
assert.equal(intent11, 'out_of_scope');
const text11 = generateGroundedResponse('out_of_scope', { matchedProducts: [] }, {});
assert(text11.includes('Mohon maaf'));
assert(text11.includes('aluminium, kaca, dan panel ACP'));
console.log('✓ Scenario 11 passed');

// Test 12: Topic reset on topic change
console.log('Test 12: Topic reset');
const ctxKitchen = mergeConversationContext(ctx3, 'Ganti topik, saya mau cari kitchen set', 'product_recommendation');
assert.equal(ctxKitchen.constraints.subcategory, 'Kitchen set');
assert.equal(ctxKitchen.constraints.doors, undefined, 'Doors should be reset for new category');
assert.equal(ctxKitchen.constraints.maxPrice, undefined, 'Old budget should be reset');
console.log('✓ Scenario 12 passed');

console.log('--- ALL 12 TESTS PASSED SUCCESSFULLY! ---');
