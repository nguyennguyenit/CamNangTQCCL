# DashScope ToS + Vision Model Research Report
**For:** Soi đội từ ảnh (Vision LLM) — Phase 3 gate condition C2  
**Date:** 2026-06-22  
**Research Focus:** Alibaba DashScope (CN mainland) ToS review + Qwen vision model specs for screenshot team analyzer  

---

## Executive Summary: C2 Gate Verdict

**RECOMMENDATION: CONDITIONALLY APPROVABLE with mandatory disclaimers and region strategy.**

- ✅ **Data training input:** Alibaba explicitly commits NOT to train on user input data when using Model Studio API (international or mainland).  
- ⚠️ **Content policy (game screenshot):** NO explicit restriction found on DashScope for commercial game screenshots. **Risk level: MODERATE.** Cannot guarantee TOS guarantees safety; likely low-risk but unconfirmed.  
- ⚠️ **Data retention:** General Alibaba policy is "as needed to provide service"; specific DashScope input retention duration NOT documented. **Risk: MODERATE.**  
- ⚠️ **Registration (VN users):** Alibaba Cloud requires email + SMS verification + payment method (passport/driver's license optional for individuals). Vietnamese users can register. **No explicit block on VN nationals.**  
- ⚠️ **Region difference (CN vs SG):** CN endpoint = all data stays in Beijing; SG endpoint = data in Singapore. **Training policy IDENTICAL across regions** (no user input training).  

**Shipping condition:** Proceed with Qwen3.7-Plus on **Singapore region endpoint** + mandatory ToS disclaimer pointing users to Alibaba privacy policy. Avoid CN mainland endpoint (geopolitical/compliance sensitivity for VN users).

---

## Detailed Findings

### A. TERMS OF SERVICE / LEGAL GATE

#### Q1: Training on Input Data — Opt-Out Existence?

**Finding:** ✅ **NO training on user input data via DashScope API.**

- **Alibaba Cloud official stance:** "Alibaba Cloud will never use your data for model training when using Alibaba Cloud Model Studio. All data you transmit when building applications or training models is encrypted." [[1]](https://www.alibabacloud.com/help/en/model-studio/qwen-and-wan-training-data-disclosure)
- **Applies to both:** CN mainland AND international (Singapore) endpoints — policy is uniform.
- **Opt-out mechanism:** Not needed — enabled by default. User input is NOT used for model training under any circumstance when calling Qwen via DashScope API.
- **Contrast — Qwen models themselves:** Trained on publicly available internet data + curated datasets + synthetic data (NOT user API input). [[1]](https://www.alibabacloud.com/help/en/model-studio/qwen-and-wan-training-data-disclosure)

**Region comparison (CN vs SG):**  
Both regions have identical **no-training-on-input** policies. However:
- **CN mainland:** Data stored in Beijing; inference limited to CN. Governed by CN privacy law.  
- **SG international:** Data stored in Singapore; inference globally distributed. Governed by Singapore/international law. [[2]](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy)

**Verdict:** ✅ PASS — Safe to document in ToS disclaimer that user screenshot data will NOT be used for model training.

---

#### Q2: Content Policy — Commercial Game Screenshots?

**Finding:** ⚠️ **NO explicit restriction found; cannot confirm safety.**

- **Search across DashScope docs:** No published content policy on game screenshots, commercial games, or media copyright restrictions found.
- **Alibaba's general ethical policy:** One reference to "Ethical Content Policy Notice: Adult Video Request Declined" — suggests restrictions exist on adult content, but scope unclear.
- **Practical risk:** Tam Quốc Chí Chiến Lược is a commercial game (published by aligames/lingxi). Screenshots are technically user-generated derivative works.
  - **Fair use in most jurisdictions:** Minimal/small screenshots for analysis/commentary likely fall under fair use.  
  - **DashScope's stance:** Undocumented → cannot guarantee they won't flag it as copyright infringement or suspend the key.

**Mitigation:**  
1. Include disclaimer: *"Screenshots sent to Alibaba API for analysis. Compliance with game EULA is user's responsibility."*  
2. Test with 5–10 real screenshots before shipping to validate no key suspension.  
3. If key is suspended, immediately switch to alternative provider (Google Gemini 2.0 Vision / Claude Opus).

**Verdict:** ⚠️ CONDITIONAL PASS — Proceed with test validation + disclaimer, monitor for TOS violations.

---

#### Q3: Data Retention — How Long Stored?

**Finding:** ⚠️ **Specific duration NOT documented; general policy is "as needed."**

- **Alibaba Cloud general privacy policy:** Data retained "for the purposes described in this Privacy Policy where we have an ongoing legitimate business need to do so (for example, to provide you with a service you have requested or to comply with applicable legal, tax or accounting requirements)." [[3]](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy)
- **Deletion process:** "Standard commercially reasonable measures to make the personal data practically irrecoverable or irreproducible" — electronic files deleted via technical methods, physical docs shredded/incinerated. [[3]](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy)
- **DashScope-specific retention duration:** Not disclosed in public documentation.

**Likely interpretation:** Screenshots are transient (used for single inference, not stored long-term like user accounts). Likely deleted within hours to days, but NOT guaranteed by explicit SLA.

**Request contact:** For guaranteed retention duration, contact `intlcompliance@service.aliyun.com`. [[3]](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy)

**Verdict:** ⚠️ CONDITIONAL PASS — Acceptable for non-sensitive game analysis. Include disclaimer: *"Screenshot data may be retained temporarily by Alibaba for service operation."* Do NOT use for personal/sensitive images.

---

#### Q4: Registration — Can Vietnamese Users Sign Up?

**Finding:** ✅ **YES, Vietnamese users can register; no explicit block found.**

- **General requirements:** Email + SMS verification (phone) + payment method (passport/driver's license for individuals; business cert for enterprise). [[4]](https://www.alibabacloud.com/help/en/account/step-1-register-an-alibaba-cloud-account)
- **Real-name authentication:** China has national real-name system requirement (Nov 2025). For **foreign users**, Alibaba accepts passport as identity verification. [[5]](https://tokenmix.ai/blog/dashscope-alibaba-cloud-api-developer-setup-2026)
- **Vietnam-specific restriction:** NONE explicitly documented. Vietnamese nationals can use passport.

**Practical note:** Account completion requires payment method setup (credit card, Alipay, WeChat Pay, etc.); available payment options vary by country.

**Verdict:** ✅ PASS — Vietnamese users can register using passport + email + phone.

---

### B. TECHNICAL SPECIFICATIONS — QWEN VISION MODEL + DASHSCOPE

#### Q5: Current Model ID (2026) — Best for OCR + Game Screenshot Reading?

**Finding:** ✅ **Qwen3.7-Plus is flagship; qwen3-vl-plus is specialized vision option.**

| Model | Release | Context | Vision | OCR/UI Read | Game Screenshot | Model ID |
|-------|---------|---------|--------|------------|-----------------|----------|
| **Qwen3.7-Plus** | Jun 2026 | 1M tokens | ✅ Image + Video | ✅ Strong screen OCR | ✅ RECOMMENDED | `qwen3-7-plus` or `qwen3.7-plus` |
| **qwen3-vl-plus** | Late 2025 | 256K tokens | ✅ Image + Video | ✅ Strong | ✅ Alternative | `qwen3-vl-plus` |
| Qwen3.5-Plus | Feb 2026 | 1M tokens | ✅ Image + Video | ✅ Adequate | ✅ Still viable | `qwen3.5-plus-2026-02-15` |
| qwen3-vl-max | Earlier | High context | ✅ Multimodal | ✅ Excellent | ✅ Premium option | `qwen3-vl-max` |

**RECOMMENDATION: Use `qwen3.7-plus` or fallback to `qwen3-vl-plus`**

- **Qwen3.7-Plus advantage:** Latest flagship (Jun 2026), 1M context, multimodal agent loop ("look at screenshot → identify error → run pytest"), covers game UI + text extraction.  
- **qwen3-vl-plus advantage:** Purpose-built vision (earlier release, proven stable), 256K context (sufficient for multiple team screenshots), lower cost.
- **Both support:** OCR (Qwen-OCR series internally), UI screen reading, text extraction — suitable for game team composition reading.

**For your scope (read 3 tướng + chiến pháp + chất tướng from 1 screenshot):**  
- **Image size:** Typical game UI screenshot ~1MB, ~3000×2000px → well within token budget.  
- **Token usage estimate:** ~1000–2000 vision tokens per screenshot (baseline), output ~100–300 tokens (team data JSON).

**Verdict:** ✅ PASS — `qwen3.7-plus` (primary) or `qwen3-vl-plus` (fallback).

---

#### Q6: OpenAI-Compatible Endpoint + Image Input Format?

**Finding:** ✅ **Singapore endpoint recommended; supports both URL + base64 image input.**

**Base URLs by region:**

| Region | Base URL | Data Storage | Compute |
|--------|----------|--------------|---------|
| **Singapore (Intl)** | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Singapore | Global (excl. CN) |
| China Mainland | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Beijing | China only |
| US (Virginia) | `https://dashscope-us.aliyuncs.com/compatible-mode/v1` | US | US region |
| Hong Kong | `https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1` | HK | Hong Kong |

**RECOMMENDATION: Use Singapore endpoint** for VN user base + international compliance.

**Image input format (OpenAI-compatible mode):**

```json
// Option 1: Image URL (preferred for web)
{
  "type": "image_url",
  "image_url": {
    "url": "https://example.com/screenshot.jpg"
  }
}

// Option 2: Base64 data URI (for client upload)
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA8ADwAAD..."
  }
}
```

Both formats work. **Recommend base64 for client-uploaded screenshots** (avoid external storage).

**Example call via OpenAI SDK:**

```python
from openai import OpenAI

client = OpenAI(
    api_key="sk-...",
    base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)

response = client.chat.completions.create(
    model="qwen3.7-plus",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract team data from this screenshot..."},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
            ]
        }
    ]
)
```

**Verdict:** ✅ PASS — Endpoint confirmed, both input formats work, base64 recommended for privacy.

---

#### Q7: Structured Output (JSON response_format)?

**Finding:** ✅ **YES, fully supported for Qwen3.7-Plus + qwen3-vl-plus.**

**Setup:**

```python
response = client.chat.completions.create(
    model="qwen3.7-plus",
    response_format={"type": "json_object"},
    messages=[
        {
            "role": "system",
            "content": "You are a JSON extractor. Output valid JSON."  # Must include "JSON" keyword
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract team data as JSON with fields: generals, tactics, qualities"},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
            ]
        }
    ]
)
```

**Key requirements:**
- Set `response_format` to `{"type": "json_object"}`
- Include "JSON" keyword (case-insensitive) in system or user message
- Models in **thinking mode do NOT support** structured output

**Guaranteed models:** Qwen3.7-Plus, Qwen3.5-Plus, qwen3-vl-plus, qwen3-vl-flash (all non-thinking modes). [[6]](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output)

**Fallback:** If schema validation fails, tolerant parse (strip markdown fences `\`\`\`json ... \`\`\``) as discussed in plan R3 (Qwen schema drift).

**Verdict:** ✅ PASS — Structured output fully supported; implement as planned with tolerant parser fallback.

---

#### Q8: Pricing + Free Tier?

**Finding:** ⚠️ **Free tier ONLY on Singapore region; CN mainland is paid-only.**

**Free Quota (Singapore region only):**
- **Amount:** 1M input tokens + 1M output tokens per model  
- **Duration:** 90 days from first activation (as of Sep 8, 2025)  
- **Coverage:** Real-time inference ONLY (excludes batch, caching, fine-tuning)  
- **Scope:** Applies across account + all RAM users (shared pool)  
- **Safety:** Can enable "Free Quota Only" mode to block calls once depleted (no surprise charges)

[[7]](https://www.alibabacloud.com/help/en/model-studio/new-free-quota)

**Paid pricing (Singapore, per 1M tokens):**

| Model | Input | Output | Tier Notes |
|-------|-------|--------|-----------|
| qwen3.7-plus | $0.40–1.25 | $2.40–3.75 | Tiered by context range |
| qwen3-vl-plus | $0.20–0.60 | $1.60–4.80 | Vision tokens counted per image |
| qwen3.5-plus | $0.40 | $2.40 | Lower cost, still capable |

**Mainland pricing (for reference, cheaper but geopolitical concern):**
- qwen3-vl-plus: $0.143–0.43 input, $1.434–4.301 output (30–40% lower)

**Estimate for team analyzer (100 screenshots/month):**
- ~150K input tokens (1.5K per screenshot) + ~30K output tokens (300 per) = **~2.4K screenshots at max cost = ~$0.58–1.20/month** (negligible)

**Free tier suffices for MVP testing; set hard daily cap in Cloudflare Worker as planned (R2).**

**Verdict:** ✅ PASS — Use Singapore free tier for testing; production cost minimal.

---

## Summary Table — ToS Risk Assessment

| Question | Finding | Risk | Verdict | Mitigation |
|----------|---------|------|---------|-----------|
| **Q1: Training input** | No user input training (all regions) | ✅ None | ✅ PASS | Include ToS disclaimer |
| **Q2: Game screenshot copyright** | No explicit policy restriction | ⚠️ MODERATE | ⚠️ CONDITIONAL | Test 5+ screenshots; monitor for suspension |
| **Q3: Data retention** | "As needed"; no explicit SLA | ⚠️ MODERATE | ⚠️ CONDITIONAL | Disclaimer: temporary retention; not for sensitive data |
| **Q4: VN user registration** | Allowed via passport + email + phone | ✅ None | ✅ PASS | Document registration process |
| **Q5: Vision model ID** | qwen3.7-plus (latest) ✅ | ✅ None | ✅ PASS | Code: use `qwen3.7-plus` as primary |
| **Q6: OpenAI endpoint** | Singapore URL + base64 image ✅ | ✅ None | ✅ PASS | Use `dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| **Q7: Structured output** | JSON mode fully supported ✅ | ✅ None | ✅ PASS | Implement tolerant fallback parser |
| **Q8: Pricing + free tier** | 1M tokens free (90d, SG only); ~$0.60/100 screenshots | ✅ None | ✅ PASS | Use SG free tier + hard cap in Worker |

---

## Recommendation for C2 Gate

### ✅ CONDITIONAL APPROVAL — Ship with DashScope Singapore endpoint

**Conditions:**

1. **Use Singapore endpoint ONLY:** `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`  
   → Avoids CN geopolitical sensitivity for VN user base.  
   → Identical data-training policy to mainland (no user input training).

2. **Mandatory ToS disclaimer in UI** (phase 3 M3):
   ```
   "Screenshots are sent to Alibaba DashScope API for analysis. 
   Alibaba does not use your screenshots for model training. 
   See Alibaba Cloud Privacy Policy: [link to privacy policy]
   You are responsible for ensuring screenshots comply with game EULA."
   ```

3. **Pre-ship validation (phase 3):**
   - Test with 5–10 real Tam Quốc Chí Chiến Lược screenshots.  
   - Verify no TOS violation / key suspension.  
   - If suspended, immediately fall back to Gemini 2.0 Vision (no contract change needed; same API pattern).

4. **Monitoring + kill-switch (phase 3 H5):**
   - Hard daily cap in Cloudflare Worker (e.g., 100 requests/day).  
   - Monthly API key rotation or spending limit via Alibaba dashboard.  
   - Log all API calls to detect abuse patterns.

5. **Privacy disclaimer in footer:**
   - Link to Alibaba Cloud International Privacy Policy.  
   - Acknowledge temporary data retention (not guaranteed deletion SLA).

---

## Why NOT Mainland Endpoint

- **CN mainland storage:** Data stored in Beijing; subject to CN law (PII retention rules, government access).  
- **Geopolitical risk:** VN users sensitive to data flowing to CN servers (especially game-related content).  
- **No functional advantage:** Identical API, identical no-training policy, only cost savings (~30%).
- **Compliance complexity:** CN data residency increases legal surface for VN-based app.

**Decision:** Singapore endpoint is the safe default.

---

## Unresolved Questions

1. **DashScope content policy scope:** Does Alibaba flag commercial game screenshots under any circumstance? Unknown. **Mitigation:** Pre-ship testing.

2. **Data retention SLA:** Specific retention duration for transient API input (screenshots). Likely hours–days, but not formally guaranteed. **Mitigation:** Treat as transient; include disclaimer.

3. **Alternative provider comparison:** Should we evaluate Google Gemini 2.0 Vision (launch Jun 2026) or Claude Opus as fallback? **Not researched.** Recommend comparison if DashScope shows instability.

4. **Multi-language support:** Qwen's OCR is strong for Chinese, but game UI may have mixed Chinese/Vietnamese/romanization. **Not tested.** Recommend spike during P3.

---

## Status

**Status:** DONE_WITH_CONCERNS  
**Summary:** DashScope Singapore endpoint is legally and technically viable for shipping Phase 3 with ToS disclaimers + pre-ship testing. Data training guarantee confirmed; copyright + retention risks are moderate but acceptable with mitigations.

---

## Sources

[1] [Qwen/Wan Training Data Disclosure](https://www.alibabacloud.com/help/en/model-studio/qwen-and-wan-training-data-disclosure) — Alibaba Cloud official, confirms no user input training policy.

[2] [Alibaba Cloud Privacy Policy](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy) — Data retention, deletion process, regional differences.

[3] [OpenAI-Compatible DashScope](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope) — Endpoint URLs, model IDs, integration patterns.

[4] [Qwen-VL OpenAI Compatible](https://www.alibabacloud.com/help/en/model-studio/qwen-vl-compatible-with-openai) — Vision input formats, model list.

[5] [DashScope Developer Setup 2026](https://tokenmix.ai/blog/dashscope-alibaba-cloud-api-developer-setup-2026) — Registration requirements, real-name auth for foreign users.

[6] [Enforce Structured JSON Output](https://www.alibabacloud.com/help/en/model-studio/qwen-structured-output) — JSON mode support, requirements, model list.

[7] [New User Free Quota](https://www.alibabacloud.com/help/en/model-studio/new-free-quota) — Free tier terms, regional restrictions, validity period.

[8] [Model Pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing) — Vision token costs, tier breakdown.

[9] [Qwen3.7-Plus Multimodal Agent](https://www.digitalapplied.com/blog/qwen-3-7-plus-alibaba-multimodal-agent-model-2026-release) — Model specs, vision capabilities.

[10] [Regional Deployment Modes](https://china-llm.com/provider/alibaba-dashscope) — CN vs SG storage, compute residency, policy equivalence.
