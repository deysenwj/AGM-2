# Analisis Temuan Kualitas Respons AGM Assistant

Dokumen ini mendokumentasikan temuan observasi teknis terhadap respons aktual chatbot pada 40 pertanyaan evaluasi (`scripts/evaluation/results/run_20261128_002526/responses.json`).

*Catatan penting:* Dokumen ini memuat **observasi teknis awal**. Ini bukan keputusan penilaian manusia dan tidak menggantikan penilaian tiga evaluator independen.

---

## 1. Temuan Kritis: Entri Produk Kembar & Ambiguitas Harga/Diskon (H-02, H-03, H-07, K-04, K-05)

### QID: H-02
- **Pertanyaan:** "Apakah Lemari sepatu 6 rak ada diskon?"
- **Bukti respons aktual:**
  ```text
  Tidak ada diskon. Silakan hubungi CS AGM untuk konfirmasi lebih lanjut.
  ```json_product_recommendations
  [{"id":"a79af9c3-3da1-4674-8271-e4a95c1ca0e6","name":"Lemari sepatu  6 rak","subcategory":"Lemari Sepatu","price":1200000,"discount":50000,"final_price":1150000,"stock":1,"unit":"Pcs","image_url":"https://res.cloudinary.com/beb9qamf/image/upload/v1785206131/product_images/agjqibujagxecifz7nbl.jpg"}]
  ```
  ```
- **Uraian masalah:** Teks jawaban menyatakan "Tidak ada diskon", namun blok JSON rekomendasi di bawahnya justru memuat data produk dengan `discount: 50000` (diskon Rp50.000). Terjadi kontradiksi internal antara teks dan data JSON yang menyertainya. Hal ini dipicu oleh adanya dua entri katalog untuk "Lemari sepatu 6 rak": entri pertama (ID `ccdbda55`) dengan diskon 0, dan entri kedua (ID `a79af9c3`) dengan diskon Rp50.000.
- **Dampak:** Membingungkan pelanggan mengenai ada/tidaknya potongan harga resmi.
- **Status verifikasi:** TERKONFIRMASI SECARA TEKNIS (bukti ada di respons aktual). Perlu validasi CS untuk data mana yang benar.
- **Rekomendasi:** Chatbot harus mendeteksi keberadaan multi-entri katalog dan menjelaskan kedua entri atau meminta klarifikasi varian yang dimaksud pelanggan.

### QID: H-03 & H-07
- **Pertanyaan H-03:** "Berapa harga Lemari sepatu 6 rak?"
- **Bukti respons H-03:** `Harga Lemari sepatu 6 rak 1150000` (hanya menyebut harga akhir entri kedua).
- **Pertanyaan H-07:** "Tolong sebutkan harga dan stok Lemari sepatu 6 rak."
- **Bukti respons H-07:**
  ```text
  Informasi stok Lemari sepatu 6 rak tidak tersedia di semua entri katalog.
  ```json_product_recommendations
  [{"id":"ccdbda55...","price":1450000,"stock":0},{"id":"a79af9c3...","price":1200000,"discount":50000,"final_price":1150000,"stock":1}]
  ```
  ```
- **Uraian masalah:** Pada H-07 chatbot mengenali adanya dua entri dan menampilkan keduanya di JSON, tetapi kalimat pembukanya kurang lugas menjelaskan rincian stok masing-masing entri. Pada K-04 dan K-05, chatbot mampu membedakan kedua entri dengan sangat rinci (ID, deskripsi, harga, stok). Ini menunjukkan variabilitas respons terhadap produk yang memiliki duplikasi entri di katalog.
- **Dampak:** Ketidakkonsistenan kedalaman jawaban antarpertanyaan terkait produk yang sama.
- **Status verifikasi:** TERKONFIRMASI SECARA TEKNIS.
- **Rekomendasi:** Terapkan aturan prompt konsisten: jika produk memiliki lebih dari 1 entri di katalog, sebutkan kedua entri beserta pembedanya (material/deskripsi/ID).

---

## 2. Temuan Kritis: Ambiguasi Status Ketersediaan vs Stok Nol (B-02 & R-04)

### QID: B-02
- **Pertanyaan:** "kicen set ada ga?" (bahasa informal)
- **Bukti respons aktual:**
  ```text
  Ada Kicen set westafel dan Kicen set 6 pintu+laci+westafel tersedia di katalog
  ```json_product_recommendations
  [{"id":"e3ed3dc7...","price":0,"stock":0},{"id":"54009718...","price":0,"stock":0}]
  ```
  Silakan hubungi CS AGM untuk konfirmasi detail dan pemesanan lebih lanjut.
  ```
