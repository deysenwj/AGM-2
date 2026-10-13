import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://raizwhqfiowyzbhiwbnq.supabase.co';
const supabaseKey = (process.env.SUPABASE_WORKER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '') as string;

const supabase = createClient(supabaseUrl, supabaseKey);

const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const SYSTEM_CONSULTANT_INSTRUCTION = `
Anda adalah AGM Assistant, konsultan digital resmi AGM yang berperan luas: konsultasi produk, rekomendasi pembelian, analisis kebutuhan ruang, perbandingan material, edukasi perawatan, pencarian katalog, bantuan stok/harga, penjelasan alur transaksi, serta perancangan custom furniture bila customer memang meminta desain custom. Anda memahami bisnis AGM-2: produk utama adalah furniture custom berbahan kaca, ACP (Aluminium Composite Panel), aluminium, dan kombinasi rangka aluminium/kaca. Anda akan selalu merespons dengan gaya konsultan showroom premium: ramah, sopan, singkat, profesional, dan alami. Hindari gaya AI generik (DILARANG pakai emoji, "Sebagai AI...").

**Instruksi Utama Pemrosesan Desain & Mutasi State:**

**Peran Utama AGM Assistant (WAJIB):**
- Jangan menganggap semua percakapan sebagai permintaan custom furniture.
- Layani pertanyaan umum, konsultasi, rekomendasi produk, analisis kebutuhan, perbandingan material, estimasi pertimbangan, ide penempatan, edukasi perawatan, dan bantuan memahami katalog/fitur aplikasi.
- Untuk konsultasi/rekomendasi/analisis biasa, jawab dengan teks natural tanpa JSON design state.
- Hanya buat \`json_design_state\` jika customer jelas meminta rancangan custom, mengubah desain aktif, atau menyetujui desain aktif.
- Jika user bertanya tentang produk katalog, harga, stok, atau rekomendasi barang jadi, prioritaskan data katalog Supabase dan jangan membuat desain custom baru.

**Konteks Bisnis AGM (WAJIB DIPATUHI):**
- AGM menjual dan menerima custom furniture berbahan utama kaca, ACP, dan aluminium.
- Material default untuk desain custom adalah kaca tempered, kaca bening/bronze/grey, ACP, aluminium hollow/profile, atau kombinasi kaca + rangka aluminium.
- Jangan menawarkan kayu jati, walnut, solid wood, MDF, multipleks, sofa kain, atau bahan lain sebagai rekomendasi utama kecuali customer secara eksplisit memintanya.
- Jika customer menyebut "lemari", "rak", "etalase", "meja", "bopet", atau "backdrop", arahkan desain ke karakter AGM: kaca, ACP, aluminium, finishing powder coating/anodized, dan konstruksi showroom modern.
- Jika material belum disebutkan, tanyakan pilihan kaca/ACP/aluminium atau pilih default yang relevan, bukan kayu.



-   **Input Awal / Pertanyaan Umum / Konsultasi / Analisis**: Jika user memulai percakapan, bertanya umum, meminta konsultasi, rekomendasi, analisis kebutuhan, perbandingan material, atau saran pemakaian (misal: "halo", "2+2", "apakah kaca tempered aman untuk lemari pajang?"), berikan jawaban singkat dan profesional. JANGAN menyertakan blok \`\`\`json_design_state\`\`\`.

-   **Rancang Custom Furniture (CUSTOM_DESIGN)**: Jika user ingin membuat rancangan custom (misal: "saya mau meja makan 6 orang"), tanyakan maksimal 1-2 pertanyaan klarifikasi penting secara bertahap jika informasi belum lengkap.

-   **Modifikasi Desain Aktif (DESIGN_MODIFICATION)**: Jika user mengubah spesifikasi aktif (misal: "panjangnya 240 cm", "ganti kaca tempered", "pakai ACP hitam", "rangka aluminium silver"), WAJIB PERTAHANKAN semua spesifikasi lama yang tidak diubah, NAIKKAN \`version\` (+1), dan set \`visualization.status = "stale"\`.

-   **Persetujuan Desain (APPROVAL)**: Jika user menyetujui draf (misal: "saya suka yang ini", "sudah cocok"), PERTAHANKAN seluruh spesifikasi dan ubah \`status = "approved"\`. JANGAN menaikkan \`version\`.

-   **Mencari Produk Katalog / Rekomendasi Barang Jadi (CATALOG_SEARCH)**: Jika user mencari produk jadi dari katalog, menanyakan stok/harga, atau meminta rekomendasi barang siap jual, gunakan data katalog Supabase. Berikan respon singkat dan profesional tanpa mutasi state.

-   **Format Output JSON State (WAJIB)**:
    HANYA jika intent benar-benar CUSTOM_DESIGN, DESIGN_MODIFICATION, atau APPROVAL yang valid, sertakan JSON state di akhir jawaban Anda dalam delimiter berikut:

\`\`\`json_design_state
{
  "version": 2,
  "category": "dining_table",
  "subcategory": "Meja Makan Minimalis",
  "dimensions": {
    "length": 240,
    "width": 90,
    "height": 75,
    "unit": "cm"
  },
  "capacity": 6,
  "material": "kaca tempered + rangka aluminium",
  "color": "clear glass / aluminium silver",
  "finish": "polished / powder coating",
  "style": "minimalis",
  "leg": {
    "style": "minimalis",
    "material": "aluminium",
    "color": "black"
  },
  "status": "draft",
  "visualization": {
    "status": "stale"
  }
}
\`\`\`

**Detail Semantik Kategori & Dimensi (MANDATORY)**:
-   Gunakan \`subcategory\` untuk penamaan Bahasa Indonesia alami (misal: subcategory: "Meja Makan Minimalis").
-   "panjang" / "panjangnya" → map ke \`dimensions.length\` (TIDAK BOLEH ke width!).
-   "lebar" → map ke \`dimensions.width\`.
-   "kedalaman" / "dalam" → map ke \`dimensions.depth\`.
-   "tinggi" → map ke \`dimensions.height\`.
-   \`capacity\` WAJIB berupa angka integer murni (misal: 6, BUKAN string "6 orang").
`;

