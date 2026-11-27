# Panduan Evaluasi Kualitas AGM Assistant (40 Pertanyaan)

Dokumen ini menjelaskan alur lengkap evaluasi kualitas chatbot AGM Assistant untuk skripsi:
*“Implementasi Chatbot Berbasis Large Language Model (LLM) dengan Hermes AI pada Sistem Katalog Retail Berbasis Web (Studi Kasus: CV Adi Guna Mandiri)”*

---

## Alur Evaluasi (6 Tahap)

```
[Tahap 1: Eksekusi Teknis] (SELESAI - 40/40)
       │
       ▼
[Tahap 2: Validasi CS] ───────────────► `cs_reference_validation_form.csv`
       │                                 (PENDING -> APPROVED/REVISED via ChatGPT)
       ├─────────────────────────────────┐
       ▼                                 ▼
[Tahap 3: Penilaian Evaluator]     [Tahap 5: ROUGE Final]
(3 evaluator x 40 = 120 entri)     `calculate_final_rouge.py`
       │                                 │
       ▼                                 │
[Tahap 4: Pengolahan Evaluator]          │
`analyze_evaluator_scores.py`            │
       │                                 │
       └────────────────┬────────────────┘
                        ▼
           [Tahap 6: Finalisasi Laporan]
           `final_report.md` & `bab_iv_evaluation_summary.md`
```

---

## Tahap 1 — Eksekusi Teknis (SELESAI)
- **Status:** `TECHNICAL_EXECUTION_COMPLETED`.
- **Hasil:** 40 pertanyaan berhasil dieksekusi oleh native Hermes CLI pada batch `run_20261128_002526`.
- **File hasil:**
  - `scripts/evaluation/results/run_20261128_002526/responses.json`
  - `scripts/evaluation/results/run_20261128_002526/responses.csv`
- **ATURAN WAJIB:** **Jangan menjalankan ulang 40 pertanyaan.** Hasil asli telah terkunci dan tidak boleh diubah.
- **Runner arsip pelaksanaan:** `scripts/evaluate_40_questions.py` (DEPRECATED untuk finalisasi; jangan dijalankan ulang). Salinan `scripts/evaluation/evaluate_40_questions.py.DEPRECATED` tidak digunakan.

---

## Tahap 2 — Validasi Jawaban Acuan oleh CS (MENUNGGU VALIDASI)
- **Tujuan:** Menetapkan jawaban acuan resmi yang disahkan CS CV Adi Guna Mandiri.
- **Instrumen:**
  - `scripts/evaluation/cs_reference_validation_form.csv` (tabel 40 pertanyaan)
  - `scripts/evaluation/cs_reference_validation_form.md` (format bacaan untuk prompt ChatGPT)
  - `scripts/evaluation/PETUNJUK_VALIDASI_CS.md` (panduan alur validasi)
- **Mekanisme:**
  1. Pengguna membuka sesi percakapan terpisah dengan ChatGPT (sebagai alat bantu analisis, bukan CS AGM mengacu pada snapshot katalog dan kebijakan toko).
  2. Kirim isi `cs_reference_validation_form.md` per bagian ke ChatGPT.
  3. ChatGPT mengoreksi/menyetujui jawaban acuan draft.
  4. Pengguna atau Antigravity memperbarui `cs_reference_validation_form.csv`:
     - Isi `cs_validated_answer` dengan jawaban resmi CS.
     - Ubah `validation_status` dari `PENDING` menjadi `APPROVED` atau `REVISED`.
     - Isi `cs_notes` bila ada catatan khusus.
- **Status saat ini:** `CS_REFERENCE_VALIDATION_PENDING` (40 baris masih `PENDING`).

---

## Tahap 3 — Penilaian oleh Tiga Evaluator Independen (MENUNGGU EVALUATOR)
- **Tujuan:** Mengukur kualitas respons secara manusiawi pada 4 dimensi (Accuracy, Relevance, Completeness, Clarity) dengan skala 1–4.
- **Instrumen:**
  - `scripts/evaluation/three_evaluator_assessment.csv` (120 entri: 40 Q × E1, E2, E3)
  - `scripts/evaluation/three_evaluator_assessment.md` (format bacaan per pertanyaan)
  - `scripts/evaluation/PETUNJUK_PENILAIAN_EVALUATOR.md` (rubrik penilaian)
- **Aturan:**
  - Evaluator harus manusia nyata (E1, E2, E3) dan menilai secara independen.
  - Jangan mengisi skor atau komentar menggunakan AI.
  - Skala 1 (Tidak sesuai) s.d. 4 (Sangat sesuai).
- **Status saat ini:** `THREE_EVALUATOR_ASSESSMENT_PENDING` (120 entri kosong).

