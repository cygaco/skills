---
guide: MINORS
anchor: lastmile:day-zero
shape: notice
timing: project-start
lead_time: "none (the audience decision is a day-zero fork: anything under-13 means a lawyer BEFORE you build, not before you launch)"
---

# MINORS_GUIDE.md — Who Is Your App For? (a day-zero risk triage)

> ## ⚠️ READ THIS FIRST — this is NOT legal advice
> This is a **short triage notice**, not a treatise. Children's and teens' data is one of the few corners of launch where the answer is sometimes *"stop and hire a lawyer before you write a line of code."* This page exists to tell you **which lane you're in** — and the moment you're not sure, the safe move is the lawyer. The privacy and legal guides both point you *here* when they hit "children." This is where those STOPs land.

> **New here?** The shared "what only a human can do" preamble lives in **[`README.md`](README.md)** — read it once.

---

## The one decision: who is your product for?

Answer this **on day zero**, before you design anything. Pick the lane that matches your audience.

### 🟢 GREEN — adults / general-audience (13+) — the default lane

A genuinely general-audience app, not aimed at or especially attractive to kids. You **may** operate on a 13+ basis — but that stance only holds if you also do the things in the next section. **This is the only lane you can self-serve.**

### 🟡 AMBER — teens (13–17) as a TARGET audience

You're deliberately building *for* teenagers. Allowed, but you take on **extra duties** and you're exposed to a **fast-moving, unstable** set of teen-safety laws (next page). Tread carefully; get a privacy review before launch.

### 🔴 RED — anyone under 13, or "kids" as your audience — **STOP**

If your product targets under-13s — or "kids," "children," "for your little one," cartoon characters, homework-for-kids, a children's category — **stop and get a lawyer BEFORE you build.** This is verifiable-parental-consent territory (US COPPA), and the rule to follow is: **don't build under-13 products without counsel.** This is not a launch-week checkbox; it's a day-zero gate.

---

## What a GENUINELY general-audience (13+) app STILL must do

Picking the green lane is not "do nothing." The baseline:

1. **An honest age gate.** Ask for date of birth (or age) **neutrally** — a plain entry, no birthday prefilled to an adult year, "over 13" not the giant obvious tap target, the question *before* a long sunk-cost flow, no language nudging kids to lie. *([VERIFIED] — FTC has flagged each of those nudges as inadequate.)*
2. **Don't create "actual knowledge."** US COPPA only reaches a general-audience app once you have **actual knowledge** a user is under 13 — but here's the trap: **if your age gate captures an under-13 birthdate, you cannot just discard it and carry on.** Block account creation, stop collecting their data, don't invite them to "try again" with a new birthday. *([VERIFIED] — FTC FAQ on the neutral age-gate.)*
3. **No targeted ads or behavioral profiling to anyone you know is a minor.**
4. **Know the COPPA amended-rule dates.** The amended COPPA Rule is **effective June 23, 2025**, with **full compliance required by April 22, 2026** (so it's live now). What changed: **separate** verifiable parental consent for sharing a child's data for targeted ads, a **written data-retention policy** in your privacy notice, and **biometric identifiers** (face/fingerprint/voiceprint) now count as "personal information." *([VERIFIED] — Federal Register + FTC.)*
5. **Pass the "you knew" test.** If your **content, characters, or marketing attract kids**, calling it "13+" in the fine print won't save you — the law looks at whether your app is *child-directed in fact*, not what your terms claim. If kids would obviously love it, you're not really general-audience. **That's the question to answer honestly before you commit.**

---

## 🟡 The teens (13–17) lane — extra duties + volatile law

If teens are a target audience, two things are true:

- **The UK Children's Code applies** if UK teens can access your service — it expects privacy-by-default for anyone likely under 18. *([VERIFIED] — in force.)*
- **US state teen / age-appropriate-design laws are VOLATILE.** Several states passed them (California AADC, Texas, Florida, Utah, and more), but **many are currently enjoined or partially blocked in court** and the picture changes month to month. *([VERIFIED] as a pattern — California's AADC was narrowed by the 9th Circuit in March 2026; Texas/Florida/Utah versions blocked or on appeal as of mid-2026.)* **Don't treat any single state law as settled** — the durable, non-litigated obligation is **federal COPPA + the honest age-gate discipline above**. Verify the current status of state teen laws (and the UK Code) against the official sources below before you launch to teens.

---

## 🔴 The escalation line (copy this verbatim into your tracker)

> **If you cannot rule out under-13 users, or you're building FOR minors, or you add AI chat / companions reachable by minors — stop and get counsel.**

That third clause matters in an AI app: an AI friend, tutor, or companion that a minor can reach is exactly the kind of feature that turns "an app with a sign-up screen" into a regulated trust-and-safety product.

---

## The triage in one box

```
WHO IS YOUR APP FOR?
[ ] Adults / general-audience (13+)  → 🟢 proceed, but build the honest age gate + COPPA baseline above
[ ] Teens (13–17) as a target        → 🟡 add teen duties; verify UK Code + (volatile) US state laws; privacy review
[ ] Under 13, or "kids" as audience  → 🔴 STOP — lawyer BEFORE you build (COPPA / verifiable parental consent)
[ ] Can't rule out under-13 users    → 🔴 treat as RED until you can — get counsel
```

---

## Official sources (the source of truth — rules change, always re-check)

- **FTC — Children's privacy (COPPA) overview:** https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy
- **FTC — Complying with COPPA: FAQs** (neutral age-gate, "actual knowledge"): https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- **COPPA amended Rule** (Federal Register — dates, retention, biometrics): https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- **UK ICO — Children's Code** (Age Appropriate Design Code): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/
- **And the rest of the law:** `PRIVACY_GDPR_GUIDE.md` (the data half) and `LEGAL_GUIDE.md` (terms, age line, data declarations). `ONBOARDING_GUIDE.md` §6 has the age-gate *design* detail.

---

> ## ⚠️ One more time — this is not legal advice
> This page only helps you **pick your lane**. The teen-law landscape is moving fast and varies by country and US state; under-13 is a hard legal gate, not a setting. **When in doubt — especially if you can't rule out kids, or you're putting AI in front of minors — get a qualified lawyer before you build.**

---

*Part of the **lastmile launch guides** (`.claude/lastmile/guides/`) — plain-language launch playbooks for newbie vibe coders. See [`README.md`](README.md) for the shared preamble. **Last reviewed: 2026-06.** Children's and teens' privacy law changes and varies by jurisdiction — the official sources above are the source of truth, and this guide is not legal advice.*
