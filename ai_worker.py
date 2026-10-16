import os
import io
import json
import time
import shutil
import subprocess
import urllib.request
import csv
import pypdf
import docx
import openpyxl
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(dotenv_path='./.env.worker')

SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_WORKER_KEY: str = os.environ.get("SUPABASE_WORKER_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_WORKER_KEY:
    print("Error: SUPABASE_URL or SUPABASE_WORKER_KEY environment variables are not set in .env.worker")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_WORKER_KEY)

def find_hermes_executable() -> str:
    appdata_hermes = os.path.expanduser(r"~\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe")
    if os.path.exists(appdata_hermes):
        return appdata_hermes

    mac_local_hermes = os.path.expanduser("~/.local/bin/hermes")
    if os.path.exists(mac_local_hermes):
        return mac_local_hermes

    for candidate in ["/usr/local/bin/hermes", "/opt/homebrew/bin/hermes"]:
        if os.path.exists(candidate):
            return candidate

    found = shutil.which("hermes")
    if found:
        return found
    return "hermes"

HERMES_EXE = find_hermes_executable()

# System Prompt Injection for AGM Furniture Consultant Persona
SYSTEM_CONSULTANT_INSTRUCTION = """
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
   - Jika ditanya rekomendasi umum, berikan 2-4 pilihan produk terbaik beserta alasannya.

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
"""

def extract_pdf_text(file_bytes: bytes) -> str:
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    pages_text = []
    for idx, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and text.strip():
            pages_text.append(f"--- Page {idx + 1} ---\n{text.strip()}")
    return "\n\n".join(pages_text) if pages_text else "[Empty or unreadable PDF text]"

def extract_docx_text(file_bytes: bytes) -> str:
    doc = docx.Document(io.BytesIO(file_bytes))
    elements = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            row_txt = " | ".join(c.text.strip() for c in row.cells if c.text.strip())
            if row_txt:
                elements.append(row_txt)
    return "\n".join(elements) if elements else "[Empty DOCX document]"

def extract_txt_text(file_bytes: bytes) -> str:
    return file_bytes.decode('utf-8', errors='ignore')

def extract_csv_text(file_bytes: bytes) -> str:
    content = file_bytes.decode('utf-8', errors='ignore')
    reader = csv.reader(content.splitlines())
    rows = list(reader)
    if not rows:
        return "[Empty CSV file]"
    lines = ["Columns: " + ", ".join(rows[0]), "Data Rows:"]
    for r in rows[1:150]:
        lines.append(" | ".join(r))
    return "\n".join(lines)

def extract_xlsx_text(file_bytes: bytes) -> str:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    lines = []
    for sheet_name in wb.sheetnames:
        lines.append(f"--- Sheet: {sheet_name} ---")
        sheet = wb[sheet_name]
        for row in sheet.iter_rows(values_only=True):
            row_vals = [str(v) for v in row if v is not None]
            if row_vals:
                lines.append(" | ".join(row_vals))
    return "\n".join(lines) if lines else "[Empty XLSX workbook]"

def extract_file_content(file_bytes: bytes, filename: str, mime_type: str) -> str:
    filename_lower = filename.lower()
    if filename_lower.endswith('.pdf') or 'pdf' in mime_type.lower():
        return extract_pdf_text(file_bytes)
    elif filename_lower.endswith('.docx') or 'wordprocessingml' in mime_type.lower():
        return extract_docx_text(file_bytes)
    elif filename_lower.endswith('.csv') or 'csv' in mime_type.lower():
        return extract_csv_text(file_bytes)
    elif filename_lower.endswith('.xlsx') or 'spreadsheetml' in mime_type.lower():
        return extract_xlsx_text(file_bytes)
    else:
        return extract_txt_text(file_bytes)

def normalize_attachment_context(filename: str, mime_type: str, raw_text: str) -> str:
    MAX_CHARS = 30000
    clean_text = raw_text.strip()
    truncated = len(clean_text) > MAX_CHARS
    if truncated:
        clean_text = clean_text[:MAX_CHARS]

    context = f"[ATTACHMENT]\nFilename: {filename}\nType: {mime_type}\n\n[CONTENT]\n{clean_text}\n"
    if truncated:
        context += "\n[File content truncated because it exceeds context limit.]\n"
    context += "[END ATTACHMENT]"
    return context

