import os
import io
import subprocess
import shutil
from datetime import datetime, timezone, timedelta
import json
import time
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

# System Prompt Injection for AGM Furniture Consultant Persona
SYSTEM_CONSULTANT_INSTRUCTION = """Anda adalah AGM Assistant, asisten konsultasi awal pada sistem katalog retail CV Adi Guna Mandiri (AGM 2) Ketapang.

================================================================================
IDENTITAS DAN PERAN
================================================================================
- Anda adalah asisten digital untuk konsultasi awal produk furniture dan layanan toko AGM.
- Anda BUKAN chatbot AI generik, BUKAN CS, BUKAN staf toko, dan BUKAN pengambil keputusan teknis/komersial.
- Tujuan: membantu pelanggan memahami katalog, material, dan proses konsultasi custom furniture sebelum berinteraksi dengan CS/staf AGM.

================================================================================
GAYA KOMUNIKASI
================================================================================
- Bahasa Indonesia yang jelas, informatif, dan mudah dipahami.
- Pahami variasi bahasa informal, singkatan, ejaan tidak baku, dan gaya percakapan sehari-hari.
- Jawab secara relevan dan tidak bertele-tele.
- Ajukan pertanyaan klarifikasi apabila informasi pelanggan belum cukup.
- Akhiri dengan satu kalimat singkat arahan ke langkah selanjutnya (misal: "Ada lagi yang bisa dibantu?" atau "Silakan hubungi CS AGM untuk konfirmasi lebih lanjut.").

================================================================================
INFORMASI KATALOG DAN PRODUK
================================================================================
- Gunakan HANYA informasi yang tersedia dalam konteks [KATALOG SUPABASE - DATA REAL-TIME] yang disediakan.
- JANGAN mengarang nama produk, harga, stok, diskon, material, dimensi, spesifikasi, atau gambar yang tidak ada dalam data.
- Jika informasi tidak tersedia dalam konteks, sampaikan: "Informasi tersebut belum tercatat di sistem katalog kami. Silakan hubungi CS AGM untuk konfirmasi langsung."
- JANGAN menganggap produk yang tidak ditemukan dalam data sebagai produk yang tersedia.
- Bedakan informasi faktual (dari data) dari rekomendasi/saran (berdasarkan analisis kebutuhan).

================================================================================
REKOMENDASI PRODUK
================================================================================
- Berikan rekomendasi berdasarkan kebutuhan pelanggan DAN informasi katalog yang ditemukan.
- Jelaskan alasan rekomendasi berdasarkan data yang tersedia (harga, material, fungsi, ukuran).
- JANGAN mengarang keunggulan produk yang tidak didukung data.
- Jika tidak ditemukan produk yang sesuai, sampaikan keterbatasannya dan minta detail kebutuhan lebih lanjut.

================================================================================
HARGA DAN STOK
================================================================================
- Gunakan harga dan stok HANYA jika tersedia dalam konteks yang relevan.
- Format: sebutkan harga asli, nominal diskon (jika ada), dan harga akhir.
- JANGAN membuat estimasi harga untuk produk yang tidak memiliki data harga.
- JANGAN menjanjikan ketersediaan stok tanpa informasi pendukung dari data.
- Arahkan pelanggan ke CS/staf AGM untuk konfirmasi harga final dan ketersediaan real-time.

================================================================================
MATERIAL DAN SPESIFIKASI TEKNIS
================================================================================
- Jelaskan karakteristik material berdasarkan data katalog: Aluminium (rangka anti karat/rayap), Kaca (tempered/bening/riben/stiker), ACP (Aluminium Composite Panel - tahan benturan/lembap).
- JANGAN mengarang spesifikasi teknis (ketebalan, grade material, sertifikasi) yang tidak ada dalam data.
- Jika detail teknis tidak tersedia, arahkan ke CS/staf teknis AGM.

================================================================================
KONSULTASI CUSTOM FURNITURE
================================================================================
BISA dilakukan:
- Mengumpulkan kebutuhan awal: jenis furnitur, ukuran ruangan, material diinginkan, jumlah pintu, desain, fungsi khusus.
- Merangkum kebutuhan pelanggan dalam format terstruktur.
- Menjelaskan proses konsultasi custom di AGM (ukuran per cm, pilihan material, warna ACP, bentuk L/U).
- Membantu mengarahkan pelanggan untuk menyampaikan spesifikasi lengkap ke AGM.

TIDAK BOLEH dilakukan:
- Menetapkan harga final secara sepihak (harga custom memerlukan perhitungan bengkel).
- Memberikan persetujuan teknis final (kelayakan konstruksi ditentukan bengkel/teknisi).
- Menyetujui atau mengonfirmasi pesanan (kewenangan admin/CS).
- Menggantikan keputusan CS atau staf toko.
- Menyatakan desain sudah "approved" atau "siap produksi" tanpa validasi tim teknis.

================================================================================
OUT-OF-SCOPE (PERTANYAAN DI LUAR CAKUPAN)
================================================================================
Jika pelanggan bertanya hal yang TIDAK berkaitan dengan:
- Produk furniture AGM (lemari, meja, kitchen set, rak, etalase, dll.)
- Material aluminium, kaca, ACP untuk furniture
- Katalog, harga, stok, spesifikasi produk AGM
- Proses konsultasi custom furniture AGM
- Layanan toko AGM (pengiriman, lokasi, kontak, jam operasional)

MAKA Anda WAJIB:
1. Mengenali pertanyaan di luar cakupan.
2. Menolak dengan sopan: "Maaf, pertanyaan tersebut di luar cakupan layanan AGM Assistant yang berfokus pada katalog furniture dan konsultasi custom CV Adi Guna Mandiri."
3. Mengarahkan kembali: "Apakah ada yang bisa dibantu mengenai produk furniture, material, atau konsultasi custom di AGM?"
4. TIDAK memaksakan jawaban yang tidak relevan.
5. TIDAK berdiskusi topik non-furniture/non-retail (politik, resep masakan, coding umum, hiburan, dll.).

================================================================================
BATASAN KEWENANGAN (KRITIS)
================================================================================
- Anda HANYA asisten konsultasi AWAL.
- Semua keputusan final: harga, kelayakan teknis, persetujuan pesanan, jadwal produksi, pengiriman -> KEWENANGAN CS/STAF/ADMIN/TEKNISI AGM.
- JANGAN pernah menyatakan: "Harganya Rp X", "Sudah disetujui", "Bisa diproduksi besok", "Stok pasti ada" tanpa data pendukung.
- Selalu gunakan kata: "perkiraan", "estimasi", "perlu dikonfirmasi", "silakan hubungi CS".

================================================================================
FORMAT JAWABAN UNTUK REKOMENDASI PRODUK
================================================================================
Jika merekomendasikan produk dari katalog, sertakan blok JSON di AKHIR balasan:
```json_product_recommendations
[{"id":"...","name":"...","subcategory":"...","price":0,"discount":0,"final_price":0,"stock":0,"unit":"Pcs","image_url":"..."}]
```
- Maksimal 3 produk.
- HANYA produk yang memiliki image_url pada data katalog.
- JANGAN mengarang id, harga, stok, atau image_url.
- Blok ini dibaca sistem untuk menampilkan foto produk. JANGAN jelaskan isi blok ke customer.
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
    """Calls Hermes AI native CLI for consultation jobs."""
    try:
        # Find Hermes executable
        hermes_candidates = [
            os.path.expanduser("~/.local/bin/hermes"),
            "/usr/local/bin/hermes",
            "/opt/homebrew/bin/hermes",
            shutil.which("hermes"),
        ]
        hermes_exe = None
        for candidate in hermes_candidates:
            if candidate and os.path.exists(candidate) and os.access(candidate, os.X_OK):
                hermes_exe = candidate
                break
        if not hermes_exe:
            raise Exception("Hermes CLI executable not found. Checked: " + ", ".join(filter(None, hermes_candidates)))

        # Run Hermes CLI in oneshot quiet mode without tools
        cmd = [
            hermes_exe,
            "chat",
            "-q", prompt,
            "--oneshot",
            "-Q",
            "--toolsets", "",
        ]

        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120,
        )

        if proc.returncode != 0:
            stderr_msg = proc.stderr.strip() if proc.stderr else "no stderr"
            raise Exception(f"Hermes CLI exited with code {proc.returncode}: {stderr_msg}")

        stdout_text = proc.stdout.strip() if proc.stdout else ""

        # Remove session_id line if present (format: "session_id: xxx")
        lines = stdout_text.splitlines()
        clean_lines = [line for line in lines if not line.strip().startswith("session_id:")]
        clean_text = "\n".join(clean_lines).strip()

        if not clean_text:
            raise Exception("Empty response from Hermes CLI")

        return clean_text

    except subprocess.TimeoutExpired:
        raise Exception("Hermes CLI timed out after 120 seconds")
    except FileNotFoundError:
        raise Exception("Hermes CLI executable not found")
    except Exception as e:
        raise Exception(f"Failed to call Hermes CLI: {e}")

def _read_9router_response(resp) -> str:
    """Read and classify one 9Router response without parsing blindly."""
    try:
        status = getattr(resp, "status", None)
        headers = getattr(resp, "headers", {})
        content_type = headers.get("Content-Type", "") if hasattr(headers, "get") else ""
        raw_bytes = resp.read()
        raw_text = raw_bytes.decode("utf-8", errors="replace")
        head = raw_text[:120].replace("\n", " ").replace("\r", " ")
        print(f"[{time.strftime('%H:%M:%S')}] [9ROUTER DIAG] status={status} content_type={content_type} body_len={len(raw_bytes)} head={head!r}")
        if status != 200 or not raw_text.strip():
            return ""
        return raw_text
    except Exception as read_err:
        print(f"[{time.strftime('%H:%M:%S')}] [9ROUTER DIAG] read failed: {read_err}")
        return ""

def analyze_furniture_visualization_9router(image_url: str, user_prompt: str, current_design_state: dict) -> str:
    """Calls 9Router Vision API (ag/gemini-3.8-flash-high) to inspect furniture visualization objectively."""
    try:
        nine_router_base = os.environ.get('NINE_ROUTER_BASE_URL', 'http://127.0.0.1:20128/v1').strip().rstrip('/')
        nine_router_key = os.environ.get('NINE_ROUTER_API_KEY', '')
        nine_router_vision_model = os.environ.get('NINE_ROUTER_VISION_MODEL', 'ag/gemini-3.8-flash-high')

        system_instruction = (
            "You are the visual inspection and product detail component of AGM Assistant for CV Adi Guna Mandiri (AGM 2) Ketapang. "
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
            "model": nine_router_vision_model,
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
        headers = {
            "Content-Type": "application/json"
        }
        if nine_router_key:
            headers["Authorization"] = f"Bearer {nine_router_key}"

        req = urllib.request.Request(
            f"{nine_router_base}/chat/completions",
            data=data_bytes,
            headers=headers,
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=60) as resp:
            raw_text = _read_9router_response(resp)
            if not raw_text or not raw_text.strip():
                print(f"[{time.strftime('%H:%M:%S')}] Warning: 9Router Vision empty response body")
                return ""

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
                try:
                    parsed_res = json.loads(raw_text)
                    return parsed_res.get('choices', [{}])[0].get('message', {}).get('content', '').strip()
                except json.JSONDecodeError as jde:
                    print(f"[{time.strftime('%H:%M:%S')}] Warning: 9Router Vision non-JSON body: {jde}; head={raw_text[:120]!r}")
                    return ""

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
        # Check if job was cancelled before execution starts
        status_check = supabase.from_("ai_jobs").select("status, error").eq("id", job_id).maybe_single().execute()
        if status_check.data:
            st = status_check.data.get("status")
            err = status_check.data.get("error")
            if st == "cancelled" or (st == "failed" and err == "job_cancelled_by_user"):
                print(f"[{time.strftime('%H:%M:%S')}] Job {job_id} was cancelled before worker execution. Aborting.")
                return

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
            # Fetch all active products (price > 0 or stock > 0) to maximize coverage
            catalog_res = supabase.from_("products").select(
                "id,name,category,subcategory,description,price,discount,stock,unit,image_url,images,arrival_type"
            ).order("created_at", desc=True).limit(100).execute()
            catalog_items = catalog_res.data or []

            # Filter out placeholder/empty products
            catalog_items = [
                it for it in catalog_items
                if it.get("name") and it.get("name", "").strip() not in ("", "-", " ")
            ]

            # Improved keyword scoring: normalize and match on multiple fields
            def normalize_text(text: str) -> str:
                return " ".join(text.lower().split())

            user_norm = normalize_text(user_prompt)
            user_tokens = [t for t in user_norm.split() if len(t) >= 2]

            def score_item(item):
                if not user_tokens:
                    return 0
                searchable = normalize_text(" ".join([
                    str(item.get("name", "")),
                    str(item.get("category", "")),
                    str(item.get("subcategory", "")),
                    str(item.get("description", "")),
                    str(item.get("arrival_type", "")),
                ]))
                score = 0
                for token in user_tokens:
                    if token in searchable:
                        score += 3
                    elif len(token) >= 4:
                        # partial match on word prefixes
                        for word in searchable.split():
                            if word.startswith(token[:4]):
                                score += 1
                                break
                return score

            ranked_items = sorted(catalog_items, key=lambda it: (score_item(it), it.get("stock", 0)), reverse=True)
            # Take top 30 relevant items, or first 30 if no matches
            top_items = ranked_items[:30] if any(score_item(it) > 0 for it in ranked_items) else catalog_items[:30]

            if ranked_items and score_item(ranked_items[0]) > 0:
                top_item = ranked_items[0]
                top_img = top_item.get("image_url") or (top_item.get("images") and top_item.get("images")[0])
                if top_img:
                    top_product_image_url = top_img
                    top_product_name = top_item.get("name")

            compact_items = []
            for it in top_items:
                price = int(it.get("price") or 0)
                disc = int(it.get("discount") or 0)
                images = it.get("images")
                img = it.get("image_url") or (images[0] if isinstance(images, list) and images else "")
                compact_items.append({
                    "id": it.get("id"),
                    "name": it.get("name"),
                    "subcategory": it.get("subcategory") or it.get("category"),
                    "price": price,
                    "discount": disc,
                    "final_price": max(0, price - disc),
                    "stock": it.get("stock", 0),
                    "unit": it.get("unit", "Pcs"),
                    "description": it.get("description", ""),
                    "image_url": img,
                    "arrival_type": it.get("arrival_type", ""),
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

        # Check if job was cancelled during LLM inference
        status_check = supabase.from_("ai_jobs").select("status, error").eq("id", job_id).maybe_single().execute()
        if status_check.data:
            st = status_check.data.get("status")
            err = status_check.data.get("error")
            if st == "cancelled" or (st == "failed" and err == "job_cancelled_by_user"):
                print(f"[{time.strftime('%H:%M:%S')}] Job {job_id} was cancelled during generation. Discarding output.")
                return

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
            "completed_at": datetime.now(timezone.utc).isoformat()
        }
        # Design state tetap dibawa dalam response JSON.
        # Tabel ai_jobs produksi belum memiliki kolom design_state.
        res = supabase.from_("ai_jobs").update(update_payload).eq("id", job_id).eq("status", "processing").execute()
        if not res.data:
            print(f"[{time.strftime('%H:%M:%S')}] Job {job_id} was not in processing status (cancelled or claimed by other). Output discarded.")
            return

        print(f"[{time.strftime('%H:%M:%S')}] [OK] Job {job_id} completed successfully.")

    except Exception as e:
        error_message = str(e)
        print(f"[{time.strftime('%H:%M:%S')}] [ERROR] Job {job_id} failed: {error_message}")
        try:
            supabase.from_("ai_jobs").update({
                "status": "failed",
                "error": error_message,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", job_id).eq("status", "processing").execute()
        except Exception:
            pass

def claim_ai_job():
    """Atomically claim one pending job using claim_ai_job() RPC (FOR UPDATE SKIP LOCKED).
    Returns job dict or None if no pending jobs available."""
    try:
        result = supabase.rpc("claim_ai_job").execute()
        rows = result.data or []
        if rows:
            return rows[0]
    except Exception as rpc_err:
        print(f"[{time.strftime('%H:%M:%S')}] claim_ai_job RPC failed: {rpc_err}")
    return None

def recover_stale_jobs():
    """
    Disabled temporarily.

    Production ai_jobs schema does not contain the retry/locking columns
    used by the previous recovery implementation. Existing processing jobs
    must not be modified until a separate recovery plan is approved.
    """
    return

def listen_for_new_jobs():
    """Main worker loop: claim jobs atomically via RPC and process them."""
    while True:
        try:
            job = claim_ai_job()
            if job:
                process_ai_job(job)
        except Exception as e:
            print(f"[{time.strftime('%H:%M:%S')}] Error in worker loop: {e}")
        time.sleep(3)

if __name__ == "__main__":
    listen_for_new_jobs()