#!/usr/bin/env python3
"""
Analisis skor penilaian tiga evaluator untuk AGM Assistant.

Prasyarat: semua 120 entri (40 pertanyaan x E1, E2, E3) sudah diisi oleh evaluator
manusia. Script menolak finalisasi jika ada data kosong, duplikasi pasangan,
evaluator selain E1/E2/E3, atau skor di luar rentang 1–4.
"""
import csv
import sys
from collections import defaultdict, Counter
from pathlib import Path

BASE = Path(__file__).resolve().parent
CSV_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else (BASE / "three_evaluator_assessment.csv")
QUESTIONS_PATH = BASE / "data" / "evaluation_questions.csv"
OUT_DIR = BASE / "results"

EXPECTED_TOTAL = 120
EXPECTED_QUESTIONS = 40
VALID_EVALUATORS = {"E1", "E2", "E3"}
ASPECTS = ["accuracy_score", "relevance_score", "completeness_score", "clarity_score"]
REQUIRED_COLS = {
    "question_id", "category", "question", "chatbot_response", "evaluator_id",
    "accuracy_score", "relevance_score", "completeness_score", "clarity_score",
    "actual_behavior", "evaluator_notes", "final_assessment", "assessment_date",
}


def fail(errors: list) -> None:
    print("=== ANALISIS NILAI EVALUATOR DITOLAK ===")
    for err in errors:
        print(f"- {err}")
    print("\nTidak ada output final yang ditulis. Lengkapi penilaian oleh evaluator E1, E2, E3 terlebih dahulu.")
    sys.exit(2)


