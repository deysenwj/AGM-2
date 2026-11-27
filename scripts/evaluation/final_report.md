# LAPORAN AKHIR EVALUASI AGM ASSISTANT

**Status laporan:** VALID untuk pelaporan eksekusi; evaluasi kualitas dan acuan CS masih BELUM DIVALIDASI.

## Status Keberhasilan Evaluasi

| Komponen | Status | Keterangan |
|---|---|---|
| Eksekusi teknis 40 pertanyaan | TECHNICAL_EXECUTION_COMPLETED | 40/40 `completed`, 0 gagal, 0 error, 0 respons kosong |
| Validasi jawaban acuan CS | CS_REFERENCE_VALIDATION_PENDING | 40/40 `PENDING`, belum diberikan jawaban acuan CS |
| Penilaian tiga evaluator | THREE_EVALUATOR_ASSESSMENT_PENDING | 120 entri kosong, belum diisi oleh E1/E2/E3 |
| Perhitungan ROUGE final | FINAL_ROUGE_PENDING | Hanya tersedia hasil sementara dari referensi draft |
| Analisis kualitas | QUALITY_EVALUATION_PENDING | Observasi teknis tersedia, belum ada kesimpulan evaluator |

Eksekusi 40 pertanyaan menggunakan isolated runner dan native Hermes CLI. Hal ini tidak otomatis membuktikan keseluruhan integrasi produksi frontend/API/worker/Supabase/9Router berjalan tanpa masalah. Error upstream (HTTP 504 DeadlineExceeded) sebelumnya tidak diklaim teratasi tanpa bukti.


## 1. Ringkasan Evaluasi
Evaluasi menguji jalur runner terisolasi pada 40 pertanyaan dalam enam kategori: katalog/material, rekomendasi, harga/stok, custom furniture, out-of-scope, serta bahasa informal. Runner memanggil Hermes AI CLI native dan menyediakan konteks katalog Supabase. Jalur ini tidak sama dengan validasi integrasi AGM Assistant produksi secara utuh melalui frontend, API, polling job, dan 9Router.

Bukti utama:
- Dataset: `scripts/evaluation/data/evaluation_questions.csv`
- Respons aktual: `scripts/evaluation/results/run_20261128_002526/responses.json`
- Ringkasan ROUGE: `scripts/evaluation/results/run_20261128_002526/rouge_summary.json`
- Implementasi worker: `ai_worker.py`

## 2. Lingkungan dan Konfigurasi Pengujian Hermes AI
- Engine: Hermes AI CLI native, executable `/Users/mac/.local/bin/hermes`.
- Versi teridentifikasi: `Hermes Agent v0.21.6+726.g7bc0508`.
- Pemanggilan: `hermes chat -q <prompt> --oneshot -Q --toolsets ""` melalui `subprocess.run`.
- Timeout pemanggilan: 120 detik.
- Output: stdout dibaca sebagai jawaban; baris `session_id:` difilter; stderr dipisahkan.
- Worker utama: `ai_worker.py`, fungsi `call_hermes_cli()`.
- Runner: `scripts/evaluate_40_questions.py`.
- Retrieval: tabel Supabase `products`; mengambil hingga 100 baris, melakukan ranking berbasis pencocokan kata pada nama, kategori, subkategori, deskripsi, dan arrival type; hingga 30 produk dikirim ke prompt.
- Tidak ditemukan penggunaan vector database, embedding, pgvector, cosine similarity, atau semantic search pada runner/worker yang diaudit.
- Tanggal eksekusi berdasarkan timestamp file hasil: 2026-11-28.
- **Batas cakupan:** hasil ini membuktikan eksekusi runner/Hermes CLI. Integrasi produksi frontend → API → worker → 9Router tidak dinyatakan tervalidasi oleh batch ini.

## 3. Dataset Evaluasi
Audit dataset menunjukkan 40 baris data, 40 ID unik, tanpa duplikasi.

