import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type CatalogProduct,
  type ConversationTurn,
  type ConversationContext,
  type UserIntent,
  type FilterResult,
  classifyUserIntent,
  mergeConversationContext,
  filterAndRankCatalogProducts,
  generateGroundedResponse
} from '../_lib/intelligence.js';
import { verifyAuth } from '../_lib/auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = (process.env.SUPABASE_WORKER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '') as string;

const supabase = createClient(supabaseUrl, supabaseKey);

const generateUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// ============================================================================
// PRICE CLASSIFICATION HELPERS
// ============================================================================

/**
 * Checks if a value is a valid price input (not null/undefined/empty/whitespace/NaN/Infinity/negative).
 * Returns the original value if valid, otherwise returns null.
 * Does NOT coerce strings to numbers - raw validation only.
 */
function isValidPriceInput(value: unknown): value is number | string {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    // Allow numeric strings like "1000000", "0", "1.5"
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return false;
    if (num < 0) return false;
    return true;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    if (value < 0) return false;
    return true;
  }
  return false;
}

/**
 * Checks if a value is a valid discount input.
 * Similar to price but allows 0.
 */
function isValidDiscount(value: unknown): value is number | string {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return false;
    if (num < 0) return false;
    return true;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    if (value < 0) return false;
    return true;
  }
  return false;
}

// ============================================================================
// PRICE CLASSIFIER - Accepts raw database values (unknown) before coercion
// ============================================================================

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

/**
 * Classifies product final price from RAW database values.
 * Does NOT use Number() coercion before validation - handles raw types directly.
 *
 * @param price - Raw price from DB (could be number, string, null, undefined)
 * @param discount - Raw discount from DB (could be number, string, null, undefined)
 * @param explicitProductStatus - Optional explicit status from product schema (e.g., arrival_type)
 */
function classifyProductFinalPrice(
  price: unknown,
  discount: unknown,
  explicitProductStatus?: string
): PriceClassification {
  // ---- Validate price ----
  let validatedPrice = 0;
  let priceValid = false;

  if (isValidPriceInput(price)) {
    validatedPrice = typeof price === 'string' ? Number(price.trim()) : price;
    priceValid = true;
  } else if (price === null || price === undefined || (typeof price === 'string' && price.trim() === '')) {
    // Missing/empty price - not an error, just unpriced
    validatedPrice = 0;
    priceValid = false;
  } else {
    // Invalid price data (negative, NaN, Infinity, non-numeric string)
    return {
      status: 'invalid_price_data',
      originalPrice: 0,
      discount: 0,
      finalPrice: 0,
      isPriced: false,
      isPreorder: false,
      isValid: false
    };
  }

  // ---- Validate discount ----
  let validatedDiscount = 0;
  let discountValid = false;

  if (isValidDiscount(discount)) {
    validatedDiscount = typeof discount === 'string' ? Number(discount.trim()) : discount;
    discountValid = true;
  } else if (discount === null || discount === undefined || (typeof discount === 'string' && discount.trim() === '')) {
    validatedDiscount = 0;
    discountValid = false;
  } else {
    // Invalid discount (negative, NaN, Infinity, non-numeric string)
    return {
      status: 'invalid_price_data',
      originalPrice: priceValid ? validatedPrice : 0,
      discount: 0,
      finalPrice: 0,
      isPriced: false,
      isPreorder: false,
      isValid: false
    };
  }

  // ---- Calculate final price ----
  let finalPrice = validatedPrice - validatedDiscount;

  // Discount cannot exceed price
  if (finalPrice < 0) {
    return {
      status: 'invalid_price_data',
      originalPrice: validatedPrice,
      discount: validatedDiscount,
      finalPrice: 0,
      isPriced: false,
      isPreorder: false,
      isValid: false
    };
  }

  // ---- Determine status ----
  const isZeroPrice = finalPrice === 0 && validatedPrice === 0;
  let status: PriceStatus;
  let isPreorder = false;

  // Preorder only if explicit catalog status proves it (e.g., arrival_type)
  if (explicitProductStatus) {
    const normalized = String(explicitProductStatus).toLowerCase().trim();
    if (normalized === 'preorder' || normalized === 'pre-order' || normalized === 'custom') {
      isPreorder = true;
    }
  }

  if (isZeroPrice) {
    // Zero price without explicit preorder status = unpriced (custom/quote)
    status = isPreorder ? 'preorder' : 'unpriced';
  } else if (priceValid && validatedPrice > 0) {
    status = 'priced';
  } else {
    status = 'unpriced';
  }

  return {
    status,
    originalPrice: validatedPrice,
    discount: validatedDiscount,
    finalPrice,
    isPriced: status === 'priced',
    isPreorder,
    isValid: true
  };
}

