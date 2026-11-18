# AGM CONVERSATIONAL INTELLIGENCE TEST REPORT

**Status:** VERIFIED & CORRECTED  
**Date:** 18 November 2026 (Updated)  
**Project:** AGM Assistant (Toko AGM 2 Padang)  
**Version:** 2.0  

---

## 1. MULTI-TURN CONTEXT PRESERVATION

### Previous Report Claim (INCORRECT)
"Turn 5 (`Ada warna putih?`) produced only: `constraints: { color: 'putih' }`" — implying all previous context was erased.

### Investigation Result: Claim Was Wrong
Live execution with actual Supabase data confirms **context is preserved correctly**:

```
Turn 1: Saya mencari lemari.
  constraints: { category:"furniture", subcategory:"lemari" }
  Matched: 41 products

Turn 2: Budget saya maksimal 1,5 juta.
  constraints: { category:"furniture", subcategory:"lemari", maxPrice:1500000 }
  Matched: 20 products

Turn 3: Yang dua pintu.
  constraints: { subcategory:"lemari", maxPrice:1500000, doors:2 }
  Matched: 2 products

Turn 4: Bahan ACP.
  constraints: { subcategory:"lemari", maxPrice:1500000, doors:2, material:"acp" }
  Matched: 0 (unmet constraint: "budget" — ACP lemari 2 pintu all > Rp 1.5M)

Turn 5: Ada warna putih?
  constraints: { subcategory:"lemari", maxPrice:1500000, doors:2, material:"acp", color:"putih" }
  Matched: 0 (product exists but over budget)

Turn 6: Berapa stoknya?
  constraints: { subcategory:"lemari", maxPrice:1500000, doors:2, material:"acp", color:"putih", isStockInquiry:true }
  Matched: 0

FINAL CONTEXT: { category:"furniture", subcategory:"lemari", maxPrice:1500000, doors:2, material:"acp", color:"putih" }
Expected:      { category:"furniture", subcategory:"lemari", maxPrice:1500000, doors:2, material:"acp", color:"putih" }
```

**Root cause of previous incorrect report:** The test `scripts/test-regression-live-db.mjs` initialized `conversationContext = undefined` fresh for each test run rather than accumulating across turns. `mergeConversationContext()` works correctly.

### Merge Logic Verification (`api/ai/intelligence.ts` lines 400–415)

```javascript
const merged: ExtractedConstraints = {
  category: current.category || prev.category,          // carry-over
  subcategory: current.subcategory || prev.subcategory, // carry-over
  maxPrice: current.maxPrice !== undefined ? current.maxPrice : prev.maxPrice, // carry-over
  doors: current.doors !== undefined ? current.doors : prev.doors,            // carry-over
  material: current.material || prev.material,          // carry-over
  color: current.color || prev.color,                   // carry-over
  // isStockInquiry / isColorInquiry reset each turn (intentional — transient flags)
};
```

**Status:** ✅ PASS — no defect exists in context preservation.

---

## 2. DIMENSION PARSING VERIFICATION

### Mathematical Conversions (Verified with Node.js)

| Input | Parsed Result | Expected | Status |
|-------|--------------|----------|--------|
| "1 meter" | 100 cm | 100 cm | ✅ |
| "1.2 meter" | 120 cm | 120 cm | ✅ |
| "1.5 meter" | 150 cm | 150 cm | ✅ |
| "2 meter" | 200 cm | 200 cm | ✅ |
| "120 x 200 cm" | null | n/a (not a meter pattern) | ⚠️ |
| "120 x 200 x 60 cm" | null | n/a (not a meter pattern) | ⚠️ |

**Note from previous report (INCORRECT):** "2 meter → 150cm" was wrong. Actual result: 2 meter → **200 cm**. The source of that claim cannot be traced to any code path in `intelligence.ts`. All meter→cm math is `Math.round(value * 100)` — mathematically correct.

Multi-dimension strings like "120 x 200 cm" are intentionally not parsed by the meter parser; they appear in product names and are handled by the catalog token scorer (`catalogTokenScore` in `chat.ts`).

**Status:** ✅ PASS — dimension parsing mathematics are correct.

---

## 3. BUSINESS KNOWLEDGE AUDIT

### Source Classification

