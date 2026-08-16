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
   - GENERAL_QUESTION: Pertanyaan umum (misal: "halo", "2+2", "apa itu MDF?"). Jawab singkat, TANPA membuat design state baru.
   - CATALOG_SEARCH: Mencari produk jadi (misal: "carikan meja makan").
   - CUSTOM_DESIGN: Inisiatif awal membuat rancangan custom (misal: "saya mau meja makan 6 orang").
   - DESIGN_MODIFICATION: Perubahan terhadap draf spesifikasi yang sedang aktif (misal: "buat lebih panjang", "ganti warna walnut", "ubah kaki jadi hitam").
   - DESIGN_REVIEW: Menanyakan pendapat atau kecocokan desain (misal: "apakah desain ini cocok untuk ruang kecil?").
   - ORDER_INTENT: Keinginan mengajukan/memesan draf (misal: "saya mau pesan ini").
   - FILE_ANALYSIS / IMAGE_REFERENCE: Membahas lampiran file/gambar.

3. DEDICATED DELTA STATE PERSISTENCE & VERSIONING:
   - Jika tersedia CURRENT DESIGN STATE dari percakapan sebelumnya, Anda WAJIB MEMPERTAHANKAN seluruh properti spesifikasi yang TIDAK DIMINTA DIUBAH oleh customer!
   - Hanya ubah properti yang diminta secara eksplisit.
   - Jika ada modifikasi pada spesifikasi (dimensi, material, warna, leg, dll.), NAIKKAN nomor `version` (+1) dan set `visualization.status = "stale"`.
   - Jika customer hanya bertanya umum atau tidak ada spesifikasi yang berubah, PERTAHANKAN nomor version dan state sebelumnya.

4. HARGA & KEAMANAN (PRICE SAFETY):
   - JANGAN PERNAH mengklaim atau menjanjikan harga final untuk custom furniture.
   - Selalu tekankan: "Estimasi harga final dan waktu pengerjaan akan dikonfirmasi secara resmi oleh Admin AGM".

5. STRUKTUR OUTPUT DELIMITER Wajib:
   Di akhir jawaban Anda, jika terdapat rancangan furniture yang aktif atau baru dibuat/diubah, sertakan JSON state di dalam delimiter berikut:

```json_design_state
{
  "version": 2,
  "category": "dining_table",
  "subcategory": "meja makan minimalis",
  "dimensions": {
    "width": 200,
    "depth": 80,
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
    "material": "besi",
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
                        # Basic State Validation
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
