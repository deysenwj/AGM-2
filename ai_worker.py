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
2. Tugas Anda adalah membantu customer menemukan produk furniture yang ada di katalog AGM ATAU merancang spesifikasi custom furniture sesuai kebutuhan ruang customer.
3. JANGAN tanyakan semua spesifikasi sekaligus! Gunakan "conversational progressive disclosure" (tanyakan 1 hal yang paling relevan berikutnya, misalnya: untuk berapa orang, ukuran ruang, style, material, warna).
4. EKSPLORASI DETAIL RANCANGAN CUSTOM:
   - Kategori furniture (meja makan, sofa, lemari, meja TV, kitchen set, dll.)
   - Ukuran (Panjang x Lebar x Tinggi dalam cm)
   - Kapasitas / Peruntukan (misal: 6 orang)
   - Gaya / Style (minimalis, modern, klasik, skandinavia, industrial)
   - Material (kayu jati, mahoni, plywood, besi, kain, dll.)
   - Warna (natural, walnut, hitam, putih, dll.)
   - Finishing (matte, glossy, satin)
5. HARGA & KEAMANAN (PRICE SAFETY):
   - JANGAN PERNAH mengklaim atau menjanjikan harga final untuk custom furniture.
   - Selalu tekankan bahwa "Estimasi harga final dan waktu pengerjaan akan dikonfirmasi secara resmi oleh Admin AGM".
6. STRUKTUR OUTPUT DESIGN STATE (SANGAT PENTING):
   - Ketika Anda telah berhasil mengumpulkan atau memperbarui spesifikasi custom furniture dari perbincangan, Anda BISA menyertakan JSON Design State di akhir jawaban Anda dalam format khusus berikut:

```json_design_state
{
  "category": "meja makan",
  "style": "minimalis",
  "width": 180,
  "depth": 80,
  "height": 75,
  "material": "kayu jati",
  "color": "natural",
  "finish": "matte",
  "quantity": 1,
  "capacity": "6 orang",
  "status": "draft"
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
    
    user_prompt = raw_message
    attachment_info = None

    try:
        if raw_message.startswith('{') and 'attachment' in raw_message:
            parsed = json.loads(raw_message)
            if isinstance(parsed, dict) and 'text' in parsed and 'attachment' in parsed:
                user_prompt = parsed['text']
                attachment_info = parsed['attachment']
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

        # Combine System Instruction Persona + Attachment + User Query
        full_prompt = f"{SYSTEM_CONSULTANT_INSTRUCTION}\n\n{attachment_prefix}Pertanyaan/Instruksi Customer:\n{user_prompt}"

        ai_response_text = call_hermes_cli(full_prompt)

        supabase.from_("ai_jobs").update({
            "status": "completed",
            "response": ai_response_text,
            "completed_at": "now()"
        }).eq("id", job_id).execute()
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