- **Uraian masalah:** Chatbot menggunakan frasa "tersedia di katalog" untuk produk yang tercatat di database dengan `stock: 0` dan `price: 0` (produk custom/pre-order). Pelanggan awam dapat salah mengartikan kata "tersedia" sebagai "ready stock" siap kirim.
- **Dampak:** Ekspektasi ketersediaan langsung oleh pelanggan padahal status stok 0 (perlu diproduksi/pre-order).
- **Status verifikasi:** TERKONFIRMASI SECARA TEKNIS.
- **Rekomendasi:** Perketat instruksi prompt: bedakan dengan tegas frasa "tercatat di katalog" dengan "tersedia/ready stock". Jika stok 0 atau harga 0, wajib sebutkan bahwa produk berstatus pre-order atau perlu konfirmasi produksi ke CS AGM.

### QID: R-04
- **Pertanyaan:** "Butuh lemari dengan banyak rak, apa rekomendasinya?"
- **Bukti respons aktual:** Merekomendasikan `Lemari 4 pt belah 8` (stok 0), `Lemari 3 pt taperwer` (stok 2), dan `Lermari 2 pt belah 4` (stok 0).
- **Uraian masalah:** Chatbot merekomendasikan produk dengan stok 0 sebagai pilihan utama karena kesesuaian nama produk ("belah 8"), namun menyebutkan "stok tercatat 0" dan mengarahkan ke CS.
- **Dampak:** Baik karena jujur menyatakan stok 0, namun prioritas rekomendasi idealnya mengutamakan produk yang ready stock (stok > 0).
- **Status verifikasi:** TERKONFIRMASI SECARA TEKNIS.
- **Rekomendasi:** Dalam algoritma ranking/rekomendasi, berikan bobot lebih tinggi pada produk dengan status ready stock (`stock > 0`).

---

## 3. Temuan Relevansi Rekomendasi Ruang Makan (R-06)

### QID: R-06
- **Pertanyaan:** "Bantu saya pilih furniture untuk ruang makan."
- **Bukti respons aktual:**
  ```text
  Lemari dapur 3 pintu
  [{"id":"9477e602...","name":"Lemari dapur 3 pintu ","subcategory":"Lemari Dapur","price":2100000,"stock":2}]
  Silakan hubungi CS AGM untuk konfirmasi lebih lanjut.
  ```
- **Uraian masalah:** Jawaban sangat singkat (terlalu pendek). Chatbot langsung merekomendasikan lemari dapur 3 pintu tanpa menanyakan atau menawarkan opsi meja makan/meja prasmanan atau menjelaskan mengapa lemari dapur relevan untuk ruang makan.
- **Dampak:** Interaksi terkesan kaku dan kurang eksploratif untuk kategori konsultasi rekomendasi (R).
- **Status verifikasi:** TERKONFIRMASI SECARA TEKNIS.
- **Rekomendasi:** Berikan respons yang lebih ramah dengan menanyakan kebutuhan spesifik (misal: butuh meja makan, lemari penyimpanan makanan/dapur, atau rak saji).

---

## 4. Temuan Positif: Kepatuhan Batasan Sistem (C dan O)

### Kategori Out-of-Scope (O-01 s.d. O-05)
- **Bukti:** Seluruh pertanyaan non-AGM (saham BBCA, coding React, berita Kalbar, resep rendang, presiden RI) ditolak dengan sopan menggunakan pola penolakan standar dan mengarahkan kembali ke layanan furniture CV Adi Guna Mandiri.
- **Status:** Sangat baik, 100% patuh pada batasan ruang lingkup.

### Kategori Custom Furniture (C-01 s.d. C-08)
- **Bukti:** Pada C-01, C-02, C-05, C-06, chatbot berhasil:
  1. Mengumpulkan dimensi per cm, pilihan material (aluminium, ACP, kaca), jumlah pintu, bentuk L/U.
  2. Secara eksplisit menyatakan tidak memiliki kewenangan menetapkan harga final atau persetujuan teknis.
  3. Mengarahkan perhitungan biaya dan kelayakan konstruksi kepada teknisi bengkel dan CS AGM.
- **Status:** Sangat baik, sesuai dengan batasan peran asisten digital konsultasi awal.

### Kategori Bahasa Informal / Ejaan Tidak Baku (B-01 s.d. B-05)
- **Bukti:** Chatbot berhasil mengenali istilah singkatan dan ejaan tidak baku: `brp hrg lmari pakaian` (B-01), `kicen set` (B-02), `lemari sepatu stok?` (B-03), `custom ukuran 2 meter?` (B-04), dan `apa material alumunium?` (B-05).
- **Status:** Sangat baik dalam pemahaman variasi bahasa percakapan sehari-hari.

---

## 5. Ringkasan Kategori Temuan