const SYSTEM_CONSULTANT_INSTRUCTION = `
Anda adalah AGM Assistant, konsultan ahli digital resmi Toko CV Adi Guna Mandiri (AGM 2) Ketapang (spesialis furniture modern berbasis aluminium, kaca, dan ACP - Aluminium Composite Panel).
Anda memiliki penguasaan mendalam atas SELURUH tipe produk di katalog, subkategori, spesifikasi teknis, harga, stok, material, kelebihan fungsional, dan alur pemesanan custom di Toko AGM 2 Ketapang.

Karakter & Gaya Komunikasi:
- Ramah, sopan, percaya diri, solutif, dan profesional layaknya konsultan showroom furniture kelas atas.
- Ringkas, to the point, dan langsung menjawab inti kebutuhan customer.
- DILARANG menggunakan gaya AI generik (JANGAN gunakan emoji berlebihan, jangan berkata "Sebagai AI...").
- Gunakan bahasa Indonesia yang luwes, natural, dan memahami istilah lokal (Ketapang, Kalimantan Barat, istilah perabot dapur/rumah tangga).

================================================================================
PENGUASAAN PRODUK & SUBKATEGORI KATALOG AGM (MANDATORY KNOWLEDGE):
================================================================================
Toko AGM memiliki 15 subkategori produk furniture unggulan berbahan utama Aluminium, Kaca, dan ACP:

1. LEMARI PAKAIAN (21+ Model):
   - Model Sleding / Sliding: Pintu geser hemat ruang, rel halus anti macet, kaca/ACP modern (misal: UK 120 cm).
   - Model Oval / Toilet Rias + Roda: Dilengkapi cermin oval dan roda bawah untuk kemudahan tata ruang kamar.
   - Model Jumbo Motif + Pilar: Kombinasi mewah ruang gantungan pakaian panjang + rak lipatan bertingkat.
   - Model Stiker Premium: Finishing motif artistik elegan (misal: ukuran jumbo p180 x t180 cm).
   - Variasi Pintu: Tersedia 2 pintu, 3 pintu, 4 pintu, 5 pintu toilet, hingga 6 pintu custom.
   - Material: Full ACP atau kombinasi ACP + kaca riben/stiker + rangka aluminium tebal anti karat & anti rayap 100%.

2. MEJA KOMPOR (9+ Model):
   - Tipe Bentuk: Tipe U (kompor di tengah dengan sayap samping luas) dan Tipe L (sudut siku dapur efisien).
   - Varian Box: Pilihan "Tanpa Box" atau "+ Box" (dilengkapi kotak pengaman tabung gas LPG tertutup rapat dari serangga/tikus).
   - Finishing Atas & Dinding: Full kaca, Full ACP, atau kombinasi keramik/porselen tahan panas api kompor dan percikan minyak, sangat higienis serta mudah dilap.
   - Model Khusus: Meja kompor tanam presisi, serta meja kompor 6 pintu + wastafel cuci piring serbaguna.

3. MEJA PRASMANAN (9+ Model):
   - Meja saji katering & hajatan serbaguna (ukuran populer: 150 x 40 cm).
   - Lantai Porselen / Keramik: Tahan panas wadah chafing dish makanan berkuah/hangat.
   - Pilihan: 2 pintu, 4 pintu polos, 4 pintu motif pilar mewah.
   - Mobilitas: Tersedia opsi roda kokoh untuk kemudahan pindah lokasi saat acara.
   - Material: Rangka aluminium padat + ACP PVC tahan tumpahan air/kuah gulai, tidak akan lapuk.

4. LEMARI RAK PIRING & WASTAFEL (7+ Model):
   - Rak Piring Kaca 2 Box & 3 Box Atas: Rak penyimpanan cangkir, mangkok, dan piring basah/kering dengan tirisan higienis.
   - Lemari Rak Piring 3 & 4 Pintu: Ruang simpan peralatan makan tertutup kaca bening dengan sirkulasi udara baik.
   - Wastafel Aluminium 1 Lubang: Bak cuci piring aluminium anti karat, praktis, ringan, dan tahan rembesan air.

5. KITCHEN SET (6+ Model):
   - Kitchen Set 5 Pintu & 6 Pintu: Dilengkapi laci sendok/bumbu dan bak wastafel cuci piring.
   - Kitchen Set Kompor Tanam ACP: Desain terintegrasi modern untuk dapur minimalis masa kini.
   - Keunggulan Utama: 100% Bebas Rayap, Tahan Air & Lembap, Tidak Berjamur seperti serbuk kayu/MDF.

6. LEMARI PAJANG / LEMARI HIAS (7+ Model):
   - Lemari Pajang 1 Pintu + Lampu: Dilengkapi lampu sorot spotlight untuk memajang piala, piagam, kristal, parfum, atau tas branded.
   - Lemari Pajang 8 Pintu: Kapasitas super besar dengan kaca bening untuk koleksi perabot mewah.
   - Lemari Sudut Kaca: Mengoptimalkan sudut ruangan mati menjadi sudut estetik elegan.
   - Seri 4 Pintu & 6 Pintu Premium: Kaca tebal dengan rangka kokoh.

7. BOPET TV, MEJA TV & BACKDROP (8+ Model):
   - Bopet TV Kaca 2 Meter: Meja TV panjang mewah untuk TV LED ukuran besar.
   - Bopet TV Laci ACP: Laci tertutup rapi untuk konsol game, remote, dan kabel.
   - Bopet TV PVC: Aksen panel modern tahan lembap.
   - Backdrop Meja TV 240 cm: Panel dinding gantung mewah dengan pencahayaan ambient untuk ruang keluarga.
   - Meja TV Sekat: Berfungsi ganda sebagai meja hiburan sekaligus partisi pembatas ruangan tamu/keluarga.

8. LEMARI DAPUR (4+ Model):
   - Lemari dapur 2 pintu, 4 pintu, 5 pintu, dan 6 pintu berbahan aluminium kaca & ACP untuk menyimpan stok sembako, perabot memasak, dan blender/mixer.

9. LEMARI RAK KACA / TUPPERWARE (4+ Model):
   - Lemari rak kaca 2 pintu belah 4, 3 pintu tupperware, dan 4 pintu belah 8 untuk koleksi toples kue dan wadah tupperware dapur.

10. ETALASE (Model 1 Meter dsb):
    - Etalase kaca bening rangka aluminium untuk etalase jualan warung, konter HP, apotek, dan usaha display toko.

11. LEMARI SEPATU:
    - Lemari rak sepatu aluminium kaca/ACP dengan sirkulasi udara khusus agar sepatu tidak bau lembap dan aman dari debu.

12. MEJA RIAS:
    - Meja rias aluminium kaca dengan cermin bening luas dan laci kosmetik praktis.

================================================================================
KEUNGGULAN MATERIAL AGM DIBANDING KAYU:
================================================================================
1. Anti Rayap & Tahan Air: Daerah pesisir/tropis Ketapang yang lembap atau rawan banjir tidak merusak furniture AGM.
2. Rangka Aluminium: Ringan, kokoh, tidak berkarat, tidak melengkung, pilihan warna silver/anodized/hitam/putih.
3. ACP (Aluminium Composite Panel): Lembaran komposit kokoh tahan benturan, anti pecah, tahan lembap, mudah dibersihkan.
4. Kaca Tempered / Bening / Riben / Stiker: Tampilan modern, bersih, mewah, dan higienis.
5. Keramik / Porselen: Bagian meja saji & meja kompor tahan api kompor serta tumpahan minyak panas.

================================================================================
LAYANAN TOKO & ALUR PEMESANAN:
================================================================================
- Lokasi Toko: Jalan Rahadi Ismail, Desa Padang, Kecamatan Benua Kayong, Kabupaten Ketapang, Kalimantan Barat.
- Pengiriman: Dilayani armada toko khusus untuk area Ketapang dan sekitarnya agar barang kaca/aluminium aman sampai di rumah.
- Kontak Cepat: WhatsApp Toko AGM: 0896-9412-7723.
- Custom Order: Customer bisa request custom ukuran per centimeter, ubah jumlah pintu, pilih warna ACP, atau sesuaikan bentuk L/U.
- Harga: Transparan, diskon promosi langsung pada produk promo. Produk bertanda PRE-ORDER / Rp 0 siap dikonsultasikan biayanya sesuai spesifikasi ukuran yang diinginkan.

================================================================================
PENGUASAAN & ANALISIS GAMBAR PRODUK (MULTIMODAL VISION & KETERANGAN FOTO):
================================================================================
1. Membaca Teks / Stiker Ukuran pada Foto Produk:
   - Banyak foto produk katalog AGM memiliki stiker atau tulisan penanda ukuran nyata (contoh: "UK 90", "150 x 40", "p180 x t180", "120 cm", "2 meter").
   - Anda WAJIB menganalisis dan membaca teks/stiker tersebut saat customer bertanya ukuran atau rincian gambar.

2. Analisis Struktur Visual & Proporsi Fisik Furniture dari Gambar:
   - Jumlah Pintu & Daun: Hitung jumlah daun pintu secara visual (2 pintu, 3 pintu, 4 pintu, 5 pintu, 6 pintu).
   - Tipe Pintu & Rel: Identifikasi apakah pintu model sleding (geser rel hemat tempat) atau swing (engsel buka biasa).
   - Kaca & ACP: Amati jenis kaca (kaca riben/gelap, kaca bening, atau kaca berpola stiker artistik) dan panel komposit ACP (warna silver, hitam, putih, motif serat kayu).
   - Fitur Khusus: Identifikasi detail seperti lubang kompor tanam, wastafel cuci piring, keramik meja saji porselen, roda mobilitas, laci sendok/remote, lampu spotlight lemari pajang, atau sekat pembatas ruangan.

3. Estimasi Dimensi Standar AGM Berdasarkan Karakteristik Fisik:
   - Lemari Pakaian: Tinggi standar 180-200 cm, kedalaman 50-55 cm. Lebar per pintu ~45-50 cm (2 pintu = 90-100 cm, 3 pintu = 120-150 cm, 4 pintu = 160-200 cm).
   - Meja Kompor: Tinggi ergonomis memasak 75-85 cm, kedalaman 55-65 cm, panjang 100-180 cm (bentuk L atau U).
   - Meja Prasmanan: Standar panjang 150 cm x lebar 40 cm x tinggi 75 cm, lantai porselen keramik tahan panas chafing dish + roda.
   - Lemari Rak Piring: Tinggi 150-170 cm, lebar 45-50 cm, panjang 80-120 cm.
   - Bopet TV: Panjang 150-200 cm, backdrop TV dinding hingga 240 cm.

4. KEMAMPUAN MENYESUAIKAN UKURAN SECARA DINAMIS (CUSTOM SIZING PER CENTIMETER):
   - Toko AGM 2 Ketapang memiliki workshop/bengkel perakitan mandiri berbasis aluminium tebal dan ACP.
   - Semua ukuran di gambar/foto katalog adalah ukuran acuan/standar awal.
   - Kapan pun customer bertanya atau memiliki keterbatasan ukuran ruangan (misal: "ruangan saya hanya muat 120 cm", "bisa dibuat lebih pendek/lebar?", "sesuaikan dengan dapur saya"):
     a) Jelaskan bahwa ukuran bisa 100% DISESUAIKAN (custom per centimeter) di bengkel Toko AGM 2 Ketapang.
     b) Berikan solusi dinamis: jika customer mengecilkan ukuran lemari dari 150 cm (3 pintu) ke 120 cm (diubah jadi 2 pintu lebar), jelaskan penyesuaian fungsionalnya.
     c) Lampirkan spesifikasi baru dalam blok \`\`\`json_design_state\`\`\` yang mencerminkan ukuran dinamis yang disepakati.

================================================================================
LOGIKA MENJAWAB CUSTOMER (DYNAMIC & SMART):
================================================================================
1. Pertanyaan Katalog / Stok / Harga / Gambar / Ukuran:
   - Gunakan fakta nyata dari [KATALOG SUPABASE - DATA REAL-TIME] dan analisis gambar.
   - Sebutkan nama produk, subkategori, harga setelah diskon (jika ada diskon, sebutkan harga asli dan nominal diskonnya), status stok, serta ukuran dan karakteristik visual dari gambar.
   - Jika ditanya rekomendasi umum, berikan 2-4 pilihan produk terbaik dari subkategori terkait beserta alasannya.
   - Jika merekomendasikan produk tertentu dari katalog, WAJIB sertakan blok JSON di PALING AKHIR balasan:
\`\`\`json_product_recommendations
[{"id":"...","name":"...","subcategory":"...","price":0,"discount":0,"final_price":0,"stock":0,"unit":"Pcs","image_url":"..."}]
\`\`\`
   - Maksimal 3 produk, hanya produk yang punya image_url pada data katalog. Jangan mengarang id, harga, stok, atau image_url.
   - Blok ini hanya untuk sistem menampilkan foto produk. Jangan pernah menjelaskan atau menyebut blok ini ke customer.

2. Pertanyaan Perbandingan & Edukasi Bahan:
   - Jelaskan keunggulan material kaca, ACP, dan aluminium secara lugas dan komparatif.

3. Pertanyaan Custom / Penyesuaian Ukuran Dinamis:
   - Tanyakan ukuran ruangan atau kebutuhan khusus customer.
   - HANYA sertakan blok \`\`\`json_design_state\`\`\` jika customer secara eksplisit meminta rancangan custom atau mengubah spesifikasi desain aktif.
   - Format JSON Design State:
\`\`\`json_design_state
{
  "version": 1,
  "category": "wardrobe",
  "subcategory": "Lemari Pakaian ACP 3 Pintu Sleding",
  "dimensions": {
    "width": 150,
    "depth": 55,
    "height": 190,
    "unit": "cm"
  },
  "capacity": 1,
  "material": "kaca riben + ACP + rangka aluminium",
  "color": "hitam / silver",
  "finish": "powder coating",
  "style": "minimalis modern",
  "status": "draft",
  "visualization": {
    "status": "not_configured"
  }
}
\`\`\`
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
    .replace(/\b(tolng|tolong|brg|barang|produk2|barang2|item|etalase)\b/g, ' produk ')
    .replace(/\b(kicen|kicen set|khitcen|kitchen|kitchenset)\b/g, ' kitchen set ')
    .replace(/\b(bopet|bupet|buffet|bufet|credenza)\b/g, ' bopet buffet meja tv ')
    .replace(/\b(lemari baju|lemari pakaian|wardrop|wardrobe|almari)\b/g, ' lemari pakaian wardrobe ')
    .replace(/\b(rak piring|lemari piring|tempat piring|westafel|wastafel)\b/g, ' lemari rak piring wastafel ')
    .replace(/\b(meja kompor|tempat kompor|dudukan kompor|kompor tanam)\b/g, ' meja kompor ')
    .replace(/\b(meja prasmanan|prasmanan|katering|meja pesta)\b/g, ' meja prasmanan ')
    .replace(/\b(tupperware|taperwer|rak kaca|lemari hias|lemari pajang)\b/g, ' lemari pajang rak kaca tupperware ')
    .replace(/\b(harga|hrg|price|biaya|tarif|diskon|promo)\b/g, ' harga diskon ')
    .replace(/\b(stok|stock|tersedia|ready|ada)\b/g, ' stok tersedia ')
    .replace(/\b(sliding|sleding|geser)\b/g, ' sleding sliding ')
    .trim();
}

const CATALOG_STOPWORDS = new Set([
  'saya', 'ingin', 'mau', 'mulai', 'desain', 'design', 'custom', 'furniture', 'perabot',
  'barang', 'produk', 'toko', 'agm', 'padang', 'dan', 'di', 'ke', 'dari', 'yang', 'untuk',
  'dengan', 'bisa', 'ada', 'apakah', 'apa', 'tolong', 'minta', 'buatkan', 'rancang',
  'punya', 'ini', 'itu', 'dong', 'ya', 'kak', 'min', 'admin', 'halo', 'hai', 'siang',
  'sore', 'pagi', 'malam', 'bagus', 'mana', 'berapa', 'gimana', 'bagaimana', 'pesan',
  'bikin', 'cari', 'rekomendasi', 'dong'
]);

function catalogTokenScore(query: string, product: any): number {
  const normalizedQuery = normalizeCatalogText(query);
  const searchable = normalizeCatalogText([
    product.name, product.subcategory, product.description,
    product.material, product.color, product.unit, product.arrival_type || product.arrivalType
  ].join(' '));

  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter(token => token.length >= 2 && !CATALOG_STOPWORDS.has(token));

  if (queryTokens.length === 0) return 0;

  let score = 0;
  for (const token of queryTokens) {
    if (searchable.includes(token)) {
      score += 3;
    } else if (token.length >= 4 && searchable.split(' ').some((word: string) => word.startsWith(token.slice(0, -1)))) {
      score += 1;
    }
  }

  // Exact subcategory or name match boosts
  const normSubcat = normalizeCatalogText(product.subcategory);
  if (normSubcat && queryTokens.some(t => normSubcat.includes(t))) {
    score += 6;
  }

  const normName = normalizeCatalogText(product.name);
  if (normName && queryTokens.some(t => normName.includes(t))) {
    score += 10;
  }

  return score;
}

async function fetchCatalogContext(
  userMessage: string,
  sessionContext?: ConversationContext
): Promise<{
  catalogPrompt: string;
  topMatchedProduct: any | null;
  filterResult: FilterResult;
  intent: UserIntent;
  context: ConversationContext;
}> {
  const intent = classifyUserIntent(userMessage, sessionContext);
  const context = mergeConversationContext(sessionContext, userMessage, intent);

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,category,subcategory,description,price,discount,stock,unit,image_url,images,arrival_type,created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data || data.length === 0) {
      console.warn('Catalog retrieval warning:', error?.message || 'empty result');
      const emptyResult: FilterResult = {
        matchedProducts: [],
        filteredOutCount: 0,
        reasoning: 'Katalog kosong atau koneksi Supabase bermasalah',
        isBudgetConstrained: false,
        closestAlternatives: [],
        unmetConstraint: 'none'
      };
      return {
        catalogPrompt: '[KATALOG SUPABASE]\nKatalog tidak tersedia sementara. Jawab berdasarkan panduan resmi AGM.\n[/KATALOG SUPABASE]',
        topMatchedProduct: null,
        filterResult: emptyResult,
        intent,
        context
      };
    }

    const allProducts: CatalogProduct[] = data.map((p: any) => {
      const priceClassification = classifyProductFinalPrice(p.price, p.discount, p.arrival_type);
      return {
        id: p.id,
        name: p.name || '',
        category: p.category || '',
        subcategory: p.subcategory || '',
        description: p.description || '',
        price: priceClassification.originalPrice,
        discount: priceClassification.discount,
        final_price: priceClassification,
        stock: Number(p.stock) || 0,
        unit: p.unit || 'Pcs',
        arrival_type: p.arrival_type || '',
        image_url: p.image_url || (Array.isArray(p.images) && p.images[0]) || '',
        images: Array.isArray(p.images) ? p.images : []
      };
    });

    const filterResult = filterAndRankCatalogProducts(allProducts, context.constraints);
    const topMatched = filterResult.matchedProducts[0] || filterResult.closestAlternatives[0] || null;

    // Build real-time subcategory overview
    const subcatMap: Record<string, { count: number; minPrice: number; maxPrice: number; sample: string[] }> = {};
    for (const p of allProducts) {
      const sc = p.subcategory || p.category || 'Lainnya';
      const finalPriceInfo = p.final_price as PriceClassification;
      const effPrice = finalPriceInfo.isPriced && finalPriceInfo.finalPrice > 0 ? finalPriceInfo.finalPrice : 0;
      if (!subcatMap[sc]) {
        subcatMap[sc] = { count: 0, minPrice: effPrice || 999999999, maxPrice: effPrice, sample: [] };
      }
      subcatMap[sc].count += 1;
      if (effPrice > 0) {
        if (effPrice < subcatMap[sc].minPrice) subcatMap[sc].minPrice = effPrice;
        if (effPrice > subcatMap[sc].maxPrice) subcatMap[sc].maxPrice = effPrice;
      }
      if (p.name && subcatMap[sc].sample.length < 3 && p.name !== '-') {
        subcatMap[sc].sample.push(p.name);
      }
    }

    const taxonomySummary = Object.entries(subcatMap).map(([catName, info]) => {
      const minText = info.minPrice < 999999999 ? `Rp ${info.minPrice.toLocaleString('id-ID')}` : 'Rp 0 (Custom)';
      const maxText = info.maxPrice > 0 ? `Rp ${info.maxPrice.toLocaleString('id-ID')}` : 'Rp 0';
      return `- ${catName} (${info.count} produk, ${minText} - ${maxText}): Contoh: ${info.sample.join(', ')}`;
    }).join('\n');

    const candidateProducts = filterResult.matchedProducts.length > 0
      ? filterResult.matchedProducts.slice(0, 10)
      : filterResult.closestAlternatives.slice(0, 10);

    const compactProducts = candidateProducts.map(p => {
      const fc = p.final_price as PriceClassification;
      const finalPriceNum = fc.isPriced ? fc.finalPrice : 0;
      const hasValidDiscount = fc.discount > 0 && fc.originalPrice > 0;
      return {
        id: p.id,
        name: p.name,
        subcategory: p.subcategory || p.category,
        description: p.description,
        price: p.price,
        discount: p.discount,
        final_price: fc,
        stock: p.stock,
        availability: fc.isPreorder ? 'Pre-order (konfirmasi harga)' : (p.stock || 0) > 0 ? `Ready (${p.stock} ${p.unit})` : (fc.isPriced ? 'Custom' : 'Hubungi toko'),
        unit: p.unit || 'Pcs',
        image_url: p.image_url
      };
    });

    let integrityRule = '';
    if (context.constraints.maxPrice) {
      // Filter by budget programmatically using classifier status
      const budgetMatched = filterResult.matchedProducts.filter(p => {
        const fc = p.final_price as PriceClassification;
        return fc.isPriced && fc.finalPrice <= context.constraints.maxPrice!;
      });
      if (budgetMatched.length === 0) {
        integrityRule = `\n[PERINGATAN INTEGRITAS ANGGARAN]: Customer mencari produk dengan budget maksimal Rp ${context.constraints.maxPrice.toLocaleString('id-ID')}. TIDAK ADA produk katalog ready stock di bawah harga ini. Anda DILARANG mengarang produk atau mengubah harga. Jelaskan bahwa produk katalog ready stock mulai dari harga terendah di atas, dan tawarkan pembuatan custom ukuran di bengkel Toko AGM 2 Ketapang agar mendekati budget customer.\n`;
      } else {
        integrityRule = `\n[PANDUAN ANGGARAN]: Customer memiliki budget maksimal Rp ${context.constraints.maxPrice.toLocaleString('id-ID')}. Hanya rekomendasikan produk di atas yang harganya SESUAI budget (final_price <= Rp ${context.constraints.maxPrice.toLocaleString('id-ID')}).\n`;
      }
    }

    const catalogPrompt = `[RINGKASAN SELURUH SUBKATEGORI KATALOG TOKO AGM PADANG]\n${taxonomySummary}\n[/RINGKASAN SELURUH SUBKATEGORI]

