---
guide: AI_COMPLIANCE
anchor: lastmile:gate/legal
shape: walkthrough
timing: at-gate
lead_time: "EU AI Act Art. 50 transparency applies from Aug 2 2026 — ship the disclosure/labeling WITH the AI feature, not after"
---

# AI_COMPLIANCE_GUIDE.md — Shipping AI Features Without Getting Fined (for Total Newbies)

> Your app has an AI feature — a chatbot, a "summarize this", an image generator, a "smart" anything that calls OpenAI or Anthropic behind the scenes. The moment it does, **three different referees start watching you**: the **EU** (the AI Act, which has rules about telling people they're talking to a machine), the **FTC** (the US regulator that fines you for *lying* about what your AI does), and **your own users** (whose data you must not quietly feed back into a model). The good news: almost everything they want is **cheap if you do it at build time** and expensive if you bolt it on after launch.
>
> **New here?** Read [`README.md`](README.md) once for the human-vs-AI split (🔴 = only you can do it; 🤖 = hand it to your AI assistant). This guide focuses on the four obligations that actually generate enforcement for a small AI app: **disclosure, honest claims, training-on-user-data, and minors** — plus a one-paragraph "are you even in scope?" triage so you don't over-engineer.

---

## 1. ELI5 — who's watching, and why most of it is cheap

Imagine you open a little café and you put a robot at the counter. Three people care:

- **The EU** says: *put a small sign on the robot so customers know it's a robot* — that's the **AI Act's transparency rule**. It's a sign, not a redesign. Cheap.
- **The FTC** (the US "don't-lie-in-business" cop) says: *don't put a poster claiming the robot is a Michelin chef if it heats up frozen soup.* Every brag about your AI has to be **true and provable**. Free, if you don't lie.
- **Your users** say: *don't take what I tell the robot and use it to train your next robot without asking me.* Don't **train on private user content** by default. Free, if you just leave it off.

That's 90% of AI compliance for a small consumer app, and you'll notice none of it is "hire a lawyer" expensive — it's a label, an honest marketing page, and one default setting. The trap is **timing**: the EU's transparency rule has a real date (**2 August 2026** — see Section 3), so you build the disclosure *into the feature*, not "later."

The one big risk, in one sentence: **the headlines say "the AI Act got delayed," that delay is for the *scary high-risk* stuff, and the transparency rule that actually applies to your little chat app did NOT move.** *([VERIFIED] — the Digital Omnibus delayed high-risk rules to Dec 2027; Article 50 transparency stays 2 Aug 2026. Confidence H.)*

---

## 2. Where you stand — the 60-second triage (do this first)

Before anything else, figure out which lane you're in. For the overwhelming majority of vibe-coded apps, the answer is "the easy lane."

### You are a DEPLOYER, not a "provider"

> **If your app just *calls* the OpenAI or Anthropic API, you are a "deployer" of an AI system — NOT a "provider" of an AI model.** That distinction matters enormously: the heaviest duties (documenting how the model was trained, the model-marking machinery) sit **upstream with OpenAI/Anthropic**, not with you. *([VERIFIED] — "organizations that call their APIs are deployers"; you become a provider only if you "sufficiently modify the underlying model — specifically, if your fine-tuning compute exceeds one-third of the original model's training compute." EU AI Act structure, confidence H.)*

You only cross into "provider" territory if you **build or substantially modify a model** — i.e., fine-tuning at a scale a solo founder essentially never reaches. **Calling an API in a normal app does not make you a model provider.**

But — and this is the part the "the AI Act doesn't touch API callers" myth gets wrong — **being a deployer is not being off the hook.** You still owe the **Article 50(4) disclosure duties** (telling people about deepfakes / AI-generated content), and you still owe honest-marketing and data-handling duties to the FTC and your users. *([VERIFIED] — "The 'AI Act doesn't touch API callers' claim is false." Confidence H.)*

### The 🔴 STOP lane — features a vibe-coder app should simply not be in

A short list of AI uses is either **outright prohibited** or **"high-risk"** under the EU AI Act, and they carry compliance machinery far beyond this guide. **If your idea is in this lane, STOP and escalate to a human (a lawyer) before building:**

- **Social scoring** of people (ranking citizens by behavior).
- **Emotion recognition** in a **workplace or school**.
- **Biometric categorization** of people by sensitive traits, or untargeted face-scraping.
- **Consequential decisioning** of the CV-screening / credit-scoring / insurance / housing / law-enforcement class — AI that decides who gets a job, a loan, a home, or benefits.

> **The honest truth for a newbie:** a normal consumer app — a chatbot, a writing helper, a photo tool, a study buddy — **should simply not be in this lane.** If you find yourself building hiring-decision AI or a "credit score from your selfie," that's not a "add a disclosure" problem, that's a "talk to a lawyer first" problem. The Colorado AI Act and the EU's high-risk regime are aimed *here*, not at your chat feature (see Section 7). *([VERIFIED] — prohibited/high-risk scope per AI Act; "a generic consumer chat/LLM feature is generally NOT in scope." Confidence M-H.)*

**Everything below assumes you're in the easy lane: a normal consumer app that calls an LLM API.**

---

## 3. The build-time duties (the transparency labels)

These are the things you wire into the **UI** while building the feature. They're small. The discipline is doing them *now*, because the EU date is real.

### Duty 1 — Tell people they're talking to an AI (chatbot disclosure)

If a user is interacting with your AI and it isn't *obvious*, say so. A line like *"You're chatting with an AI assistant"* near the chat input is enough.

- The strict legal text (Article 50(1)) makes this primarily the **model provider's** duty, with an "unless it's obvious" carve-out — *"unless this is obvious from the point of view of a natural person who is reasonably well-informed, observant and circumspect."* But the cheap, safe move is: **you label it anyway.** *([VERIFIED] — Art. 50(1) verbatim, confidence H.)*
- 🤖 **AI CAN DO THIS** — it's a UI string. Have your assistant add the disclosure to the chat surface.

### Duty 2 — Label AI-generated / manipulated media (the deepfake rule)

If your app **generates or manipulates** realistic images, audio, or video of people or events — anything a viewer might mistake for real — you must **disclose that it's artificially generated.** This one is squarely **your** duty as the deployer.

> **This is the deployer duty you actually own.** Article 50(4): deployers of a system generating **deepfakes** must *"disclose that the content has been artificially generated or manipulated."* If you publish **AI-written text "to inform the public on matters of public interest"**, you must disclose that too — unless a real human reviewed it and takes editorial responsibility. *([VERIFIED] — Art. 50(4) verbatim, confidence H.)*

Practical version: if your app makes face-swaps, voice clones, realistic synthetic photos, or AI news-style text, put a visible *"AI-generated"* label on the output. 🤖 the label is code; 🔴 the *decision* that your output is "realistic enough to need it" is yours.

### Duty 3 — Get the timeline right (don't relax because of a headline)

This is where founders trip. The dates that matter:

| What | When it applies | Does the "delay" touch it? |
|---|---|---|
| **Article 50 transparency** (chatbot + AI-content disclosure) | **2 August 2026** | **NO — this date held.** |
| Machine-readable marking of generative systems *already on the market* (50(2)) | **February 2027** (a narrow carve-out) | Slightly later, narrow case |
| **High-risk** systems (the scary lane in Section 2) | **December 2027** (delayed from Aug 2027) | **YES — this is what "got delayed."** |

> **The golden rule on timing:** *"The AI Act got delayed, so I have until 2027" is misleading.* The high-risk rules slipped — **Article 50 transparency is still 2 August 2026.** Build your disclosures **with** the feature, not after. *([VERIFIED] — Digital Omnibus delayed high-risk to Dec 2027; Art. 50 stays Aug 2026; 50(2) marking of already-on-market systems → Feb 2027. Confidence H. CAVEAT: the Omnibus is a *provisional* Council/Parliament agreement as of 7 May 2026, not final-adopted text — the Aug 2026 transparency date is the safe planning assumption regardless of how the high-risk dates finalize.)*

---

## 4. Don't lie about your AI (FTC claims substantiation)

The FTC doesn't care about your EU labels — it cares whether your **marketing is true.** This is the rule that has actually produced fines for small and mid-size companies, under the FTC's **"Operation AI Comply"** sweep.

> **The one rule to remember:** **every claim you make about your AI must be provable before you publish it.** No "AI-powered accuracy," no "98% accurate" unless you can show the 98%, and no calling something "AI" when it's actually a hand-written script (that's deception too). *([VERIFIED] — FTC "Operation AI Comply" actions, confidence H.)*

