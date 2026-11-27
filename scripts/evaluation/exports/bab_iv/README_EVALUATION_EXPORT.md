# Bab IV Evaluation Export

Sumber resmi: `scripts/evaluation/results/run_20261128_002526/`.
Run `run_20261128_002432` parsial (1 respons), tidak digunakan.

| File | Sumber | Baris | Status |
|---|---|---:|---|
| `evaluation_questions.csv` | dataset kanonis | 40 | lengkap |
| `agm_assistant_responses.csv` | responses.json run resmi | 40 | lengkap; 40 completed |
| `cs_reference_validation_form.csv` | formulir CS | 40 | 0 tervalidasi; 40 PENDING |
| `three_evaluator_assessment.csv` | instrumen evaluator | 120 | 0 skor terisi; E1/E2/E3 masing-masing 40 baris |
| `rouge_results.csv` | output ROUGE historis run resmi | 40 | draft; referensi masih DRAFT_NEEDS_CS_VALIDATION |

## Konsistensi

- ID pertanyaan kanonis: 40 unik.
- Respons aktual: 40 ID cocok, 0 kosong.
- Status eksekusi: 40 `completed`.
- Referensi CS: 40 `PENDING`; tidak ada `APPROVED`/`REVISED`.
- Skor evaluator: belum tersedia; tidak diisi otomatis.
- ROUGE: tersedia sebagai output historis berbasis referensi draft. Bukan hasil final penelitian.

## Batasan

Validasi CS wajib dilakukan oleh pemilik/validator CS AGM. AI hanya membantu analisis; tidak menggantikan persetujuan manusia. Penilaian E1, E2, E3 harus dilakukan independen. Tidak ada rerun Hermes, perubahan data asli, atau pembuatan skor sintetis.