| Kategori | Makna | Jumlah | Status |
|---|---|---:|---|
| K | Katalog/material | 8 | VALID |
| R | Rekomendasi | 7 | VALID |
| H | Harga/stok | 7 | VALID |
| C | Custom furniture | 8 | VALID |
| O | Di luar cakupan | 5 | VALID |
| B | Bahasa informal/lokal | 5 | VALID |
| **Total** |  | **40** | **VALID** |

Seluruh pertanyaan memiliki kategori dan ID. Pertanyaan merujuk pada produk/konteks AGM, termasuk `Meja tv bopet 4 pt roda`, `Lemari sepatu 6 rak`, lemari pakaian, kitchen set, serta kebutuhan custom. Beberapa nama produk memiliki lebih dari satu entri katalog; kondisi ini menjadi keterbatasan yang perlu diperhatikan saat validasi CS.

### Status jawaban acuan
`reference_answers_draft.csv` berisi 40 jawaban nonkosong. Seluruh 40 baris berstatus `DRAFT_NEEDS_CS_VALIDATION`. Tidak ada jawaban acuan yang dapat dinyatakan telah divalidasi CS. Status acuan: **BELUM DIVALIDASI**.

## 4. Hasil Eksekusi Seluruh Pertanyaan
Sumber: `responses.json` dan `responses.csv` pada run `run_20261128_002526`.

| Ukuran | Hasil | Status |
|---|---:|---|
| Pertanyaan tersedia pada hasil | 40 | VALID |
| Berhasil dieksekusi (`completed`) | 40 | VALID |
| Gagal | 0 | VALID |
| Respons kosong | 0 | VALID |
| Timeout/error tercatat | 0 | VALID |
| Total waktu respons | 695.4 detik | VALID |
| Rata-rata waktu respons | 17.385 detik | VALID |
| Waktu minimum | 10.98 detik | VALID |
| Waktu maksimum | 41.72 detik | VALID |

Semua 40 objek hasil memiliki `execution_status: completed`, `error_message` kosong, serta `candidate_answer` nonkosong. Dengan demikian, **40 pertanyaan berhasil dieksekusi secara teknis** dan terdapat **0 kegagalan eksekusi pada run final**. Ini membuktikan keberhasilan jalur runner/Hermes CLI, bukan otomatis kebenaran setiap jawaban atau keberhasilan integrasi AGM Assistant produksi melalui frontend/API/9Router.

### Catatan Error Upstream

Artefak evaluasi lokal yang diaudit tidak memuat log `HTTP 504 DeadlineExceeded`. Karena itu, laporan ini tidak dapat memverifikasi apakah percobaan awal tersebut terjadi sebelum run final. Run final `run_20261128_002526` sendiri tercatat selesai dengan 40 `completed`, 0 error, dan 0 respons kosong. Tidak ada klaim bahwa error upstream telah pulih atau teratasi berdasarkan bukti yang tidak tersedia.

## 5. Analisis Respons Chatbot
Ringkasan di bawah berasal dari respons aktual, bukan penilaian manual final.

| Kelompok | Bukti aktual | Analisis | Status |
|---|---|---|---|
| Katalog/material | K-01 menjawab bahan meja TV sebagai aluminium dan kaca; K-02 mengembalikan subkategori Lemari Sepatu. | Respons menggunakan data katalog. K-04/K-05 menemukan dua entri bernama hampir sama dan menyatakan perbedaan stok/deskripsi. | SEMENTARA |
| Harga/stok | K-03/H-01/H-05 menyebut harga asli Rp2.450.000, diskon Rp150.000, harga akhir Rp2.300.000; H-02 menyatakan tidak ada diskon meskipun hasil juga memuat entri dengan diskon. | Ada indikasi ketidakkonsistenan pada pertanyaan dengan beberapa entri produk. Perlu validasi katalog/CS. | SEMENTARA |
| Rekomendasi | R-01, R-03, R-04, dan R-05 mengembalikan produk katalog serta blok rekomendasi JSON. | Rekomendasi berbasis konteks, tetapi R-06 memilih lemari dapur untuk kebutuhan ruang makan tanpa klarifikasi memadai. | SEMENTARA |
| Custom | C-01/C-02/C-05/C-06 mengumpulkan ukuran, material, pintu, bentuk, serta mengarahkan estimasi/kelayakan kepada CS/bengkel. | Batas kewenangan umumnya disebutkan. C-03/C-04/C-07/C-08 lebih ringkas sehingga memerlukan klarifikasi lanjutan. | SEMENTARA |
| Out-of-scope | O-01 sampai O-05 menolak pertanyaan non-AGM dan mengarahkan kembali ke furniture AGM. | Perilaku sesuai batasan out-of-scope pada prompt. | SEMENTARA |
| Bahasa informal | B-01 sampai B-05 memahami singkatan seperti `brp hrg`, `kicen`, dan pertanyaan custom informal. | Pemahaman informal terlihat, tetapi B-02 menyatakan produk "tersedia" sementara stok yang ditampilkan 0; wording perlu diperketat menjadi "tercatat di katalog, ketersediaan perlu dikonfirmasi". | SEMENTARA |

