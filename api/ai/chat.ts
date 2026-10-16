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
Anda adalah AGM Assistant, konsultan ahli digital resmi Toko AGM Padang (spesialis furniture modern berbasis aluminium, kaca, dan ACP - Aluminium Composite Panel).
Anda memiliki penguasaan mendalam atas SELURUH tipe produk di katalog, subkategori, spesifikasi teknis, harga, stok, material, kelebihan fungsional, dan alur pemesanan custom di Toko AGM Padang.

Karakter & Gaya Komunikasi:
- Ramah, sopan, percaya diri, solutif, dan profesional layaknya konsultan showroom furniture kelas atas.
- Ringkas, to the point, dan langsung menjawab inti kebutuhan customer.
- DILARANG menggunakan gaya AI generik (JANGAN gunakan emoji berlebihan, jangan berkata "Sebagai AI...").
- Gunakan bahasa Indonesia yang luwes, natural, dan memahami istilah lokal (Padang, Minang, istilah perabot dapur/rumah tangga).

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
1. 100% Anti Rayap & Tahan Air: Daerah Padang yang lembap atau rawan banjir tidak merusak furniture AGM. Bebas keropos selamanya.
2. Rangka Aluminium: Ringan, kokoh, tidak berkarat, tidak melengkung, pilihan warna silver/anodized/hitam/putih.
3. ACP (Aluminium Composite Panel): Lembaran komposit kokoh tahan benturan, anti pecah, tahan lembap, mudah dibersihkan.
4. Kaca Tempered / Bening / Riben / Stiker: Tampilan modern, bersih, mewah, dan higienis.
5. Keramik / Porselen: Bagian meja saji & meja kompor tahan api kompor serta tumpahan minyak panas.

================================================================================
LAYANAN TOKO & ALUR PEMESANAN:
================================================================================
- Lokasi Toko: Kota Padang, Sumatera Barat.
- Pengiriman: Dilayani armada toko khusus untuk area Padang kota dan sekitarnya agar barang kaca/aluminium aman sampai di rumah.
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
   - Toko AGM Padang memiliki workshop/bengkel perakitan mandiri berbasis aluminium tebal dan ACP.
   - Semua ukuran di gambar/foto katalog adalah ukuran acuan/standar awal.
   - Kapan pun customer bertanya atau memiliki keterbatasan ukuran ruangan (misal: "ruangan saya hanya muat 120 cm", "bisa dibuat lebih pendek/lebar?", "sesuaikan dengan dapur saya"):
     a) Jelaskan bahwa ukuran bisa 100% DISESUAIKAN (custom per centimeter) di bengkel Toko AGM Padang.
     b) Berikan solusi dinamis: jika customer mengecilkan ukuran lemari dari 150 cm (3 pintu) ke 120 cm (diubah jadi 2 pintu lebar), jelaskan penyesuaian fungsionalnya.
     c) Lampirkan spesifikasi baru dalam blok \`\`\`json_design_state\`\`\` yang mencerminkan ukuran dinamis yang disepakati.

================================================================================
LOGIKA MENJAWAB CUSTOMER (DYNAMIC & SMART):
================================================================================
1. Pertanyaan Katalog / Stok / Harga / Gambar / Ukuran:
   - Gunakan fakta nyata dari [KATALOG SUPABASE - DATA REAL-TIME] dan analisis gambar.
   - Sebutkan nama produk, subkategori, harga setelah diskon (jika ada diskon, sebutkan harga asli dan nominal diskonnya), status stok, serta ukuran dan karakteristik visual dari gambar.
   - Jika ditanya rekomendasi umum, berikan 2-4 pilihan produk terbaik dari subkategori terkait beserta alasannya.

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

async function fetchCatalogContext(userMessage: string): Promise<{ catalogPrompt: string; topMatchedProduct: any | null }> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,category,subcategory,description,price,discount,stock,unit,image_url,images,arrival_type,created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data || data.length === 0) {
      console.warn('Catalog retrieval warning:', error?.message || 'empty result');
      return {
        catalogPrompt: '[KATALOG SUPABASE]\nKatalog tidak tersedia sementara. Jawab berdasarkan panduan resmi AGM.\n[/KATALOG SUPABASE]',
        topMatchedProduct: null
      };
    }

    // Build real-time subcategory overview
    const subcatMap: Record<string, { count: number; minPrice: number; maxPrice: number; sample: string[] }> = {};
    for (const p of data) {
      const sc = p.subcategory || p.category || 'Lainnya';
      const effPrice = Math.max(0, (Number(p.price) || 0) - (Number(p.discount) || 0));
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

    const ranked = data
      .map((product: any) => ({ product, score: catalogTokenScore(userMessage, product) }))
      .sort((a, b) => b.score - a.score || Number(b.product.stock || 0) - Number(a.product.stock || 0));

    const hasSpecificMatch = ranked.some(item => item.score > 0);
    const selected = (hasSpecificMatch ? ranked.filter(item => item.score > 0) : ranked).slice(0, 25);
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
      availability: Number(product.stock) > 0 ? 'tersedia' : 'pre-order / habis',
      unit: product.unit || 'Pcs',
      arrival_type: product.arrival_type || '',
      image_url: product.image_url || (Array.isArray(product.images) && product.images[0]) || '',
      relevance_score: score
    }));

    const catalogPrompt = `[RINGKASAN SELURUH SUBKATEGORI KATALOG TOKO AGM PADANG]\n${taxonomySummary}\n[/RINGKASAN SELURUH SUBKATEGORI]