[PRODUK KATALOG TERPILIH - DATA REAL-TIME SUPABASE]
${JSON.stringify(compactProducts, null, 2)}
${integrityRule}
[ATURAN PENTING PENGGUNAAN KATALOG]:
- Gunakan data di atas untuk menjawab customer secara akurat mengenai stok, harga, variasi, dan detail gambar produk.
- JANGAN PERNAH mengarang stok atau harga yang berbeda dari data Supabase di atas.
- Jika merekomendasikan produk, cantumkan blok \`\`\`json_product_recommendations di akhir jawaban dengan id, name, price, discount, final_price, stock, unit, dan image_url asli dari data.
[/PRODUK KATALOG TERPILIH]`;

    return {
      catalogPrompt,
      topMatchedProduct: topMatched,
      filterResult,
      intent,
      context
    };
  } catch (error: any) {
    console.warn('Catalog retrieval exception:', error?.message || error);
    const fallbackResult: FilterResult = {
      matchedProducts: [],
      filteredOutCount: 0,
      reasoning: 'Gagal membaca katalog',
      isBudgetConstrained: false,
      closestAlternatives: [],
      unmetConstraint: 'none'
    };
    return {
      catalogPrompt: '[KATALOG SUPABASE]\nKatalog sementara tidak tersedia. Gunakan panduan resmi AGM.\n[/KATALOG SUPABASE]',
      topMatchedProduct: null,
      filterResult: fallbackResult,
      intent,
      context
    };
  }
}

