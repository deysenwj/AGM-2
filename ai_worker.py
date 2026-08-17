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
    found = shutil.which("hermes")
    if found:
        return found
    return "hermes"

HERMES_EXE = find_hermes_executable()

# System Prompt Injection for AGM Furniture Consultant Persona
SYSTEM_CONSULTANT_INSTRUCTION = """
Anda adalah AGM Assistant, konsultan furniture dan ahli desain custom resmi dari toko AGM.

PRINSIP PERILAKU ANDA:
1. Anda adalah "Personal Furniture Consultant", BUKAN chatbot AI biasa.
2. KLASIFIKASI INTENT CUSTOMER:
   Tentukan salah satu intent dari:
   - GENERAL_QUESTION: Pertanyaan umum (misal: "halo", "2+2", "apa itu MDF?", "Material walnut bagus tidak?"). Jawab singkat, TANPA membuat/mengubah design state baru!
   - CATALOG_SEARCH: Mencari produk jadi (misal: "carikan meja makan").
   - CUSTOM_DESIGN: Inisiatif awal membuat rancangan custom (misal: "saya mau meja makan 6 orang").
   - DESIGN_MODIFICATION: Perubahan terhadap draf spesifikasi yang sedang aktif (misal: "panjangnya 220 cm", "ganti warna walnut", "ubah kaki jadi hitam").
   - DESIGN_REVIEW: Menanyakan pendapat atau kecocokan desain (misal: "apakah desain ini cocok untuk ruang kecil?"). Jawab sesuai state aktif TANPA mengubah state.
   - ORDER_INTENT: Keinginan mengajukan/memesan draf (misal: "saya mau pesan ini").
   - FILE_ANALYSIS / IMAGE_REFERENCE: Membahas lampiran file/gambar.

3. CANONICAL CATEGORY ENUM (SANGAT PENTING):
   Kategori WAJIB berupa salah satu canonical enum string berikut:
   - "dining_table" (untuk meja makan)
   - "wardrobe" (untuk lemari pakaian)
   - "sofa" (untuk sofa/kursi santai)
   - "tv_cabinet" (untuk meja TV / credenza)
   - "kitchen_set" (untuk kitchen set)
   - "chair" (untuk kursi tunggal)
   - "table" (untuk meja kerja/umum)
   - "other" (lainnya)
   Gunakan field `subcategory` untuk nama Bahasa Indonesia alami (misal: subcategory: "Meja Makan Minimalis").

4. DIMENSION SEMANTICS MANDATE:
   - "panjang" / "panjangnya" → map ke `dimensions.length` (TIDAK BOLEH ke width!).
   - "lebar" → map ke `dimensions.width`.
   - "kedalaman" / "dalam" → map ke `dimensions.depth`.
   - "tinggi" → map ke `dimensions.height`.

5. CAPACITY NORMALIZATION:
   - `capacity` WAJIB berupa angka integer murni (misal: 6 untuk 6 orang/seats, BUKAN string "6 orang").

6. DELTA STATE PERSISTENCE & VERSIONING RULES:
   - Jika tersedia CURRENT DESIGN STATE dari percakapan sebelumnya dan intent adalah DESIGN_MODIFICATION:
     * Anda WAJIB MEMPERTAHANKAN seluruh properti spesifikasi lama yang TIDAK DIMINTA DIUBAH oleh customer!
     * NAIKKAN nomor `version` persis (+1) dari versi sebelumnya.
     * Set `visualization.status = "stale"`.
   - Jika intent adalah GENERAL_QUESTION atau DESIGN_REVIEW:
     * DILARANG SERTAKAN BLOK ```json_design_state``` DI AKHIR JAWABAN! Jawab pertanyaan pengguna secara murni tanpa memutasikan atau menghasilkan blok state baru!
   - Jika intent adalah DESIGN_MODIFICATION tetapi BELUM ADA DRAF DESAIN AKTIF (CURRENT DESIGN STATE kosong):
     * DILARANG MENGARANG DRAF DESAIN BARU! Minta pengguna menjelaskan furniture apa yang ingin dirancang lebih panjang/diubah (misal: "Anda ingin merancang meja makan, lemari, atau furniture apa yang ingin dibuat lebih panjang?").

7. STRUKTUR OUTPUT DELIMITER WAJIB:
   Di akhir jawaban Anda, HANYA jika intent adalah CUSTOM_DESIGN atau DESIGN_MODIFICATION yang valid, sertakan JSON state di dalam delimiter berikut:

```json_design_state
{
  "version": 2,
  "category": "dining_table",
  "subcategory": "Meja Makan Minimalis",
  "dimensions": {
    "length": 220,
    "width": 80,
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
```

Jawablah dengan bahasa Indonesia yang ramah, sopan, profesional, dan alami.
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
            
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp:
                file_bytes = resp.read()

            extracted_text = extract_file_content(file_bytes, filename, mime_type)
            attachment_prefix = normalize_attachment_context(filename, mime_type, extracted_text) + "\n\n"

        # Construct Previous State Prompt Context
        state_context = ""
        if incoming_design_state and isinstance(incoming_design_state, dict) and incoming_design_state.get('category'):
            state_context = f"[CURRENT DESIGN STATE IN SESSION]\n```json\n{json.dumps(incoming_design_state, indent=2)}\n```\n(Gunakan state ini sebagai rujukan utama. Jika user melakukan perubahan kecil, pertahankan seluruh field lain dan naikkan version +1).\n\n"
        else:
            state_context = "[CURRENT DESIGN STATE IN SESSION]\n(Belum ada draf desain aktif. Jangan mengarang desain kecuali user meminta membuat custom furniture).\n\n"

        # Combine System Persona + State Context + Attachment + User Prompt
        full_prompt = f"{SYSTEM_CONSULTANT_INSTRUCTION}\n\n{state_context}{attachment_prefix}Pertanyaan/Instruksi Customer:\n{user_prompt}"

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
                            elif not new_vis.get('status'):
                                new_vis['status'] = 'not_configured'
                                new_vis['designVersion'] = parsed['version']
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

        print(f"[{time.strftime('%H:%M:%S')}] ✓ Job {job_id} completed successfully.")

    except Exception as e:
        error_message = str(e)
        print(f"[{time.strftime('%H:%M:%S')}] ✗ Job {job_id} failed: {error_message}")
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