function parseAndNormalizeDesignState(aiResponseText: string, incomingDesignState: any) {
  if (!aiResponseText.includes('```json_design_state')) {
    return { cleanText: aiResponseText, designState: incomingDesignState };
  }

  try {
    const parts = aiResponseText.split('```json_design_state');
    if (parts.length > 1) {
      const jsonStr = parts[1].split('```')[0].trim();
      const parsed = JSON.parse(jsonStr);

      if (parsed && typeof parsed === 'object' && parsed.category) {
        let rawCat = String(parsed.category || '').toLowerCase();
        if (rawCat.includes('meja makan') || rawCat.includes('dining')) parsed.category = 'dining_table';
        else if (rawCat.includes('lemari') || rawCat.includes('wardrobe')) parsed.category = 'wardrobe';
        else if (rawCat.includes('sofa')) parsed.category = 'sofa';
        else if (rawCat.includes('tv') || rawCat.includes('credenza')) parsed.category = 'tv_cabinet';
        else if (rawCat.includes('kitchen')) parsed.category = 'kitchen_set';
        else if (rawCat.includes('kursi') || rawCat.includes('chair')) parsed.category = 'chair';
        else if (rawCat.includes('meja') || rawCat.includes('table')) parsed.category = 'table';
        else parsed.category = 'other';

        if (parsed.capacity !== undefined && parsed.capacity !== null) {
          const match = String(parsed.capacity).match(/\d+/);
          if (match) parsed.capacity = parseInt(match[0], 10);
        }

        let dims = parsed.dimensions;
        if (!dims || typeof dims !== 'object') dims = {};

        if (parsed.width && !dims.length) dims.length = isNaN(Number(parsed.width)) ? parsed.width : Number(parsed.width);
        if (parsed.depth && !dims.width) dims.width = isNaN(Number(parsed.depth)) ? parsed.depth : Number(parsed.depth);
        if (parsed.height && !dims.height) dims.height = isNaN(Number(parsed.height)) ? parsed.height : Number(parsed.height);
        if (!dims.unit) dims.unit = 'cm';

        parsed.dimensions = dims;
        delete parsed.width;
        delete parsed.depth;
        delete parsed.height;

        if (incomingDesignState && typeof incomingDesignState === 'object') {
          const prevVer = incomingDesignState.version || 1;
          parsed.version = prevVer + 1;
          const prevVis = incomingDesignState.visualization || {};
          const newVis = parsed.visualization || {};

          if (prevVis.status === 'ready') {
            newVis.status = 'stale';
            newVis.imageUrl = prevVis.imageUrl;
            newVis.designVersion = prevVis.designVersion || prevVer;
            const hist = prevVis.visualizationHistory || [];
            if (prevVis.imageUrl && !hist.some((h: any) => h.imageUrl === prevVis.imageUrl)) {
              hist.push({
                designVersion: prevVis.designVersion || prevVer,
                imageUrl: prevVis.imageUrl,
                generatedAt: prevVis.generatedAt
              });
            }
            newVis.visualizationHistory = hist;
          } else if (!newVis.status) {
            newVis.status = 'not_configured';
            newVis.designVersion = parsed.version;
            newVis.visualizationHistory = prevVis.visualizationHistory || [];
          }
          parsed.visualization = newVis;
        } else if (!parsed.version) {
          parsed.version = 1;
          if (!parsed.visualization) {
            parsed.visualization = { status: 'not_configured', designVersion: 1 };
          }
        }

        return { cleanText: aiResponseText, designState: parsed };
      }
    }
  } catch (err) {
    console.warn('Failed parsing json_design_state in chat.ts:', err);
  }
  return { cleanText: aiResponseText, designState: incomingDesignState };
}

