# Persiapan Materi Bab IV — Evaluasi AGM Assistant

## 1. Pelaksanaan Evaluasi
Evaluasi dilakukan menggunakan `scripts/evaluate_40_questions.py` sebagai runner terisolasi. Runner memanggil Hermes AI CLI native dan menyediakan konteks katalog Supabase. Pengujian ini mengukur jalur eksekusi runner/Hermes, bukan validasi keseluruhan integrasi produksi frontend, API, worker, Supabase, dan 9Router.

## 2. Hasil Eksekusi 40 Pertanyaan
Run `run_20261128_002526` berisi 40/40 pertanyaan dengan status `completed`, 0 kegagalan, 0 error/timeout tercatat, dan 0 respons kosong. Rata-rata waktu respons 17.385 detik; total waktu respons 695.4 detik. Status: **TECHNICAL_EXECUTION_COMPLETED**.

## 3. Validasi Jawaban Acuan CS
Formulir tersedia di `cs_reference_validation_form.csv`. Seluruh 40 baris berstatus `PENDING`; jawaban acuan CS belum diberikan. Status: **CS_REFERENCE_VALIDATION_PENDING**. Bagian ini menunggu validasi pengguna sebagai validator CS AGM, dengan ChatGPT hanya sebagai alat bantu analisis.

## 4. Penilaian Tiga Evaluator
Instrumen berisi 120 entri (40 pertanyaan × E1, E2, E3). Seluruh skor, komentar, perilaku aktual, dan tanggal masih kosong. Status: **THREE_EVALUATOR_ASSESSMENT_PENDING**.

## 5. Hasil ROUGE
Hasil sementara dari referensi draft:

| Metrik | Precision | Recall | F1 |
|---|---:|---:|---:|
| ROUGE-1 | 0.1270 | 0.7112 | 0.1963 |
| ROUGE-2 | 0.0801 | 0.4264 | 0.1271 |
| ROUGE-L | 0.1217 | 0.6696 | 0.1876 |

Status: **FINAL_ROUGE_PENDING**. `calculate_final_rouge.py` menolak berjalan selama ada status CS `PENDING`. ROUGE mengukur kesamaan teks, bukan bukti tunggal kebenaran faktual atau pemahaman semantik.

## 6. Analisis Per Kategori
- Katalog/material: respons memanfaatkan konteks katalog; beberapa nama produk memiliki lebih dari satu entri.
- Rekomendasi: beberapa respons relevan, tetapi R-06 memerlukan klarifikasi kebutuhan ruang makan.
- Harga/stok: terdapat indikasi kontradiksi H-02 dan ambiguitas H-03/H-07 akibat entri ganda.
- Custom: respons umumnya mengumpulkan kebutuhan dan mengarahkan harga/kelayakan ke CS/teknisi.
- Out-of-scope: O-01–O-05 menolak pertanyaan non-AGM dan mengarahkan kembali.
- Bahasa informal: istilah informal dipahami, tetapi B-02 memakai kata "tersedia" untuk data stok 0.

## 7. Temuan dan Keterbatasan
Detail temuan: `quality_findings.md`. Keterbatasan utama: acuan CS belum divalidasi, evaluator belum menilai, retrieval berbasis pencocokan kata bukan vector/semantic search, dan batch terisolasi bukan pengujian produksi.

## 8. Interpretasi Hasil
Eksekusi teknis selesai, tetapi evaluasi kualitas penelitian belum final. Kesimpulan faktual harus menunggu validasi CS dan tiga evaluator. Jangan menyamakan skor ROUGE sementara dengan akurasi chatbot.

## Status Bab IV
Materi teknis siap dikembangkan. Bagian validasi CS, penilaian evaluator, dan ROUGE final diberi label **MENUNGGU DATA**.


> **Peran validator:** Pengguna adalah pemilik/validator CS AGM. ChatGPT hanya membantu analisis katalog dan rekomendasi APPROVED/REVISED. Keputusan final serta perubahan status hanya dilakukan setelah konfirmasi eksplisit pengguna. Antigravity hanya mengelola artefak. AI tidak mengaku sebagai staf atau CS AGM.