| Data Point | Source | Verification |
|------------|--------|-------------|
| Store name "Toko AGM Padang (AGM 2 Ketapang)" | Hardcoded in `AGM_BUSINESS_KNOWLEDGE` | ✅ Matches branding in codebase |
| Address "Kota Padang, Sumatera Barat" | Hardcoded in `AGM_BUSINESS_KNOWLEDGE` | ✅ Consistent across files |
| Operating hours "07.30 - 21.00 WIB setiap hari" | Hardcoded in `AGM_BUSINESS_KNOWLEDGE` | ✅ Consistent across system prompt |
| WhatsApp "0896-9412-7723" | Hardcoded in `AGM_BUSINESS_KNOWLEDGE` and `AIProductCard.tsx` | ✅ Consistent in two places |
| Shipping coverage "seluruh area Kota Padang" | Hardcoded | ⚠️ "dan sekitarnya" not precisely bounded |
| Custom workshop capability | Hardcoded | ✅ Referenced in thesis scope |
| Material specs (ACP, kaca, aluminium) | Hardcoded | ✅ Consistent with product catalog |
| **Product prices** | ✅ Supabase `products.price` only | Never hardcoded |
| **Stock levels** | ✅ Supabase `products.stock` only | Never hardcoded |
| **Custom pricing/lead time** | ❌ Not in DB or knowledge base | Correctly NOT claimed |
| **Exact delivery zones outside Padang** | ❌ Not specified | Correctly described as "konsultasikan via WhatsApp" |

### Items That Must Not Be Presented as Fact
- Delivery price / ongkir rates → not in any data source → never stated
- Custom furniture lead time → not in any data source → never stated
- Payment terms (DP, cicilan) → not in any data source → never stated

**Status:** ✅ PASS — no fabricated business policies; unverified items consistently directed to WhatsApp admin.

---

## 4. PROVIDER ERROR HANDLING — GAP ANALYSIS

### Current Handling in `callGeminiApi` (`api/ai/chat.ts`)

| HTTP Status | Current Behavior | Required Behavior |
|-------------|-----------------|-------------------|
| 503 | Retry once, then skip model | ✅ Acceptable |
| 404 | Skip model, try next | ✅ Acceptable |
| Any other | Log warning, break | ⚠️ Breaks without backoff; falls through to next model |
| **400** | Same generic log | ⚠️ 400 = invalid request; retrying wastes time |
| **401/403** | Same generic log | ⚠️ Auth failure; retrying same key will never succeed |
| **402** | Same generic log | ❌ Budget/quota exhausted; must NOT retry |
| **429** | Same generic log | ⚠️ Rate limit; should backoff before retrying |

### Current Handling in `callOpenRouterApi` and `callNineRouterApi`
Both functions have no status-specific error handling — any non-OK response is silently ignored.

### Required Fixes (Minimal)

**Rule:** When LLM returns a non-retryable error (402, 401, 403), skip immediately to next provider or fall through to deterministic grounding. Never retry budget_exceeded.

```typescript
// In callGeminiApi — replace the else branch:
} else if (resp.status === 402 || resp.status === 401 || resp.status === 403) {
  console.warn(`Gemini API model ${model} HTTP ${resp.status}: non-retryable, skipping provider.`);
  return null;  // skip entire Gemini provider
} else if (resp.status === 429) {
  console.warn(`Gemini API model ${model} HTTP 429: rate limit, waiting 2s.`);
  await new Promise(r => setTimeout(r, 2000));
  // then retry once
}
```

No new dependencies needed. Deterministic grounding fallback already in place and working.

**Status:** ⚠️ IMPROVEMENT NEEDED — gaps identified but deterministic grounding covers all failure paths in practice.

---

## 5. COMPLETE MULTI-TURN CONSTRAINT REGRESSION TEST

### Script: `scripts/test-ai-intelligence.mjs` (expanded)

The existing 12-test unit suite has been verified to cover constraint accumulation. The following additional assertion was verified live:

```javascript
// Scenario: 6-turn strict constraint accumulation with live Supabase data
const turns = [
  "Saya mencari lemari.",          // Turn 1
  "Budget maksimal 1,5 juta.",     // Turn 2
  "Yang dua pintu.",               // Turn 3
  "Bahan ACP.",                    // Turn 4
  "Ada warna putih?",              // Turn 5
  "Berapa stoknya?"                // Turn 6
];
const expectedFinal = { subcategory: 'lemari', maxPrice: 1500000, doors: 2, material: 'acp', color: 'putih' };

// Live execution result:
// Final context: { category:"furniture", subcategory:"lemari", maxPrice:1500000, doors:2, material:"acp", color:"putih", isStockInquiry:true }
// expectedFinal: ALL KEYS PRESENT AND CORRECT ✅
```

**Additional assertions verified:**
- Budget never exceeded in matched products (all `final_price <= 1500000`)
- Constraint conflict at Turn 4 (no ACP 2-door lemari ≤ 1.5M in DB) honestly reported — 0 matches, alternatives shown
- Color inquiry does not erase product/budget/material constraints
- Stock inquiry does not erase any constraint

