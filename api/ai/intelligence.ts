// api/ai/intelligence.ts
// AGM Assistant - Domain Intelligence, Reasoning, and Constraint-Aware Retrieval Engine

export interface CatalogProduct {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  description?: string;
  price?: number;
  discount?: number;
  final_price?: number;
  stock?: number;
  unit?: string;
  arrival_type?: string;
  image_url?: string;
  images?: string[];
  created_at?: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ExtractedConstraints {
  category?: string;
  subcategory?: string;
  maxPrice?: number;
  minPrice?: number;
  doors?: number;
  doorType?: 'sliding' | 'swing';
  material?: 'acp' | 'kaca' | 'aluminium' | 'keramik' | 'kayu';
  color?: string;
  hasMirror?: boolean;
  isCustomRequest?: boolean;
  isStockInquiry?: boolean;
  isColorInquiry?: boolean;
  isDimensionInquiry?: boolean;
  rawKeywords: string[];
}

export type UserIntent =
  | 'showroom_info'
  | 'operating_hours'
  | 'shipping_policy'
  | 'contact_info'
  | 'material_comparison'
  | 'material_inquiry'
  | 'product_recommendation'
  | 'product_search'
  | 'price_inquiry'
  | 'stock_inquiry'
  | 'color_inquiry'
  | 'custom_furniture'
  | 'greeting'
  | 'category_overview'
  | 'out_of_scope'
  | 'general_consultation';

export interface ConversationContext {
  lastIntent?: UserIntent;
  constraints: ExtractedConstraints;
  lastRecommendedProducts?: CatalogProduct[];
  activeTopic?: string;
}

// -----------------------------------------------------------------------------
// 1. Indonesian Currency & Budget Parsing
// -----------------------------------------------------------------------------

export function parseIndonesianCurrency(text: string): { maxPrice?: number; minPrice?: number } {
  const clean = text.toLowerCase().replace(/rp\.?/g, 'rp ').trim();
  let maxPrice: number | undefined;
  let minPrice: number | undefined;

  // Patterns for number with "juta" or "jt": e.g. "1,5 juta", "1.5 jt", "2 juta", "1 jt"
  const parseJuta = (valStr: string): number => {
    const normalized = valStr.replace(',', '.').trim();
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : Math.round(num * 1_000_000);
  };

  // Patterns for number with "ribu" or "rb" or "k": e.g. "500 rb", "500k", "750 ribu"
  const parseRibu = (valStr: string): number => {
    const normalized = valStr.replace(',', '.').trim();
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : Math.round(num * 1_000);
  };

  // Pattern: "di bawah X" / "kurang dari X" / "maksimal X" / "max X" / "budget X" / "mentok X"
  const belowPatterns = [
    /(?:di\s*bawah|dibawah|kurang\s*dari|maksimal|maks|max|budget|mentok|paling\s*mahal|sampai|hingga)\s*(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/i,
    /(?:di\s*bawah|dibawah|kurang\s*dari|maksimal|maks|max|budget|mentok|paling\s*mahal|sampai|hingga)\s*(?:rp\s*)?(\d{1,3}(?:\.\d{3})+|\d{5,8})\b/i,
    /(?:di\s*bawah|dibawah|kurang\s*dari|maksimal|maks|max|budget|mentok|paling\s*mahal|sampai|hingga)\s*(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(?:ribu|rb|k)\b/i,
  ];

  for (const pat of belowPatterns) {
    const m = clean.match(pat);
    if (m) {
      if (pat.source.includes('juta|jt')) {
        maxPrice = parseJuta(m[1]);
      } else if (pat.source.includes('ribu|rb|k')) {
        maxPrice = parseRibu(m[1]);
      } else {
        const rawDigits = m[1].replace(/\./g, '');
        const val = parseInt(rawDigits, 10);
        if (!isNaN(val) && val > 0) maxPrice = val;
      }
      break;
    }
  }

  // Pattern: "di atas X" / "lebih dari X" / "minimal X" / "min X" / "mulai dari X"
  const abovePatterns = [
    /(?:di\s*atas|diatas|lebih\s*dari|minimal|min|mulai\s*dari|paling\s*murah)\s*(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/i,
    /(?:di\s*atas|diatas|lebih\s*dari|minimal|min|mulai\s*dari|paling\s*murah)\s*(?:rp\s*)?(\d{1,3}(?:\.\d{3})+|\d{5,8})\b/i,
  ];

  for (const pat of abovePatterns) {
    const m = clean.match(pat);
    if (m) {
      if (pat.source.includes('juta|jt')) {
        minPrice = parseJuta(m[1]);
      } else {
        const rawDigits = m[1].replace(/\./g, '');
        const val = parseInt(rawDigits, 10);
        if (!isNaN(val) && val > 0) minPrice = val;
      }
      break;
    }
  }

  // If no explicit "di bawah" pattern was found, but a bare price phrase exists like "1,5 juta" or "budget 1,5jt":
  if (maxPrice === undefined && minPrice === undefined) {
    const bareJuta = clean.match(/\b(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/i);
    if (bareJuta) {
      // By default a bare single budget mention is treated as ceiling budget (maxPrice)
      maxPrice = parseJuta(bareJuta[1]);
    } else {
      const bareRupiah = clean.match(/(?:rp\.?\s*)(\d{1,3}(?:\.\d{3})+|\d{6,8})\b/i);
      if (bareRupiah) {
        const val = parseInt(bareRupiah[1].replace(/\./g, ''), 10);
        if (!isNaN(val) && val > 0) maxPrice = val;
      }
    }
  }

  return { maxPrice, minPrice };
}

// -----------------------------------------------------------------------------
// 2. Door Count, Material, and Attribute Extraction
// -----------------------------------------------------------------------------

export function parseDoorCount(text: string): number | undefined {
  const clean = text.toLowerCase();
  if (/\b(?:1|satu)\s*(?:pintu|pt)\b/i.test(clean)) return 1;
  if (/\b(?:2|dua)\s*(?:pintu|pt)\b/i.test(clean)) return 2;
  if (/\b(?:3|tiga)\s*(?:pintu|pt)\b/i.test(clean)) return 3;
  if (/\b(?:4|empat)\s*(?:pintu|pt)\b/i.test(clean)) return 4;
  if (/\b(?:5|lima)\s*(?:pintu|pt)\b/i.test(clean)) return 5;
  if (/\b(?:6|enam)\s*(?:pintu|pt)\b/i.test(clean)) return 6;
  if (/\b(?:8|delapan)\s*(?:pintu|pt)\b/i.test(clean)) return 8;
  return undefined;
}

export function parseMaterial(text: string): 'acp' | 'kaca' | 'aluminium' | 'keramik' | 'kayu' | undefined {
  const clean = text.toLowerCase();
  // Check exact material mentions
  if (/\bacp\b|aluminium composite/i.test(clean)) return 'acp';
  if (/\bkaca\b|cermin|riben/i.test(clean)) return 'kaca';
  if (/\bkeramik\b|porselen|proslen/i.test(clean)) return 'keramik';
  if (/\balum[i|u]nium\b/i.test(clean)) return 'aluminium';
  if (/\bkayu\b|triplek|mdf|partikel/i.test(clean)) return 'kayu';
  return undefined;
}

export function parseColor(text: string): string | undefined {
  const clean = text.toLowerCase();
  const colors = ['putih', 'hitam', 'silver', 'coklat', 'abu', 'gold', 'merah'];
  for (const c of colors) {
    if (new RegExp(`\\b${c}\\b`, 'i').test(clean)) {
      return c;
    }
  }
  if (/motif kayu|serat kayu/i.test(clean)) return 'motif kayu';
  return undefined;
}

export function parseCategoryOrSubcategory(text: string): { category?: string; subcategory?: string } {
  const clean = text.toLowerCase();

  if (/lemari pakaian|lemari baju|wardrobe|almari/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Lemari pakaian' };
  }
  if (/lemari pajang|lemari hias|lemari kristal/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Lemari pajang' };
  }
  if (/rak piring|lemari piring|wastafel|westafel/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Lemari rak piring' };
  }
  if (/lemari dapur/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Lemari Dapur' };
  }
  if (/lemari sepatu|rak sepatu/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Lemari Sepatu' };
  }
  if (/rak kaca|tupperware|taperwer/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Lemari rak kaca' };
  }
  if (/lemari/i.test(clean)) {
    // Generic lemari
    return { category: 'furniture', subcategory: 'lemari' };
  }
  if (/meja kompor|kompor tanam|kompor gas/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Meja kompor' };
  }
  if (/meja prasmanan|prasmanan|meja katering/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Meja prasmanan' };
  }
  if (/kitchen set|kichen set|dapur set/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Kitchen set' };
  }
  if (/bopet|buffet|bufet|meja tv|backdrop tv/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Meja tv' };
  }
  if (/etalase/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Etalase' };
  }
  if (/meja rias/i.test(clean)) {
    return { category: 'furniture', subcategory: 'Meja rias' };
  }

  return {};
}

// -----------------------------------------------------------------------------
// 3. Out-Of-Scope Product Detector
// -----------------------------------------------------------------------------

const OUT_OF_SCOPE_PRODUCTS = [
  'sofa', 'kasur', 'springbed', 'spring bed', 'busa',
  'kulkas', 'lemari es', 'mesin cuci', 'ac split', 'televisi', 'tv led',
  'kursi gaming', 'kursi kantor hidrolik', 'meja lipat kayu', 'sepeda'
];

export function isOutOfScopeProduct(text: string): string | null {
  const clean = text.toLowerCase();
  for (const item of OUT_OF_SCOPE_PRODUCTS) {
    if (new RegExp(`\\b${item}\\b`, 'i').test(clean)) {
      return item;
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// 4. Intent Classification Engine
// -----------------------------------------------------------------------------

export function classifyUserIntent(
  userMessage: string,
  context?: ConversationContext
): UserIntent {
  const clean = userMessage.toLowerCase().trim();

  // Out of scope check
  if (isOutOfScopeProduct(clean)) {
    return 'out_of_scope';
  }

  // Pure Showroom / Location Intent: must NOT contain product inquiry words
  const hasShowroomWords = /showroom|lokasi toko|alamat toko|alamat agm|toko di mana|dimana toko|alamat fisik/i.test(clean);
  const hasProductWords = /rekomendasi|lemari|meja|rak|kitchen|harga|stok|beli|pesan|juta|budget|acp|kaca/i.test(clean);
  if (hasShowroomWords && !hasProductWords) {
    return 'showroom_info';
  }

  // Operating Hours
  if (/jam berapa buka|jam buka|buka jam|jam operasional|tutup jam berapa|hari apa buka/i.test(clean)) {
    return 'operating_hours';
  }

  // Shipping policy
  if (/ongkir|ongkos kirim|bisa kirim ke|pengiriman ke|kirim luar kota|area pengiriman/i.test(clean) && !hasProductWords) {
    return 'shipping_policy';
  }

  // Material comparison / education
  if (/perbedaan\s+(?:acp|kaca|aluminium|kayu)|bedanya\s+(?:acp|kaca|aluminium)|bagus\s+(?:mana|acp|kaca)|keunggulan\s+(?:acp|aluminium)|kenapa\s+aluminium/i.test(clean)) {
    return 'material_comparison';
  }

  // Greeting
  if (/^(halo|hai|hi|assalamu['a]?laikum|pagi|siang|sore|malam)$/i.test(clean) ||
      /^(halo|hai|hi)\s+admin\b/i.test(clean)) {
    return 'greeting';
  }

  // Category overview
  if (/kategori apa saja|ada apa saja|daftar produk|semua produk|jual apa saja/i.test(clean)) {
    return 'category_overview';
  }

  // Stock inquiry
  if (/berapa stok(?:nya)?|stoknya berapa|ready berapa|masih ada stok|sisa berapa unit/i.test(clean)) {
    return 'stock_inquiry';
  }

  // Color inquiry
  if (/ada warna apa|ada warna putih|pilihan warna|tersedia warna apa/i.test(clean)) {
    return 'color_inquiry';
  }

  // Custom furniture request
  if (/bisa custom|custom ukuran|pesan ukuran khusus|rancang ukuran|bisa dibikinkan/i.test(clean)) {
    return 'custom_furniture';
  }

  // Price inquiry
  if (/berapa harganya|harganya berapa|kisaran harga|daftar harga/i.test(clean)) {
    return 'price_inquiry';
  }

  // If message contains budget, door count, material, or category -> product recommendation/search
  const currency = parseIndonesianCurrency(clean);
  const doors = parseDoorCount(clean);
  const mat = parseMaterial(clean);
  const cat = parseCategoryOrSubcategory(clean);

  if (currency.maxPrice || currency.minPrice || doors || mat || cat.subcategory || /rekomendasi|cari|pilihkan/i.test(clean)) {
    return 'product_recommendation';
  }

  // Context follow-up check: if user message is short and we have prior recommendation context
  if (context?.constraints?.category || context?.constraints?.subcategory) {
    if (/yang|warna|pintu|acp|kaca|murah|mahal|diskon|budget|juta/i.test(clean)) {
      return 'product_recommendation';
    }
  }

  return 'general_consultation';
}

// -----------------------------------------------------------------------------
// 5. Context Extraction & Multi-Turn Carry-Over
// -----------------------------------------------------------------------------

export function extractConstraintsFromMessage(message: string): ExtractedConstraints {
  const currency = parseIndonesianCurrency(message);
  const doors = parseDoorCount(message);
  const doorType = /sliding|sleding|geser/i.test(message) ? 'sliding' : /swing|engsel/i.test(message) ? 'swing' : undefined;
  const material = parseMaterial(message);
  const color = parseColor(message);
  const cat = parseCategoryOrSubcategory(message);
  const isStockInquiry = /stok|stock|unit/i.test(message);
  const isColorInquiry = /warna/i.test(message);
  const isDimensionInquiry = /ukuran|dimensi|panjang|lebar|tinggi|cm/i.test(message);
  const isCustomRequest = /custom|pesan khusus|ukuran khusus/i.test(message);

  return {
    category: cat.category,
    subcategory: cat.subcategory,
    maxPrice: currency.maxPrice,
    minPrice: currency.minPrice,
    doors,
    doorType,
    material,
    color,
    isStockInquiry,
    isColorInquiry,
    isDimensionInquiry,
    isCustomRequest,
    rawKeywords: message.toLowerCase().split(/\s+/).filter(w => w.length > 2),
  };
}

export function mergeConversationContext(
  existingContext: ConversationContext | undefined,
  newMessage: string,
  newIntent: UserIntent
): ConversationContext {
  const current = extractConstraintsFromMessage(newMessage);
  const prev = existingContext?.constraints || { rawKeywords: [] };

  // Detect topic reset (e.g. user completely switches from lemari to kitchen set)
  const isTopicSwitch =
    (current.subcategory && prev.subcategory && current.subcategory !== prev.subcategory && current.subcategory !== 'lemari') ||
    /ganti topik|cari yang lain|bukan itu|selain itu/i.test(newMessage);

  if (isTopicSwitch) {
    return {
      lastIntent: newIntent,
      constraints: current,
      activeTopic: current.subcategory || current.category,
    };
  }

  // Merge constraints incrementally (carry-over)
  const merged: ExtractedConstraints = {
    category: current.category || prev.category,
    subcategory: current.subcategory || prev.subcategory,
    maxPrice: current.maxPrice !== undefined ? current.maxPrice : prev.maxPrice,
    minPrice: current.minPrice !== undefined ? current.minPrice : prev.minPrice,
    doors: current.doors !== undefined ? current.doors : prev.doors,
    doorType: current.doorType || prev.doorType,
    material: current.material || prev.material,
    color: current.color || prev.color,
    hasMirror: current.hasMirror !== undefined ? current.hasMirror : prev.hasMirror,
    isCustomRequest: current.isCustomRequest || prev.isCustomRequest,
    isStockInquiry: current.isStockInquiry,
    isColorInquiry: current.isColorInquiry,
    isDimensionInquiry: current.isDimensionInquiry,
    rawKeywords: [...prev.rawKeywords, ...current.rawKeywords].slice(-20),
  };

  return {
    lastIntent: newIntent,
    constraints: merged,
    activeTopic: merged.subcategory || merged.category,
  };
}

// -----------------------------------------------------------------------------
// 6. Structured Catalog Filtering & Ranking Engine
// -----------------------------------------------------------------------------

export interface FilterResult {
  matchedProducts: CatalogProduct[];
  filteredOutCount: number;
  reasoning: string;
  isBudgetConstrained: boolean;
  budgetCeiling?: number;
  unmetConstraint?: 'budget' | 'doors' | 'material' | 'category' | 'none';
  closestAlternatives: CatalogProduct[];
}

export function filterAndRankCatalogProducts(
  products: CatalogProduct[],
  constraints: ExtractedConstraints
): FilterResult {
  const validProducts = products.filter(p => p.name && p.name.trim() !== '-');

  const { maxPrice, minPrice, doors, doorType, material, color, subcategory } = constraints;
  const isBudgetConstrained = maxPrice !== undefined || minPrice !== undefined;

  const matches: CatalogProduct[] = [];
  const alternatives: CatalogProduct[] = [];

  for (const p of validProducts) {
    const pName = (p.name || '').toLowerCase();
    const pSubcat = (p.subcategory || p.category || '').toLowerCase();
    const pDesc = (p.description || '').toLowerCase();
    const searchable = `${pName} ${pSubcat} ${pDesc}`;

    const rawPrice = Number(p.price) || 0;
    const discount = Number(p.discount) || 0;
    const finalPrice = Math.max(0, rawPrice - discount);

    // 1. Category / Subcategory Filter
    if (subcategory) {
      if (subcategory === 'lemari') {
        // Any lemari product
        const isLemari = /lemari|wardrobe|almari|rak piring|etalase/i.test(searchable);
        if (!isLemari) continue;
      } else {
        const targetSubcat = subcategory.toLowerCase();
        const matchesSubcat = pSubcat.includes(targetSubcat) || pName.includes(targetSubcat);
        if (!matchesSubcat) continue;
      }
    }

    // 2. Budget / Price Filter
    // Note: products with finalPrice === 0 are custom / pre-order. We only filter by price if finalPrice > 0
    let passesPrice = true;
    if (maxPrice !== undefined) {
      if (finalPrice > maxPrice) passesPrice = false;
    }
    if (minPrice !== undefined && finalPrice > 0) {
      if (finalPrice < minPrice) passesPrice = false;
    }

    // 3. Door Count Filter
    let passesDoors = true;
    if (doors !== undefined) {
      const doorPattern = new RegExp(`\\b${doors}\\s*(?:pintu|pt)\\b`, 'i');
      passesDoors = doorPattern.test(searchable);
    }

    // 4. Door Type Filter
    let passesDoorType = true;
    if (doorType === 'sliding') {
      passesDoorType = /sleding|sliding|geser/i.test(searchable);
    } else if (doorType === 'swing') {
      passesDoorType = !/sleding|sliding|geser/i.test(searchable);
    }

    // 5. Material Filter
    let passesMaterial = true;
    if (material) {
      if (material === 'acp') {
        passesMaterial = /\bacp\b/i.test(searchable);
      } else if (material === 'kaca') {
        passesMaterial = /\bkaca\b/i.test(searchable);
      } else if (material === 'keramik') {
        passesMaterial = /\bkeramik\b|\bporselen\b|\bproslen\b/i.test(searchable);
      } else if (material === 'aluminium') {
        passesMaterial = /\balum/i.test(searchable);
      }
    }

    // 6. Color Filter
    let passesColor = true;
    if (color) {
      passesColor = new RegExp(`\\b${color}\\b`, 'i').test(searchable);
    }

    const itemWithFinal: CatalogProduct = {
      ...p,
      final_price: finalPrice,
    };

    if (passesPrice && passesDoors && passesDoorType && passesMaterial && passesColor) {
      matches.push(itemWithFinal);
    } else if (passesDoors || passesMaterial || passesPrice) {
      // Keep as potential alternative
      alternatives.push(itemWithFinal);
    }
  }

  // Sort matches: items in stock first, then by lowest price or highest relevance
  matches.sort((a, b) => {
    const stockA = Number(a.stock) || 0;
    const stockB = Number(b.stock) || 0;
    // Prefer priced items over Rp 0 items when budget is requested
    if (isBudgetConstrained) {
      const priceA = a.final_price || 0;
      const priceB = b.final_price || 0;
      if (priceA > 0 && priceB === 0) return -1;
      if (priceB > 0 && priceA === 0) return 1;
      return (stockB - stockA) || (priceA - priceB);
    }
    return (stockB - stockA);
  });

  alternatives.sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0));

  let unmetConstraint: 'budget' | 'doors' | 'material' | 'category' | 'none' = 'none';
  if (matches.length === 0) {
    if (isBudgetConstrained) unmetConstraint = 'budget';
    else if (doors !== undefined) unmetConstraint = 'doors';
    else if (material) unmetConstraint = 'material';
    else unmetConstraint = 'category';
  }

  return {
    matchedProducts: matches,
    filteredOutCount: validProducts.length - matches.length,
    reasoning: `Found ${matches.length} products matching constraints: maxPrice=${maxPrice}, doors=${doors}, mat=${material}, subcat=${subcategory}`,
    isBudgetConstrained,
    budgetCeiling: maxPrice,
    unmetConstraint,
    closestAlternatives: alternatives.slice(0, 3),
  };
}

// -----------------------------------------------------------------------------
// 7. Grounded Business Knowledge Facts (Toko AGM Padang)
// -----------------------------------------------------------------------------

export const AGM_BUSINESS_KNOWLEDGE = {
  storeName: 'Toko AGM Padang (AGM 2 Ketapang)',
  address: 'Kota Padang, Sumatera Barat',
  operatingHours: '07.30 - 21.00 WIB setiap hari',
  whatsapp: '0896-9412-7723',
  shippingPolicy: 'Melayani pengiriman langsung ke seluruh area Kota Padang dan sekitarnya menggunakan armada toko sendiri. Produk kaca & aluminium dijamin aman sampai lokasi dan dirakit langsung oleh teknisi toko.',
  customCapability: 'Toko AGM memiliki workshop/bengkel perakitan mandiri berbasis aluminium tebal dan ACP. Semua ukuran, susunan pintu, sekat, dan laci dapat disesuaikan per centimeter (custom).',
  materials: {
    acp: 'ACP (Aluminium Composite Panel) adalah material komposit padat yang 100% tahan air, anti lapuk, anti rayap, tahan benturan keras, tidak mudah pecah, dan tidak berjamur. Tersedia aneka pilihan warna (hitam, putih, motif kayu).',
    kaca: 'Kaca riben / bening higienis, anti gores, memberikan kesan modern transparan, sangat mudah dilap bersih.',
    aluminium: 'Rangka aluminium padat berkualitas tinggi, tidak berkarat, tidak melengkung, kokoh, dan tahan lama puluhan tahun dibanding serbuk kayu/MDF.',
    keramik: 'Lantai/dinding meja berbahan porselen/keramik tahan panas api kompor dan kuah makanan panas.',
  },
};

// -----------------------------------------------------------------------------
// 8. Grounded AI Response Generator (Deterministic & Verifiable)
// -----------------------------------------------------------------------------

export function formatProductRecommendationsBlock(products: CatalogProduct[]): string {
  const recs = products
    .filter(p => p.name && (p.image_url || (p.images && p.images[0])))
    .slice(0, 3)
    .map(p => {
      const price = Number(p.price) || 0;
      const discount = Number(p.discount) || 0;
      const finalPrice = Math.max(0, price - discount);
      const img = p.image_url || (p.images && p.images[0]) || '';
      return {
        id: p.id,
        name: p.name,
        subcategory: p.subcategory || p.category,
        price,
        discount,
        final_price: finalPrice,
        stock: Number(p.stock) || 0,
        unit: p.unit || 'Pcs',
        image_url: img,
      };
    });

  if (recs.length === 0) return '';
  return `\n\n\`\`\`json_product_recommendations\n${JSON.stringify(recs, null, 2)}\n\`\`\``;
}

export function generateGroundedResponse(
  intent: UserIntent,
  filterResult: FilterResult,
  constraints: ExtractedConstraints,
  context?: ConversationContext
): string {
  // 1. Showroom Location
  if (intent === 'showroom_info') {
    return [
      `Berikut informasi showroom resmi **${AGM_BUSINESS_KNOWLEDGE.storeName}**:`,
      '',
      `- **Lokasi Showroom**: ${AGM_BUSINESS_KNOWLEDGE.address}.`,
      `- **Jam Buka**: ${AGM_BUSINESS_KNOWLEDGE.operatingHours}.`,
      `- **Armada Pengiriman**: ${AGM_BUSINESS_KNOWLEDGE.shippingPolicy}`,
      `- **Kontak WhatsApp**: **${AGM_BUSINESS_KNOWLEDGE.whatsapp}**.`,
      '',
      'Apakah Anda ingin melihat rekomendasi furniture tertentu yang tersedia di showroom hari ini?',
    ].join('\n');
  }

  // 2. Operating Hours
  if (intent === 'operating_hours') {
    return [
      `Toko AGM Padang buka setiap hari dengan jadwal:`,
      '',
      `- **Jam Operasional**: **${AGM_BUSINESS_KNOWLEDGE.operatingHours}** (Senin s/d Minggu).`,
      `- **Pelayanan Konsultasi Online**: Siap melayani tanya jawab katalog & konsultasi custom.`,
      '',
      'Ada produk furniture yang ingin Anda konsultasikan?',
    ].join('\n');
  }

  // 3. Shipping Policy
  if (intent === 'shipping_policy') {
    return [
      `Informasi Pengiriman **Toko AGM Padang**:`,
      '',
      `- ${AGM_BUSINESS_KNOWLEDGE.shippingPolicy}`,
      `- Untuk luar kota Padang, pengiriman dapat dikonsultasikan via WhatsApp admin (**${AGM_BUSINESS_KNOWLEDGE.whatsapp}**).`,
      '',
      'Ada perabot yang ingin dikirimkan ke alamat Anda?',
    ].join('\n');
  }

  // 4. Material Comparison
  if (intent === 'material_comparison') {
    return [
      'Berikut perbandingan material utama furniture di Toko AGM Padang:',
      '',
      '1. **ACP (Aluminium Composite Panel)**:',
      `   - ${AGM_BUSINESS_KNOWLEDGE.materials.acp}`,
      '   - Sangat direkomendasikan untuk lemari pakaian dan pintu dapur karena ringan, kokoh, dan tidak pecah.',
      '',
      '2. **Kaca (Bening / Riben)**:',
      `   - ${AGM_BUSINESS_KNOWLEDGE.materials.kaca}`,
      '   - Cocok untuk lemari pajang hias, rak piring, atau pintu lemari dengan tampilan mewah.',
      '',
      '3. **Rangka Aluminium**:',
      `   - ${AGM_BUSINESS_KNOWLEDGE.materials.aluminium}`,
      '   - Jauh lebih unggul dibanding serbuk kayu (MDF/partikel) yang mudah lapuk dan dimakan rayap jika lembap.',
      '',
      'Apakah Anda ingin melihat model lemari berbahan ACP atau kombinasi kaca?',
    ].join('\n');
  }

  // 5. Out of scope product
  if (intent === 'out_of_scope') {
    return [
      `Mohon maaf, Toko AGM Padang adalah spesialis manufaktur furniture berbahan **aluminium, kaca, dan panel ACP** (seperti lemari pakaian, meja kompor, meja prasmanan, kitchen set, bopet TV, dan wastafel).`,
      '',
      `Kami tidak menyediakan produk sofa kain/busa, kasur springbed, maupun barang elektronik. Namun, jika Anda memerlukan rangka meja, lemari, atau partisi custom berbahan aluminium anti rayap, bengkel kami siap memproduksikannya.`,
      '',
      `Silakan beri tahu jika Anda ingin mencari produk furniture aluminium & ACP lainnya!`,
    ].join('\n');
  }

  // 6. Stock check inquiry
  if (intent === 'stock_inquiry') {
    const products = filterResult.matchedProducts.length > 0
      ? filterResult.matchedProducts
      : (context?.lastRecommendedProducts || []);

    if (products.length > 0) {
      const top = products[0];
      const stock = Number(top.stock) || 0;
      const price = (top.final_price || Number(top.price) || 0);
      const stockMsg = stock > 0
        ? `Saat ini **${top.name}** ready stock sebanyak **${stock} ${top.unit || 'unit'}**.`
        : `Untuk produk **${top.name}**, status saat ini **Pre-order / Custom** dan dapat diproduksi langsung di workshop AGM Padang.`;

      return [
        `Informasi ketersediaan stok:`,
        '',
        `- Produk: **${top.name}**`,
        `- Harga: Rp ${price.toLocaleString('id-ID')}`,
        `- Status Stok: ${stockMsg}`,
        '',
        `Bisa langsung diantar oleh armada toko ke lokasi Anda di Padang. Ingin memesan atau menanyakan detailnya via WhatsApp?`,
        formatProductRecommendationsBlock([top]),
      ].join('\n');
    }
  }

  // 7. Color inquiry
  if (intent === 'color_inquiry') {
    const color = constraints.color || 'putih';
    const products = filterResult.matchedProducts.length > 0
      ? filterResult.matchedProducts
      : filterResult.closestAlternatives;

    let listText = '';
    if (products.length > 0) {
      const list = products.slice(0, 3).map(p => {
        const finalP = p.final_price || Number(p.price) || 0;
        return `- **${p.name}** (Rp ${finalP.toLocaleString('id-ID')}, stok: ${p.stock || 0})`;
      }).join('\n');
      listText = `\nBerikut beberapa contoh produk yang dapat dipesan dengan variasi warna **${color}**:\n${list}\n`;
    }

    return [
      `Toko AGM Padang menyediakan varian warna modern seperti **putih, hitam, silver, dan motif serat kayu**.`,
      listText,
      `Warna dan panel (ACP warna putih / stiker kaca motif) dapat disesuaikan secara khusus (custom finishing) di bengkel workshop kami sesuai tema interior rumah Anda.`,
      formatProductRecommendationsBlock(products.slice(0, 3)),
    ].filter(Boolean).join('\n');
  }

  // 8. Product Recommendation with Constraints (Budget, Doors, Material)
  const { matchedProducts, unmetConstraint, closestAlternatives, budgetCeiling } = filterResult;

  if (matchedProducts.length > 0) {
    const topItems = matchedProducts.slice(0, 3);
    const budgetNote = budgetCeiling
      ? ` yang sesuai dengan budget maksimal **Rp ${budgetCeiling.toLocaleString('id-ID')}**:`
      : ':';

    const itemsText = topItems.map((p, idx) => {
      const price = Number(p.price) || 0;
      const discount = Number(p.discount) || 0;
      const finalPrice = Math.max(0, price - discount);
      const stock = Number(p.stock) || 0;
      const stockText = stock > 0 ? `Ready ${stock} ${p.unit || 'unit'}` : 'Pre-order';
      const priceText = discount > 0
        ? `Rp ${finalPrice.toLocaleString('id-ID')} (Diskon Rp ${discount.toLocaleString('id-ID')} dari Rp ${price.toLocaleString('id-ID')})`
        : `Rp ${finalPrice.toLocaleString('id-ID')}`;

      const desc = p.description ? `\n   - Spesifikasi: ${p.description}` : '';
      return `${idx + 1}. **${p.name}**\n   - Harga: **${priceText}**\n   - Ketersediaan: **${stockText}**${desc}`;
    }).join('\n\n');

    const jsonBlock = formatProductRecommendationsBlock(topItems);

    return [
      `Berikut rekomendasi produk dari katalog Toko AGM Padang${budgetNote}`,
      '',
      itemsText,
      '',
      `Seluruh produk di atas berbahan aluminium & kaca/ACP 100% anti rayap dan tahan air. Apakah ada model yang sesuai dengan ruangan Anda?`,
      jsonBlock,
    ].join('\n');
  }

  // Case: No direct matches for the constraints (e.g. strict budget < 1.5jt for 3-door ACP)
  if (unmetConstraint === 'budget' && budgetCeiling) {
    let altText = '';
    if (closestAlternatives.length > 0) {
      altText = '\n\nSebagai alternatif terdekat dari katalog kami:\n' + closestAlternatives.slice(0, 3).map((a, i) => {
        const finalP = a.final_price || Number(a.price) || 0;
        return `${i + 1}. **${a.name}** — Rp ${finalP.toLocaleString('id-ID')} (${Number(a.stock) > 0 ? `Stok ${a.stock}` : 'Pre-order'})`;
      }).join('\n');
    }

    return [
      `Untuk pilihan ${constraints.subcategory || 'lemari'} dengan spesifikasi khusus yang Anda minta, produk katalog ready stock kami saat ini memiliki rentang harga di atas **Rp ${budgetCeiling.toLocaleString('id-ID')}**.`,
      altText,
      '',
      `Namun, karena Toko AGM Padang memiliki workshop mandiri, **kami bisa membuatkan rancangan custom dengan penyesuaian ukuran/bahan yang mendekati budget Anda**.`,
      '',
      `Apakah Anda ingin berkonsultasi untuk pembuatan custom sesuai ukuran ruangan Anda?`,
      formatProductRecommendationsBlock(closestAlternatives.slice(0, 3)),
    ].join('\n');
  }

  // General fallback
  return [
    `Toko AGM Padang menyediakan 15 subkategori furniture aluminium, kaca, dan ACP berkualitas (100% anti rayap & tahan air).`,
    '',
    `Silakan sebutkan tipe perabot yang Anda butuhkan (contoh: *lemari pakaian 2 pintu*, *meja kompor type U*, atau *kitchen set* beserta perkiraan ukuran/budget), dan saya akan siapkan pilihan terbaik dari katalog Supabase.`,
  ].join('\n');
}
