import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://raizwhqfiowyzbhiwbnq.supabase.co';
const supabaseKey = (process.env.SUPABASE_WORKER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '') as string;

const supabase = createClient(supabaseUrl, supabaseKey);

const nineRouterBaseUrl = (process.env.NINE_ROUTER_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, '');
const nineRouterKey = process.env.NINE_ROUTER_API_KEY || '';

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

async function call9RouterAi(fullPrompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${nineRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(nineRouterKey ? { 'Authorization': `Bearer ${nineRouterKey}` } : {})
        },
        body: JSON.stringify({
            model: 'gemini/gemini-3.7-flash',
            messages: [
                { role: 'system', content: SYSTEM_CONSULTANT_INSTRUCTION },
                { role: 'user', content: fullPrompt }
            ],
            temperature: 0.7
        }),
        signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (!res.ok) {
        throw new Error(`9Router API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

async function tryInlineFastAi(insertedJobId: string, userMessage: string, currentDesignState: any, attachment: any) {
    try {
        let stateContext = "[CURRENT DESIGN STATE IN SESSION]\n(Belum ada draf desain aktif. Jangan mengarang desain kecuali user meminta membuat custom furniture).\n\n";
        if (currentDesignState && typeof currentDesignState === 'object' && currentDesignState.category) {
            stateContext = `[CURRENT DESIGN STATE IN SESSION]\n\`\`\`json\n${JSON.stringify(currentDesignState, null, 2)}\n\`\`\`\n(Gunakan state ini sebagai rujukan utama. Jika user melakukan perubahan kecil, pertahankan seluruh field lain dan naikkan version +1).\n\n`;
        }

        let attachmentContext = "";
        if (attachment && attachment.filename) {
            attachmentContext = `[ATTACHMENT]\nFilename: ${attachment.filename}\nSource: ${attachment.source || 'furniture_reference'}\n[END ATTACHMENT]\n\n`;
        }

        const fullPrompt = `${stateContext}${attachmentContext}Pertanyaan/Instruksi Customer:\n${userMessage}`;

        const aiText = await call9RouterAi(fullPrompt);
        if (!aiText) return null;

        let updatedDesignState = currentDesignState;
        if (aiText.includes("```json_design_state")) {
            try {
                const parts = aiText.split("```json_design_state");
                if (parts.length > 1) {
                    const jsonStr = parts[1].split("```")[0].trim();
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

                        if (currentDesignState && typeof currentDesignState === 'object') {
                            parsed.version = (currentDesignState.version || 1) + 1;
                        } else if (!parsed.version) {
                            parsed.version = 1;
                        }
                        updatedDesignState = parsed;
                    }
                }
            } catch (e) {
                console.warn("Error parsing design state JSON:", e);
            }
        }

        const updatePayload: any = {
            status: 'completed',
            response: aiText,
            completed_at: new Date().toISOString()
        };

        if (updatedDesignState) {
            updatePayload.design_state = updatedDesignState;
        }

        await supabase.from('ai_jobs').update(updatePayload).eq('id', insertedJobId);
        return { aiText, updatedDesignState };

    } catch (err) {
        // If inline fast AI is unavailable, return null without overwriting job status so python ai_worker.py handles it!
        return null;
    }
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

        if (attachment && attachment.id) {
            try {
                await supabase.from('ai_attachments').update({
                    job_id: insertedJobId,
                    status: 'processing'
                }).eq('id', attachment.id);
            } catch (attErr) {
                console.warn('Optional update to ai_attachments failed:', attErr);
            }
        }

        // Try fast inline AI (2.5s) if available; if not available, leave as 'pending' for python ai_worker.py!
        const fastResult = await tryInlineFastAi(insertedJobId, message, currentDesignState, attachment);

        if (fastResult && fastResult.aiText) {
            return res.status(200).json({
                success: true,
                job_id: insertedJobId,
                conversation_id: data[0].conversation_id,
                status: 'completed',
                response: fastResult.aiText
            });
        }

        return res.status(200).json({
            success: true,
            job_id: insertedJobId,
            conversation_id: data[0].conversation_id,
            status: 'pending'
        });

    } catch (error: any) {
        console.error('Unhandled error in /api/ai/chat:', error);
        return res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
    }
}