def call_hermes_cli(prompt: str) -> str:
    try:
        cmd = [HERMES_EXE, "chat", "-q", prompt, "-Q"]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip() or f"Hermes process exited with code {result.returncode}"
            raise Exception(error_msg)

        output = result.stdout.strip()
        lines = output.splitlines()
        clean_lines = [line for line in lines if not line.startswith("session_id:")]
        final_text = "\n".join(clean_lines).strip()
        return final_text if final_text else "No response from AI."

    except subprocess.TimeoutExpired:
        raise Exception("Hermes CLI request timed out (120s).")
    except Exception as e:
        raise Exception(f"Failed to execute Hermes CLI: {e}")

def analyze_furniture_visualization_9router(image_url: str, user_prompt: str, current_design_state: dict) -> str:
    """
    Calls 9Router Vision API (gemini/gemini-3.7-flash) to inspect furniture visualization objectively.
    Returns structured vision observation string or empty string on failure/timeout.
    """
    try:
        nine_router_base = os.environ.get('NINE_ROUTER_BASE_URL', 'http://localhost:20128/v1').rstrip('/')
        nine_router_key = os.environ.get('NINE_ROUTER_API_KEY', '')
        
        system_instruction = (
            "You are the visual inspection and product detail component of AGM Assistant for Toko AGM Padang. "
            "Analyze the provided AGM furniture image thoroughly and objectively: "
            "1. Read any visible text, labels, or dimension stickers in the photo (e.g. '180x180', 'UK 90', '150 x 40', '120 cm', '2 meter'). "
            "2. Count number of doors, drawers, sections, and identify door mechanism (sliding/sleding vs swing). "
            "3. Identify visible materials (aluminium frame color, ACP panels, glass types: riben/clear/decorative sticker, ceramic porcelain top, sink, wheels). "
            "4. Analyze proportions and physical dimensions, noting how they can adapt dynamically to customer room requirements. "
            f"Reference design state: {json.dumps(current_design_state or {})}. "
            f"User query/feedback: '{user_prompt}'. "
            "Return concise structured observations covering: 'visible_dimensions_and_stickers', 'structure_and_doors', 'materials', 'dynamic_adaptation_recommendations'."
        )

        payload = {
            "model": "gemini/gemini-3.7-flash",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": system_instruction},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ]
        }

        data_bytes = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"{nine_router_base}/chat/completions",
            data=data_bytes,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {nine_router_key}" if nine_router_key else ""
            }
        )

        with urllib.request.urlopen(req, timeout=15) as resp:
            resp_bytes = resp.read()
            raw_text = resp_bytes.decode('utf-8')
            
            # Handle streaming chunks if returned as SSE
            if "data: " in raw_text:
                chunks = raw_text.split("data: ")
                extracted_content = ""
                for c in chunks:
                    c_clean = c.strip()
                    if c_clean and c_clean != "[DONE]":
                        try:
                            parsed_c = json.loads(c_clean)
                            delta = parsed_c.get('choices', [{}])[0].get('delta', {}).get('content', '')
                            extracted_content += delta
                        except Exception:
                            pass
                return extracted_content.strip()
            else:
                parsed_res = json.loads(raw_text)
                return parsed_res.get('choices', [{}])[0].get('message', {}).get('content', '').strip()

    except Exception as vision_err:
        print(f"[{time.strftime('%H:%M:%S')}] Warning: 9Router Vision analysis skipped/failed: {vision_err}")
        return ""

