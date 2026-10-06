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
Anda adalah AGM Assistant, Personal Furniture Consultant & Ahli Desain Custom resmi dari toko AGM.

GAYA RESPON & NADA BICARA (SHOWROOM CONSULTANT STYLE):
1. Anda adalah konsultan profesional toko furniture AGM, BUKAN chatbot AI generik.
2. DILARANG menggunakan gaya AI generik: DILARANG pakai emoji dekoratif (✨, 🤖), DILARANG bilang "Sebagai AI...", "Tentu! Saya siap membantu Anda...".
3. Gunakan bahasa Indonesia yang ramah, sopan, singkat, profesional, dan alami seperti konsultan showroom premium.

KLASIFIKASI INTENT CUSTOMER & ATURAN MUTASI STATE:
- GENERAL_QUESTION: Pertanyaan umum / diskusi materi (misal: "halo", "2+2", "apakah kayu walnut tahan lama?"). Jawab singkat & profesional. DILARANG menyertakan blok \`\`\`json_design_state\`\`\`! State & versi TIDAK BISA berubah!
- CATALOG_SEARCH: Mencari produk jadi katalog (misal: "carikan meja makan").
- CUSTOM_DESIGN: Inisiatif awal membuat rancangan custom baru (misal: "saya mau meja makan 6 orang"). Tanyakan maksimal 1-2 pertanyaan klarifikasi penting secara bertahap jika informasi belum lengkap.
- DESIGN_MODIFICATION: Perubahan eksplisit terhadap spesifikasi aktif (misal: "panjangnya 240 cm", "ganti warna walnut", "ubah kaki jadi hitam").
  * WAJIB MEMPERTAHANKAN seluruh spesifikasi lama yang tidak diubah!
  * NAIKKAN \`version\` (+1) dan set \`visualization.status = "stale"\`.
- DESIGN_REVIEW: Tanggapan / opini terhadap desain aktif (misal: "kayaknya terlalu besar", "warnanya kurang cocok"). Tanyakan bagian spesifik mana yang ingin disesuaikan SEBELUM mengubah state. DILARANG memutasikan state tanpa permintaan spesifik!
- APPROVAL: Customer menyukai/menyetujui draf (misal: "saya suka yang ini", "sudah cocok", "setuju dengan desain ini").
  * PERTAHANKAN seluruh spesifikasi dan ubah \`status = "approved"\`. DILARANG menaikkan nomor \`version\`!
- ORDER_INTENT: Customer menyatakan ingin memesan/mengajukan draf (misal: "saya mau pesan", "ajukan ke admin").
  * Respons secara profesional: "Desain Anda sudah siap diajukan ke Admin AGM. Silakan tekan tombol 'Ajukan ke Admin' pada kartu spesifikasi di atas."
  * DILARANG mengubah spesifikasi furniture!

CANONICAL CATEGORY ENUM:
- "dining_table" (meja makan)
- "wardrobe" (lemari pakaian)
- "sofa" (sofa / kursi santai)
- "tv_cabinet" (meja TV / credenza)
- "kitchen_set" (kitchen set)
- "chair" (kursi)
- "table" (meja kerja/umum)
- "other" (lainnya)
Gunakan \`subcategory\` untuk penamaan Bahasa Indonesia alami (misal: subcategory: "Meja Makan Minimalis").

DIMENSION SEMANTICS MANDATE:
- "panjang" / "panjangnya" → map ke \`dimensions.length\` (TIDAK BOLEH ke width!).
- "lebar" → map ke \`dimensions.width\`.
- "kedalaman" / "dalam" → map ke \`dimensions.depth\`.
- "tinggi" → map ke \`dimensions.height\`.

CAPACITY NORMALIZATION:
- \`capacity\` WAJIB berupa angka integer murni (misal: 6 untuk 6 orang/seats, BUKAN string "6 orang").

STRUKTUR OUTPUT DELIMITER WAJIB:
Di akhir jawaban Anda, HANYA jika intent adalah CUSTOM_DESIGN, DESIGN_MODIFICATION, atau APPROVAL yang valid, sertakan JSON state di dalam delimiter berikut:

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
  "material": "walnut",
  "color": "natural",
  "finish": "matte",
  "style": "minimalis",
  "leg": {
    "style": "minimalis",
    "material": "wood",
    "color": "black"
  },
  "status": "draft",
  "visualization": {
    "status": "stale"
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

async function callGeminiApi(apiKey: string, prompt: string): Promise<string | null> {
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
  for (const model of models) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) return text.trim();
      }
    } catch (e) {
      console.warn(`Gemini API call (${model}) failed:`, e);
    }
  }
  return null;
}

async function callOpenRouterApi(apiKey: string, prompt: string): Promise<string | null> {
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://agm-2.vercel.app',
        'X-Title': 'AGM Assistant'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content;
      if (text && text.trim()) return text.trim();
    }
  } catch (e) {
    console.warn('OpenRouter API call failed:', e);
  }
  return null;
}

async function callNineRouterApi(baseUrl: string, apiKey: string, prompt: string): Promise<string | null> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const resp = await fetch(`${cleanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gc/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content;
      if (text && text.trim()) return text.trim();
    }
  } catch (e) {
    console.warn('9Router API call failed:', e);
  }
  return null;
}