[PRODUK KATALOG TERPILIH - DATA REAL-TIME SUPABASE]\n${JSON.stringify(compactProducts, null, 2)}\n
[ATURAN PENTING PENGGUNAAN KATALOG]:
- Gunakan data di atas untuk menjawab customer secara akurat mengenai stok, harga, variasi, dan detail gambar produk.
- Jika customer bertanya tentang tipe produk tertentu (misal lemari, meja kompor, prasmanan), sebutkan variasi yang ada di data.
- Jangan mengarang produk atau harga yang tidak ada di data Supabase.
- Jika ada potongan diskon, sebutkan secara menarik ("Harga Rp X didiskon Rp Y menjadi Rp Z").
[/PRODUK KATALOG TERPILIH]`;

    return {
      catalogPrompt,
      topMatchedProduct: (hasSpecificMatch && selected[0]) ? selected[0].product : null
    };
  } catch (error: any) {
    console.warn('Catalog retrieval exception:', error?.message || error);
    return {
      catalogPrompt: '[KATALOG SUPABASE]\nKatalog sementara tidak tersedia. Gunakan panduan resmi AGM.\n[/KATALOG SUPABASE]',
      topMatchedProduct: null
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

async function generateDynamicConsultantFallback(userMessage: string, currentDesignState: any, topProduct?: any): Promise<string> {
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

  // 2. Fetch live products from Supabase
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
    return 'Halo! Selamat datang di Toko AGM Padang. Saya AGM Assistant, konsultan produk spesialis furniture aluminium, kaca, dan ACP.\n\nSaya siap membantu Anda:\n1. Cek katalog & stok 15 subkategori produk (lemari pakaian, meja kompor, meja prasmanan, kitchen set, bopet TV, lemari pajang, wastafel, dll).\n2. Konsultasi bahan anti rayap & tahan air.\n3. Info harga, diskon, dan pengiriman wilayah Padang.\n4. Perancangan custom furniture sesuai ukuran ruangan Anda.\n\nAda produk atau kebutuhan apa yang ingin Anda cari hari ini?';
  }

  // 4. Inquire about all available categories ("ada kategori apa saja?", "produk apa saja yang dijual?")
  if (msgLower.includes('kategori apa') || msgLower.includes('ada apa saja') || msgLower.includes('semua produk') || msgLower.includes('daftar produk') || msgLower.includes('katalog apa')) {
    const subcats = [...new Set(liveProducts.map(p => p.subcategory || p.category).filter(Boolean))];
    const subcatList = subcats.map((sc, i) => `${i + 1}. **${sc}**`).join('\n');
    return `Toko AGM Padang menyediakan 15 lini furniture modern berbahan aluminium, kaca, dan ACP:\n\n${subcatList}\n\nSemua produk kami 100% anti rayap, anti lapuk, dan tahan air. Anda bisa menanyakan salah satu kategori di atas untuk melihat model, harga, dan ketersediaan stok!`;
  }

  // 5. Store info, shipping, and WhatsApp contact
  if (msgLower.includes('alamat') || msgLower.includes('lokasi') || msgLower.includes('toko') || msgLower.includes('padang') || msgLower.includes('ongkir') || msgLower.includes('kirim') || msgLower.includes('wa') || msgLower.includes('whatsapp') || msgLower.includes('kontak') || msgLower.includes('telepon')) {
    return 'Berikut informasi Toko AGM Padang:\n\n- **Lokasi Showroom**: Kota Padang, Sumatera Barat.\n- **Jam Operasional**: 07.30 - 21.00 WIB setiap hari.\n- **Pengiriman**: Melayani pengiriman langsung ke seluruh area Kota Padang dan sekitarnya menggunakan armada toko sendiri agar produk kaca & aluminium terjamin aman dan langsung terpasang.\n- **Kontak WhatsApp**: **0896-9412-7723** (Anda juga bisa langsung klik tombol Tanyakan di katalog untuk chat langsung dengan admin toko).\n\nAda produk tertentu yang ingin dikirimkan ke lokasi Anda?';
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
      introText = 'Tentu! **Kitchen Set Custom AGM** dibuat dari rangka aluminium tebal dan ACP anti rayap & tahan banjir, jauh lebih awet dibandingkan kitchen set kayu/MDF.';
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
      introText = 'Selamat datang di layanan **Custom Furniture Toko AGM Padang**!\n\nKami memproduksi furniture mandiri berbasis rangka aluminium kokoh, kaca berkualitas, dan panel ACP tahan air & 100% anti rayap per centimeter sesuai ukuran ruangan rumah Anda.\n\nUntuk memulai perancangan custom, silakan beri tahu kami:\n1. **Jenis Furniture**: (Lemari pakaian, Meja kompor tipe L/U, Kitchen set, Meja prasmanan, Bopet TV, atau Lemari pajang)\n2. **Ukuran Ruangan**: (Panjang x Lebar/Kedalaman x Tinggi dalam cm)\n3. **Kebutuhan Khusus**: (Jumlah pintu, pintu sleding atau engsel, laci, wastafel, atau kompor tanam)\n\nSebagai langkah awal, kami telah menyiapkan kartu draf spesifikasi di bawah. Anda bisa langsung menyampaikan ukuran yang diinginkan untuk kami perbarui secara dinamis:';
    }

    const nextVer = (currentDesignState?.version || 0) + 1;

    return `${introText}\n\nSilakan tinjau kartu spesifikasi desain di bawah ini. Anda dapat menyampaikan perubahan ukuran atau langsung mengajukannya ke Admin Toko AGM Padang.\n\n\`\`\`json_design_state\n{\n  "version": ${nextVer},\n  "category": "${cat}",\n  "subcategory": "${subcat}",\n  "dimensions": {\n    "width": ${len},\n    "depth": ${wid},\n    "height": ${hei},\n    "unit": "cm"\n  },\n  "capacity": 1,\n  "material": "${mat}",\n  "color": "hitam / silver / motif kayu",\n  "finish": "powder coating / glossy",\n  "style": "minimalis modern",\n  "status": "draft",\n  "visualization": {\n    "status": "not_configured"\n  }\n}\n\`\`\``;
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

    const priceNum = Number(targetProduct.price) || 0;
    const discNum = Number(targetProduct.discount) || 0;
    const finalPrice = Math.max(0, priceNum - discNum);
    const priceFormatted = finalPrice > 0 ? `Rp ${finalPrice.toLocaleString('id-ID')}` : 'Rp 0 (Custom / Pre-order)';

    const nextVer = (currentDesignState?.version || 0) + 1;

    return `Berdasarkan analisis keterangan & detail gambar produk **${name}**:\n\n` +
      `1. **Ukuran Standar pada Foto**: Panjang/Lebar Depan **${width} cm**, Kedalaman/Lebar Samping **${depth} cm**, Tinggi **${height} cm**.\n` +
      `2. **Karakteristik Fisik & Gambar**:\n` +
      `   - Bahan: ${mat}\n` +
      `   - Detail: ${desc || 'Rangka aluminium presisi dengan finishing rapi dan kokoh'}\n` +
      `   - Harga: ${priceFormatted} (${targetProduct.stock > 0 ? `Ready ${targetProduct.stock} unit` : 'Pre-order / Custom'})\n\n` +
      `3. **Penyesuaian Dinamis (Custom Sizing)**:\n` +
      `   Ukuran di atas adalah ukuran standar acuan pada gambar produk. Karena Toko AGM Padang memiliki workshop mandiri, **seluruh ukuran dapat disesuaikan secara dinamis per centimeter** sesuai luas ruangan atau tata letak rumah Anda! Anda bisa memperkecil, memperlebar, atau mengubah susunan pintu/sekatnya.\n\n` +
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
    return 'Di AGM Padang, seluruh furniture diproduksi menggunakan kombinasi material modern unggulan:\n\n1. **100% Anti Rayap & Tahan Air**: Sangat cocok untuk iklim Kota Padang. Bebas risiko lapuk, menggelembung, atau rapuh seperti furniture serbuk kayu/MDF saat terkena rembesan air atau banjir.\n2. **Rangka Aluminium Berkualitas**: Ringan, kokoh, tidak berkarat, dan tidak melengkung, dengan finishing rapi anodized/silver/hitam.\n3. **Panel ACP (Aluminium Composite Panel)**: Material komposit aluminium tebal yang anti pecah, tahan benturan, tidak berjamur, dan tersedia aneka warna elegan (hitam, putih, motif kayu, merah).\n4. **Kaca Pilihan & Lantai Keramik/Porselen**: Bagian meja kompor dan meja prasmanan dilapisi keramik/porselen tahan panas api dan kuah panas, sangat mudah dilap bersih dari cipratan minyak.\n\nProduk mana yang ingin Anda bandingkan spesifikasi bahannya?';
  }

  // 9. Ready Stock vs Pre-order Query
  if (msgLower.includes('ready') || msgLower.includes('siap kirim') || msgLower.includes('stok tersedia') || msgLower.includes('stok ready')) {
    const readyItems = liveProducts.filter(p => Number(p.stock) > 0).slice(0, 6);
    if (readyItems.length > 0) {
      const listText = readyItems.map((item, idx) => {
        const eff = Math.max(0, (Number(item.price) || 0) - (Number(item.discount) || 0));
        return `${idx + 1}. **${item.name}**\n   - Subkategori: ${item.subcategory || item.category}\n   - Harga: Rp ${eff.toLocaleString('id-ID')}\n   - Stok: **${item.stock} ${item.unit || 'pcs'} tersedia**`;
      }).join('\n\n');
      return `Berikut beberapa produk AGM yang saat ini **READY STOCK** dan siap dikirim:\n\n${listText}\n\nBarang ready stock bisa langsung diantar armada toko ke lokasi Anda di Padang. Apakah Anda tertarik dengan salah satunya?`;
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
      const priceNum = Number(item.price) || 0;
      const discountNum = Number(item.discount) || 0;
      const finalPrice = Math.max(0, priceNum - discountNum);
      const stockNum = Number(item.stock) || 0;
      const stockStatus = stockNum > 0 ? `Ready (${stockNum} ${item.unit || 'unit'})` : 'Pre-Order / Habis';
      
      let priceText = 'Rp 0 (Hubungi Admin / Custom)';
      if (priceNum > 0) {
        priceText = discountNum > 0
          ? `Rp ${finalPrice.toLocaleString('id-ID')} (Diskon Rp ${discountNum.toLocaleString('id-ID')} dari Rp ${priceNum.toLocaleString('id-ID')})`
          : `Rp ${finalPrice.toLocaleString('id-ID')}`;
      }

      const tagText = item.arrival_type ? ` [${item.arrival_type}]` : '';
      const descText = item.description ? `\n   - Spek: ${item.description}` : '';

      return `${idx + 1}. **${item.name}**${tagText}\n   - Subkategori: ${item.subcategory || item.category || 'Furniture'}\n   - Harga: ${priceText}\n   - Status: ${stockStatus}${descText}`;
    }).join('\n\n');

    return `Berikut produk dari katalog Toko AGM Padang yang sesuai dengan pencarian Anda:\n\n${itemsText}\n\nSeluruh produk di atas terbuat dari rangka aluminium kokoh, kaca tebal, dan panel ACP tahan air & anti rayap 100%. Apakah Anda berminat memesan atau ingin konsultasi ukuran tertentu?`;
  }

  // 11. Conversational Acknowledgement & General Helpful Fallback
  if (msgLower === 'ok' || msgLower === 'oke' || msgLower === 'siap' || msgLower.includes('terima kasih') || msgLower.includes('makasih')) {
    return 'Sama-sama! Senang bisa membantu Anda di Toko AGM Padang. Jika ada produk lain yang ingin Anda tanyakan atau ingin memesan furniture custom, silakan sampaikan kapan saja!';
  }

  return 'Saya AGM Assistant siap membantu Anda di Toko AGM Padang:\n\n- **Cek Produk & Stok**: Cari aneka lemari pakaian, meja kompor, meja prasmanan, rak piring, kitchen set, meja TV, dll.\n- **Desain Custom**: Buat perabot aluminium & ACP 100% anti rayap sesuai ukuran ruangan rumah Anda.\n- **Konsultasi Bahan & Ukuran**: Analisis detail gambar foto dan panduan bahan tahan air.\n- **Info Toko & Pengiriman**: Layanan kirim area Padang dan kontak WhatsApp admin (0896-9412-7723).\n\nAda produk atau rencana perabot apa yang ingin Anda diskusikan?';
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

        const { catalogPrompt, topMatchedProduct } = await fetchCatalogContext(message);

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

        const fullPrompt = `${SYSTEM_CONSULTANT_INSTRUCTION}\n\n${catalogPrompt}\n\n${imageInstruction}${stateContext}Pertanyaan/Instruksi Customer:\n${message}`;

        // 3. Attempt direct AI completion via available Cloud APIs or local 9Router LLM
        const rawGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const rawOpenRouterKey = process.env.OPENROUTER_API_KEY;
        const rawNineRouterBase = process.env.NINE_ROUTER_BASE_URL || 'http://localhost:20128/v1';
        const rawNineRouterKey = process.env.NINE_ROUTER_API_KEY || 'sk-c830fbb86ebb3f99-c4kzdx-0e7bace3';

        let aiResponseText: string | null = null;

        if (rawGeminiKey) {
            aiResponseText = await callGeminiApi(rawGeminiKey, fullPrompt, imagePart);
        }
        if (!aiResponseText && rawOpenRouterKey) {
            aiResponseText = await callOpenRouterApi(rawOpenRouterKey, fullPrompt, targetImageUrl);
        }
        if (!aiResponseText && rawNineRouterBase) {
            aiResponseText = await callNineRouterApi(rawNineRouterBase, rawNineRouterKey, fullPrompt, targetImageUrl);
        }

        if (aiResponseText) {
            // LLM provider executed successfully! Parse and complete job.
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

        // 5. Emergency Fallback Guard: If worker is offline AND Cloud AI failed/missing,
        // generate a valid consultant response so the frontend NEVER gets stuck on "Menyiapkan rekomendasi..."!
        const fallbackText = await generateDynamicConsultantFallback(message, currentDesignState, topMatchedProduct);
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