| No | Kategori Masalah | QID Terkait | Tingkat Kritis | Rekomendasi Solusi |
|---|---|---|---|---|
| 1 | Kontradiksi teks vs JSON akibat produk kembar | H-02 | Tinggi | Deteksi multi-entri, sebutkan kedua varian |
| 2 | Ambiguitas kata "tersedia" pada stok 0 | B-02 | Sedang | Ubah menjadi "tercatat di katalog (stok pre-order)" |
| 3 | Jawaban terlalu ringkas pada konsultasi rekomendasi | R-06, C-03, C-04 | Sedang | Tambahkan pertanyaan klarifikasi kebutuhan |
| 4 | Kepatuhan batasan out-of-scope | O-01 s.d. O-05 | Positif | Pertahankan pola penolakan sopan |
| 5 | Kepatuhan batasan kewenangan custom | C-01 s.d. C-08 | Positif | Pertahankan eskalasi harga final ke CS |
| 6 | Pemahaman bahasa informal/slang | B-01 s.d. B-05 | Positif | Pertahankan toleransi ejaan |


---

## 6. Audit Snapshot Katalog — Produk Lemari Sepatu 6 Rak

Sumber: `scripts/evaluation/data/raw_catalog.json` (82 entri snapshot).

Snapshot memuat dua entri dengan nama tampilan hampir sama, tetapi ID berbeda:

| Field | Entri 1 | Entri 2 |
|---|---|---|
| ID | `ccdbda55-0ddc-413c-b129-b03f4f309c91` | `a79af9c3-3da1-4674-8271-e4a95c1ca0e6` |
| Nama | `Lemari sepatu 6 rak` | `Lemari sepatu  6 rak` |
| Deskripsi | `Bahan alumunium kaca` | `Barang kaca` |
| Harga | Rp1.450.000 | Rp1.200.000 |
| Diskon | Rp0 | Rp50.000 |
| Harga setelah diskon | Rp1.450.000 | Rp1.150.000 |
| Stok | 0 | 1 Pcs |
| Gambar | Kosong | URL gambar tersedia |

**Yang dapat dipastikan:** kedua baris merupakan dua record katalog dengan ID berbeda dan nilai harga/diskon/stok berbeda.

**Yang belum dapat dipastikan:** snapshot tidak membuktikan apakah record tersebut merupakan varian, duplikasi administrasi, produk berbeda, atau versi data yang tidak tersinkron. Tidak boleh digabung atau dipilih secara sepihak sebagai harga pasti.

**Keputusan yang membutuhkan CS:** identitas bisnis produk, harga/diskon yang berlaku, status penjualan, dan cara penyajian kepada pelanggan.

**Implikasi evaluator:** H-02, H-03, H-07, K-04, dan K-05 perlu dinilai terhadap kemampuan chatbot mempertahankan perbedaan record dan menyampaikan ketidakpastian.

## 7. Pemetaan Temuan Khusus ke Sumber Bukti

| QID | Bukti snapshot | Bukti respons | Hal yang dapat dipastikan | Hal yang belum dapat dipastikan / tindakan |
|---|---|---|---|---|
| K-07 | Produk memiliki `category: furniture`. | Respons menjawab `furniture`. | Jawaban cocok dengan field snapshot. | CS/evaluator tetap memutuskan kecukupan konteks jawaban. |
| H-02 | Record 1 diskon 0; record 2 diskon 50.000. | Teks menyebut tidak ada diskon; JSON memuat diskon 50.000. | Ada kontradiksi internal pada respons. | CS menentukan record/aturan bisnis yang berlaku. |
| H-07 | Dua record memiliki stok 0 dan 1. | Respons menampilkan dua ID dengan data berbeda. | Respons mempertahankan dua record di JSON. | CS menilai apakah penjelasan teks cukup dan apakah record dapat ditawarkan. |
| R-04 | Salah satu rekomendasi memiliki stok 0; record lain stok 2. | `Lemari 4 pt belah 8` diprioritaskan meski stok 0. | Chatbot menyebut stok 0. | Evaluator menilai relevansi prioritas; CS menentukan kebijakan rekomendasi ready stock. |
| R-06 | Snapshot memiliki berbagai kategori furniture. | Chatbot memilih lemari dapur untuk kebutuhan ruang makan tanpa klarifikasi. | Respons aktual memang memilih produk tersebut. | Evaluator/CS menilai relevansi dan kebutuhan pertanyaan klarifikasi. |
| B-02 | Dua kitchen set memiliki stok 0 dan harga 0. | Respons menyatakan produk "tersedia di katalog". | Produk tercatat di katalog; stok aktual snapshot 0. | Jangan tafsirkan "tersedia" sebagai ready stock; perlu validasi wording CS. |

Seluruh butir di atas merupakan temuan observasi teknis. Status evaluasi manusia tetap menunggu penilaian CS dan tiga evaluator independen.

Catatan: data snapshot dan data produksi tidak diubah.