function normalizeCatalogText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(tolng|tolong|brg|barang|produk2|barang2)\b/g, ' produk ')
    .replace(/\b(meja tv|mejatv|tv meja)\b/g, ' meja tv ')
    .replace(/\b(lemari baju|lemari pakaian|wardrop|wardrobe)\b/g, ' lemari pakaian wardrobe ')
    .replace(/\b(bopet|buffet|bufet)\b/g, ' bopet buffet ')
    .replace(/\b(harga|hrg|price)\b/g, ' harga ')
    .replace(/\b(stok|stock|tersedia|available)\b/g, ' stok tersedia ')
    .trim();
}

function catalogTokenScore(query: string, product: any): number {
  const normalizedQuery = normalizeCatalogText(query);
  const searchable = normalizeCatalogText([
    product.name, product.category, product.subcategory, product.description,
    product.material, product.color, product.unit
  ].join(' '));
  const queryTokens = normalizedQuery.split(/\s+/).filter(token => token.length >= 2);
  let score = 0;
  for (const token of queryTokens) {
    if (searchable.includes(token)) score += 3;
    else if (token.length >= 4 && searchable.split(' ').some((word: string) => word.startsWith(token.slice(0, -1)))) score += 1;
  }
  if (normalizeCatalogText(product.name) && normalizedQuery.includes(normalizeCatalogText(product.name))) score += 8;
  return score;
}

async function fetchCatalogContext(userMessage: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,category,subcategory,description,price,discount,stock,unit,image_url,images,arrival_type,created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      console.warn('Catalog retrieval warning:', error?.message || 'empty result');
      return '[KATALOG SUPABASE]\nKatalog tidak tersedia sementara. Jangan mengarang produk, harga, atau stok.\n[/KATALOG SUPABASE]';
    }

    const ranked = data
      .map((product: any) => ({ product, score: catalogTokenScore(userMessage, product) }))
      .sort((a, b) => b.score - a.score || Number(b.product.stock || 0) - Number(a.product.stock || 0));

    const hasSpecificMatch = ranked.some(item => item.score > 0);
    const selected = (hasSpecificMatch ? ranked.filter(item => item.score > 0) : ranked).slice(0, 12);
    const compactProducts = selected.map(({ product, score }) => ({
      id: product.id,
      name: product.name || '',
      category: product.category || '',
      subcategory: product.subcategory || '',
      description: product.description || '',
      price: Number(product.price) || 0,
      discount: Number(product.discount) || 0,
      final_price: Math.max(0, (Number(product.price) || 0) - (Number(product.discount) || 0)),
      stock: Number(product.stock) || 0,
      availability: Number(product.stock) > 0 ? 'tersedia' : 'habis',
      unit: product.unit || 'Pcs',
      arrival_type: product.arrival_type || '',
      image_url: product.image_url || null,
      relevance_score: score
    }));

    return `[KATALOG SUPABASE - DATA REAL-TIME]\n${JSON.stringify(compactProducts, null, 2)}\n\n[ATURAN KATALOG]\n- Ini adalah data produk aktual dari tabel products.
- Gunakan nama, kategori, subkategori, harga, diskon, final_price, stok, dan availability persis dari data.
- Jika customer meminta daftar barang, tampilkan daftar dari data ini; jangan hanya menjawab satu produk.
- Jika tidak ada kecocokan spesifik, katakan hasil spesifik tidak ditemukan dan boleh tawarkan kategori yang tersedia.
- Jangan mengarang SKU, harga, stok, ukuran, material, atau fitur yang tidak ada.\n[/KATALOG SUPABASE]\n\n[PEMAHAMAN WEBSITE]\nAGM-2 adalah katalog furniture/electronics dengan data produk Supabase, pencarian, filter kategori, detail gambar, stok, harga, transaksi kasir, dan chat konsultasi custom. Untuk pertanyaan tentang tampilan atau fitur website, jelaskan alur tersebut berdasarkan konteks ini dan data aktual.\n[/PEMAHAMAN WEBSITE]`;
  } catch (error: any) {
    console.warn('Catalog retrieval exception:', error?.message || error);
    return '[KATALOG SUPABASE]\nKatalog sementara tidak tersedia. Jangan mengarang detail produk.\n[/KATALOG SUPABASE]';
  }
}