### Rekapitulasi per pertanyaan
Seluruh pertanyaan tidak dihilangkan dari hasil. Detail lengkap pertanyaan, respons aktual, status eksekusi, waktu, dan error ada di `responses.json`/`responses.csv`. Tidak ada baris gagal yang perlu dikecualikan.

## 6. Hasil Perhitungan ROUGE
Sumber: `rouge_summary.json`, `rouge_results.csv`, dan implementasi `scripts/evaluation/rouge_metrics.py`.

| Metrik | Precision | Recall | F1 rata-rata |
|---|---:|---:|---:|
| ROUGE-1 | 0.1270 | 0.7112 | 0.1963 |
| ROUGE-2 | 0.0801 | 0.4264 | 0.1271 |
| ROUGE-L | 0.1217 | 0.6696 | 0.1876 |

Implementasi mencakup:
- ROUGE-1 unigram.
- ROUGE-2 bigram.
- ROUGE-L berbasis longest common subsequence.
- Precision, recall, dan F1 per pertanyaan.
- Tokenisasi lowercase dan penghapusan punctuation.
- Guard pembagian nol.
- Konsistensi diverifikasi: 40 baris CSV, 40 objek JSON. Rata-rata per-question yang dihitung dari `rouge_summary.json` adalah Precision/Recall/F1: ROUGE-1 0.1270/0.7112/0.1963; ROUGE-2 0.0801/0.4264/0.1271; ROUGE-L 0.1217/0.6696/0.1876.

**Status ROUGE: SEMENTARA / BELUM VALID untuk klaim kualitas final.** Seluruh referensi masih `DRAFT_NEEDS_CS_VALIDATION`. ROUGE hanya mengukur kesamaan tekstual; bukan akurasi fakta, kebenaran katalog, kualitas penalaran, atau kemampuan semantik chatbot.

## 7. Evaluasi Kemampuan Chatbot
Klasifikasi yang digunakan:

1. **High Capability** — respons menjawab pertanyaan dengan benar dan sesuai sumber.
2. **Conditional Capability** — respons cukup sesuai, tetapi membutuhkan klarifikasi atau memiliki keterbatasan.
3. **Escalation Required** — pertanyaan memerlukan keputusan/validasi CS, teknisi, admin, atau berada di luar kewenangan chatbot.

`capability_assessment_template.csv` memiliki 40 baris, tetapi kolom `actual_behavior`, evaluator 1, evaluator 2, evaluator 3, dan `final_assessment` belum diisi. Karena itu:

- Jumlah High Capability final: **belum tersedia**.
- Jumlah Conditional Capability final: **belum tersedia**.
- Jumlah Escalation Required final: **belum tersedia**.
- Status tiga evaluator: **BELUM DILAKUKAN**.
- Penilaian manual: **BELUM SELESAI**.

Observasi teknis pada bagian 5 bukan pengganti penilaian evaluator.

## Catatan Analisis Kualitas

