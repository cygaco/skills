---
guide: AI_PRODUCT_COMPLIANCE
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: core
maps_to: [ai-compliance, privacy-data]
sources:
  - "https://artificialintelligenceact.eu/article/50/"
  - "https://artificialintelligenceact.eu/implementation-timeline/"
  - "https://www.consilium.europa.eu (Digital Omnibus provisional agreement, 2026-05-07)"
  - "https://www.ftc.gov (Operation AI Comply)"
---

# AI Product Compliance (risk · transparency · claims · training)

## 1. What this is

The reviewer's lens on AI-powered features: prohibited/high-risk triage, transparency duties, marketing-claims substantiation, and training-on-user-data posture. Most small AI products CALL provider APIs (OpenAI/Anthropic) — that makes them EU AI Act **deployers** (provider duties sit upstream), but Art. 50 transparency duties still bite where applicable. Founder-facing companion: [`AI_COMPLIANCE_GUIDE.md`](../../guides/AI_COMPLIANCE_GUIDE.md).

## 2. Why it matters

EU AI Act Art. 50 transparency (chatbot disclosure; synthetic/deepfake content labeling) applies from **2026-08-02**; the Digital Omnibus (provisional agreement 2026-05-07) delays HIGH-RISK obligations to ~Dec 2027 but does NOT move Art. 50 (one carve-out: Art. 50(2) machine-readable marking for already-on-market generators → Feb 2027). The FTC's Operation AI Comply line of actions targets unsubstantiated AI claims and fake-AI products. Training on private user content without clear consent/ToS disclosure draws both FTC and EU action (retroactive ToS changes especially).

## 3. Core principles / requirements

- **3.1 Lane triage first** — prohibited practices (social scoring, emotion inference at work/school, manipulative techniques) and high-risk decisioning (employment, credit, housing, education, medical, legal) are NOT vibe-coder lanes: escalate/refuse.
- **3.2 Disclose the bot** — users interacting with AI must be able to tell (where not obvious from context).
- **3.3 Label synthetic media** — AI-generated/manipulated realistic content carries disclosure (Art. 50(4)).
- **3.4 Claims need evidence** — every marketing capability claim about AI is substantiated in a claims-evidence artifact; "AI-powered" on a non-AI script is deception too.
- **3.5 Training posture is explicit** — default NO training on private user content; if on, separate revocable consent + exact ToS language; vendor-side training toggled OFF where the API offers it.
- **3.6 The AI vendor is a processor** — listed in the processor inventory with DPA/data-processing terms; prompts/outputs follow the retention schedule.

## 4. Concrete examples

- Compliant: chat UI labeled "AI assistant"; image generator stamps/discloses synthetic output; `claims_evidence.md` backs the landing-page claims; ToS states "we do not train on your content"; OpenAI/Anthropic listed as processors with training disabled.
- Non-compliant: "human support" routing silently to a bot; realistic AI avatars with no disclosure; "diagnoses your condition with AI" with no substantiation and no escalation; quiet ToS edit enabling training on user uploads.

## 5. Common failure modes

Undisclosed chatbot in a support flow · unlabeled deepfake-capable output · capability puffery with zero evidence · "not professional advice" disclaimer pasted over a flow that IS making the decision · prompts/PII logged indefinitely · AI vendor missing from the processor list · AI features reaching minors without escalation.

## 6. ✅ Agent-applicable RULES

Each rule: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

- **[AIACT-01] critical — Conversational AI is disclosed as AI where a user could reasonably believe it's human.** → `ai-compliance`. Detect: LLM-backed chat/support/voice UI with no AI disclosure in the surface or onboarding = FAIL (observed: undisclosed bot; expected: visible disclosure).
- **[AIACT-02] critical — The product is not in a prohibited/high-risk lane without escalation.** → `ai-compliance`. Detect: features making/automating employment, credit, housing, education, medical, or legal determinations (or emotion-inference/social-scoring) with no recorded human escalation = FAIL; "advice-like" gray zones = FLAG for human confirmation.
- **[AIACT-03] serious — Realistic AI-generated/manipulated media carries disclosure.** → `ai-compliance`. Detect: image/video/audio generation of realistic people/events with no labeling mechanism = FAIL; text-only generation = N/A unless presented as human journalism.
- **[AIACT-04] serious — Marketing AI claims trace to evidence.** → `ai-compliance`. Detect: capability claims in landing/store copy (accuracy %, "detects X", "expert-level") with no claims-evidence artifact = FAIL; soft puffery = FLAG. Also FAIL the inverse fake-AI case: "AI-powered" where no model call exists.
- **[AIACT-05] critical — No training on private user content without disclosed, separate, revocable consent.** → `ai-compliance`, `privacy-data`. Detect: fine-tuning/training pipelines or data-export-to-training flows fed by user content, with no explicit consent surface + ToS/privacy disclosure = FAIL; consent buried in a general ToS update = FAIL.
- **[AIACT-06] serious — The AI vendor appears in the processor inventory; vendor-side training on user data is addressed.** → `ai-compliance`, `privacy-data`. Detect: model API calls in code but vendor absent from processors/policy = FAIL; no statement of the vendor-training setting = FLAG.
- **[AIACT-07] minor — Prompt/output logs obey the retention schedule.** → `ai-compliance`, `data-rights-ops`. Detect: prompts/completions containing user content logged with no retention bound = FLAG (ties to DSR-08).
- **[AIACT-08] serious — AI features reachable by minors carry the minors escalation.** → `ai-compliance`, `minors`. Detect: see MINOR-06 — same condition, both lenses fire = FAIL.
- **[AIACT-09] minor — Consequential outputs have a human-review or safety path.** → `ai-compliance`. Detect: outputs that users act on (financial amounts, deletions, sent messages) executed with no confirmation/review affordance = FLAG; no abuse/safety handling for self-harm/illegal/sexual content in open-ended chat = FLAG.
- **[AIACT-10] minor — "Disclaimer vs flow" honesty.** → `ai-compliance`. Detect: "not professional advice" text while the flow's structure makes/automates the professional decision = FLAG for human confirmation.

## 7. Sources

Primary: EU AI Act Art. 50 + implementation timeline (artificialintelligenceact.eu; EUR-Lex); Digital Omnibus provisional agreement (Council, 2026-05-07 — high-risk delay to ~Dec 2027, Art. 50 unchanged at 2026-08-02, 50(2) marking carve-out Feb 2027 — PROVISIONAL, verify final text). FTC: Operation AI Comply actions; retroactive-ToS/training enforcement posture. Colorado AI Act: postponed implementation (verify current effective date) — consequential-decision scope rarely hits small consumer apps. *Last reviewed: 2026-06. NOT legal advice; lane triage gray zones are human FLAGs.*