function generateFallbackResponse(userMessage: string, currentDesignState: any): string {
  const msgLower = userMessage.toLowerCase();

  if (msgLower.includes('halo') || msgLower.includes('hi') || msgLower.includes('selamat')) {
    return 'Halo! Selamat datang di AGM Furniture. Saya Personal Furniture Consultant AGM. Ada spesifikasi atau model furniture tertentu yang ingin Anda rancang atau tanyakan hari ini?';
  }

  if (msgLower.includes('custom') || msgLower.includes('desain') || msgLower.includes('meja') || msgLower.includes('lemari') || msgLower.includes('sofa') || msgLower.includes('kursi') || msgLower.includes('rak')) {
    let cat = 'dining_table';
    let subcat = 'Meja Makan Custom';
    let len = 180;
    let wid = 90;
    let hei = 75;

    if (msgLower.includes('lemari')) { cat = 'wardrobe'; subcat = 'Lemari Pakaian Custom'; len = 200; wid = 60; hei = 220; }
    else if (msgLower.includes('sofa')) { cat = 'sofa'; subcat = 'Sofa Modern Custom'; len = 210; wid = 90; hei = 85; }
    else if (msgLower.includes('tv')) { cat = 'tv_cabinet'; subcat = 'Meja TV Custom'; len = 160; wid = 45; hei = 50; }
    else if (msgLower.includes('kursi')) { cat = 'chair'; subcat = 'Kursi Minimalis Custom'; len = 50; wid = 50; hei = 85; }

    const nextVer = (currentDesignState?.version || 0) + 1;

    return `Tentu! Saya telah membuatkan draf spesifikasi ${subcat} sesuai keinginan Anda. Silakan periksa kartu spesifikasi di bawah dan sampaikan jika ada ukuran, bahan, atau warna yang ingin Anda sesuaikan.

\`\`\`json_design_state
{
  "version": ${nextVer},
  "category": "${cat}",
  "subcategory": "${subcat}",
  "dimensions": {
    "length": ${len},
    "width": ${wid},
    "height": ${hei},
    "unit": "cm"
  },
  "capacity": 6,
  "material": "kayu jati / solid wood",
  "color": "natural wood",
  "finish": "doff / matte",
  "style": "minimalis modern",
  "status": "draft",
  "visualization": {
    "status": "not_configured"
  }
}
\`\`\``;
  }

  return 'Terima kasih telah menghubungi AGM Assistant. Kami siap membantu konsultasi spesifikasi furniture dan rancangan custom Anda. Silakan jelaskan kebutuhan furniture yang Anda cari!';
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
            status: 'processing',
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

        const fullPrompt = `${SYSTEM_CONSULTANT_INSTRUCTION}\n\n${stateContext}Pertanyaan/Instruksi Customer:\n${message}`;

        // 3. Attempt direct AI completion via available Cloud APIs
        const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        const openRouterKey = process.env.OPENROUTER_API_KEY;
        const nineRouterUrl = process.env.NINE_ROUTER_BASE_URL;
        const nineRouterKey = process.env.NINE_ROUTER_API_KEY;

        let aiResponseText: string | null = null;

        if (geminiKey) {
            aiResponseText = await callGeminiApi(geminiKey, fullPrompt);
        }
        if (!aiResponseText && openRouterKey) {
            aiResponseText = await callOpenRouterApi(openRouterKey, fullPrompt);
        }
        if (!aiResponseText && nineRouterUrl) {
            aiResponseText = await callNineRouterApi(nineRouterUrl, nineRouterKey || '', fullPrompt);
        }
        if (!aiResponseText) {
            aiResponseText = generateFallbackResponse(message, currentDesignState);
        }

        // 4. Parse output design state & update Supabase ai_jobs table to completed
        const { cleanText, designState: updatedDesignState } = parseAndNormalizeDesignState(aiResponseText, currentDesignState);

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

    } catch (error: any) {
        console.error('Unhandled error in /api/ai/chat:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
    }
}