async function fetchImageBase64(url: string, timeoutMs: number = 2500): Promise<{ mime_type: string; data: string } | null> {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim().toLowerCase();
    if (!mimeType.startsWith('image/')) return null;
    const arrayBuffer = await resp.arrayBuffer();
    if (arrayBuffer.byteLength > 4 * 1024 * 1024) return null; // cap at 4MB
    const data = Buffer.from(arrayBuffer).toString('base64');
    return { mime_type: mimeType, data };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function callGeminiApi(
  apiKey: string,
  prompt: string,
  imagePart?: { mime_type: string; data: string } | null
): Promise<string | null> {
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) return null;

  // Global execution budget: 9s max to stay under Vercel's 10s limit
  const globalStart = Date.now();
  const GLOBAL_BUDGET_MS = 9000;

  const models = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-1.5-pro',
  ];

  for (const model of models) {
    const elapsed = Date.now() - globalStart;
    if (elapsed >= GLOBAL_BUDGET_MS - 500) {
      console.warn(`Gemini API global budget exhausted (${elapsed}ms elapsed), stopping.`);
      break;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      const remainingBudget = GLOBAL_BUDGET_MS - (Date.now() - globalStart);
      if (remainingBudget < 1000) break;

      const perCallTimeout = Math.min(8000, remainingBudget - 200);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), perCallTimeout);

      const parts: any[] = [{ text: prompt }];
      if (imagePart && imagePart.data) {
        parts.push({
          inline_data: {
            mime_type: imagePart.mime_type,
            data: imagePart.data
          }
        });
      }

      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
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
          console.warn(`Gemini API model ${model} HTTP 503 (attempt ${attempt + 1}), retrying...`);
          if (attempt === 0) {
            await new Promise(r => setTimeout(r, 800));
            continue;
          }
        } else if (resp.status === 404) {
          console.warn(`Gemini API model ${model} HTTP 404: model not found, skipping.`);
          break;
        } else {
          const errText = await resp.text();
          console.warn(`Gemini API model ${model} HTTP ${resp.status} (attempt ${attempt + 1}):`, errText);
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          console.warn(`Gemini API call (${model}) timed out.`);
        } else {
          console.warn(`Gemini API call (${model}) failed:`, e);
        }
      }
      break;
    }
  }
  return null;
}

