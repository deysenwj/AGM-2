#!/usr/bin/env python3
"""Run isolated AGM Assistant evaluation questions through native Hermes CLI."""
import argparse, csv, json, sys, time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ai_worker import SYSTEM_CONSULTANT_INSTRUCTION, call_hermes_cli, supabase

QUESTIONS = ROOT / "scripts/evaluation/data/evaluation_questions.csv"
RESULTS = ROOT / "scripts/evaluation/results"

def catalog_context(question):
    rows = supabase.from_("products").select("id,name,category,subcategory,description,price,discount,stock,unit,image_url,images,arrival_type").order("created_at", desc=True).limit(100).execute().data or []
    words = set(question.lower().split())
    def score(row):
        text = " ".join(str(row.get(k) or "") for k in ("name","category","subcategory","description","arrival_type")).lower()
        return sum(1 for w in words if len(w) > 1 and w in text)
    rows.sort(key=score, reverse=True)
    compact = []
    for row in rows[:30]:
        price = int(row.get("price") or 0); discount = int(row.get("discount") or 0)
        images = row.get("images") or []
        compact.append({"id":row.get("id"),"name":row.get("name"),"category":row.get("category"),"subcategory":row.get("subcategory"),"description":row.get("description"),"price":price,"discount":discount,"final_price":max(0,price-discount),"stock":row.get("stock",0),"unit":row.get("unit","Pcs"),"image_url":row.get("image_url") or (images[0] if isinstance(images,list) and images else ""),"arrival_type":row.get("arrival_type","")})
    return "[KATALOG SUPABASE - DATA REAL-TIME]\n" + json.dumps(compact, ensure_ascii=False) + "\n[/KATALOG SUPABASE]"

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--all", action="store_true"); ap.add_argument("--category"); ap.add_argument("--id")
    args = ap.parse_args()
    with QUESTIONS.open(newline="", encoding="utf-8") as f: rows = list(csv.DictReader(f))
    if args.id: rows = [r for r in rows if r["question_id"] == args.id]
    elif args.category: rows = [r for r in rows if r["category"] == args.category]
    elif not args.all: ap.error("gunakan --all, --category, atau --id")
    out = RESULTS / ("run_" + datetime.now().strftime("%Y%m%d_%H%M%S")); out.mkdir(parents=True, exist_ok=True)
    results = []
    for row in rows:
        started = time.monotonic(); status = "completed"; answer = ""; error = ""
        try:
            prompt = f"{SYSTEM_CONSULTANT_INSTRUCTION}\n\n{catalog_context(row['question'])}\n\nPertanyaan/Instruksi Customer:\n{row['question']}"
            answer = call_hermes_cli(prompt)
        except Exception as exc:
            status, error = "failed", str(exc)
        results.append({"question_id":row["question_id"],"category":row["category"],"question":row["question"],"candidate_answer":answer,"response_time_seconds":round(time.monotonic()-started,2),"execution_status":status,"error_message":error})
        with (out / "responses.json").open("w", encoding="utf-8") as f: json.dump(results,f,ensure_ascii=False,indent=2)
        print(row["question_id"], status)
    with (out / "responses.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys() if results else ["question_id"]); writer.writeheader(); writer.writerows(results)
    print(f"saved: {out}")

if __name__ == "__main__": main()