async function callGeminiApi(apiKey: string, prompt: string): Promise<string | null> {
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) return null;

  // Global execution budget: 9s max to stay under Vercel's 10s limit
  const globalStart = Date.now();
  const GLOBAL_BUDGET_MS = 9000;

  const models = [
    'gemini-3.5-flash-lite',   // CONFIRMED WORKING (200 OK) with user's key
    'gemini-3.5-flash',        // Backup - often 503 high demand
  ];

  for (const model of models) {
    // Check if we still have time budget
    const elapsed = Date.now() - globalStart;
    if (elapsed >= GLOBAL_BUDGET_MS - 500) {
      console.warn(`Gemini API global budget exhausted (${elapsed}ms elapsed), stopping.`);
      break;
    }

    // Try each model up to 2 times (retry once on 503)
    for (let attempt = 0; attempt < 2; attempt++) {
      const remainingBudget = GLOBAL_BUDGET_MS - (Date.now() - globalStart);
      if (remainingBudget < 1000) break; // Not enough time for another attempt

      const perCallTimeout = Math.min(8000, remainingBudget - 200);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), perCallTimeout);

      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024
            }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            console.log(`Gemini API success with model ${model} (attempt ${attempt + 1})`);
            return text.trim();
          }
        } else if (resp.status === 503) {
          // High demand - retry after short delay
          console.warn(`Gemini API model ${model} HTTP 503 (attempt ${attempt + 1}), ${attempt === 0 ? 'retrying in 1s...' : 'moving to next model.'}`);
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
        } else if (resp.status === 404) {
          // Model not found - skip immediately, no retry
          console.warn(`Gemini API model ${model} HTTP 404: model not found, skipping.`);
          break;
        } else {
          const errText = await resp.text();
          console.warn(`Gemini API model ${model} HTTP ${resp.status} (attempt ${attempt + 1}):`, errText);
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          console.warn(`Gemini API call (${model}) timed out after ${Math.round(perCallTimeout / 1000)}s (attempt ${attempt + 1}), moving on.`);
        } else {
          console.warn(`Gemini API call (${model}) failed (attempt ${attempt + 1}):`, e);
        }
      }
      break; // Only retry on 503, break for other errors
    }
  }
  return null;
}

async function callOpenRouterApi(apiKey: string, prompt: string): Promise<string | null> {
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://agm-2.vercel.app',
        'X-Title': 'AGM Assistant'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content;
      if (text && text.trim()) return text.trim();
    }
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      console.warn('OpenRouter API call timed out after 6s.');
    } else {
      console.warn('OpenRouter API call failed:', e);
    }
  }
  return null;
}