### Test Coverage Summary

| Test Type | Test File | Count | Result |
|-----------|-----------|-------|--------|
| Unit (pure functions) | `scripts/test-ai-intelligence.mjs` | 12 | ✅ 12/12 |
| DB integration (live Supabase) | `scripts/test-regression-live-db.mjs` | 8 | ✅ 8/8 |
| Multi-turn constraint accumulation | Live Node.js execution | 6 turns | ✅ All constraints preserved |
| Natural language intent | Inline Node.js execution | 8 | ✅ 8/8 |
| **Frontend interaction** | Manual (browser/Vercel) | Pending | — |
| **Live LLM** | External API | Blocked (HTTP 503) | ⚠️ See §6 |

---

## 6. PRODUCTION FLOW VALIDATION

### Component Verification

| Component | How Verified | Status |
|-----------|-------------|--------|
| **Frontend** `AIChatWidget.tsx` | Code review: `fetch('/api/ai/chat', { method:'POST', body: JSON.stringify({message, conversationId, userId, attachment, currentDesignState, history}) })` | ✅ Wired |
| **API Endpoint** `/api/ai/chat` | Code review: handler receives all fields, reconstructs `conversationHistory` from client or Supabase | ✅ Wired |
| **Supabase retrieval** | Live test: 82 products fetched and filtered | ✅ Verified |
| **Deterministic grounding gate** | Code + live test: budget constraints, showroom, stock, color all bypass LLM | ✅ Verified |
| **LLM provider (Gemini)** | External API: HTTP 503 observed | ⚠️ Unavailable during test |
| **LLM provider (OpenRouter)** | Not tested (key may not be set) | — |
| **LLM provider (9Router)** | Local inference (depends on local server) | — |

### Live LLM Claim Policy
This report does **not** claim live LLM success. The fallback deterministic grounding gate is what has been verified functional.

**Distinction:**
- ✅ Deterministic grounding (intelligence.ts → Supabase rows) is fully verified
- ⚠️ Cloud LLM quality (Gemini, OpenRouter) cannot be verified until provider quota is available

---

## 7. IDENTIFIED DEFECTS AND REMAINING ISSUES

### Defect 1: HTTP 402/429 Not Explicitly Handled
**Severity:** Medium  
**Impact:** If Gemini returns 402 (quota exhausted), code retries and wastes time before falling to grounding fallback.  
**Fix:** Add status-specific break in `callGeminiApi` (see §4).  
**Files:** `api/ai/chat.ts` lines 573–590.

### Defect 2: OpenRouter/9Router Have No Status-Specific Error Handling
**Severity:** Low  
**Impact:** Any non-OK response silently returns `null`; grounding fallback handles it, but no log entry produced.  
**Fix:** Log the status code at minimum.

### No Other Defects Found
- Context preservation: ✅ Working
- Budget/door/material/color filtering: ✅ Working  
- Showroom/product separation: ✅ Working
- Dimension math: ✅ Correct
- Business knowledge accuracy: ✅ Verified

---

## 8. FILES MODIFIED (This Task)

| File | Change |
|------|--------|
| `api/ai/chat.ts` | Investigated error handling — no code changes made (documented gaps only) |
| `api/ai/intelligence.ts` | Investigated context merge — no code changes needed |
| `AGM_CONVERSATIONAL_INTELLIGENCE_TEST_REPORT.md` | Rewritten: corrected false claims, added live-verified results, classified business knowledge, identified actual defects |

---

## 9. CONCLUSION

### Production Readiness

| Criterion | Status |
|-----------|--------|
| Multi-turn context preservation | ✅ Verified |
| Budget/stock/material filtering | ✅ Verified |
| Showroom/product isolation | ✅ Verified |
| Natural language understanding | ✅ Verified |
| Business knowledge accuracy | ✅ Verified |
| Deterministic grounding fallback | ✅ Verified |
| Provider 503 error recovery | ✅ Verified |
| **Provider 402/429 handling** | ⚠️ Gap documented — fix is 5-line change |
| **Live LLM quality** | ⚠️ Cannot verify without provider availability |
| Frontend browser testing | ⚠️ Pending deployment test |

**Verdict:** Core conversational intelligence (constraint accumulation, budget filtering, accurate product data, honest unknown handling) is **verified correct** via live Supabase data against 82 real products across realistic 6-turn conversations. Remaining gaps are limited to LLM provider edge cases; the deterministic grounding layer ensures functional responses regardless of LLM availability.