---

## Tahap 4 — Pengolahan Nilai Evaluator
- **Script:** `scripts/evaluation/analyze_evaluator_scores.py`
- **Perintah eksekusi:**
  ```bash
  ./.venv/bin/python scripts/evaluation/analyze_evaluator_scores.py
  ```
- **Prasyarat & kondisi penolakan:**
  - Menolak jika file tidak ada.
  - Menolak jika jumlah baris != 120.
  - Menolak jika ada skor kosong.
  - Menolak jika ada skor di luar bilangan bulat 1–4.
  - Menolak jika ada evaluator selain E1, E2, E3.
  - Menolak jika ada pertanyaan tanpa penilaian lengkap dari ketiga evaluator.
  - Menolak jika ada duplikasi pasangan `(question_id, evaluator_id)`.
- **Output (jika lolos):**
  - `scripts/evaluation/results/evaluator_scores_detail.csv`
  - `scripts/evaluation/results/evaluator_scores_summary.csv`
  - `scripts/evaluation/results/evaluator_scores_report.md`

---

## Tahap 5 — Perhitungan ROUGE Final
- **Script:** `scripts/evaluation/calculate_final_rouge.py`
- **Perintah eksekusi:**
  ```bash
  ./.venv/bin/python scripts/evaluation/calculate_final_rouge.py
  ```
- **Prasyarat & kondisi penolakan:**
  - Menolak jika ada status `PENDING`, kosong, atau tidak dikenal pada `cs_reference_validation_form.csv`.
  - Menolak jika ada `cs_validated_answer` kosong.
  - Menolak jika jumlah pertanyaan != 40 pada form atau responses.
  - Menolak jika ID respons dan referensi tidak cocok 1-ke-1.
  - Menolak jika ada respons kosong.
- **Metrik:** ROUGE-1, ROUGE-2, ROUGE-L (Precision, Recall, F1 macro-average per pertanyaan).
- **Hasil sementara (tetap dipertahankan sebelum CS valid):**
  - ROUGE-1: P=0.1270, R=0.7112, F1=0.1963
  - ROUGE-2: P=0.0801, R=0.4264, F1=0.1271
  - ROUGE-L: P=0.1217, R=0.6696, F1=0.1876
- **Output (jika lolos):**
  - `scripts/evaluation/results/rouge_detail_final.csv`
  - `scripts/evaluation/results/rouge_summary_final.md`

---

## Tahap 6 — Finalisasi Laporan Penelitian
- Perbarui `scripts/evaluation/final_report.md` dan `scripts/evaluation/bab_iv_evaluation_summary.md` hanya setelah Tahap 2–5 selesai.
- Pertahankan label status resmi:
  - `TECHNICAL_EXECUTION_COMPLETED`
  - `CS_REFERENCE_VALIDATION_PENDING` / `COMPLETED`
  - `THREE_EVALUATOR_ASSESSMENT_PENDING` / `COMPLETED`
  - `FINAL_ROUGE_PENDING` / `COMPLETED`
  - `QUALITY_EVALUATION_PENDING` / `COMPLETED`

---

## Ringkasan Lokasi File Penting

| Peran | File |
|---|---|
| Runner resmi | `scripts/evaluate_40_questions.py` |
| Runner arsip (jangan pakai) | `scripts/evaluation/evaluate_40_questions.py.DEPRECATED` |
| Dataset 40 pertanyaan | `scripts/evaluation/data/evaluation_questions.csv` |
| Jawaban draft acuan | `scripts/evaluation/data/reference_answers_draft.csv` |
| Snapshot katalog | `scripts/evaluation/data/raw_catalog.json` |
| Respons aktual chatbot | `scripts/evaluation/results/run_20261128_002526/responses.json` |
| Formulir validasi CS | `scripts/evaluation/cs_reference_validation_form.csv` |
| Instrumen evaluator | `scripts/evaluation/three_evaluator_assessment.csv` |
| Script olah evaluator | `scripts/evaluation/analyze_evaluator_scores.py` |
| Script ROUGE final | `scripts/evaluation/calculate_final_rouge.py` |
| Analisis temuan kualitas | `scripts/evaluation/quality_findings.md` |
| Laporan utama | `scripts/evaluation/final_report.md` |
| Materi Bab IV | `scripts/evaluation/bab_iv_evaluation_summary.md` |


> **Peran validator:** Pengguna adalah pemilik/validator CS AGM. ChatGPT hanya membantu analisis katalog dan rekomendasi APPROVED/REVISED. Keputusan final serta perubahan status hanya dilakukan setelah konfirmasi eksplisit pengguna. Antigravity hanya mengelola artefak. AI tidak mengaku sebagai staf atau CS AGM.