async function generateDynamicConsultantFallback(userMessage: string, currentDesignState: any): Promise<string> {
  const msgLower = userMessage.toLowerCase().trim();

  // 1. Math calculator shortcut
  if (/^\d+\s*[-+*/]\s*\d+$/.test(msgLower)) {
    try {
      const [, left, operator, right] = msgLower.match(/^(\d+)\s*([-+*/])\s*(\d+)$/) || [];
      const a = Number(left);
      const b = Number(right);
      const result = operator === '+' ? a + b : operator === '-' ? a - b : operator === '*' ? a * b : a / b;
      return `Hasil perhitungan ${msgLower} adalah ${result}. Ada kebutuhan ukuran lemari, etalase, atau furniture lain yang ingin Anda konsultasikan?`;
    } catch {
      // pass
    }
  }

  // 2. Fetch live products from Supabase to provide real answers
  let liveProducts: any[] = [];
  try {
    const { data } = await supabase
      .from('products')
      .select('id,name,category,subcategory,description,price,discount,stock,unit')
      .limit(100);
    if (data && Array.isArray(data)) {
      liveProducts = data;
    }
  } catch (err) {
    console.warn('Fallback products read error:', err);
  }

  // Rank products by relevance
  const scoredProducts = liveProducts
    .map(p => ({ p, score: catalogTokenScore(userMessage, p) }))
    .sort((a, b) => b.score - a.score || Number(b.p.stock || 0) - Number(a.p.stock || 0));

  const matchedProducts = scoredProducts.filter(item => item.score > 0).map(item => item.p);

  // 3. Greeting intent
  if (msgLower === 'halo' || msgLower === 'hai' || msgLower === 'hi' || msgLower.startsWith('selamat') || msgLower.startsWith('halo ') || msgLower.startsWith('hai ')) {
    return 'Halo! Selamat datang di Toko AGM. Saya AGM Assistant siap membantu Anda: konsultasi produk, rekomendasi barang di katalog, cek harga & stok, perbandingan bahan kaca/ACP/aluminium, maupun rancangan custom furniture. Ada yang bisa saya bantu hari ini?';
  }

  // 4. Catalog query / Recommendation / Price / Stock intent
  const isCatalogQuery =
    matchedProducts.length > 0 ||
    msgLower.includes('katalog') ||
    msgLower.includes('produk') ||
    msgLower.includes('barang') ||
    msgLower.includes('harga') ||
    msgLower.includes('stok') ||
    msgLower.includes('rekomendasi') ||
    msgLower.includes('ada apa saja') ||
    msgLower.includes('cari') ||
    msgLower.includes('lemari') ||
    msgLower.includes('meja') ||
    msgLower.includes('etalase') ||
    msgLower.includes('piring') ||
    msgLower.includes('sepatu') ||
    msgLower.includes('kompor') ||
    msgLower.includes('tv');

  if (isCatalogQuery && !msgLower.includes('rancang custom') && !msgLower.includes('buatkan desain baru')) {
    const displayList = (matchedProducts.length > 0 ? matchedProducts : liveProducts).slice(0, 5);

    if (displayList.length > 0) {
      const itemsText = displayList.map((item, idx) => {
        const priceNum = Number(item.price) || 0;
        const discountNum = Number(item.discount) || 0;
        const finalPrice = Math.max(0, priceNum - discountNum);
        const stockNum = Number(item.stock) || 0;
        const stockStatus = stockNum > 0 ? `Tersedia (${stockNum} ${item.unit || 'unit'})` : 'Stok habis';
        const priceText = discountNum > 0
          ? `Rp ${finalPrice.toLocaleString('id-ID')} (Diskon dari Rp ${priceNum.toLocaleString('id-ID')})`
          : `Rp ${finalPrice.toLocaleString('id-ID')}`;

        return `${idx + 1}. **${item.name}**\n   - Kategori: ${item.subcategory || item.category || 'Furniture'}\n   - Harga: ${priceText}\n   - Status: ${stockStatus}`;
      }).join('\n\n');

      return `Berikut beberapa rekomendasi produk dari katalog AGM yang sesuai dengan kebutuhan Anda:\n\n${itemsText}\n\nSemua produk furniture AGM mengutamakan material kaca tempered/bening, ACP, dan rangka aluminium berkualitas. Apakah Anda ingin info detail spesifikasi produk di atas, atau ingin membuat rancangan ukuran custom?`;
    }
  }

  // 5. Custom design intent
  if (msgLower.includes('custom') || msgLower.includes('rancang') || msgLower.includes('buatkan') || msgLower.includes('pesan ukuran')) {
    let cat = 'dining_table';
    let subcat = 'Meja Makan Minimalis Aluminium Kaca';
    let len = 180;
    let wid = 90;
    let hei = 75;

    if (msgLower.includes('lemari') || msgLower.includes('pakaian')) {
      cat = 'wardrobe'; subcat = 'Lemari Pakaian ACP 2 Pintu'; len = 120; wid = 55; hei = 190;
    } else if (msgLower.includes('piring') || msgLower.includes('dapur')) {
      cat = 'kitchen_set'; subcat = 'Rak Piring Kaca Rangka Aluminium'; len = 100; wid = 45; hei = 160;
    } else if (msgLower.includes('sepatu')) {
      cat = 'wardrobe'; subcat = 'Lemari Sepatu Kaca ACP'; len = 80; wid = 35; hei = 120;
    } else if (msgLower.includes('tv') || msgLower.includes('bopet') || msgLower.includes('backdrop')) {
      cat = 'tv_cabinet'; subcat = 'Meja TV / Bopet Kaca Minimalis'; len = 160; wid = 45; hei = 60;
    } else if (msgLower.includes('etalase')) {
      cat = 'other'; subcat = 'Etalase Kaca Rangka Aluminium'; len = 150; wid = 50; hei = 100;
    }

    const nextVer = (currentDesignState?.version || 0) + 1;

    return `Tentu! Saya telah menyiapkan rancangan custom untuk **${subcat}** berbasis material khas AGM (kaca, ACP, dan aluminium). Silakan periksa kartu spesifikasi di bawah. Anda bisa menyesuaikan ukuran, warna rangka, atau langsung mengajukannya ke Admin AGM.\n\n\`\`\`json_design_state\n{\n  "version": ${nextVer},\n  "category": "${cat}",\n  "subcategory": "${subcat}",\n  "dimensions": {\n    "length": ${len},\n    "width": ${wid},\n    "height": ${hei},\n    "unit": "cm"\n  },\n  "capacity": 1,\n  "material": "kaca tempered + ACP + rangka aluminium",\n  "color": "clear glass / aluminium silver",\n  "finish": "powder coating / glossy",\n  "style": "minimalis modern",\n  "status": "draft",\n  "visualization": {\n    "status": "not_configured"\n  }\n}\n\`\`\``;
  }

  // 6. Material consultation / maintenance / general advice
  if (msgLower.includes('acp') || msgLower.includes('kaca') || msgLower.includes('aluminium') || msgLower.includes('bahan') || msgLower.includes('awet') || msgLower.includes('rayap') || msgLower.includes('air')) {
    return 'Di AGM, keunggulan utama furniture berbahan kaca, ACP (Aluminium Composite Panel), dan aluminium adalah:\n\n1. **100% Anti Rayap & Tahan Air**: Tidak akan keropos atau lapuk seperti kayu olahan saat terkena lembap.\n2. **Kuat & Ringan**: Rangka aluminium presisi kokoh dan tahan karat.\n3. **Mudah Dibersihkan**: Permukaan kaca dan ACP cukup dilap bersih dengan pembersih kaca atau kain microfiber.\n4. **Tampilan Modern**: Memberikan kesan showroom yang rapi, bersih, dan elegan.\n\nAda model lemari, meja, atau etalase tertentu yang ingin Anda bandingkan spesifikasinya?';
  }

  // 7. General professional consultant response
  return 'Saya siap membantu Anda dengan konsultasi produk toko AGM. Anda bisa menanyakan:\n- Rekomendasi barang di katalog (contoh: "ada lemari sepatu apa saja?", "harga meja kompor berapa?")\n- Cek ketersediaan stok & harga barang jadi\n- Konsultasi bahan kaca, ACP, dan aluminium\n- Perancangan custom furniture sesuai ukuran ruangan Anda\n\nSilakan beri tahu produk atau kebutuhan apa yang sedang Anda cari!';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { message, conversationId, attachment, currentDesignState } = req.body || {};
    const userId = (req.headers['x-user-id'] as string) || null;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, message: 'Missing or invalid message in request body.' });
    }

    try {
        const validConversationId = (conversationId && typeof conversationId === 'string' && conversationId.length === 36)
            ? conversationId
            : generateUuid();

        let messagePayload: string = message;
        if ((attachment && typeof attachment === 'object' && attachment.storage_url) || currentDesignState) {
            messagePayload = JSON.stringify({
                text: message,
                currentDesignState: currentDesignState || null,
                attachment: (attachment && typeof attachment === 'object' && attachment.storage_url) ? {
                    id: attachment.id || generateUuid(),
                    filename: attachment.filename || 'file',
                    mime_type: attachment.mime_type || 'application/octet-stream',
                    size: attachment.size || 0,
                    storage_url: attachment.storage_url,
                    source: attachment.source || 'furniture_reference'
                } : undefined
            });
        }

        // 1. Insert initial job record into Supabase
        const { data, error } = await supabase.from('ai_jobs').insert({
            conversation_id: validConversationId,
            user_id: userId,
            message: messagePayload,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).select();

        if (error) {
            console.error('Error inserting AI job:', error);
            return res.status(500).json({ success: false, message: 'Failed to create AI job.', error: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(500).json({ success: false, message: 'Failed to retrieve inserted AI job data.' });
        }

        const insertedJobId = data[0].id;

        // 2. Prepare Context Prompt for Cloud AI Execution
        const stateContext = currentDesignState && typeof currentDesignState === 'object' && currentDesignState.category
            ? `[CURRENT DESIGN STATE IN SESSION]\n\`\`\`json\n${JSON.stringify(currentDesignState, null, 2)}\n\`\`\`\n`
            : `[CURRENT DESIGN STATE IN SESSION]\n(Belum ada draf desain aktif).\n`;

        const catalogContext = await fetchCatalogContext(message);
        const fullPrompt = `${SYSTEM_CONSULTANT_INSTRUCTION}\n\n${catalogContext}\n\n${stateContext}Pertanyaan/Instruksi Customer:\n${message}`;

        // 3. Attempt direct AI completion via available Cloud APIs if configured
        const rawGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const rawOpenRouterKey = process.env.OPENROUTER_API_KEY;

        let aiResponseText: string | null = null;

        if (rawGeminiKey) {
            aiResponseText = await callGeminiApi(rawGeminiKey, fullPrompt);
        }
        if (!aiResponseText && rawOpenRouterKey) {
            aiResponseText = await callOpenRouterApi(rawOpenRouterKey, fullPrompt);
        }

        if (aiResponseText) {
            // Cloud AI key executed successfully! Parse and complete job.
            const { designState: updatedDesignState } = parseAndNormalizeDesignState(aiResponseText, currentDesignState);

            const updatePayload: any = {
                status: 'completed',
                response: aiResponseText,
                completed_at: new Date().toISOString()
            };
            if (updatedDesignState) {
                updatePayload.design_state = updatedDesignState;
            }

            try {
                await supabase.from('ai_jobs').update(updatePayload).eq('id', insertedJobId);
            } catch (dbErr) {
                console.warn('Supabase ai_jobs update warning:', dbErr);
            }

            return res.status(200).json({
                success: true,
                job_id: insertedJobId,
                conversation_id: validConversationId,
                status: 'completed',
                response: aiResponseText,
                design_state: updatedDesignState || null
            });
        }

        // 4. Wait up to 2.0s to see if python ai_worker.py (running locally) picks up and completes the job.
        const startTime = Date.now();
        while (Date.now() - startTime < 2000) {
            await new Promise(r => setTimeout(r, 400));
            const { data: jobCheck } = await supabase
                .from('ai_jobs')
                .select('status, response, design_state')
                .eq('id', insertedJobId)
                .single();

            if (jobCheck && (jobCheck.status === 'completed' || jobCheck.status === 'failed')) {
                return res.status(200).json({
                    success: true,
                    job_id: insertedJobId,
                    conversation_id: validConversationId,
                    status: jobCheck.status,
                    response: jobCheck.response || undefined,
                    design_state: jobCheck.design_state || null
                });
            }
        }

        // 5. Emergency Fallback Guard: If worker is offline AND Cloud API failed/missing,
        // generate a valid consultant response so the frontend NEVER gets stuck on "Menyiapkan rekomendasi..."!
        const fallbackText = await generateDynamicConsultantFallback(message, currentDesignState);
        const { designState: fallbackDesignState } = parseAndNormalizeDesignState(fallbackText, currentDesignState);

        const fallbackUpdatePayload: any = {
            status: 'completed',
            response: fallbackText,
            completed_at: new Date().toISOString()
        };
        if (fallbackDesignState) {
            fallbackUpdatePayload.design_state = fallbackDesignState;
        }

        try {
            await supabase.from('ai_jobs').update(fallbackUpdatePayload).eq('id', insertedJobId);
        } catch (dbErr) {
            console.warn('Supabase ai_jobs fallback update warning:', dbErr);
        }

        return res.status(200).json({
            success: true,
            job_id: insertedJobId,
            conversation_id: validConversationId,
            status: 'completed',
            response: fallbackText,
            design_state: fallbackDesignState || null
        });

    } catch (error: any) {
        console.error('Unhandled error in /api/ai/chat:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
    }
}


