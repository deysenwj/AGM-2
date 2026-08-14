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

# Load environment variables from .env.worker
load_dotenv(dotenv_path='./.env.worker')

# --- KONFIGURASI SUPABASE ---
SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
SUPABASE_WORKER_KEY: str = os.environ.get("SUPABASE_WORKER_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_WORKER_KEY:
    print("Error: SUPABASE_URL or SUPABASE_WORKER_KEY environment variables are not set in .env.worker")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_WORKER_KEY)

def find_hermes_executable() -> str:
    """Mencari lokasi executable Hermes Agent yang valid di PC."""
    appdata_hermes = os.path.expanduser(r"~\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe")
    if os.path.exists(appdata_hermes):
        return appdata_hermes
    
    found = shutil.which("hermes")
    if found:
        return found
    return "hermes"

HERMES_EXE = find_hermes_executable()

# --- FILE EXTRACTOR DISPATCHERS ---

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
    lines = []
    lines.append("Columns: " + ", ".join(rows[0]))
    lines.append("Data Rows:")
    for r in rows[1:150]:  # Cap at 150 rows for safety
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
    elif filename_lower.endswith('.txt') or 'plain' in mime_type.lower():
        return extract_txt_text(file_bytes)
    else:
        return extract_txt_text(file_bytes)

def normalize_attachment_context(filename: str, mime_type: str, raw_text: str) -> str:
    MAX_CHARS = 30000
    truncated = False
    clean_text = raw_text.strip()
    
    if len(clean_text) > MAX_CHARS:
        clean_text = clean_text[:MAX_CHARS]
        truncated = True

    context = f"[ATTACHMENT]\nFilename: {filename}\nType: {mime_type}\n\n[CONTENT]\n{clean_text}\n"
    if truncated:
        context += "\n[File content truncated because it exceeds the context limit.]\n"
    context += "[END ATTACHMENT]"
    return context

def call_hermes_cli(prompt: str) -> str:
    """
    Memanggil Hermes Agent CLI secara native melalui subprocess.
    Menggunakan `hermes chat -q "<prompt>" -Q` yang terhubung ke 9Router.
    """
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

    # Parse JSON if job contains attachment reference
    try:
        if raw_message.startswith('{') and 'attachment' in raw_message:
            parsed = json.loads(raw_message)
            if isinstance(parsed, dict) and 'text' in parsed and 'attachment' in parsed:
                user_prompt = parsed['text']
                attachment_info = parsed['attachment']
    except Exception as parse_err:
        print(f"[{time.strftime('%H:%M:%S')}] Message JSON parse skipped: {parse_err}")

    print(f"[{time.strftime('%H:%M:%S')}] Processing job {job_id} for session {conversation_id}: '{user_prompt[:50]}...'")

    try:
        # 1. Update status to 'processing'
        supabase.from_("ai_jobs").update({
            "status": "processing",
            "processing_start_at": "now()"
        }).eq("id", job_id).execute()

        final_prompt = user_prompt

        # 2. Process attachment if present
        if attachment_info and attachment_info.get('storage_url'):
            url = attachment_info['storage_url']
            filename = attachment_info.get('filename', 'attachment')
            mime_type = attachment_info.get('mime_type', 'application/octet-stream')
            
            print(f"[{time.strftime('%H:%M:%S')}] Downloading attachment '{filename}' from {url[:40]}...")
            
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as resp:
                file_bytes = resp.read()

            print(f"[{time.strftime('%H:%M:%S')}] Extracting text from '{filename}' ({len(file_bytes)} bytes)...")
            extracted_text = extract_file_content(file_bytes, filename, mime_type)
            attachment_context = normalize_attachment_context(filename, mime_type, extracted_text)

            final_prompt = f"{attachment_context}\n\nPertanyaan User:\n{user_prompt}"
            print(f"[{time.strftime('%H:%M:%S')}] Attachment normalized successfully ({len(attachment_context)} chars context).")

            # Update ai_attachments record if table exists
            if attachment_info.get('id'):
                try:
                    supabase.from_("ai_attachments").update({
                        "status": "ready"
                    }).eq("id", attachment_info['id']).execute()
                except Exception:
                    pass

        # 3. Panggil Hermes CLI
        ai_response_text = call_hermes_cli(final_prompt)

        # 4. Update status to 'completed' dengan respons AI
        supabase.from_("ai_jobs").update({
            "status": "completed",
            "response": ai_response_text,
            "completed_at": "now()"
        }).eq("id", job_id).execute()
        print(f"[{time.strftime('%H:%M:%S')}] ✓ Job {job_id} completed successfully. Response: '{ai_response_text[:60]}...'")

    except Exception as e:
        error_message = str(e)
        print(f"[{time.strftime('%H:%M:%S')}] ✗ Job {job_id} failed: {error_message}")
        
        if attachment_info and attachment_info.get('id'):
            try:
                supabase.from_("ai_attachments").update({
                    "status": "failed",
                    "error": error_message
                }).eq("id", attachment_info['id']).execute()
            except Exception:
                pass

        supabase.from_("ai_jobs").update({
            "status": "failed",
            "error": f"File tidak dapat diproses: {error_message}" if attachment_info else error_message,
            "completed_at": "now()"
        }).eq("id", job_id).execute()

def listen_for_new_jobs():
    print("==================================================")
    print(" Hermes AI Local Worker (Native CLI + File Extraction)")
    print(f" Target Supabase : {SUPABASE_URL}")
    print(f" Hermes Binary   : {HERMES_EXE}")
    print(" Status          : Active & Listening...")
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