def main():
    errors = []

    if not CSV_PATH.exists():
        fail([f"File tidak ditemukan: {CSV_PATH}"])
    if not QUESTIONS_PATH.exists():
        fail([f"Dataset pertanyaan kanonis tidak ditemukan: {QUESTIONS_PATH}"])

    with open(QUESTIONS_PATH, newline="", encoding="utf-8") as f:
        question_reader = csv.DictReader(f)
        required_question_cols = {"question_id", "category", "question"}
        missing_question_cols = required_question_cols - set(question_reader.fieldnames or [])
        if missing_question_cols:
            fail([f"Kolom wajib tidak ada pada dataset pertanyaan: {sorted(missing_question_cols)}"])
        question_rows = list(question_reader)

    canonical = {}
    for row in question_rows:
        qid = (row.get("question_id") or "").strip()
        if not qid:
            fail(["Dataset pertanyaan memiliki question_id kosong"])
        if qid in canonical:
            fail([f"Dataset pertanyaan memiliki question_id duplikat: {qid}"])
        canonical[qid] = {
            "category": (row.get("category") or "").strip(),
            "question": (row.get("question") or "").strip(),
        }
    if len(canonical) != EXPECTED_QUESTIONS:
        fail([f"Dataset pertanyaan harus berisi {EXPECTED_QUESTIONS} ID unik, ditemukan {len(canonical)}"])

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing_cols = REQUIRED_COLS - set(reader.fieldnames or [])
        if missing_cols:
            fail([f"Kolom wajib tidak ada: {sorted(missing_cols)}"])
        rows = list(reader)

    if len(rows) != EXPECTED_TOTAL:
        errors.append(f"Jumlah entri harus {EXPECTED_TOTAL} (40 pertanyaan x 3 evaluator), ditemukan {len(rows)}")

    q_eval_pairs = set()
    question_ids = set()
    evaluators_used = set()
    dup_pairs = set()
    missing_scores = []
    invalid_scores = []
    missing_other_cols = []

    for idx, row in enumerate(rows, start=2):
        qid = (row.get("question_id") or "").strip()
        eid = (row.get("evaluator_id") or "").strip()

        if qid:
            question_ids.add(qid)
        if eid:
            evaluators_used.add(eid)

        if qid not in canonical:
            errors.append(f"Baris {idx}: question_id asing/tidak ada pada dataset utama: {qid or '<kosong>'}")
        else:
            expected = canonical[qid]
            if (row.get("category") or "").strip() != expected["category"]:
                errors.append(f"Baris {idx} ({qid}): category tidak konsisten dengan dataset utama")
            if (row.get("question") or "").strip() != expected["question"]:
                errors.append(f"Baris {idx} ({qid}): question tidak konsisten dengan dataset utama")

        pair = (qid, eid)
        if pair in q_eval_pairs:
            dup_pairs.add(pair)
        q_eval_pairs.add(pair)

        # Skor wajib terisi 1-4 integer
        for asp in ASPECTS:
            val = (row.get(asp) or "").strip()
            if not val:
                missing_scores.append((idx, qid, eid, asp))
            else:
                try:
                    score = int(val)
                    if score < 1 or score > 4:
                        invalid_scores.append((idx, qid, eid, asp, val))
                except ValueError:
                    invalid_scores.append((idx, qid, eid, asp, val))

        # Kolom wajib lainnya terisi
        for col in ("question_id", "category", "question", "chatbot_response", "evaluator_id",
                    "actual_behavior", "evaluator_notes", "final_assessment", "assessment_date"):
            if not (row.get(col) or "").strip():
                missing_other_cols.append((idx, qid, col))

    if dup_pairs:
        errors.append(f"Pasangan question_id+evaluator_id duplikat: {sorted(dup_pairs)}")
    if missing_scores:
        errors.append(f"Skor kosong ({len(missing_scores)} field): contoh {missing_scores[:5]}")
    if invalid_scores:
        errors.append(f"Skor di luar rentang 1–4 ({len(invalid_scores)} field): contoh {invalid_scores[:5]}")
    if missing_other_cols:
        errors.append(f"Kolom wajib kosong ({len(missing_other_cols)} field): contoh {missing_other_cols[:5]}")
    if len(question_ids) != EXPECTED_QUESTIONS:
        errors.append(f"Jumlah question_id unik evaluator harus {EXPECTED_QUESTIONS}, ditemukan {len(question_ids)}")
    unknown_ids = sorted(question_ids - set(canonical))
    missing_ids = sorted(set(canonical) - question_ids)
    if unknown_ids:
        errors.append(f"ID evaluator asing: {unknown_ids}")
    if missing_ids:
        errors.append(f"ID dataset utama tanpa penilaian evaluator: {missing_ids}")
    if not question_ids:
        pass
    elif evaluators_used - VALID_EVALUATORS:
        errors.append(f"Evaluator selain E1/E2/E3 ditemukan: {sorted(evaluators_used - VALID_EVALUATORS)}")

    # Setiap pertanyaan harus memiliki tepat E1, E2, E3
    evals_per_q = defaultdict(set)
    for qid, eid in q_eval_pairs:
        evals_per_q[qid].add(eid)
    incomplete_q = [q for q, es in evals_per_q.items() if es != VALID_EVALUATORS]
    if incomplete_q:
        errors.append(f"Pertanyaan tanpa penilaian lengkap E1/E2/E3: {sorted(incomplete_q)}")

    if errors:
        fail(errors)

    # --- perhitungan ---
    by_q = defaultdict(lambda: defaultdict(list))
    by_cat = defaultdict(lambda: defaultdict(list))
    all_scores = defaultdict(list)
    score_dist = {asp: Counter() for asp in ASPECTS}
    detail_rows = []

    for row in rows:
        qid = row["question_id"]
        cat = row["category"]
        q_scores = {}
        for asp in ASPECTS:
            sc = int(row[asp])
            by_q[qid][asp].append(sc)
            by_cat[cat][asp].append(sc)
            all_scores[asp].append(sc)
            score_dist[asp][sc] += 1
            q_scores[asp] = sc
        detail_rows.append({
            "question_id": qid,
            "category": cat,
            "evaluator_id": row["evaluator_id"],
            **q_scores,
            "mean_evaluator": round(sum(q_scores.values()) / 4.0, 4),
        })

    summary_q = []
    for qid in sorted(by_q.keys()):
        row_s = {"question_id": qid}
        for asp in ASPECTS:
            row_s[f"mean_{asp}"] = round(sum(by_q[qid][asp]) / len(by_q[qid][asp]), 4)
        row_s["overall_question_mean"] = round(sum(row_s[f"mean_{asp}"] for asp in ASPECTS) / 4.0, 4)
        summary_q.append(row_s)

    summary_cat = []
    for cat in sorted(by_cat.keys()):
        row_c = {"category": cat}
        for asp in ASPECTS:
            row_c[f"mean_{asp}"] = round(sum(by_cat[cat][asp]) / len(by_cat[cat][asp]), 4)
        row_c["overall_category_mean"] = round(sum(row_c[f"mean_{asp}"] for asp in ASPECTS) / 4.0, 4)
        summary_cat.append(row_c)

    overall = {asp: round(sum(all_scores[asp]) / len(all_scores[asp]), 4) for asp in ASPECTS}
    overall_mean = round(sum(overall.values()) / 4.0, 4)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    detail_path = OUT_DIR / "evaluator_scores_detail.csv"
    with open(detail_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["question_id", "category", "evaluator_id", *ASPECTS, "mean_evaluator"])
        w.writeheader()
        w.writerows(detail_rows)

    summary_path = OUT_DIR / "evaluator_scores_summary.csv"
    with open(summary_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["question_id", *[f"mean_{asp}" for asp in ASPECTS], "overall_question_mean"])
        w.writeheader()
        w.writerows(summary_q)

    report_path = OUT_DIR / "evaluator_scores_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Laporan Hasil Penilaian Tiga Evaluator — AGM Assistant\n\n")
        f.write("## Ringkasan Keseluruhan\n\n")
        f.write(f"- Total entri: {len(rows)} (40 pertanyaan x 3 evaluator)\n")
        f.write(f"- Evaluator: E1, E2, E3\n")
        f.write(f"- Rata-rata Keseluruhan: **{overall_mean}** (skala 1-4)\n\n")
        f.write("| Aspek | Rata-rata |\n|---|---:|\n")
        for asp in ASPECTS:
            f.write(f"| {asp} | {overall[asp]} |\n")

        f.write("\n## Rata-rata Berdasarkan Kategori\n\n")
        f.write("| Kategori | Accuracy | Relevance | Completeness | Clarity | Rata-rata Kategori |\n")
        f.write("|---|---:|---:|---:|---:|---:|\n")
        for sc in summary_cat:
            f.write(f"| {sc['category']} | {sc['mean_accuracy_score']} | {sc['mean_relevance_score']} | {sc['mean_completeness_score']} | {sc['mean_clarity_score']} | {sc['overall_category_mean']} |\n")

        f.write("\n## Distribusi Skor (Skala 1-4)\n\n")
        for asp in ASPECTS:
            f.write(f"### {asp}\n")
            f.write(f"- Skor 1: {score_dist[asp][1]}\n")
            f.write(f"- Skor 2: {score_dist[asp][2]}\n")
            f.write(f"- Skor 3: {score_dist[asp][3]}\n")
            f.write(f"- Skor 4: {score_dist[asp][4]}\n\n")

        f.write("\n## Catatan Metodologi\n\n")
        f.write("- Nilai rata-rata tidak menggantikan uji reliabilitas antar-penilai (inter-rater reliability).\n")
        f.write("- Uji reliabilitas seperti Fleiss' Kappa atau Krippendorff's Alpha memerlukan perhitungan formal tambahan dan tidak dicantumkan tanpa perhitungan yang sesuai.\n")
        f.write("- Skor kosong tidak diimputasi; data yang belum lengkap akan ditolak oleh script ini.\n")

    print("Analisis nilai evaluator berhasil.")
    print(f"Rata-rata keseluruhan: {overall_mean}")
    print(f"Output: {detail_path} | {summary_path} | {report_path}")


if __name__ == "__main__":
    main()
