---
guide: MINORS_AND_AGE_ASSURANCE
anchor: none
shape: notice
timing: reference
lead_time: "none"
tier: core
maps_to: [minors, privacy-data]
sources:
  - "https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule"
  - "https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions"
  - "https://ico.org.uk (Children's Code)"
---

# Minors & Age Assurance

## 1. What this is

The reviewer's lens on audience: does the product's REAL audience match its declared 13+ stance, is the age gate honest, and do minor-reachable features escalate. The posture here: no under-13 products without counsel (the lastmile security/privacy escalation already hard-stops children's data). Founder-facing companion: [`MINORS_GUIDE.md`](../../guides/MINORS_GUIDE.md).

## 2. Why it matters

The amended COPPA Rule (effective 2025-06-23; full compliance 2026-04-22) tightened consent (separate opt-in for targeted advertising), retention limits, and safe-harbor oversight; FTC children's-privacy actions carry eight-figure exposure (e.g. the Disney YouTube settlement). "We said 13+" does not survive marketing/content that visibly targets kids ("actual knowledge" + audience-targeting analysis). US state teen/AADC laws are volatile (several enjoined in NetChoice litigation; UK Children's Code applies to UK-reachable teens regardless).

## 3. Core principles / requirements

- **3.1 The declared audience is an artifact** — an age/audience assessment exists and matches marketing copy, store category/rating, and feature set.
- **3.2 Honest age gate** — neutral date-of-birth (or age-band) entry, no nudging ("born before 2013?"), block-and-don't-retain on under-13, no trivial retry loop.
- **3.3 No targeted ads to known minors.** Separate-consent territory under amended COPPA; default = off.
- **3.4 Teen-reachable social features need safety affordances** — blocking, reporting, non-public-by-default profiles.
- **3.5 AI reachable by minors escalates** (companions/chat especially — ties to AIACT rules).
- **3.6 Data minimization for age** — store the age BAND or over/under flag, not a precise DOB, where a band suffices.

## 4. Concrete examples

- Compliant: general-audience product, neutral DOB gate at signup, under-13 entry → polite block with no account row retained; store rating consistent; no ad SDKs targeting minors.
- Non-compliant: marketing says "perfect for kids' homework" while the policy says 13+; a single "I am over 13" checkbox on a cartoon-styled product; blocked under-13 user can immediately re-enter a new DOB; precise DOB stored forever for a feature that needs only 13+.

## 5. Common failure modes

Child-attractive product hiding behind a 13+ ToS line · age gate that coaches the answer · DOB retained precisely with no purpose · store age rating contradicting actual content · teen DMs public-by-default with no block/report · AI chat shipped to teens without escalation.

## 6. ✅ Agent-applicable RULES

Each rule: **[ID] severity — assertion → maps_to → detection (observed vs expected).**

- **[MINOR-01] critical — Marketing/content audience matches the declared age stance.** → `minors`. Detect: copy/store text/assets target children ("kids", "for school", child-styled art as the primary aesthetic) while the policy claims 13+ = FLAG for human confirmation (FAIL when explicit "for kids" copy coexists with a 13+ gate and child-directed features).
- **[MINOR-02] critical — No under-13 account path.** → `minors`. Detect: age gate absent on a product whose audience assessment requires one, or the under-13 branch still creates an account/retains the profile = FAIL.
- **[MINOR-03] serious — The age gate is neutral and non-gameable.** → `minors`. Detect: gate nudges the passing answer, or a blocked user can immediately resubmit a different age with no friction/device memory = FAIL; single "I am 13+" checkbox on a child-attractive product = FLAG.
- **[MINOR-04] serious — No targeted advertising to known minors.** → `minors`. Detect: ad/adtech SDK active on accounts whose age band marks them minors, without a separate verified consent flow = FAIL.
- **[MINOR-05] serious — Teen-reachable social/UGC/DM features ship with block + report + non-public-default.** → `minors`. Detect: messaging/UGC features, minor-reachable audience, and no blocking/reporting path or public-by-default profiles = FAIL.
- **[MINOR-06] serious — AI features reachable by minors carry the escalation flag.** → `minors`. Detect: LLM chat/companion/mental-health-adjacent feature + minor-reachable audience + no recorded human escalation = FAIL (ties to AIACT-08).
- **[MINOR-07] minor — Age data is minimized.** → `minors`, `privacy-data`. Detect: precise DOB stored where an over/under band suffices = FLAG.
- **[MINOR-08] minor — Store age rating consistent with features/content.** → `minors`, `app-store-policy`. Detect: rating/category in store config contradicts observed content/features = FLAG (off-repo store forms: state what to verify).

## 7. Sources

Primary: amended COPPA Rule (Federal Register 2025-04-22; effective 2025-06-23, compliance 2026-04-22) · FTC COPPA FAQ · ICO Children's Code. Enforcement: FTC/Disney $10M (children's data on YouTube). Status note: US state teen/AADC laws are volatile — several enjoined (NetChoice line of cases); verify current force before relying. *Last reviewed: 2026-06. NOT legal advice; the under-13 line is a counsel escalation by policy.*
