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
  final_price?: number | PriceClassification;
  stock?: number;
  unit?: string;
  arrival_type?: string;
  image_url?: string;
  images?: string[];
  created_at?: string;
}

export type PriceStatus = 'priced' | 'unpriced' | 'preorder' | 'invalid_price_data';

export interface PriceClassification {
  status: PriceStatus;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  isPriced: boolean;
  isPreorder: boolean;
  isValid: boolean;
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
  | 'product_comparison'
  | 'spec_inquiry'
  | 'follow_up'
  | 'clarification'
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

  // 1. Out of scope check
  if (isOutOfScopeProduct(clean)) {
    return 'out_of_scope';
  }

  // 2. Custom furniture request
  if (/bisa custom|custom ukuran|pesan ukuran khusus|rancang ukuran|bisa dibikinkan|bikin custom|buat custom|bisa buatkan|bisa pesan model|membuat .* custom/i.test(clean)) {
    return 'custom_furniture';
  }

  // 3. Product comparison / differences between models
  if (/perbedaan|bedanya|beda antara|beda dari|bagus mana|lebih bagus mana|bandingkan|dibanding|kelebihan.*kekurangan|lebih awet mana/i.test(clean)) {
    return 'product_comparison';
  }

  // 4. Follow-up to previous turns (e.g. "kalau produk ketiga?", "yang nomor 2?", "kalau yang tadi?")
  if (
    context?.lastRecommendedProducts?.length &&
    (/(?:produk|nomor|pilihan|opsi)\s*(?:ke-?\s*\d+|pertama|kedua|ketiga|1|2|3)\b/i.test(clean) ||
     /^kalau yang (?:itu|tadi|pertama|kedua|ketiga)\b/i.test(clean))
  ) {
    if (/masih ada|ready|tersedia|stok/i.test(clean)) return 'stock_inquiry';
    if (/berapa|harga/i.test(clean)) return 'price_inquiry';
    return 'follow_up';
  }

  // 5. Pure Showroom / Location Intent: must NOT contain product inquiry words
  const hasShowroomWords = /showroom|lokasi toko|alamat toko|alamat agm|toko di mana|dimana toko|alamat fisik/i.test(clean);
  const hasProductWords = /rekomendasi|lemari|meja|rak|kitchen|harga|stok|beli|pesan|juta|budget|acp|kaca/i.test(clean);
  if (hasShowroomWords && !hasProductWords) {
    return 'showroom_info';
  }

  // 6. Operating Hours
  if (/jam berapa buka|jam buka|buka jam|jam operasional|tutup jam berapa|hari apa buka/i.test(clean)) {
    return 'operating_hours';
  }

  // 7. Shipping policy
  if (/ongkir|ongkos kirim|bisa kirim ke|pengiriman ke|kirim luar kota|area pengiriman/i.test(clean) && !hasProductWords) {
    return 'shipping_policy';
  }

  // 8. Material comparison / education
  if (/perbedaan\s+(?:acp|kaca|aluminium|kayu)|bedanya\s+(?:acp|kaca|aluminium)|keunggulan\s+(?:acp|aluminium)|kenapa\s+aluminium|bahan\s+(?:acp|aluminium|kaca)\s+itu/i.test(clean)) {
    return 'material_comparison';
  }