def process_ai_job(job):
    job_id = job['id']
    conversation_id = job['conversation_id']
    raw_message = job['message']
    incoming_design_state = job.get('design_state')
    
    user_prompt = raw_message
    attachment_info = None

    try:
        if raw_message.startswith('{'):
            parsed = json.loads(raw_message)
            if isinstance(parsed, dict):
                if 'text' in parsed:
                    user_prompt = parsed['text']
                if 'attachment' in parsed:
                    attachment_info = parsed['attachment']
                if 'currentDesignState' in parsed and parsed['currentDesignState']:
                    incoming_design_state = parsed['currentDesignState']
    except Exception as parse_err:
        pass

    print(f"[{time.strftime('%H:%M:%S')}] Processing job {job_id} for session {conversation_id}: '{user_prompt[:50]}...'")

    try:
        supabase.from_("ai_jobs").update({
            "status": "processing",
            "processing_start_at": "now()"
        }).eq("id", job_id).execute()

        attachment_prefix = ""
        if attachment_info and attachment_info.get('storage_url'):
            url = attachment_info['storage_url']
            filename = attachment_info.get('filename', 'attachment')
            mime_type = attachment_info.get('mime_type', 'application/octet-stream')
            source_type = attachment_info.get('source', 'furniture_reference')
            
            is_image_attachment = any(mime_type.lower().startswith(p) for p in ['image/jpeg', 'image/png', 'image/webp']) or any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp'])

            if is_image_attachment:
                print(f"[{time.strftime('%H:%M:%S')}] Customer image attachment ({source_type}) detected. Calling 9Router Vision...")
                header_tag = "[ROOM VISUAL ANALYSIS]" if source_type == 'room_photo' else "[FURNITURE REFERENCE ANALYSIS]" if source_type == 'furniture_reference' else "[DESIGN INSPIRATION ANALYSIS]"
                img_vision_res = analyze_furniture_visualization_9router(url, f"Analyze this customer uploaded image ({source_type}). {user_prompt}", incoming_design_state)
                if img_vision_res:
                    attachment_prefix = f"{header_tag}\nFilename: {filename}\nSource: {source_type}\nVisual Analysis: {img_vision_res}\n[END ATTACHMENT]\n\n"
                else:
                    attachment_prefix = f"{header_tag}\nFilename: {filename}\nSource: {source_type}\n[Image URL: {url}]\n[END ATTACHMENT]\n\n"
            else:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as resp:
                    file_bytes = resp.read()

                extracted_text = extract_file_content(file_bytes, filename, mime_type)
                attachment_prefix = normalize_attachment_context(filename, mime_type, extracted_text) + "\n\n"

        # Vision Pipeline Execution Guard (Trigger Vision ONLY if active visualization image exists AND prompt implies visual feedback)
        vision_context = ""
        active_img_url = (incoming_design_state or {}).get('visualization', {}).get('imageUrl')
        
        # Check if prompt contains visual feedback indicators (leg, color, proportion, shape, appearance, etc.)
        prompt_lower = user_prompt.lower()
        is_explicit_dim = any(k in prompt_lower for k in ['panjang', 'lebar', 'tinggi', 'kedalaman', 'cm', 'mm', 'ukuran'])
        visual_keywords = ['kaki', 'warna', 'proporsi', 'bentuk', 'terlalu besar', 'terlalu kecil', 'terlalu terang', 'terlalu gelap', 'desainnya', 'kelihatan', 'tampak', 'elegan']
        is_visual_feedback = any(vk in prompt_lower for vk in visual_keywords) and not is_explicit_dim

        if active_img_url and is_visual_feedback:
            print(f"[{time.strftime('%H:%M:%S')}] Active visualization image detected. Triggering 9Router Vision analysis...")
            vision_result = analyze_furniture_visualization_9router(active_img_url, user_prompt, incoming_design_state)
            if vision_result:
                vision_context = f"[9ROUTER VISION MODEL INSPECTION RESULT]\n{vision_result}\n(Gunakan hasil analisis visual ini sebagai panduan konteks visual produk untuk menjawab umpan balik customer).\n\n"

        # Construct Previous State Prompt Context
        state_context = ""
        if incoming_design_state and isinstance(incoming_design_state, dict) and incoming_design_state.get('category'):
            state_context = f"[CURRENT DESIGN STATE IN SESSION]\n```json\n{json.dumps(incoming_design_state, indent=2)}\n```\n(Gunakan state ini sebagai rujukan utama. Jika user melakukan perubahan kecil, pertahankan seluruh field lain dan naikkan version +1).\n\n"
        else:
            state_context = "[CURRENT DESIGN STATE IN SESSION]\n(Belum ada draf desain aktif. Jangan mengarang desain kecuali user meminta membuat custom furniture).\n\n"

        catalog_context = "[KATALOG SUPABASE - DATA REAL-TIME]\n"
        top_product_image_url = None
        top_product_name = None
        try:
            catalog_res = supabase.from_("products").select("id,name,category,subcategory,description,price,discount,stock,unit,arrival_type,image_url,images").order("created_at", desc=True).limit(60).execute()
            catalog_items = catalog_res.data or []
            
            # Simple keyword scoring for worker
            user_tokens = user_prompt.lower().split()
            def score_item(item):
                s = 0
                searchable = f"{item.get('name','')} {item.get('category','')} {item.get('subcategory','')} {item.get('description','')}".lower()
                for t in user_tokens:
                    if len(t) >= 3 and t in searchable:
                        s += 2
                return s

            ranked_items = sorted(catalog_items, key=lambda it: (score_item(it), it.get('stock', 0)), reverse=True)
            top_items = ranked_items[:20] if any(score_item(it) > 0 for it in ranked_items) else catalog_items[:20]

            if ranked_items and score_item(ranked_items[0]) > 0:
                top_item = ranked_items[0]
                top_img = top_item.get('image_url') or (top_item.get('images') and top_item.get('images')[0])
                if top_img:
                    top_product_image_url = top_img
                    top_product_name = top_item.get('name')

            compact_items = []
            for it in top_items:
                price = int(it.get('price') or 0)
                disc = int(it.get('discount') or 0)
                img = it.get('image_url') or (it.get('images') and it.get('images')[0]) or ''
                compact_items.append({
                    "id": it.get('id'),
                    "name": it.get('name'),
                    "subcategory": it.get('subcategory') or it.get('category'),
                    "price": price,
                    "discount": disc,
                    "final_price": max(0, price - disc),
                    "stock": it.get('stock', 0),
                    "unit": it.get('unit', 'Pcs'),
                    "description": it.get('description', ''),
                    "image_url": img
                })

            catalog_context += json.dumps(compact_items, ensure_ascii=False, indent=2)
            catalog_context += "\nGunakan fakta produk aktual di atas; jangan mengarang harga atau stok yang tidak tertera.\n[/KATALOG SUPABASE]"
        except Exception as catalog_err:
            print(f"[{time.strftime('%H:%M:%S')}] Catalog retrieval warning: {catalog_err}")
            catalog_context += "Katalog sementara tidak tersedia; gunakan panduan resmi katalog AGM.\n[/KATALOG SUPABASE]"

        # If user asks about product photo, dimensions, or visual details and top product image is available
        if not vision_context and top_product_image_url:
            is_product_visual_query = any(k in prompt_lower for k in [
                'gambar', 'foto', 'lihat', 'ukuran', 'dimensi', 'panjang', 'lebar',
                'tinggi', 'stiker', 'muat', 'cm', 'meter', 'detail', 'bentuk', 'pintu'
            ])
            if is_product_visual_query:
                print(f"[{time.strftime('%H:%M:%S')}] Product catalog image detected for {top_product_name}. Triggering 9Router Vision analysis...")
                prod_vis = analyze_furniture_visualization_9router(top_product_image_url, user_prompt, incoming_design_state)
                if prod_vis:
                    vision_context = f"[PRODUCT CATALOG IMAGE INSPECTION: {top_product_name}]\nImage URL: {top_product_image_url}\nObservation: {prod_vis}\n\n"

        # Combine System Persona + State Context + Live Catalog + Vision Context + Attachment + User Prompt
        full_prompt = f"{SYSTEM_CONSULTANT_INSTRUCTION}\n\n{catalog_context}\n\n{state_context}{vision_context}{attachment_prefix}Pertanyaan/Instruksi Customer:\n{user_prompt}"

        ai_response_text = call_hermes_cli(full_prompt)

        # Parse & Validate Output Design State
        updated_design_state = incoming_design_state
        try:
            if "```json_design_state" in ai_response_text:
                parts = ai_response_text.split("```json_design_state")
                if len(parts) > 1:
                    json_str = parts[1].split("```")[0].strip()
                    parsed = json.loads(json_str)
                    if isinstance(parsed, dict) and parsed.get('category'):
                        # --- CANONICAL STATE NORMALIZATION ---
                        # 1. Category Normalization
                        raw_cat = str(parsed.get('category', '')).lower()
                        if 'meja makan' in raw_cat or 'dining' in raw_cat:
                            parsed['category'] = 'dining_table'
                        elif 'lemari' in raw_cat or 'wardrobe' in raw_cat:
                            parsed['category'] = 'wardrobe'
                        elif 'sofa' in raw_cat:
                            parsed['category'] = 'sofa'
                        elif 'tv' in raw_cat or 'credenza' in raw_cat:
                            parsed['category'] = 'tv_cabinet'
                        elif 'kitchen' in raw_cat:
                            parsed['category'] = 'kitchen_set'
                        elif 'kursi' in raw_cat or 'chair' in raw_cat:
                            parsed['category'] = 'chair'
                        elif 'meja' in raw_cat or 'table' in raw_cat:
                            parsed['category'] = 'table'
                        else:
                            parsed['category'] = 'other'

                        # 2. Capacity Normalization to Integer
                        raw_cap = parsed.get('capacity')
                        if raw_cap is not None:
                            import re
                            nums = re.findall(r'\d+', str(raw_cap))
                            if nums:
                                parsed['capacity'] = int(nums[0])

                        # 3. Dimension Semantics Normalization (length/width/depth/height)
                        dims = parsed.get('dimensions')
                        if not isinstance(dims, dict):
                            dims = {}
                        
                        # Map legacy width if length is missing and width was used as length
                        legacy_width = parsed.get('width')
                        legacy_depth = parsed.get('depth')
                        legacy_height = parsed.get('height')
                        
                        if legacy_width and not dims.get('length'):
                            dims['length'] = int(legacy_width) if str(legacy_width).isdigit() else legacy_width
                        if legacy_depth and not dims.get('width'):
                            dims['width'] = int(legacy_depth) if str(legacy_depth).isdigit() else legacy_depth
                        if legacy_height and not dims.get('height'):
                            dims['height'] = int(legacy_height) if str(legacy_height).isdigit() else legacy_height

                        if 'unit' not in dims:
                            dims['unit'] = 'cm'

                        parsed['dimensions'] = dims
                        
                        # Remove legacy top-level dimension keys to enforce clean canonical schema
                        parsed.pop('width', None)
                        parsed.pop('depth', None)
                        parsed.pop('height', None)

                        # Versioning & Visualization State Lifecycle Guarantee
                        if incoming_design_state and isinstance(incoming_design_state, dict):
                            prev_ver = incoming_design_state.get('version', 1)
                            parsed['version'] = prev_ver + 1
                            
                            # Inherit or set stale visualization status if state changed
                            prev_vis = incoming_design_state.get('visualization', {})
                            new_vis = parsed.get('visualization', {})
                            
                            if prev_vis.get('status') == 'ready':
                                new_vis['status'] = 'stale'
                                new_vis['imageUrl'] = prev_vis.get('imageUrl') # Retain as previous reference
                                new_vis['designVersion'] = prev_vis.get('designVersion', prev_ver)
                                # Preserve history
                                hist = prev_vis.get('visualizationHistory', [])
                                if prev_vis.get('imageUrl') and not any(h.get('imageUrl') == prev_vis.get('imageUrl') for h in hist):
                                    hist.append({
                                        'designVersion': prev_vis.get('designVersion', prev_ver),
                                        'imageUrl': prev_vis.get('imageUrl'),
                                        'generatedAt': prev_vis.get('generatedAt')
                                    })
                                new_vis['visualizationHistory'] = hist
                            elif not new_vis.get('status'):
                                new_vis['status'] = 'not_configured'
                                new_vis['designVersion'] = parsed['version']
                                new_vis['visualizationHistory'] = prev_vis.get('visualizationHistory', [])
                            parsed['visualization'] = new_vis
                        elif not parsed.get('version'):
                            parsed['version'] = 1
                            if not parsed.get('visualization'):
                                parsed['visualization'] = {
                                    'status': 'not_configured',
                                    'designVersion': 1
                                }

                        updated_design_state = parsed
        except Exception as parse_state_err:
            print(f"[{time.strftime('%H:%M:%S')}] Warning: Failed parsing updated design_state: {parse_state_err}. Retaining previous state.")

        update_payload = {
            "status": "completed",
            "response": ai_response_text,
            "completed_at": "now()"
        }
        if updated_design_state is not None:
            try:
                update_payload["design_state"] = updated_design_state
            except Exception:
                pass

        try:
            supabase.from_("ai_jobs").update(update_payload).eq("id", job_id).execute()
        except Exception as update_err:
            if "design_state" in str(update_err):
                # Fallback if DB table has not cached design_state column yet
                update_payload.pop("design_state", None)
                supabase.from_("ai_jobs").update(update_payload).eq("id", job_id).execute()
            else:
                raise update_err

        print(f"[{time.strftime('%H:%M:%S')}] [OK] Job {job_id} completed successfully.")

    except Exception as e:
        error_message = str(e)
        print(f"[{time.strftime('%H:%M:%S')}] [ERROR] Job {job_id} failed: {error_message}")
        supabase.from_("ai_jobs").update({
            "status": "failed",
            "error": error_message,
            "completed_at": "now()"
        }).eq("id", job_id).execute()

def listen_for_new_jobs():
    print("==================================================")
    print(" AGM Assistant Furniture Consultant Worker Active")
    print(f" Target Supabase : {SUPABASE_URL}")
    print("==================================================")

    while True:
        try:
            res = supabase.from_("ai_jobs").select("*").eq("status", "pending").order("created_at", desc=False).limit(1).execute()
            jobs = res.data
            if jobs:
                for job in jobs:
                    process_ai_job(job)
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] Error fetching pending jobs: {e}")
        time.sleep(3)

if __name__ == "__main__":
    listen_for_new_jobs()