The real cases, so you see it's not theoretical:

- **DoNotPay (settled Jan 2025, $193,000)** — marketed a "world's first robot lawyer" whose claims weren't backed by training on actual law. *([VERIFIED] — FTC, confidence H.)*
- **Workado (Apr 2025)** — advertised an AI content detector as **"98% accurate"** when the alleged real figure was ~53%. *([VERIFIED] — FTC, confidence H.)*

Two failure shapes, both fatal:
1. **Overstating capability ("AI washing").** "Diagnoses depression," "lawyer-quality," "guaranteed accurate," "bias-free hiring," "100% private" (when prompts go to a vendor). If the claim influences a purchase, a health/money/legal/job decision, or trust — **keep the evidence on file first.**
2. **Fake AI.** Calling a script "AI," or saying "human support" when it's a bot. Misrepresenting *what the thing is* is deception independent of accuracy.

> ⚠️ **A disclaimer does NOT cure a deceptive core claim.** Burying "not professional advice" at the bottom doesn't save a flow that actually behaves like it's giving professional advice. *([VERIFIED] — FTC posture, confidence H.)*

**The cheap enforcer for yourself:** keep a `claims_evidence.md` file. For every AI claim on your landing page, one line: the claim, and the proof. If you can't fill the proof line, **soften the claim.** 🤖 your AI assistant can draft this file from your marketing copy; 🔴 you decide what's actually true.