  // 9. Greeting
  if (/^(halo|hai|hi|assalamu['a]?laikum|pagi|siang|sore|malam)$/i.test(clean) ||
      /^(halo|hai|hi)\s+admin\b/i.test(clean)) {
    return 'greeting';
  }

  // 10. Clarification request from user
  if (/maksudnya|bisa diperjelas|kurang jelas|bingung|gimana maksudnya/i.test(clean)) {
    return 'clarification';
  }

  // 11. Specifications / Dimensions Inquiry
  if (/spesifikasi|speknya|ukuran(?:nya)? berapa|dimensi(?:nya)?|panjang.*lebar.*tinggi|berapa cm|berapa meter|tinggi.*berapa|muat gak|muat tidak/i.test(clean)) {
    return 'spec_inquiry';
  }

  // 12. Price inquiry (specific check before general recommendation)
  if (/berapa harganya|harganya berapa|harga paling|paling murah|termurah|paling mahal|termahal|kisaran harga|daftar harga|harga berapa|berapaan/i.test(clean)) {
    return 'price_inquiry';
  }

  // 13. Stock inquiry
  if (/berapa stok(?:nya)?|stoknya berapa|ready berapa|masih ada stok|sisa berapa unit|apakah.*masih ada|masih tersedia|apakah ready/i.test(clean)) {
    return 'stock_inquiry';
  }

  // 14. Color inquiry
  if (/ada warna apa|ada warna putih|pilihan warna|tersedia warna apa/i.test(clean)) {
    return 'color_inquiry';
  }

  // 15. Category overview / broad catalog explore
  if (/kategori apa saja|ada apa saja|daftar produk|semua produk|jual apa saja|model apa saja|apa saja model|pilihan produknya|bisa jelaskan pilihan/i.test(clean)) {
    return 'category_overview';
  }

  // 16. Product recommendation (advisory: fit, suggestions, budget-oriented)
  if (/rekomendasi|pilihkan|mana yang cocok|bagus untuk|saran|cocok untuk|terbaik|pas untuk|sarankan/i.test(clean)) {
    return 'product_recommendation';
  }

  // 17. Product search (search / existence / lookup)
  const currency = parseIndonesianCurrency(clean);
  const cat = parseCategoryOrSubcategory(clean);

  if (currency.maxPrice || currency.minPrice) {
    return 'product_recommendation';
  }

  if (cat.subcategory || /ada\s+(?:lemari|meja|kitchen|etalase|bopet|rak|wastafel)|cari|mencari|mau beli|butuh/i.test(clean)) {
    return 'product_search';
  }

  // 18. Context follow-up check: if user message short and we have prior recommendation context
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

  const { maxPrice, minPrice, doors, doorType, material, color, subcategory, rawKeywords } = constraints;
  const isBudgetConstrained = maxPrice !== undefined || minPrice !== undefined;

  let matches: CatalogProduct[] = [];
  const alternatives: CatalogProduct[] = [];

  for (const p of validProducts) {
    const pName = (p.name || '').toLowerCase();
    const pSubcat = (p.subcategory || p.category || '').toLowerCase();
    const pDesc = (p.description || '').toLowerCase();
    // Normalize known merchant typos in searchable text
    const normalizedSearchable = `${pName} ${pSubcat} ${pDesc}`
      .replace(/\btaperwer\b/g, 'tupperware rak kaca')
      .replace(/\bsleding\b/g, 'sliding')
      .replace(/\btiolet\b/g, 'toilet rias')
      .replace(/\bcatom\b/g, 'custom')
      .replace(/\bwestafel\b/g, 'wastafel');

    // Use classifier result if available (object format), otherwise fall back to raw calculation
    const fc = p.final_price as PriceClassification | undefined;
    let finalPrice: number;
    let status: PriceStatus;
    if (fc && typeof fc !== 'number') {
      finalPrice = fc.isPriced ? fc.finalPrice : 0;
      status = fc.status;
    } else {
      const rawPrice = Number(p.price) || 0;
      const discount = Number(p.discount) || 0;
      finalPrice = Math.max(0, rawPrice - discount);
      status = 'priced';
    }

    // 1. Category / Subcategory Filter
    if (subcategory) {
      if (subcategory === 'lemari') {
        const isLemari = /lemari|wardrobe|almari|rak piring|etalase/i.test(normalizedSearchable);
        if (!isLemari) continue;
      } else {
        const targetSubcat = subcategory.toLowerCase();
        const matchesSubcat = pSubcat.includes(targetSubcat) || pName.includes(targetSubcat);
        if (!matchesSubcat) continue;
      }
    }

    // 2. Budget / Price Filter
    if (status === 'invalid_price_data') {
      continue;
    }
    if (status === 'unpriced' || status === 'preorder') {
      if (maxPrice !== undefined || minPrice !== undefined) {
        alternatives.push({ ...p, final_price: finalPrice });
        continue;
      }
    }

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
      passesDoors = doorPattern.test(normalizedSearchable);
    }

    // 4. Door Type Filter
    let passesDoorType = true;
    if (doorType === 'sliding') {
      passesDoorType = /sleding|sliding|geser/i.test(normalizedSearchable);
    } else if (doorType === 'swing') {
      passesDoorType = !/sleding|sliding|geser/i.test(normalizedSearchable);
    }

    // 5. Material Filter
    // Note: In AGM, almost all products feature aluminium frames. If material is aluminium,
    // do not strictly exclude products unless they are explicitly non-aluminium (e.g. pure wood).
    let passesMaterial = true;
    if (material) {
      if (material === 'acp') {
        passesMaterial = /\bacp\b/i.test(normalizedSearchable);
      } else if (material === 'kaca') {
        passesMaterial = /\bkaca\b/i.test(normalizedSearchable);
      } else if (material === 'keramik') {
        passesMaterial = /\bkeramik\b|\bporselen\b|\bproslen\b/i.test(normalizedSearchable);
      } else if (material === 'kayu') {
        passesMaterial = /\bkayu\b|\btriplek\b|\bmdf\b/i.test(normalizedSearchable);
      }
      // 'aluminium' is universal at AGM workshop; all valid catalog items qualify.
    }

    // 6. Color Filter
    let passesColor = true;
    if (color) {
      passesColor = new RegExp(`\\b${color}\\b`, 'i').test(normalizedSearchable);
    }

    const itemWithFinal: CatalogProduct = {
      ...p,
      final_price: (p.final_price && typeof p.final_price !== 'number') ? p.final_price : finalPrice,
    };

    if (passesPrice && passesDoors && passesDoorType && passesMaterial && passesColor) {
      matches.push(itemWithFinal);
    } else if (passesDoors || passesMaterial || passesPrice) {
      alternatives.push(itemWithFinal);
    }
  }

  // Multi-factor relevance scoring for ranking
  const scoreProduct = (item: CatalogProduct): number => {
    let score = 0;
    const name = (item.name || '').toLowerCase();
    const subcat = (item.subcategory || item.category || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const stock = Number(item.stock) || 0;
    const rawPrice = Number(item.price) || 0;

    // Ready stock preference
    if (stock > 0) score += 25;
    // Valid priced product
    if (rawPrice > 0) score += 10;

    // Subcategory specific match
    if (subcategory && subcategory !== 'lemari') {
      const target = subcategory.toLowerCase();
      if (subcat.includes(target)) score += 100;
      if (name.includes(target)) score += 80;
    }

    // Doors match bonus
    if (doors !== undefined) {
      const doorRegex = new RegExp(`\\b${doors}\\s*(?:pintu|pt)\\b`, 'i');
      if (doorRegex.test(`${name} ${desc}`)) score += 40;
    }

    // Keyword matching bonuses
    const keywords = (rawKeywords || []).map(k => k.toLowerCase()).filter(k => k.length >= 3);
    for (const kw of keywords) {
      if (name.includes(kw)) score += 35;
      else if (subcat.includes(kw)) score += 20;
      else if (desc.includes(kw)) score += 10;
    }

    return score;
  };

  // Sort matches by relevance score first, then stock, then lowest price
  matches.sort((a, b) => {
    const scoreDiff = scoreProduct(b) - scoreProduct(a);
    if (scoreDiff !== 0) return scoreDiff;

    const stockA = Number(a.stock) || 0;
    const stockB = Number(b.stock) || 0;
    if (stockA !== stockB) return stockB - stockA;

    if (isBudgetConstrained) {
      const priceA = typeof a.final_price === 'number' ? a.final_price : 0;
      const priceB = typeof b.final_price === 'number' ? b.final_price : 0;
      if (priceA > 0 && priceB > 0) return priceA - priceB;
    }

    return 0;
  });

  // When query is generic 'lemari' without specific subcategory, guarantee diverse representation:
  // Show top Lemari Pakaian, top Lemari Dapur, and top Lemari Rak Kaca / Pajang
  if (subcategory === 'lemari') {
    const subcatMap = new Map<string, CatalogProduct[]>();
    for (const item of matches) {
      const sc = item.subcategory || 'Lainnya';
      if (!subcatMap.has(sc)) subcatMap.set(sc, []);
      subcatMap.get(sc)!.push(item);
    }

    const prioritySubcats = ['Lemari pakaian', 'Lemari Dapur', 'Lemari rak kaca', 'Lemari pajang', 'Lemari Sepatu'];
    const diverseMatches: CatalogProduct[] = [];
    const usedIds = new Set<string>();

    for (const sc of prioritySubcats) {
      const group = subcatMap.get(sc);
      if (group && group.length > 0) {
        diverseMatches.push(group[0]);
        usedIds.add(group[0].id);
        if (diverseMatches.length === 3) break;
      }
    }

    // Fill remaining slots
    for (const item of matches) {
      if (diverseMatches.length >= matches.length) break;
      if (!usedIds.has(item.id)) {
        diverseMatches.push(item);
        usedIds.add(item.id);
      }
    }

    matches = diverseMatches;
  }

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
// 7. Grounded Business Knowledge Facts (Toko CV Adi Guna Mandiri (AGM 2) Ketapang)
// -----------------------------------------------------------------------------

export const AGM_BUSINESS_KNOWLEDGE = {
  storeName: 'Toko CV Adi Guna Mandiri (AGM 2) Ketapang',
  address: 'Jalan Rahadi Ismail, Desa Padang, Kecamatan Benua Kayong, Kabupaten Ketapang, Kalimantan Barat',
  operatingHours: '07.30 - 21.00 WIB setiap hari',
  whatsapp: '0896-9412-7723',
  shippingPolicy: 'Melayani pengiriman langsung ke seluruh area Ketapang dan sekitarnya menggunakan armada toko sendiri. Produk kaca & aluminium aman sampai lokasi dan dirakit langsung oleh teknisi toko.',
  customCapability: 'Toko AGM memiliki workshop/bengkel perakitan mandiri berbasis aluminium tebal dan ACP. Semua ukuran, susunan pintu, sekat, dan laci dapat disesuaikan per centimeter (custom).',
  materials: {
    acp: 'ACP (Aluminium Composite Panel) adalah material komposit padat yang tahan air, anti lapuk, anti rayap, tahan benturan keras, tidak mudah pecah, dan tidak berjamur. Tersedia aneka pilihan warna (hitam, putih, motif kayu).',
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
      const fc = p.final_price;
      let price = 0;
      let discount = 0;
      let finalPrice = 0;
      if (fc && typeof fc !== 'number') {
        price = fc.originalPrice;
        discount = fc.discount;
        finalPrice = fc.isPriced ? fc.finalPrice : 0;
      } else {
        price = Number(p.price) || 0;
        discount = Number(p.discount) || 0;
        finalPrice = Math.max(0, price - discount);
      }
      const img = p.image_url || (p.images && p.images[0]) || '';
      return {
        id: p.id,
        name: p.name,
        subcategory: p.subcategory || p.category,
        price,
        discount,
        final_price: (fc && typeof fc !== 'number') ? fc : finalPrice,
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
      `Toko CV Adi Guna Mandiri (AGM 2) Ketapang buka setiap hari dengan jadwal:`,
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
      `Informasi Pengiriman **Toko CV Adi Guna Mandiri (AGM 2) Ketapang**:`,
      '',
      `- ${AGM_BUSINESS_KNOWLEDGE.shippingPolicy}`,
      `- Untuk luar area Ketapang, pengiriman dapat dikonsultasikan via WhatsApp admin (**${AGM_BUSINESS_KNOWLEDGE.whatsapp}**).`,
      '',
      'Ada perabot yang ingin dikirimkan ke alamat Anda?',
    ].join('\n');
  }

  // 4. Material Comparison
  if (intent === 'material_comparison') {
    return [
      'Berikut perbandingan material utama furniture di Toko CV Adi Guna Mandiri (AGM 2) Ketapang:',
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
      `Mohon maaf, Toko CV Adi Guna Mandiri (AGM 2) Ketapang adalah spesialis manufaktur furniture berbahan **aluminium, kaca, dan panel ACP** (seperti lemari pakaian, meja kompor, meja prasmanan, kitchen set, bopet TV, dan wastafel).`,
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
      const fc = top.final_price;
      const price = (fc && typeof fc !== 'number') ? fc.originalPrice : (top.final_price || Number(top.price) || 0);
      const stockMsg = stock > 0
        ? `Saat ini **${top.name}** ready stock sebanyak **${stock} ${top.unit || 'unit'}**.`
        : `Untuk produk **${top.name}**, status saat ini **Pre-order / Custom** dan dapat diproduksi langsung di workshop Toko AGM 2 Ketapang.`;

      return [
        `Informasi ketersediaan stok:`,
        '',
        `- Produk: **${top.name}**`,
        `- Harga: Rp ${price.toLocaleString('id-ID')}`,
        `- Status Stok: ${stockMsg}`,
        '',
        `Bisa langsung diantar oleh armada toko ke lokasi Anda di Ketapang. Ingin memesan atau menanyakan detailnya via WhatsApp?`,
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
        const fc = p.final_price;
        const finalP = (fc && typeof fc !== 'number') ? fc.originalPrice : (p.final_price || Number(p.price) || 0);
        return `- **${p.name}** (Rp ${finalP.toLocaleString('id-ID')}, stok: ${p.stock || 0})`;
      }).join('\n');
      listText = `\nBerikut beberapa contoh produk yang dapat dipesan dengan variasi warna **${color}**:\n${list}\n`;
    }

    return [
      `Toko CV Adi Guna Mandiri (AGM 2) Ketapang menyediakan varian warna modern seperti **putih, hitam, silver, dan motif serat kayu**.`,
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
      const fc = p.final_price;
      let price = 0;
      let discount = 0;
      let finalPrice = 0;
      if (fc && typeof fc !== 'number') {
        price = fc.originalPrice;
        discount = fc.discount;
        finalPrice = fc.isPriced ? fc.finalPrice : 0;
      } else {
        price = Number(p.price) || 0;
        discount = Number(p.discount) || 0;
        finalPrice = Math.max(0, price - discount);
      }
      const stock = Number(p.stock) || 0;
      const stockText = stock > 0 ? `Ready ${stock} ${p.unit || 'unit'}` : (fc && typeof fc !== 'number' && fc.isPreorder) ? 'Pre-order' : 'Habis / Custom';
      const priceText = discount > 0 && price > 0
        ? `Rp ${finalPrice.toLocaleString('id-ID')} (Diskon Rp ${discount.toLocaleString('id-ID')} dari Rp ${price.toLocaleString('id-ID')})`
        : `Rp ${finalPrice.toLocaleString('id-ID')}`;

      const desc = p.description ? `\n   - Spesifikasi: ${p.description}` : '';
      return `${idx + 1}. **${p.name}**\n   - Harga: **${priceText}**\n   - Ketersediaan: **${stockText}**${desc}`;
    }).join('\n\n');

    const jsonBlock = formatProductRecommendationsBlock(topItems);

    return [
      `Berikut rekomendasi produk dari katalog Toko CV Adi Guna Mandiri (AGM 2) Ketapang${budgetNote}`,
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
        const fc = a.final_price;
        const finalP = (fc && typeof fc !== 'number') ? fc.originalPrice : (a.final_price || Number(a.price) || 0);
        return `${i + 1}. **${a.name}** — Rp ${finalP.toLocaleString('id-ID')} (${Number(a.stock) > 0 ? `Stok ${a.stock}` : 'Pre-order'})`;
      }).join('\n');
    }

