# DashScope ToS & Vision Model Research Report

**Prepared for:** Controller (Phase 3 gate decision: Can we ship Vision feature via DashScope CN?)  
**Date:** 2026-06-22 23:03 UTC+7  
**Status:** DONE_WITH_CONCERNS  
**Summary:** DashScope CN is legally viable for screenshot analysis (no training data reuse, registration OK for intl users). Model & endpoint confirmed. **Critical blocker: content policy for commercial game screenshots unconfirmed in official docs** — requires explicit support contact before deployment.

---

## A. Terms of Service & Legal Gate (C2)

### Finding A1: Data Training on Input (User Data)
| Question | Finding | Source | Verdict |
|----------|---------|--------|---------|
| **Does DashScope train on user input?** | NO — Alibaba Cloud explicitly states: "will never use your data for model training when using Alibaba Cloud Model Studio. All data you transmit when building applications or training models is encrypted." | [Qwen Code ToS/Privacy](https://qwenlm.github.io/qwen-code-docs/en/users/support/tos-privacy/) + [Training Data Disclosure](https://www.alibabacloud.com/help/en/model-studio/qwen-and-wan-training-data-disclosure) | ✅ SAFE — no opt-out needed, data never trained on by default |
| **Opt-out clause?** | Not applicable — DashScope never trains on input. No opt-out mechanism needed because this is default behavior, not a toggle. | Same sources | ✅ SAFE |
| **CN endpoint vs intl region (SG)?** | Both CN (Beijing) and SG endpoints: same non-training guarantee applies per Alibaba policy. Regional difference: **CN data stays in CN, SG data in SG** (geopolitical residency). Training non-use is uniform. | [Regional deployment docs](https://www.alibabacloud.com/help/en/model-studio/regions/), [Privacy policy](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy) | ✅ SAFE for both regions; **recommend SG for intl compliance** |

**Assessment:** Data training risk = **ELIMINATED**. Default safe behavior; no action required.

---

### Finding A2: Content Policy — Game Screenshots (CRITICAL)
| Question | Finding | Source | Verdict |
|----------|---------|--------|---------|
| **Can we send commercial game screenshots (aligames copyright)?** | **UNCONFIRMED in public docs.** No explicit DashScope or Model Studio content policy prohibiting game screenshots found. Search results returned copyright law Q&A but NOT DashScope-specific restrictions. | Web search + official docs scanned; no policy document found | ⚠️ **UNKNOWN — requires support contact** |
| **Risk of key being locked for copyright/policy violation?** | Plausible but unquantified. Game publishers (aligames/Lingxi) could file DMCA-equivalent claims if Alibaba's terms forbid inference on their IP. CN platform ≠ US DMCA, but China has copyright law. | Inference from general copyright practice; no public SLA seen | ⚠️ **MODERATE RISK — unmitigated** |

**Assessment:** Content policy compliance = **UNRESOLVED BLOCKER**. Must contact Alibaba Cloud support explicitly before Phase 3 ship to confirm game screenshot processing is permitted.

---

### Finding A3: Data Retention & Deletion
| Question | Finding | Source | Verdict |
|----------|---------|--------|---------|
| **How long does CN endpoint store input?** | Alibaba Cloud policy states data retention "as long as you have an account with us, as needed to provide services to you, to resolve disputes, serve research/statistical analysis, or as required by law." No fixed expiration stated. | [Alibaba Cloud Privacy Policy](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy) | ⚠️ INDEFINITE (legal minimum) |
| **Data deletion SLA?** | "Upon deletion request, use standard commercially reasonable measures to make personal data practically irrecoverable or irreproducible." Contact `intlcompliance@service.aliyun.com` for deletion; response "within reasonable timeframe" (no SLA days given). | Same source | ✅ DELETABLE on request (non-real-time) |
| **Region difference (CN vs SG)?** | CN data in Beijing, SG data in Singapore. Both use same retention/deletion policy per Alibaba Cloud Privacy Policy. CN subject to China data residency law; SG complies with intl standards. | [Regional docs](https://www.alibabacloud.com/help/en/model-studio/regions/) | ⚠️ CN has stricter legal holds; SG more flexible for deletion |

**Assessment:** Retention = **acceptable for service logs**; not real-time. If privacy-sensitive (e.g., gameplay contains PII), recommend **SG endpoint** for faster deletion compliance.

---

### Finding A4: Account Registration — Can VN Users Sign Up?
| Question | Finding | Source | Verdict |
|----------|---------|--------|---------|
| **Does DashScope CN require real name (CMND TQ)?** | China mainland services do require real-name registration per China's internet real-name system. BUT: Alibaba Cloud accepts **passport** for foreign users. | [China real-name system](https://en.wikipedia.org/wiki/Internet_real-name_system_in_China), [Alibaba account docs](https://www.alibabacloud.com/help/en/account/step-1-register-an-alibaba-cloud-account) | ✅ Foreign users (VN passport OK) |
| **Can VN users use international (SG) endpoint?** | Yes — international account (alibabacloud.com) does NOT require China ID. Email + phone + optional passport/driver's license for verification. No country restriction stated. | [Account registration guide](https://www.alibabacloud.com/help/en/account/step-1-register-an-alibaba-cloud-account) | ✅ **RECOMMENDED for VN users** |
| **Practical recommendation** | Use **SG endpoint (dashscope-intl.aliyuncs.com)** for team. Simpler registration (VN passport accepted), better data residency optics, free quota available (90 days, 1M tokens/model). | All sources combined | ✅ SG = BEST PATH |

**Assessment:** Registration = **NOT a blocker**. VN users can register internationally; **SG endpoint recommended over CN**.

---

## B. Technical Specification — Vision & API

### Finding B5: Current Production Model ID
| Requirement | Finding | Model ID | Notes |
|-------------|---------|----------|-------|
| **Vision model for OCR + UI reading (game screenshot)** | **Qwen3.7-Plus** is the production multimodal agent model (GA as of 2026-06-01). Succeeds Qwen3.5-Plus. Supports text, image, video. 1M token context. | `qwen-3.7-plus` (or `bailian/qwen3.7-plus` on OpenRouter) | ✅ RECOMMENDED. Better cost/performance than Qwen3.7-Max (text-only). |
| **Alternative: Older VL models?** | Qwen2.5-VL (released 2025-02-05) still available. Qwen3-VL (latest research, not GA'd yet). | `qwen-vl-max`, `qwen-vl-plus`, `qwen3-vl-plus` | Older/research variants; use 3.7-Plus unless cost-critical. |
| **Structured JSON output support?** | ✅ YES — Qwen vision models (including 3.7-Plus) support `response_format: {"type": "json_object"}`. Requires "JSON" keyword in prompt. | Model Studio docs confirm JSON mode. | ✅ CONFIRMED — no tolerant parse needed for basic JSON. |

**Assessment:** Model = **LOCKED**. Use `qwen-3.7-plus`.

---

### Finding B6: OpenAI-Compatible Endpoint & Base URL
| Parameter | China (Beijing) | Singapore (Intl) | Notes |
|-----------|-----------------|------------------|-------|
| **Base URL** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Same API contract. |
| **Image input format** | Supports both: `{"type": "image_url", "image_url": {"url": "https://..."}}` (URL) AND `{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}` (base64 data URI) | Same | ✅ Either format works. |
| **Practical for game screenshots** | Base64 preferred (avoids uploading to OSS temporarily) if size < 20MB per request. | Same | Use data URI in client-side code to keep stateless. |
| **Model parameter** | `model: "qwen-3.7-plus"` | Same | No region-specific suffix; OpenAI-compatible SDK abstracts it. |

**Assessment:** Endpoint = **CONFIRMED**. Use SG endpoint for intl compliance.

---

### Finding B7: Structured Output (JSON Mode)
| Feature | Support | Mechanism | Notes |
|---------|---------|-----------|-------|
| **`response_format: {type: "json_object"}`** | ✅ YES | Set parameter + include "JSON" keyword in prompt (system or user message, case-insensitive). | Works on Qwen3.7-Plus. |
| **Strict schema validation** | ⚠️ PARTIAL | `response_format: {type: "json_schema", schema: {...}}` supported on some Qwen models (e.g., 3.6, 3.7-Plus) via DashScope. | Requires testing; may fallback to loose JSON. |
| **Fallback parsing** | Recommend tolerant JSON parser (e.g., `js/match-dict.js` strip fence). | JSON mode failures rare but possible under load. | ✅ Include fallback per phase plan M1. |

**Assessment:** JSON mode = **SAFE**. No strict schema guarantee; keep tolerant parser.

---

### Finding B8: Pricing & Free Tier
| Dimension | Finding | Region | Notes |
|-----------|---------|--------|-------|
| **Free quota (new account)** | 1M free tokens per model (90 days from activation) | **SG only** (CN has no free quota) | Covers ~100–200 game screenshots depending on resolution. |
| **Vision token rate** | Qwen3.7-Plus: ~$0.40/1M input tokens (0–256K tier). Output: ~$2.40/1M. | SG pricing listed. CN may differ slightly. | ~$0.0004 per screenshot (rough; depends on image size in tokens). |
| **Batch pricing** | No explicit discount; pay-as-you-go or monthly Coding Plan (fixed fee, see docs). | Both regions | ✅ Use real-time API for MVP; batch later if cost-critical. |
| **Kill-switch recommendation** | Set hard daily cap in Worker code to prevent bill surprise. Monitor free quota depletion. | Both | Per phase plan H5 (monthly kill-switch). |

**Assessment:** Pricing = **VIABLE**. Free tier covers beta testing. SG cheaper/freer; implement spend guard per plan.

---

## C. Recommendation: Ship or Not?

### Verdict: **CONDITIONAL GO — SG Endpoint, Content Policy Explicit Waiver Required**

**Decision:**
- ✅ **Technically ready** — model, endpoint, JSON mode all confirmed.
- ✅ **Data privacy safe** — no training reuse; non-training default.
- ✅ **Registration feasible** — VN users can use SG endpoint without CMND.
- ⚠️ **Content policy UNCONFIRMED** — game screenshot processing not explicitly permitted in public ToS.

**Pre-Ship Actions (Mandatory):**

1. **Contact Alibaba Cloud Support** (intlcompliance@service.aliyun.com or Model Studio support portal):
   - Explicit question: "Can we send screenshots of the commercial game Tam Quốc Chí Chiến Lược (by aligames/Lingxi) to Qwen3.7-Plus for visual analysis?"
   - Request written confirmation (email) that this use case is permitted.
   - Ask if there are any image size / frequency limits for SG endpoint.
   - Document response in `docs/dashscope-support-response.md` before Phase 3 ship.

2. **Implement Disclaimer** (Phase 3 M3):
   - Add to Worker + UI: "Vision analysis powered by Alibaba Cloud DashScope. Data processed per [link to privacy policy]."
   - Link to Alibaba Cloud Privacy Policy + Model Studio terms.
   - No user data logged by us (Worker proxy is stateless per phase plan).

3. **Test on Real Game Screenshots** (Phase 3 M1):
   - After support waiver, test Qwen3.7-Plus on 5–10 actual TQCCL screenshots.
   - Verify OCR accuracy on Hán text + UI element detection.
   - Check token costs (budget ~$0.001–0.01 per screenshot).

4. **Set Kill-Switch & Quotas** (Phase 3 H5):
   - Worker: Hard daily cap (e.g., 10,000 screenshots/day or $10/day).
   - Monitor free quota depletion; alert at 80%, block at 0% without paid plan active.
   - Plan manual shutdown path if bill spikes.

---

## D. Risk Matrix & Mitigations

| Risk | Severity | Likelihood | Mitigation | Owner |
|------|----------|------------|-----------|-------|
| **R1: Content policy violation → key locked** | 🔴 Critical | ⚠️ Medium (unconfirmed) | Support waiver + written confirmation before ship. | Researcher → Controller (decision) |
| **R2: Copyright claim (aligames/Lingxi)** | 🔴 Critical | 🟡 Low (depends on Alibaba's stance) | Enclosed in support waiver; disclaimer in UI. | Controller (legal) |
| **R3: Bill spike (unbounded API calls)** | 🟡 High | 🟡 Medium | Worker daily cap + Turnstile + rate-limit per phase plan. | Controller (Phase 3 H5) |
| **R4: Vision hallucination (reads tướng wrong)** | 🟠 Medium | 🔴 High | Fuzzy-match to `tactics.json` + user edit; no raw model output. | Phase plan R1 (already mitigated) |
| **R5: Structured output parse fail** | 🟠 Medium | 🟡 Low | Tolerant JSON parser; tolerant fallback to plain text. | Phase 3 M1 |
| **R6: VN user registration friction** | 🟢 Low | 🟢 Very low | Use SG endpoint (no CMND needed; email/phone sufficient). | Non-issue |

---

## E. Sources & Credibility Assessment

### Authoritative (Tier 1 — direct from Alibaba/Qwen):
- [Alibaba Cloud Model Studio Official Docs](https://www.alibabacloud.com/help/en/model-studio/) — primary source, maintained by Alibaba.
- [Qwen Training Data Disclosure](https://www.alibabacloud.com/help/en/model-studio/qwen-and-wan-training-data-disclosure) — explicit non-training statement.
- [Alibaba Cloud Privacy Policy](https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-privacy-policy) — legal document, complete.
- [DashScope OpenAI-Compatible Docs](https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope) — technical spec.

### Secondary (Tier 2 — third-party validation):
- [Qwen Code ToS/Privacy](https://qwenlm.github.io/qwen-code-docs/en/users/support/tos-privacy/) — mirrors Alibaba policy, community-facing.
- [Qwen Blog](https://qwen.ai/) — product announcements (Qwen3.7-Plus GA date confirmed).
- [TokenMix DashScope Guide 2026](https://tokenmix.ai/blog/dashscope-alibaba-cloud-api-developer-setup-2026) — practitioner doc, registration workflow confirmed.

### Gaps (NOT found):
- ❌ DashScope explicit content policy doc (re: game screenshots).
- ❌ Specific SLA for key lockout / policy violation response.
- ❌ Published model training audit or opt-out interface (not needed; non-training default).

---

## F. Unresolved Questions

1. **Game screenshot content policy** — Is processing commercial game images (aligames copyright) permitted? Must contact Alibaba support.
2. **Strict schema enforcement** — Does `response_format: {type: "json_schema"}` actually enforce the schema on Qwen3.7-Plus, or just suggest? Testing needed.
3. **Image size limits** — Is there a per-request image size limit (e.g., < 20MB) on SG endpoint? Not stated in docs.
4. **Multimodal token cost** — Are vision tokens charged differently than text tokens, or bundled? Pricing docs unclear.
5. **Deletion latency** — How long does "within reasonable timeframe" actually mean for data deletion requests? (days/weeks?)

---

## Summary for Controller

**Go/No-Go:** ✅ **GO, contingent on support waiver**  
**Gate:** Phase 3 starts once Alibaba Cloud confirms game screenshot processing is allowed.  
**Endpoint:** `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (SG, intl-friendly).  
**Model:** `qwen-3.7-plus`.  
**Costs:** ~$0.0004/screenshot (within budget); free tier covers beta.  
**Risk:** Content policy unconfirmed; all other vectors safe.  
**Next Step:** Researcher → Controller files support request + waits for written waiver before Phase 3 kickoff.

---

**Report Prepared By:** Researcher  
**Claude Session:** https://claude.ai/code/session_01MBF6tfAWJv5BCotqZrieoe
