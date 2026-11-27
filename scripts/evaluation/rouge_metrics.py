#!/usr/bin/env python3
"""ROUGE metrics calculator (ROUGE-1, ROUGE-2, ROUGE-L) pure Python."""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

def tokenize(text: str) -> list[str]:
    text = (text or "").lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return [t for t in text.split() if t]

def get_ngrams(tokens: list[str], n: int) -> list[tuple[str, ...]]:
    return [tuple(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]

def rouge_n(candidate_tokens: list[str], reference_tokens: list[str], n: int) -> dict[str, float]:
    cand_ngrams = get_ngrams(candidate_tokens, n)
    ref_ngrams = get_ngrams(reference_tokens, n)
    if not cand_ngrams or not ref_ngrams:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}
    cand_counts = {}
    for g in cand_ngrams:
        cand_counts[g] = cand_counts.get(g, 0) + 1
    ref_counts = {}
    for g in ref_ngrams:
        ref_counts[g] = ref_counts.get(g, 0) + 1
    overlap = sum(min(count, cand_counts.get(g, 0)) for g, count in ref_counts.items())
    precision = overlap / len(cand_ngrams) if cand_ngrams else 0.0
    recall = overlap / len(ref_ngrams) if ref_ngrams else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}

def lcs_length(x: list[str], y: list[str]) -> int:
    m, n = len(x), len(y)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if x[i - 1] == y[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[m][n]

def rouge_l(candidate_tokens: list[str], reference_tokens: list[str]) -> dict[str, float]:
    if not candidate_tokens or not reference_tokens:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0}
    lcs = lcs_length(candidate_tokens, reference_tokens)
    precision = lcs / len(candidate_tokens) if candidate_tokens else 0.0
    recall = lcs / len(reference_tokens) if reference_tokens else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    return {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}

def main():
    parser = argparse.ArgumentParser(description="Calculate ROUGE metrics")
    parser.add_argument("--candidates", required=True, help="Path to candidates JSON file")
    parser.add_argument("--references", required=True, help="Path to references CSV file")
    parser.add_argument("--output-dir", help="Directory to save evaluation results")
    args = parser.parse_args()

    with open(args.candidates, "r", encoding="utf-8") as f:
        candidates = json.load(f)

    references = {}
    with open(args.references, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            qid = row.get("question_id")
            if qid:
                references[qid] = {
                    "reference_answer": row.get("reference_answer", ""),
                    "reference_status": row.get("reference_status", "")
                }

    per_question = []
    r1_f1s, r2_f1s, rl_f1s = [], [], []
    valid_count = 0
    missing_count = 0

    for cand in candidates:
        qid = cand.get("question_id")
        candidate_text = cand.get("candidate_answer", "")
        ref_data = references.get(qid, {})
        ref_text = ref_data.get("reference_answer", "")
        ref_status = ref_data.get("reference_status", "")

        cand_tokens = tokenize(candidate_text)
        ref_tokens = tokenize(ref_text)

        if ref_text.strip():
            valid_count += 1
            r1 = rouge_n(cand_tokens, ref_tokens, 1)
            r2 = rouge_n(cand_tokens, ref_tokens, 2)
            rl = rouge_l(cand_tokens, ref_tokens)

            r1_f1s.append(r1["f1"])
            r2_f1s.append(r2["f1"])
            rl_f1s.append(rl["f1"])
        else:
            missing_count += 1
            r1 = {"precision": 0.0, "recall": 0.0, "f1": 0.0}
            r2 = {"precision": 0.0, "recall": 0.0, "f1": 0.0}
            rl = {"precision": 0.0, "recall": 0.0, "f1": 0.0}

        per_question.append({
            "question_id": qid,
            "category": cand.get("category", ""),
            "has_reference": bool(ref_text.strip()),
            "reference_status": ref_status,
            "rouge_1_p": r1["precision"],
            "rouge_1_r": r1["recall"],
            "rouge_1_f1": r1["f1"],
            "rouge_2_p": r2["precision"],
            "rouge_2_r": r2["recall"],
            "rouge_2_f1": r2["f1"],
            "rouge_l_p": rl["precision"],
            "rouge_l_r": rl["recall"],
            "rouge_l_f1": rl["f1"],
        })

    summary = {
        "total_questions": len(candidates),
        "valid_references": valid_count,
        "missing_references": missing_count,
        "mean_rouge_1_f1": round(sum(r1_f1s) / len(r1_f1s), 4) if r1_f1s else 0.0,
        "mean_rouge_2_f1": round(sum(r2_f1s) / len(r2_f1s), 4) if r2_f1s else 0.0,
        "mean_rouge_l_f1": round(sum(rl_f1s) / len(rl_f1s), 4) if rl_f1s else 0.0,
        "note": "ROUGE measures lexical overlap only, not factual correctness."
    }

    out_dir = Path(args.output_dir) if args.output_dir else Path(args.candidates).parent
    out_dir.mkdir(parents=True, exist_ok=True)

    csv_path = out_dir / "rouge_results.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        if per_question:
            writer = csv.DictWriter(f, fieldnames=per_question[0].keys())
            writer.writeheader()
            writer.writerows(per_question)

    json_path = out_dir / "rouge_summary.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "per_question": per_question}, f, indent=2)

    print(f"ROUGE evaluation complete. Summary: {summary}")
    print(f"Saved: {csv_path} and {json_path}")

if __name__ == "__main__":
    main()