    return [
      `Untuk pilihan ${constraints.subcategory || 'lemari'} dengan spesifikasi khusus yang Anda minta, produk katalog ready stock kami saat ini memiliki rentang harga di atas **Rp ${budgetCeiling.toLocaleString('id-ID')}**.`,
      altText,
      '',
      `Namun, karena Toko CV Adi Guna Mandiri (AGM 2) Ketapang memiliki workshop mandiri, **kami bisa membuatkan rancangan custom dengan penyesuaian ukuran/bahan yang mendekati budget Anda**.`,
      '',
      `Apakah Anda ingin berkonsultasi untuk pembuatan custom sesuai ukuran ruangan Anda?`,
      formatProductRecommendationsBlock(closestAlternatives.slice(0, 3)),
    ].join('\n');
  }

  // General fallback
  return [
    `Toko CV Adi Guna Mandiri (AGM 2) Ketapang menyediakan 15 subkategori furniture aluminium, kaca, dan ACP berkualitas (100% anti rayap & tahan air).`,
    '',
    `Silakan sebutkan tipe perabot yang Anda butuhkan (contoh: *lemari pakaian 2 pintu*, *meja kompor type U*, atau *kitchen set* beserta perkiraan ukuran/budget), dan saya akan siapkan pilihan terbaik dari katalog Supabase.`,
  ].join('\n');
}