> **One historical nuance so you don't cite dead law:** the FTC's *Rytr* action (an AI review-writer) was **reopened and set aside on Dec 22, 2025** — it is **no longer a live precedent.** Don't quote Rytr as the rule. *([VERIFIED] — FTC reversed Rytr Dec 22 2025, confidence H.)*

---

## 5. Don't train on your users' private content (the default that protects you)

When a user types something into your AI, that text goes to your model vendor — and *separately*, you might be tempted to keep it and **train your own future model on it.** For a newbie consumer app, the safe default is one word: **don't.**

> **The golden rule:** **default to NO training on private user content.** If you *want* to train on it, that requires **explicit, separate, revocable consent** plus Terms-of-Service language that says **exactly what trains what** — and you may **never bury it in a quiet ToS update.** *([VERIFIED] — default-no-training posture + FTC has acted on retroactive ToS changes; EDPB/FTC positions, confidence H for the "don't bury it" rule.)*

What this looks like in practice:

- **Off by default.** Don't feed private user content into any training/fine-tuning pipeline unless the user *opted in* on purpose, separately from "I agree to the terms."
- **Separate and revocable.** A distinct toggle ("Help improve our AI with my data"), not a pre-ticked box, and the user can turn it back off. (Pre-ticked = not valid consent under GDPR; the same logic the privacy guide uses for marketing.)
- **Say exactly what trains what.** Your ToS/privacy policy should name it: *which* data, for *what* purpose, and whether prompts/outputs are stored at all.
- **Never retroactive-by-stealth.** Changing your ToS to start training on data users already gave you, without a real fresh opt-in, is exactly the move the FTC has acted on. *([VERIFIED] — FTC has acted on retroactive ToS changes, confidence H.)*

### Turn OFF training at your vendor, too

This is the step newbies miss: **your AI vendor may train on your API traffic unless you tell it not to.** Most provider APIs let you disable training on your data — **do it.** And sign/accept the vendor's **data-processing terms (DPA)**, because under the law your AI vendor is your **processor** and you're responsible for what they do with your users' data.

- 🔴 **YOU MUST DO THIS** — flipping the "don't train on our data" setting and accepting the DPA happens in *your* vendor dashboard, with *your* account.
- 🤖 **AI CAN DO THIS** — listing your AI vendor in your processor/subprocessor inventory and drafting the ToS/privacy language.

---

## 6. AI + minors — extra care, or escalate

If children might use your AI feature, the stakes jump, and a fake "I am 13+" checkbox will not save you.

