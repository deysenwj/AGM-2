#!/usr/bin/env python3
"""
Perhitungan ROUGE FINAL untuk evaluasi AGM Assistant.

Prasyarat: 40 jawaban acuan pada cs_reference_validation_form.csv sudah divalidasi CS
(status APPROVED atau REVISED). Script menolak berjalan jika ada PENDING/kosong/status
tidak dikenal, ID tidak cocok, respons kosong, atau referensi kosong.

Metode tokenisasi identik dengan scripts/evaluation/rouge_metrics.py agar konsisten.
Agregasi: macro-average (rata-rata metrik per pertanyaan).
Macro-average F1 TIDAK sama dengan harmonic mean dari rata-rata Precision dan Recall.
"""
import csv
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
FORM = Path(sys.argv[1]) if len(sys.argv) > 1 else (BASE / "cs_reference_validation_form.csv")
RESPONSES = BASE / "results/run_20261128_002526/responses.json"
QUESTIONS = BASE / "data/evaluation_questions.csv"
OUT_DIR = BASE / "results"

EXPECTED_TOTAL = 40
VALID_STATUSES = {"APPROVED", "REVISED"}
REQUIRED_FORM_COLS = {
    "question_id", "category", "question", "chatbot_response",
    "draft_reference_answer", "cs_validated_answer", "validation_status", "cs_notes",
}


def fail(errors: list) -> None:
    print("=== PERHITUNGAN ROUGE FINAL DITOLAK ===")
    for err in errors:
        print(f"- {err}")
    print("\nTidak ada output final yang ditulis. Hasil sementara tetap berlaku:")
    print("ROUGE-1 P=0.1270 R=0.7112 F1=0.1963")
    print("ROUGE-2 P=0.0801 R=0.4264 F1=0.1271")
    print("ROUGE-L P=0.1217 R=0.6696 F1=0.1876")
    sys.exit(2)


def tokenize(text: str) -> list:
    text = (text or "").lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return [t for t in text.split() if t]