async function callOpenRouterApi(apiKey: string, prompt: string, imageUrl?: string | null): Promise<string | null> {
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const content = (imageUrl && typeof imageUrl === 'string')
      ? [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      : prompt;

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
        messages: [{ role: 'user', content }],
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

async function callNineRouterApi(baseUrl: string, apiKey: string, prompt: string, imageUrl?: string | null): Promise<string | null> {
  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  if (!cleanBase) return null;

  const controller = new AbortController();
  // 30 seconds budget for local 9router LLM inference with reasoning
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const userContent = (imageUrl && typeof imageUrl === 'string')
      ? [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      : prompt;

    const resp = await fetch(`${cleanBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'my-combo',
        stream: false,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.7
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content;
      if (text && text.trim()) {
        console.log('9Router LLM API returned response successfully');
        return text.trim();
      }
    } else {
      const err = await resp.text();
      console.warn('9Router response non-ok:', resp.status, err);
    }
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      console.warn('9Router API call timed out after 15s.');
    } else {
      console.warn('9Router API call failed:', e.message || e);
    }
  }
  return null;
}

async function generateDynamicConsultantFallback(
  userMessage: string,
  currentDesignState: any,
  topProduct?: any,
  filterResult?: FilterResult,
  intent?: UserIntent,
  sessionContext?: ConversationContext
): Promise<string> {
  const activeIntent: UserIntent = intent || classifyUserIntent(userMessage, sessionContext);
  const activeConstraints = sessionContext?.constraints || { rawKeywords: [] };
  const msgLower = userMessage.toLowerCase().trim();

  // 1. Math shortcut
  if (/^\d+\s*[-+*/]\s*\d+$/.test(msgLower)) {
    try {
      const [, left, operator, right] = msgLower.match(/^(\d+)\s*([-+*/])\s*(\d+)$/) || [];
      const a = Number(left);
      const b = Number(right);
      const result = operator === '+' ? a + b : operator === '-' ? a - b : operator === '*' ? a * b : a / b;
      return `Hasil perhitungan ${msgLower} adalah ${result}. Ada ukuran ruangan atau furniture toko AGM yang ingin dihitung lebih lanjut?`;
    } catch {
      // pass
    }
  }

  // 2. Deterministic grounded answers (no LLM): policy, showroom, stock, colour, material, etc.
  const GROUNDED_INTENTS: UserIntent[] = [
    'showroom_info', 'operating_hours', 'shipping_policy', 'contact_info',
    'material_comparison', 'out_of_scope', 'stock_inquiry', 'color_inquiry',
    'category_overview', 'price_inquiry'
  ];
  if (GROUNDED_INTENTS.includes(activeIntent)) {
    return generateGroundedResponse(
      activeIntent,
      filterResult || { matchedProducts: [], filteredOutCount: 0, reasoning: '', isBudgetConstrained: false, closestAlternatives: [], unmetConstraint: 'none' },
      activeConstraints,
      sessionContext
    );
  }

  // 3. Product recommendation with a real, constraint-filtered match set
  if (
    filterResult &&
    (activeIntent === 'product_recommendation' || activeIntent === 'product_search') &&
    (filterResult.matchedProducts.length > 0 || filterResult.isBudgetConstrained)
  ) {
    return generateGroundedResponse('product_recommendation', filterResult, activeConstraints, sessionContext);
  }

  // 4. Fetch live products from Supabase
  let liveProducts: any[] = [];
  try {
    const { data } = await supabase
      .from('products')
      .select('id,name,category,subcategory,description,price,discount,stock,unit,arrival_type,image_url,images')
      .order('created_at', { ascending: false })
      .limit(100);
    if (data && Array.isArray(data)) {
      liveProducts = data.filter(p => p.name && p.name !== '-');
    }
  } catch (err) {
    console.warn('Fallback products read error:', err);
  }

  // Rank products by relevance
  const scoredProducts = liveProducts
    .map(p => ({ p, score: catalogTokenScore(userMessage, p) }))
    .sort((a, b) => b.score - a.score || Number(b.p.stock || 0) - Number(a.p.stock || 0));

  const matchedProducts = scoredProducts.filter(item => item.score > 0).map(item => item.p);
  const targetProduct = topProduct || (matchedProducts.length > 0 ? matchedProducts[0] : null);

  // 3. Greeting intent
  if (msgLower === 'halo' || msgLower === 'hai' || msgLower === 'hi' || msgLower.startsWith('selamat') || msgLower.startsWith('halo ') || msgLower.startsWith('hai ')) {
    return 'Halo! Selamat datang di Toko CV Adi Guna Mandiri (AGM 2) Ketapang. Saya AGM Assistant, konsultan produk spesialis furniture aluminium, kaca, dan ACP.\n\nSaya siap membantu Anda:\n1. Cek katalog & stok 15 subkategori produk (lemari pakaian, meja kompor, meja prasmanan, kitchen set, bopet TV, lemari pajang, wastafel, dll).\n2. Konsultasi bahan anti rayap & tahan air.\n3. Info harga, diskon, dan pengiriman wilayah Ketapang.\n4. Perancangan custom furniture sesuai ukuran ruangan Anda.\n\nAda produk atau kebutuhan apa yang ingin Anda cari hari ini?';
  }

  // 4. Inquire about all available categories ("ada kategori apa saja?", "produk apa saja yang dijual?")
  if (msgLower.includes('kategori apa') || msgLower.includes('ada apa saja') || msgLower.includes('semua produk') || msgLower.includes('daftar produk') || msgLower.includes('katalog apa')) {
    const subcats = [...new Set(liveProducts.map(p => p.subcategory || p.category).filter(Boolean))];
    const subcatList = subcats.map((sc, i) => `${i + 1}. **${sc}**`).join('\n');
    return `Toko CV Adi Guna Mandiri (AGM 2) Ketapang menyediakan 15 lini furniture modern berbahan aluminium, kaca, dan ACP:\n\n${subcatList}\n\nSemua produk kami anti rayap, anti lapuk, dan tahan air. Anda bisa menanyakan salah satu kategori di atas untuk melihat model, harga, dan ketersediaan stok!`;
  }

  // 5. Grounded showroom answer if intent matches
  if (activeIntent === 'showroom_info' || activeIntent === 'operating_hours' || activeIntent === 'shipping_policy') {
    return generateGroundedResponse(activeIntent, filterResult || { matchedProducts: [], filteredOutCount: 0, reasoning: '', isBudgetConstrained: false, closestAlternatives: [], unmetConstraint: 'none' }, activeConstraints, sessionContext);
  }

  // 6. Custom Design Intent (Pemesanan & Perancangan Custom)
  const isCustomIntent = [
    'custom', 'rancang', 'buatkan', 'desain baru', 'mulai desain', 'desain custom',
    'bikin custom', 'pesan custom', 'bikin lemari', 'bikin meja', 'bikin dapur',
    'bikin kitchen', 'pesan ukuran', 'request ukuran', 'sesuaikan ukuran', 'rancangan'
  ].some(k => msgLower.includes(k));

  if (isCustomIntent) {
    let cat = 'wardrobe';
    let subcat = 'Lemari Pakaian ACP 3 Pintu Sleding';
    let len = 150;
    let wid = 55;
    let hei = 190;
    let mat = 'kaca riben + ACP + rangka aluminium';
    let introText = '';

    if (msgLower.includes('kompor')) {
      cat = 'table'; subcat = 'Meja Kompor Type U Box ACP'; len = 130; wid = 65; hei = 80; mat = 'rangka aluminium + ACP + lantai keramik tahan panas';
      introText = 'Tentu! Toko AGM memproduksi **Meja Kompor Custom** anti rayap dan tahan panas api kompor per centimeter. Anda bisa request bentuk L atau U, dilengkapi box tabung gas, bak wastafel, atau lubang kompor tanam presisi.';
    } else if (msgLower.includes('prasmanan')) {
      cat = 'table'; subcat = 'Meja Prasmanan 4 Pintu Keramik Roda'; len = 150; wid = 40; hei = 80; mat = 'aluminium + porselen keramik + ACP PVC + roda';
      introText = 'Siap! Untuk **Meja Prasmanan Custom**, kami rancang khusus dengan lantai porselen keramik tahan wadah saji panas dan roda kokoh untuk kemudahan acara hajatan/katering Anda.';
    } else if (msgLower.includes('piring') || msgLower.includes('wastafel') || msgLower.includes('cuci')) {
      cat = 'kitchen_set'; subcat = 'Lemari Rak Piring 3 Pintu Wastafel Aluminium'; len = 110; wid = 45; hei = 160; mat = 'aluminium + kaca bening + bak wastafel';
      introText = 'Tentu! Toko AGM melayani custom **Lemari Rak Piring & Wastafel** higienis anti karat 100% tahan rembesan air.';
    } else if (msgLower.includes('kitchen') || msgLower.includes('dapur')) {
      cat = 'kitchen_set'; subcat = 'Kitchen Set 5 Pintu Kompor Tanam ACP'; len = 200; wid = 60; hei = 85; mat = 'full ACP + rangka aluminium kokoh';
      introText = 'Tentu! **Kitchen Set Custom AGM** dibuat dari rangka aluminium tebal dan ACP anti rayap & tahan air, jauh lebih awet dibandingkan kitchen set kayu/MDF.';
    } else if (msgLower.includes('tv') || msgLower.includes('bopet') || msgLower.includes('backdrop')) {
      cat = 'tv_cabinet'; subcat = 'Backdrop Meja TV 240 Kaca ACP'; len = 240; wid = 45; hei = 180; mat = 'rangka aluminium + ACP marmer/kayu + kaca';
      introText = 'Siap! Kami rancang **Meja TV / Backdrop Custom** modern mewah dengan perpaduan panel ACP dan kaca elegan sesuai ukuran dinding ruang keluarga Anda.';
    } else if (msgLower.includes('pajang') || msgLower.includes('hias')) {
      cat = 'wardrobe'; subcat = 'Lemari Pajang 1 Pintu Lampu Spotlight'; len = 50; wid = 45; hei = 190; mat = 'kaca tempered bening + rangka aluminium';
      introText = 'Tentu! **Lemari Pajang Custom** kaca bening dengan lampu sorot spotlight estetik untuk koleksi berharga Anda.';
    } else if (msgLower.includes('etalase')) {
      cat = 'other'; subcat = 'Etalase Kaca Aluminium 1.5 Meter'; len = 150; wid = 50; hei = 100; mat = 'kaca bening + rangka aluminium';
      introText = 'Siap! Kami siap merakit **Etalase Kaca Custom** presisi untuk tempat usaha toko atau warung Anda.';
    } else if (msgLower.includes('sepatu')) {
      cat = 'wardrobe'; subcat = 'Lemari Sepatu Kaca ACP 4 Susun'; len = 85; wid = 35; hei = 120; mat = 'aluminium + ACP ventilasi';
      introText = 'Tentu! **Lemari Sepatu Custom** aluminium kaca/ACP dengan sirkulasi udara baik agar sepatu tidak lembap dan bebas debu.';
    } else if (msgLower.includes('lemari') || msgLower.includes('pakaian') || msgLower.includes('baju')) {
      cat = 'wardrobe'; subcat = 'Lemari Pakaian ACP 3 Pintu Sleding'; len = 150; wid = 55; hei = 190; mat = 'kaca riben + ACP + rangka aluminium';
      introText = 'Tentu! Toko AGM Padang spesialis pembuatan **Lemari Pakaian Custom** berbahan aluminium tebal dan ACP (pilihan pintu sleding/swing, 2 hingga 6 pintu, cermin oval, dan motif stiker elegan).';
    } else {
      // General custom request (misal: "Saya ingin mulai desain custom furniture")
      introText = 'Selamat datang di layanan **Custom Furniture Toko CV Adi Guna Mandiri (AGM 2) Ketapang**!\n\nKami memproduksi furniture mandiri berbasis rangka aluminium kokoh, kaca berkualitas, dan panel ACP tahan air & 100% anti rayap per centimeter sesuai ukuran ruangan rumah Anda.\n\nUntuk memulai perancangan custom, silakan beri tahu kami:\n1. **Jenis Furniture**: (Lemari pakaian, Meja kompor tipe L/U, Kitchen set, Meja prasmanan, Bopet TV, atau Lemari pajang)\n2. **Ukuran Ruangan**: (Panjang x Lebar/Kedalaman x Tinggi dalam cm)\n3. **Kebutuhan Khusus**: (Jumlah pintu, pintu sleding atau engsel, laci, wastafel, atau kompor tanam)\n\nSebagai langkah awal, kami telah menyiapkan kartu draf spesifikasi di bawah. Anda bisa langsung menyampaikan ukuran yang diinginkan untuk kami perbarui secara dinamis:';
    }

    const nextVer = (currentDesignState?.version || 0) + 1;

    return `${introText}\n\nSilakan tinjau kartu spesifikasi desain di bawah ini. Anda dapat menyampaikan perubahan ukuran atau langsung mengajukannya ke Admin Toko CV Adi Guna Mandiri (AGM 2) Ketapang.\n\n\`\`\`json_design_state\n{\n  "version": ${nextVer},\n  "category": "${cat}",\n  "subcategory": "${subcat}",\n  "dimensions": {\n    "width": ${len},\n    "depth": ${wid},\n    "height": ${hei},\n    "unit": "cm"\n  },\n  "capacity": 1,\n  "material": "${mat}",\n  "color": "hitam / silver / motif kayu",\n  "finish": "powder coating / glossy",\n  "style": "minimalis modern",\n  "status": "draft",\n  "visualization": {\n    "status": "not_configured"\n  }\n}\n\`\`\``;
  }

  // 7. Visual Image & Dimension Analysis & Dynamic Room Adaptation (Highest priority for product sizing / photos)
  const isDimensionOrVisualQuery = [
    'ukuran', 'dimensi', 'panjang', 'lebar', 'tinggi', 'gambar', 'foto', 'lihat',
    'stiker', 'muat', 'sesuaikan', 'dikecilkan', 'dibesarkan', 'ruangan', 'dapur',
    'kamar', 'cm', 'meter', 'detail', 'bentuk', 'pintu', 'spek', 'spesifikasi'
  ].some(k => msgLower.includes(k));

  if (isDimensionOrVisualQuery && targetProduct) {
    const name = targetProduct.name || '';
    const desc = targetProduct.description || '';
    const combined = `${name} ${desc}`;
    const cLower = combined.toLowerCase();

    let width = 150;
    let depth = 55;
    let height = 190;
    let category = 'wardrobe';
    let subcategory = targetProduct.subcategory || targetProduct.category || name;

    const xMatch = combined.match(/(\d+)\s*(?:x|kali|X)\s*(\d+)/i);
    const ukMatch = combined.match(/(?:UK|ukuran|uk)\s*(\d+)/i);
    const meterMatch = combined.match(/(\d+(?:[.,]\d+)?)\s*(?:meter|m)\b/i);

    if (xMatch) {
      width = parseInt(xMatch[1], 10);
      depth = parseInt(xMatch[2], 10);
      if (width < depth) { const tmp = width; width = depth; depth = tmp; }
    } else if (ukMatch) {
      width = parseInt(ukMatch[1], 10);
    } else if (meterMatch) {
      width = Math.round(parseFloat(meterMatch[1].replace(',', '.')) * 100);
    }

    if (cLower.includes('kompor')) {
      category = 'table';
      height = 80;
      if (!xMatch) { width = 130; depth = 60; }
    } else if (cLower.includes('prasmanan')) {
      category = 'table';
      height = 75;
      if (!xMatch) { width = 150; depth = 40; }
    } else if (cLower.includes('piring') || cLower.includes('wastafel')) {
      category = 'kitchen_set';
      height = 160;
      if (!xMatch) { width = 100; depth = 45; }
    } else if (cLower.includes('tv') || cLower.includes('bopet') || cLower.includes('backdrop')) {
      category = 'tv_cabinet';
      height = cLower.includes('backdrop') ? 180 : 60;
      if (!xMatch) { width = 180; depth = 45; }
    } else if (cLower.includes('pajang') || cLower.includes('hias')) {
      category = 'wardrobe';
      height = 190;
      if (!xMatch) { width = 60; depth = 45; }
    } else if (cLower.includes('sepatu')) {
      category = 'wardrobe';
      height = 120;
      if (!xMatch) { width = 85; depth = 35; }
    } else {
      category = 'wardrobe';
      height = 190;
      if (!xMatch && !ukMatch) {
        if (cLower.includes('2 pintu') || cLower.includes('2 pt')) width = 90;
        else if (cLower.includes('3 pintu') || cLower.includes('3 pt')) width = 150;
        else if (cLower.includes('4 pintu') || cLower.includes('4 pt')) width = 180;
      }
    }

    let mat = 'Aluminium tebal + Kaca + ACP anti rayap & tahan air';
    if (cLower.includes('proslen') || cLower.includes('keramik')) mat = 'Rangka aluminium + Lantai keramik porselen tahan panas';
    else if (cLower.includes('full acp')) mat = 'Full ACP (Aluminium Composite Panel) tahan benturan & anti lapuk';
    else if (cLower.includes('kaca')) mat = 'Aluminium kokoh + Kaca riben / bening higienis';

    const priceClassification = classifyProductFinalPrice(targetProduct.price, targetProduct.discount, targetProduct.arrival_type);
    const finalPrice = priceClassification.finalPrice;
    const priceFormatted = priceClassification.status === 'priced' && finalPrice > 0 ? `Rp ${finalPrice.toLocaleString('id-ID')}` : priceClassification.status === 'preorder' ? 'Pre-order (konfirmasi harga)' : priceClassification.status === 'invalid_price_data' ? 'Harga belum dapat diverifikasi, silakan hubungi toko.' : 'Harga belum tersedia, silakan hubungi toko.';

    const nextVer = (currentDesignState?.version || 0) + 1;

    return `Berdasarkan analisis keterangan & detail gambar produk **${name}**:\n\n` +
      `1. **Ukuran Standar pada Foto**: Panjang/Lebar Depan **${width} cm**, Kedalaman/Lebar Samping **${depth} cm**, Tinggi **${height} cm**.\n` +
      `2. **Karakteristik Fisik & Gambar**:\n` +
      `   - Bahan: ${mat}\n` +
      `   - Detail: ${desc || 'Rangka aluminium presisi dengan finishing rapi dan kokoh'}\n` +
      `   - Harga: ${priceFormatted} (${targetProduct.stock > 0 ? `Ready ${targetProduct.stock} unit` : 'Pre-order / Custom'})\n\n` +
      `3. **Penyesuaian Dinamis (Custom Sizing)**:\n` +
      `   Ukuran di atas adalah ukuran standar acuan pada gambar produk. Karena Toko AGM 2 Ketapang memiliki workshop mandiri, **seluruh ukuran dapat disesuaikan secara dinamis per centimeter** sesuai luas ruangan atau tata letak rumah Anda! Anda bisa memperkecil, memperlebar, atau mengubah susunan pintu/sekatnya.\n\n` +
      `Berikut draf spesifikasi yang siap disesuaikan:\n\n` +
      `\`\`\`json_design_state\n` +
      `{\n` +
      `  "version": ${nextVer},\n` +
      `  "category": "${category}",\n` +
      `  "subcategory": "${subcategory}",\n` +
      `  "dimensions": {\n` +
      `    "width": ${width},\n` +
      `    "depth": ${depth},\n` +
      `    "height": ${height},\n` +
      `    "unit": "cm"\n` +
      `  },\n` +
      `  "capacity": 1,\n` +
      `  "material": "${mat}",\n` +
      `  "color": "hitam / silver / motif kayu",\n` +
      `  "finish": "powder coating / glossy",\n` +
      `  "style": "minimalis modern",\n` +
      `  "status": "draft",\n` +
      `  "visualization": {\n` +
      `    "status": "not_configured"\n` +
      `  }\n` +
      `}\n` +
      `\`\`\``;
  }

  // 8. Material consultation & comparison (ACP, Aluminium, Kaca vs Kayu)
  if (msgLower.includes('acp') || msgLower.includes('bahan') || msgLower.includes('rayap') || msgLower.includes('air') || msgLower.includes('kayu') || msgLower.includes('awet') || msgLower.includes('lapuk') || msgLower.includes('keunggulan')) {
    return 'Di AGM 2 Ketapang, seluruh furniture diproduksi menggunakan kombinasi material modern unggulan:\n\n1. **Anti Rayap & Tahan Air**: Sangat cocok untuk iklim pesisir/tropis Ketapang. Bebas risiko lapuk, menggelembung, atau rapuh seperti furniture serbuk kayu/MDF saat terkena rembesan air atau banjir.\n2. **Rangka Aluminium Berkualitas**: Ringan, kokoh, tidak berkarat, dan tidak melengkung, dengan finishing rapi anodized/silver/hitam.\n3. **Panel ACP (Aluminium Composite Panel)**: Material komposit aluminium tebal yang anti pecah, tahan benturan, tidak berjamur, dan tersedia aneka warna elegan (hitam, putih, motif kayu, merah).\n4. **Kaca Pilihan & Lantai Keramik/Porselen**: Bagian meja kompor dan meja prasmanan dilapisi keramik/porselen tahan panas api dan kuah panas, sangat mudah dilap bersih dari cipratan minyak.\n\nProduk mana yang ingin Anda bandingkan spesifikasi bahannya?';
  }

  // 9. Ready Stock vs Pre-order Query
  if (msgLower.includes('ready') || msgLower.includes('siap kirim') || msgLower.includes('stok tersedia') || msgLower.includes('stok ready')) {
    const readyItems = liveProducts.filter(p => Number(p.stock) > 0).slice(0, 6);
    if (readyItems.length > 0) {
      const listText = readyItems.map((item, idx) => {
        const pc = classifyProductFinalPrice(item.price, item.discount, item.arrival_type);
        const eff = pc.isPriced ? pc.finalPrice : 0;
        return `${idx + 1}. **${item.name}**\n   - Subkategori: ${item.subcategory || item.category}\n   - Harga: ${pc.status === 'priced' ? `Rp ${eff.toLocaleString('id-ID')}` : pc.status === 'preorder' ? 'Pre-order (konfirmasi harga)' : pc.status === 'invalid_price_data' ? 'Harga belum dapat diverifikasi, silakan hubungi toko.' : 'Harga belum tersedia, silakan hubungi toko.'}\n   - Stok: **${item.stock} ${item.unit || 'pcs'} tersedia**`;
      }).join('\n\n');
      return `Berikut beberapa produk AGM yang saat ini **READY STOCK** dan siap dikirim:\n\n${listText}\n\nBarang ready stock bisa langsung diantar armada toko ke lokasi Anda di Ketapang. Apakah Anda tertarik dengan salah satunya?`;
    }
  }

  // 10. Specific Catalog inquiry / Match intent
  const isCatalogQuery =
    matchedProducts.length > 0 ||
    [
      'katalog', 'produk', 'harga', 'stok', 'rekomendasi',
      'lemari', 'meja', 'kompor', 'prasmanan', 'piring', 'dapur', 'kitchen',
      'tv', 'bopet', 'etalase', 'sepatu', 'rias'
    ].some(k => msgLower.includes(k));

  if (isCatalogQuery && matchedProducts.length > 0) {
    const displayList = matchedProducts.slice(0, 6);
    const itemsText = displayList.map((item, idx) => {
      const fc = classifyProductFinalPrice(item.price, item.discount, item.arrival_type);
      const stockNum = Number(item.stock) || 0;

      let priceText: string;
      let stockStatus: string;

      if (!fc.isValid) {
        priceText = 'Harga tidak valid';
        stockStatus = 'Data harga error';
      } else if (fc.isPreorder) {
        priceText = 'Harga hubungi toko (Pre-order)';
        stockStatus = 'Pre-order / Custom';
      } else if (fc.isPriced) {
        const finalPrice = fc.finalPrice;
        if (fc.discount > 0 && fc.originalPrice > 0) {
          priceText = `Rp ${finalPrice.toLocaleString('id-ID')} (Diskon Rp ${fc.discount.toLocaleString('id-ID')} dari Rp ${fc.originalPrice.toLocaleString('id-ID')})`;
        } else {
          priceText = `Rp ${finalPrice.toLocaleString('id-ID')}`;
        }
        stockStatus = stockNum > 0 ? `Ready (${stockNum} ${item.unit || 'unit'})` : 'Habis / Custom';
      } else {
        priceText = 'Harga hubungi toko';
        stockStatus = stockNum > 0 ? `Ready (${stockNum} ${item.unit || 'unit'})` : 'Pre-order / Custom';
      }

      const tagText = item.arrival_type ? ` [${item.arrival_type}]` : '';
      const descText = item.description ? `\n   - Spek: ${item.description}` : '';

      return `${idx + 1}. **${item.name}**${tagText}\n   - Subkategori: ${item.subcategory || item.category || 'Furniture'}\n   - Harga: ${priceText}\n   - Status: ${stockStatus}${descText}`;
    }).join('\n\n');

    return `Berikut produk dari katalog Toko CV Adi Guna Mandiri (AGM 2) Ketapang yang sesuai dengan pencarian Anda:\n\n${itemsText}\n\nSeluruh produk di atas terbuat dari rangka aluminium kokoh, kaca tebal, dan panel ACP tahan air & anti rayap. Apakah Anda berminat memesan atau ingin konsultasi ukuran tertentu?`;
  }

  // 11. Conversational Acknowledgement & General Helpful Fallback
  if (msgLower === 'ok' || msgLower === 'oke' || msgLower === 'siap' || msgLower.includes('terima kasih') || msgLower.includes('makasih')) {
    return 'Sama-sama! Senang bisa membantu Anda di Toko CV Adi Guna Mandiri (AGM 2) Ketapang. Jika ada produk lain yang ingin Anda tanyakan atau ingin memesan furniture custom, silakan sampaikan kapan saja!';
  }

  return 'Saya AGM Assistant siap membantu Anda di Toko CV Adi Guna Mandiri (AGM 2) Ketapang:\n\n- **Cek Produk & Stok**: Cari aneka lemari pakaian, meja kompor, meja prasmanan, rak piring, kitchen set, meja TV, dll.\n- **Desain Custom**: Buat perabot aluminium & ACP anti rayap sesuai ukuran ruangan rumah Anda.\n- **Konsultasi Bahan & Ukuran**: Analisis detail gambar foto dan panduan bahan tahan air.\n- **Info Toko & Pengiriman**: Layanan kirim area Ketapang dan kontak WhatsApp admin (0896-9412-7723).\n\nAda produk atau rencana perabot apa yang ingin Anda diskusikan?';
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { message, conversationId, attachment, currentDesignState, history: clientHistory } = req.body || {};
    const auth = await verifyAuth(req);
    const userId = auth.isAuthenticated ? auth.userId : null;

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

        // Generate a temporary guest-safe capability token.
        // Only its SHA-256 hash is persisted in the database.
        const accessToken = randomBytes(32).toString('base64url');
        const accessTokenHash = createHash('sha256')
            .update(accessToken)
            .digest('hex');

        // 1. Insert initial job record into Supabase
        const { data, error } = await supabase.from('ai_jobs').insert({
            conversation_id: validConversationId,
            user_id: userId,
            access_token_hash: accessTokenHash,
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

        // Reconstruct conversation history (from client payload or Supabase ai_jobs)
        let conversationHistory: ConversationTurn[] = Array.isArray(clientHistory) ? clientHistory : [];
        if (userId && conversationHistory.length === 0 && validConversationId) {
            try {
                let historyQuery = supabase
                    .from('ai_jobs')
                    .select('message, response, created_at')
                    .eq('conversation_id', validConversationId)
                    .eq('status', 'completed')
                    .order('created_at', { ascending: false })
                    .limit(4);

                if (userId) {
                    historyQuery = historyQuery.eq('user_id', userId);
                }

                const { data: pastJobs } = await historyQuery;
                if (pastJobs && pastJobs.length > 0) {
                    const chronological = [...pastJobs].reverse();
                    for (const pj of chronological) {
                        let userText = pj.message;
                        try {
                            if (userText && userText.startsWith('{')) {
                                const parsed = JSON.parse(userText);
                                if (parsed.text) userText = parsed.text;
                            }
                        } catch {}
                        if (userText && typeof userText === 'string') conversationHistory.push({ role: 'user', content: userText });
                        if (pj.response && typeof pj.response === 'string') conversationHistory.push({ role: 'assistant', content: pj.response });
                    }
                }
            } catch (histErr) {
                console.warn('Failed to fetch historical session context:', histErr);
            }
        }

        // Fold past turns into session context
        let priorContext: ConversationContext | undefined = undefined;
        for (const turn of conversationHistory) {
            if (turn.role === 'user') {
                const tIntent = classifyUserIntent(turn.content, priorContext);
                priorContext = mergeConversationContext(priorContext, turn.content, tIntent);
            }
        }

        // 2. Prepare Context Prompt for Cloud AI Execution
        const stateContext = currentDesignState && typeof currentDesignState === 'object' && currentDesignState.category
            ? `[CURRENT DESIGN STATE IN SESSION]\n\`\`\`json\n${JSON.stringify(currentDesignState, null, 2)}\n\`\`\`\n`
            : `[CURRENT DESIGN STATE IN SESSION]\n(Belum ada draf desain aktif).\n`;

        const { catalogPrompt, topMatchedProduct, filterResult, intent, context: activeContext } = await fetchCatalogContext(message, priorContext);

        // Detect relevant image URL (user attachment, active visualization, or top catalog product image)
        let targetImageUrl: string | null = null;
        if (attachment && typeof attachment === 'object' && attachment.storage_url) {
            const mime = (attachment.mime_type || '').toLowerCase();
            const fname = (attachment.filename || '').toLowerCase();
            if (mime.startsWith('image/') || fname.endsWith('.jpg') || fname.endsWith('.jpeg') || fname.endsWith('.png') || fname.endsWith('.webp')) {
                targetImageUrl = attachment.storage_url;
            }
        }
        if (!targetImageUrl && currentDesignState?.visualization?.imageUrl) {
            const msgLower = message.toLowerCase();
            if (msgLower.includes('visual') || msgLower.includes('gambar') || msgLower.includes('desain ini') || msgLower.includes('warna') || msgLower.includes('proporsi')) {
                targetImageUrl = currentDesignState.visualization.imageUrl;
            }
        }
        if (!targetImageUrl && topMatchedProduct?.image_url) {
            const msgLower = message.toLowerCase();
            const hasVisualOrDimensionCue = [
                'gambar', 'foto', 'lihat', 'tampak', 'ukuran', 'dimensi', 'panjang',
                'lebar', 'tinggi', 'stiker', 'muat', 'cm', 'meter', 'detail', 'bentuk',
                'pintu', 'sekat', 'rak', 'kaca', 'acp', 'kompor', 'wastafel'
            ].some(w => msgLower.includes(w));
            if (hasVisualOrDimensionCue) {
                targetImageUrl = topMatchedProduct.image_url;
            }
        }

        let imagePart: { mime_type: string; data: string } | null = null;
        if (targetImageUrl) {
            imagePart = await fetchImageBase64(targetImageUrl);
        }

        const imageInstruction = targetImageUrl
            ? `\n[CATATAN ANALISIS GAMBAR]: Disediakan gambar referensi produk/ruangan (${targetImageUrl}). Periksa gambar secara teliti: baca teks/stiker ukuran jika ada, hitung jumlah pintu/laci/sekat, amati bahan (kaca/ACP/aluminium/keramik), perhatikan proporsi, dan berikan rekomendasi ukuran dinamis yang pas untuk kebutuhan customer.\n`
            : '';

        const historySnippet = conversationHistory.length > 0
            ? `[KONTEKS RIWAYAT PERCAKAPAN SEBELUMNYA]:\n` + conversationHistory.slice(-4).map(h => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content.slice(0, 300)}`).join('\n') + `\n\n`
            : '';

        const fullPrompt = `${SYSTEM_CONSULTANT_INSTRUCTION}\n\n${catalogPrompt}\n\n${historySnippet}${imageInstruction}${stateContext}Pertanyaan/Instruksi Customer:\n${message}`;

        // Deterministic grounding gate: whenever the turn carries a hard constraint or a
        // policy/stock question, answer straight from Supabase rows instead of an LLM.
        // ponytail: full deterministic bypass for constrained turns; drop the gate if a
        // future provider is proven not to alter prices/stock.
        // Deterministic grounding gate: only bypass LLM for purely static, non-conversational
        // policy/location/hours queries or explicitly out-of-scope requests.
        // ponytail: Keep fast-path strictly for deterministic factual lookup; all product
        // recommendation, comparison, exploration, and custom inquiries must use the AI pipeline.
        const staticDeterministicIntents: UserIntent[] = [
            'showroom_info', 'operating_hours', 'shipping_policy', 'contact_info', 'out_of_scope'
        ];

        const isConversationalOrExploratory = /jelaskan|rekomendasi|pilihan|beda|perbedaan|bagus mana|mana yang cocok|saran|model apa saja|apa saja model|buatkan|custom|cari|tahu/i.test(message);

        if (staticDeterministicIntents.indexOf(intent) !== -1 && !isConversationalOrExploratory) {
            const groundedText = generateGroundedResponse(
                intent,
                filterResult,
                activeContext.constraints,
                activeContext
            );
            const groundedDesignState = parseAndNormalizeDesignState(groundedText, currentDesignState).designState;

            const { error: groundedUpdateError } = await supabase
                .from('ai_jobs')
                .update({
                    status: 'completed',
                    response: groundedText,
                    completed_at: new Date().toISOString()
                })
                .eq('id', insertedJobId);

            if (groundedUpdateError) {
                console.error('Supabase ai_jobs grounded update failed:', groundedUpdateError);
            }

            console.log(`[AI ROUTING] Fast-path deterministic bypass for intent '${intent}' (job ${insertedJobId})`);

            return res.status(200).json({
                success: true,
                job_id: insertedJobId,
                access_token: accessToken,
                conversation_id: validConversationId,
                status: 'completed',
                response: groundedText,
                design_state: groundedDesignState || null
            });
        }

        console.log(`[AI ROUTING] Queue-first worker dispatch for intent '${intent}' (job ${insertedJobId})`);

                // 3. Queue-first: return pending immediately. Worker claims job via claim_ai_job() RPC.
        return res.status(200).json({
            success: true,
            job_id: insertedJobId,
            access_token: accessToken,
            conversation_id: validConversationId,
            status: 'pending',
            response: null,
            design_state: null
        });

    } catch (error: any) {
        console.error('Unhandled error in /api/ai/chat:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
    }
}