> **The rule:** **no AI companions, AI friends, AI tutors, or AI chat aimed at (or obviously attractive to) kids without escalating to a human first.** *([Guide stance, grounded in COPPA "actual knowledge" — confidence H on COPPA scope.)*

Escalate **before building** if your AI is any of:
- a **companion / friend / romantic roleplay** bot that minors could use;
- a **tutor, homework helper, or "for school"** tool;
- **mental-health, coaching, or crisis-adjacent** for teens (self-harm, eating disorders, etc.);
- using a minor's **voice, face, or avatar**.

And remember the COPPA trap that has nothing to do with AI specifically but bites AI apps hard: a neutral age screen lets you rely on the age entered — **but the moment your form captures a birthdate showing the user is under 13, you cannot just ignore it and keep treating them as an adult.** That's "actual knowledge," and it flips you into COPPA scope. *([VERIFIED] — COPPA amended Rule fully effective 22 Apr 2026; "actual knowledge" age-gate discipline, confidence H.)* For the full minors playbook (age gates, teen-design codes, what to build for a 13+ app), this guide defers to the dedicated minors triage — see Cross-references.

---

## 7. State laws — one honest paragraph, not a survey

You'll see scary headlines about US-state AI laws. For a tiny consumer AI app, **almost all of it is noise** — here's the signal. The **Colorado AI Act** is the one people name, and it has been **delayed to January 1, 2027** *and* narrowed; crucially, it governs **"high-risk" AI used in consequential decisions** — employment, lending, housing, insurance — **not a generic consumer chat or summarizer.** So unless your app drives one of those decisions (in which case see the 🔴 STOP lane in Section 2), **Colorado is a low-priority concern for you.** The other genuinely-relevant flags only switch on for *specific* products: **deepfake/voice-cloning/likeness laws** if you generate realistic people or voices; **biometric laws (e.g. Illinois BIPA)** if you do face/voice identification; **employment-AI bias laws** if you build hiring tools. If you're a normal chat/writing/photo app, none of these apply — don't over-engineer for them. *([VERIFIED] — Colorado AI Act delayed to Jan 1 2027 and narrowed to high-risk consequential decisions; "generic consumer app excluded" is a well-supported inference. Confidence M-H.)*

---

## 8. The checklist — minimum viable AI compliance

```
AI COMPLIANCE — MINIMUM VIABLE (for a normal app that calls an LLM API)
[ ] Triage done: you're a DEPLOYER, and you're NOT in the prohibited/high-risk lane
[ ] Disclosure UI: users are told they're interacting with AI (where not obvious)
[ ] Content labeling: AI-generated/manipulated realistic media is labeled "AI-generated"
[ ] Claims-evidence file: every AI marketing claim has proof on file (claims_evidence.md)
[ ]   ...no "AI washing" (overstated capability) and no fake "AI" that's a script
[ ] Training posture DECLARED: default = no training on private user content
[ ]   ...if training: separate, revocable, opt-in consent + exact ToS language (never buried)
[ ] Vendor DPA accepted with your AI provider (they're your processor)
[ ] Vendor training on YOUR users' data turned OFF where the API allows it
[ ] AI vendor listed in your processor/subprocessor inventory
[ ] Minors: no AI companion/tutor/chat aimed at kids without escalation; under-13 = stop
[ ] Timeline honesty: Art. 50 transparency is LIVE Aug 2 2026 — shipped WITH the feature
```

**Done when:** a user can tell they're talking to an AI, every claim on your marketing page is one you could defend, your users' private content is not silently training a model (and your vendor isn't training on it either), and you didn't wait until 2027 because of a headline that was about somebody else's high-risk system.

---

## 9. Human-vs-AI split (who does what)

| Step | Who | Why |
|---|---|---|
| Decide whether your idea is in the prohibited/high-risk lane | 🔴 **YOU** (with a lawyer if close) | It's a legal-judgment call, not a coding task |
| Add the "you're talking to an AI" disclosure to the UI | 🤖 **AI** | A UI string |
| Add "AI-generated" labels to synthetic media output | 🤖 **AI** (label) / 🔴 **YOU** (decide it's needed) | Code is easy; the "is it realistic enough" call is yours |
| Decide which marketing claims are *true* | 🔴 **YOU** | You know what your product actually does |
| Draft `claims_evidence.md` from the marketing copy | 🤖 **AI** | Drafting; you fill the proof |
| Flip "don't train on our data" + accept the DPA in the vendor dashboard | 🔴 **YOU** | Your account, your legal agreement |
| Write the ToS/privacy language for training & data use | 🤖 **AI** drafts / 🔴 **YOU** publish | Drafting is coding; publishing is a legal promise *you* make |
| List AI vendors as processors in your data inventory | 🤖 **AI** | Bookkeeping |
| Escalate an AI-for-minors or consequential-decision feature | 🔴 **YOU** | Only a human can make this call |

---

## 10. Cross-references

- [`PRIVACY_GDPR_GUIDE.md`](PRIVACY_GDPR_GUIDE.md) — consent mechanics, data export/delete, the processor relationship your AI vendor sits in.
- [`LEGAL_GUIDE.md`](LEGAL_GUIDE.md) — your Terms of Service is where the training-on-user-data language and AI disclaimers actually live.
- [`SECURITY_GUIDE.md`](SECURITY_GUIDE.md) — prompt injection, AI usage caps, and keeping prompts/keys out of the wrong hands.
- [`ONBOARDING_GUIDE.md`](ONBOARDING_GUIDE.md) — the neutral age gate and the under-13 (COPPA) block that this guide's minors section relies on.
- [`ANALYTICS_TELEMETRY_GUIDE.md`](ANALYTICS_TELEMETRY_GUIDE.md) — if you log prompts/outputs, retention and privacy-safe payloads apply to AI logs too.

---

## 11. Top newbie mistakes (and the fix)

1. **"The AI Act got delayed, I have until 2027."** → That's the *high-risk* delay. Article 50 transparency is live **Aug 2 2026**. Ship the disclosure now.
2. **Thinking "I just call an API, the law doesn't touch me."** → You're a deployer; you still owe the AI-content disclosure (50(4)) and FTC honesty + data duties.
3. **"AI-powered 99% accuracy!" with no proof.** → That's the exact FTC "AI washing" pattern (Workado, DoNotPay). Keep evidence, or soften the claim.
4. **Calling a script "AI," or a bot "human support."** → Misrepresenting *what it is* is deception, separate from accuracy.
5. **Training on user content by default.** → Default OFF. Training needs separate, revocable opt-in + exact ToS language.
6. **Burying training consent in a quiet ToS update.** → The FTC has acted on retroactive ToS changes. Get a real fresh opt-in.
7. **Forgetting the vendor trains on you.** → Turn off training on your data in the API dashboard; accept the DPA.
8. **No "AI-generated" label on synthetic media.** → If it's realistic, label it (Art. 50(4) is *your* deployer duty).
9. **AI companion/tutor for kids with a fake "13+" checkbox.** → Escalate; a checkbox isn't age assurance, and under-13 "actual knowledge" flips you into COPPA.
10. **Over-engineering for Colorado/state AI laws.** → Delayed to 2027 and aimed at high-risk *decisions*; a normal chat app isn't in scope.

---

## 12. Official sources

- EU AI Act — Article 50 (transparency: provider 50(1)/(2) + deployer 50(4)): https://artificialintelligenceact.eu/article/50/
- EU AI Act — implementation timeline: https://artificialintelligenceact.eu/implementation-timeline/
- EU Council — provisional Digital Omnibus agreement (7 May 2026, high-risk delay): https://www.consilium.europa.eu/en/press/press-releases/
- FTC — Operation AI Comply (enforcement against deceptive AI claims): https://www.ftc.gov/
- FTC — COPPA FAQ ("actual knowledge," neutral age-gate): https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- Colorado AI Act (status / delay): verify current status via the Colorado AG / a maintained firm tracker before relying on a date.

---

*Part of the lastmile launch guides (`.claude/lastmile/guides/`). Last reviewed: 2026-06. **AI law moves fast and several of these are provisional** — the EU Digital Omnibus that delayed high-risk rules is a provisional agreement (7 May 2026), not final-adopted text, so re-verify the high-risk dates before relying on them; the Article 50 transparency date (Aug 2 2026) is the safe planning assumption regardless. Re-verify any date-stamped claim against the Official sources before launch.*