def get_ngrams(tokens: list, n: int) -> list:
    return [tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def rouge_n(cand: list, ref: list, n: int) -> dict:
    cand_ng = get_ngrams(cand, n)
    ref_ng = get_ngrams(ref, n)
    if not cand_ng or not ref_ng:
        return {"p": 0.0, "r": 0.0, "f1": 0.0}
    cand_counts = {}
    for g in cand_ng:
        cand_counts[g] = cand_counts.get(g, 0) + 1
    ref_counts = {}
    for g in ref_ng:
        ref_counts[g] = ref_counts.get(g, 0) + 1
    overlap = sum(min(c, cand_counts.get(g, 0)) for g, c in ref_counts.items())
    p = overlap / len(cand_ng)
    r = overlap / len(ref_ng)
    f1 = (2 * p * r) / (p + r) if (p + r) > 0 else 0.0
    return {"p": p, "r": r, "f1": f1}


def lcs_length(x: list, y: list) -> int:
    m, n = len(x), len(y)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if x[i - 1] == y[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]


def rouge_l(cand: list, ref: list) -> dict:
    if not cand or not ref:
        return {"p": 0.0, "r": 0.0, "f1": 0.0}
    lcs = lcs_length(cand, ref)
    p = lcs / len(cand)
    r = lcs / len(ref)
    f1 = (2 * p * r) / (p + r) if (p + r) > 0 else 0.0
    return {"p": p, "r": r, "f1": f1}


def main():
    errors = []

    if not FORM.exists():
        fail([f"File formulir tidak ditemukan: {FORM}"])
    if not RESPONSES.exists():
        fail([f"File respons tidak ditemukan: {RESPONSES}"])
    if not QUESTIONS.exists():
        fail([f"Dataset pertanyaan tidak ditemukan: {QUESTIONS}"])

    with open(QUESTIONS, newline="", encoding="utf-8") as f:
        q_reader = csv.DictReader(f)
        required_question_cols = {"question_id", "category", "question", "expected_behavior", "reference_answer", "reference_status"}
        missing_question_cols = required_question_cols - set(q_reader.fieldnames or [])
        if missing_question_cols:
            fail([f"Kolom wajib tidak ada pada dataset pertanyaan: {sorted(missing_question_cols)}"])
        questions = list(q_reader)

    with open(FORM, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing_cols = REQUIRED_FORM_COLS - set(reader.fieldnames or [])
        if missing_cols:
            fail([f"Kolom wajib tidak ada pada formulir: {sorted(missing_cols)}"])
        form = list(reader)

    with open(RESPONSES, encoding="utf-8") as f:
        responses = json.load(f)

    # --- validasi jumlah ---
    if len(questions) != EXPECTED_TOTAL:
        errors.append(f"Jumlah dataset pertanyaan harus {EXPECTED_TOTAL}, ditemukan {len(questions)}")
    if len(form) != EXPECTED_TOTAL:
        errors.append(f"Jumlah jawaban acuan harus {EXPECTED_TOTAL}, ditemukan {len(form)}")
    if len(responses) != EXPECTED_TOTAL:
        errors.append(f"Jumlah respons harus {EXPECTED_TOTAL}, ditemukan {len(responses)}")

    # --- validasi duplikasi dan kecocokan tiga sumber ---
    question_ids = [r.get("question_id", "").strip() for r in questions]
    form_ids = [r["question_id"].strip() for r in form]
    resp_ids = [r["question_id"].strip() for r in responses]

    for label, ids in (("dataset pertanyaan", question_ids), ("jawaban acuan", form_ids), ("respons", resp_ids)):
        if len(set(ids)) != len(ids):
            dup = sorted({x for x in ids if ids.count(x) > 1})
            errors.append(f"question_id duplikat pada {label}: {dup}")

    set_questions, set_form, set_resp = set(question_ids), set(form_ids), set(resp_ids)
    if set_questions != set_form:
        errors.append(f"ID dataset pertanyaan vs jawaban acuan tidak cocok; hilang={sorted(set_questions-set_form)}, ekstra={sorted(set_form-set_questions)}")
    if set_questions != set_resp:
        errors.append(f"ID dataset pertanyaan vs respons tidak cocok; hilang={sorted(set_questions-set_resp)}, ekstra={sorted(set_resp-set_questions)}")

    # --- validasi status & isi ---
    bad_status = []
    empty_ref = []
    empty_resp = []
    resp_map = {r["question_id"].strip(): (r.get("candidate_answer") or "") for r in responses}

    for r in form:
        qid = r["question_id"].strip()
        status = (r.get("validation_status") or "").strip().upper()
        if status not in VALID_STATUSES:
            bad_status.append(f"{qid}={status or 'KOSONG'}")
        if not (r.get("cs_validated_answer") or "").strip():
            empty_ref.append(qid)
        if not (resp_map.get(qid) or "").strip():
            empty_resp.append(qid)

    if bad_status:
        errors.append(f"Status validasi tidak valid (harus APPROVED/REVISED): {bad_status}")
    if empty_ref:
        errors.append(f"cs_validated_answer kosong: {empty_ref}")
    if empty_resp:
        errors.append(f"Respons chatbot kosong: {empty_resp}")

    if errors:
        fail(errors)

    # --- perhitungan (pasangkan per question_id) ---
    detail = []
    sums = {k: 0.0 for k in ("r1_p", "r1_r", "r1_f1", "r2_p", "r2_r", "r2_f1", "rl_p", "rl_r", "rl_f1")}

    for r in form:
        qid = r["question_id"].strip()
        cand = tokenize(resp_map[qid])
        ref = tokenize(r["cs_validated_answer"])
        r1 = rouge_n(cand, ref, 1)
        r2 = rouge_n(cand, ref, 2)
        rl = rouge_l(cand, ref)
        detail.append({
            "question_id": qid,
            "category": r.get("category", ""),
            "validation_status": (r.get("validation_status") or "").strip().upper(),
            "rouge_1_p": round(r1["p"], 4), "rouge_1_r": round(r1["r"], 4), "rouge_1_f1": round(r1["f1"], 4),
            "rouge_2_p": round(r2["p"], 4), "rouge_2_r": round(r2["r"], 4), "rouge_2_f1": round(r2["f1"], 4),
            "rouge_l_p": round(rl["p"], 4), "rouge_l_r": round(rl["r"], 4), "rouge_l_f1": round(rl["f1"], 4),
        })
        for key, val in (("r1_p", r1["p"]), ("r1_r", r1["r"]), ("r1_f1", r1["f1"]),
                         ("r2_p", r2["p"]), ("r2_r", r2["r"]), ("r2_f1", r2["f1"]),
                         ("rl_p", rl["p"]), ("rl_r", rl["r"]), ("rl_f1", rl["f1"])):
            sums[key] += val

    n = len(detail)
    macro_raw = {k: v / n for k, v in sums.items()}
    macro = {k: round(v, 4) for k, v in macro_raw.items()}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    detail_path = OUT_DIR / "rouge_detail_final.csv"
    with open(detail_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(detail[0].keys()))
        w.writeheader()
        w.writerows(detail)

    summary_path = OUT_DIR / "rouge_summary_final.md"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write("# Ringkasan ROUGE Final — AGM Assistant\n\n")
        f.write(f"- Jumlah pertanyaan: {n}\n")
        f.write("- Sumber referensi: `cs_reference_validation_form.csv` (status APPROVED/REVISED)\n")
        f.write("- Pasangan respons-referensi: berdasarkan `question_id`\n")
        f.write("- Agregasi: macro-average (rata-rata metrik per pertanyaan)\n\n")
        f.write("| Metrik | Precision | Recall | F1 |\n|---|---:|---:|---:|\n")
        f.write(f"| ROUGE-1 | {macro['r1_p']} | {macro['r1_r']} | {macro['r1_f1']} |\n")
        f.write(f"| ROUGE-2 | {macro['r2_p']} | {macro['r2_r']} | {macro['r2_f1']} |\n")
        f.write(f"| ROUGE-L | {macro['rl_p']} | {macro['rl_r']} | {macro['rl_f1']} |\n\n")
        f.write("## Catatan metodologi\n\n")
        f.write("- Macro-average F1 adalah rata-rata F1 per pertanyaan, bukan harmonic mean dari rata-rata Precision dan Recall.\n")
        f.write("- ROUGE mengukur kesamaan leksikal teks, bukan bukti tunggal kebenaran faktual maupun pemahaman semantik.\n")
        f.write("- Detail per pertanyaan: `rouge_detail_final.csv`.\n")
        f.write("- Hasil sementara (referensi draft, belum divalidasi CS) tetap dipertahankan pada run_20261128_002526/rouge_summary.json.\n")

    print("ROUGE final berhasil dihitung.")
    print(f"Macro-average: {macro}")
    print(f"Output: {detail_path} | {summary_path}")


if __name__ == "__main__":
    main()