Observasi teknis terhadap 40 respons telah disatukan di `quality_findings.md` dengan bukti respons aktual, termasuk H-02, H-03, H-07, R-06, dan B-02. Temuan tersebut adalah observasi teknis, bukan kesimpulan penilaian evaluator manusia.

## 8. Keterbatasan Penelitian dan Validitas Data
- Referensi CS belum divalidasi; seluruh acuan masih draft.
- Nama produk dapat memiliki beberapa entri katalog. Contoh: `Lemari sepatu 6 rak` muncul dengan variasi deskripsi, harga, gambar, dan stok. Pertanyaan ambigu memerlukan disambiguasi produk.
- Retrieval menggunakan ranking kata dan batas 100/30 item, bukan vector retrieval atau embedding.
- `responses.json` membuktikan pemanggilan Hermes selesai, tetapi tidak mencatat model/provider internal secara per-pertanyaan. Versi CLI tercatat, provider model tidak tercantum pada hasil run.
- Tidak ada hasil penilaian tiga evaluator.
- Tidak ada klaim akurasi faktual yang dapat ditarik hanya dari ROUGE.
- Pengujian ini merupakan batch terisolasi; bukan validasi seluruh percakapan produksi, latency frontend, atau kondisi beban produksi.

## 9. Kesimpulan
1. **Eksekusi engine:** VALID untuk jalur runner dan Hermes CLI native. Bukan validasi menyeluruh atas integrasi frontend/API/worker/9Router produksi.
2. **Eksekusi pengujian:** VALID; 40 dari 40 pertanyaan berhasil dieksekusi secara teknis, 0 kegagalan eksekusi, 0 error tercatat, 0 respons kosong pada run final.
3. **Kualitas jawaban:** BELUM FINAL. Respons sesuai batasan pada banyak kasus, namun terdapat respons yang memerlukan klarifikasi/disambiguasi (terdapat pada H-02, H-03, H-07, R-06, B-02).
4. **ROUGE:** SEMENTARA; skor tidak dapat dipakai sebagai validasi final karena referensi belum disahkan CS.
5. **Evaluasi kemampuan:** BELUM SELESAI karena belum ada penilaian manual tiga evaluator.

## 10. Rekomendasi
1. Validasi dan koreksi 40 `reference_answer` oleh CS/staf AGM; ubah status hanya setelah persetujuan nyata.
2. Isi `capability_assessment_template.csv` oleh tiga evaluator independen; dokumentasikan alasan tiap klasifikasi.
3. Tambahkan identifikasi unik/aturan disambiguasi saat beberapa produk memiliki nama sama atau hampir sama.
4. Perketat prompt agar "tercatat di katalog" tidak disamakan dengan "tersedia"; stok 0 harus dijelaskan eksplisit.
5. Ulangi ROUGE setelah referensi tervalidasi; pertahankan interpretasi ROUGE sebagai kesamaan tekstual saja.
6. Audit manual khusus untuk H-02, H-03, H-07, R-06, dan B-02 karena respons aktual menunjukkan potensi ambiguitas atau ketidakkonsistenan katalog.

## Referensi Artefak
- `scripts/evaluation/data/evaluation_questions.csv`
- `scripts/evaluation/data/reference_answers_draft.csv`
- `scripts/evaluation/data/instrument_documentation.md`
- `scripts/evaluation/capability_assessment_template.csv`
- `scripts/evaluation/README.md`
- `scripts/evaluation/rouge_metrics.py`
- `scripts/evaluate_40_questions.py`
- `scripts/evaluation/results/run_20261128_002526/responses.json`
- `scripts/evaluation/results/run_20261128_002526/responses.csv`
- `scripts/evaluation/results/run_20261128_002526/rouge_results.csv`
- `scripts/evaluation/results/run_20261128_002526/rouge_summary.json`


> **Peran validator:** Pengguna adalah pemilik/validator CS AGM. ChatGPT hanya membantu analisis katalog dan rekomendasi APPROVED/REVISED. Keputusan final serta perubahan status hanya dilakukan setelah konfirmasi eksplisit pengguna. Antigravity hanya mengelola artefak. AI tidak mengaku sebagai staf atau CS AGM.
