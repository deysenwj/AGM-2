# Petunjuk Validasi Jawaban Acuan CS

## Tujuan
Validasi 40 jawaban acuan (referensi) evaluasi AGM Assistant agar dapat digunakan sebagai acuan kebenaran dalam perhitungan ROUGE dan analisis kualitas.

## Peran ChatGPT
Dalam percakapan validasi terpisah, ChatGPT bertindak sebagai CS/staf CV Adi Guna Mandiri yang mengacu pada data dan informasi perusahaan yang benar-benar tersedia.

## Langkah
1. Buka `cs_reference_validation_form.md`.
2. Bandingkan respons chatbot dengan jawaban acuan draft untuk setiap pertanyaan.
3. Periksa apakah jawaban draft akurat menurut data katalog AGM (harga, stok, material, subkategori, dsb).
4. Jika akurat: tulis jawaban acuan final di `cs_validated_answer`, status `APPROVED`.
5. Jika perlu koreksi: tulis jawaban final yang dikoreksi, status `REVISED`, catatan di `cs_notes`.
6. Jika belum dapat dipastikan: kosongkan `cs_validated_answer`, status `PENDING`, catatan alasan.
7. Simpan hasil kembali ke `cs_reference_validation_form.csv`.

## Aturan
- Jangan mengarang harga, stok, ukuran, material, atau kebijakan.
- Produk dengan stok nol: jangan menyatakan tersedia.
- Chatbot tidak boleh memberikan harga final/persetujuan teknis/konfirmasi transaksi custom.
- Semua baris awalnya PENDING.

## File sumber
- `scripts/evaluation/data/evaluation_questions.csv` (pertanyaan)
- `scripts/evaluation/data/reference_answers_draft.csv` (jawaban draft)
- `scripts/evaluation/results/run_20261128_002526/responses.json` (respons chatbot)
- `scripts/evaluation/cs_reference_validation_form.csv` (formulir yang diisi)

Catatan: Pembuatan formulir ini belum berarti validasi selesai.


> **Peran validator:** Pengguna adalah pemilik/validator CS AGM. ChatGPT hanya membantu analisis katalog dan rekomendasi APPROVED/REVISED. Keputusan final serta perubahan status hanya dilakukan setelah konfirmasi eksplisit pengguna. Antigravity hanya mengelola artefak. AI tidak mengaku sebagai staf atau CS AGM.
