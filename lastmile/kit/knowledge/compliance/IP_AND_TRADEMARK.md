---
guide: IP_AND_TRADEMARK
anchor: none
shape: walkthrough
timing: reference
lead_time: "none"
tier: standard
maps_to: [ip-trademark]
sources:
  - "https://tmsearch.uspto.gov"
  - "https://www.uspto.gov/trademarks/search/likelihood-confusion"
  - "https://www.copyright.gov/ai/"
  - "https://www.opencoreventures.com/blog/agpl-license-is-a-non-starter-for-most-companies"
---

# IP & Trademark

**Before a product launches, a compliance reviewer should flag the intellectual-property risks it can see from the spec, the brand name, the assets, and the dependency tree — an uncleared brand name that collides with an existing mark, third-party copyrighted code/text/images/fonts used without a license, an AGPL (or other strong-copyleft) dependency in a closed-source product, missing attribution on permissive-licensed code, and reliance on AI-generated output as proprietary IP — because each of these is a rebrand, takedown, forced-source-disclosure, or "you don't actually own this" risk that is cheap to flag now and expensive to discover at or after launch.** Final IP and trademark determinations are legal calls — the reviewer's job is to surface the risk with evidence and FLAG it for human/attorney confirmation, not to give legal advice or clear a mark itself.

This is a *reference for a compliance reviewer*, not legal advice. It teaches the reviewer where the common, detectable IP traps are and how to phrase a flag. Anything that requires a clearance opinion, an infringement judgment, or a licensing strategy is explicitly a **FLAG for human/attorney confirmation**.

---

## 1. What this is

This is IP-infringement-avoidance and IP-ownership hygiene across the four surfaces a reviewer can inspect:

- **Trademark** — the product/company **name** (and logo) versus existing marks. A name collision can force a rebrand after launch.
- **Copyright** — copied or unlicensed **code, text, images, icons, fonts**; plus the distinct question of whether **AI-generated output** is even copyrightable (and therefore defensible) at all.
- **Open-source license compliance** — whether the dependency tree's licenses are honored: attribution for **permissive** licenses, and the much sharper risk of **copyleft** (GPL on distribution, **AGPL on network use**) inside a closed-source product.
- **Patents** — a brief note: patent-infringement risk is an attorney task, out of scope for static review beyond flagging.

None of these are things the reviewer *decides*. The reviewer **detects the signal** (an uncleared name, an unlicensed asset, an `AGPL` in the lockfile, a missing `NOTICE`, a "this is our IP" claim over AI output) and FLAGs it with evidence so a human/attorney can make the call.

---

## 2. Why it matters

**For the product:** the failure modes here are existential rather than cosmetic. An uncleared brand name that turns out to infringe an existing mark forces a **rename** — new domain, new app-store listing, new logo, lost SEO/recognition — sometimes after you've spent on launch. Unlicensed copyrighted assets invite **DMCA takedowns** and infringement claims. An **AGPL** dependency buried in a closed-source SaaS can legally **compel you to release your source** to your users. Missing attribution on permissive code is a license breach. And building on the assumption that your AI-generated logo/copy is **proprietary IP** can mean a competitor lawfully copies it — because it may not be protectable at all.

**For the user / the company:** clean IP is what lets the company actually own and defend what it ships, and avoid being the one taken down. It's a moat question, not just a risk question.

**For a compliance review specifically:**
- This guide owns the **`ip-trademark`** vocabulary; read it with an adversarial "assume corners were cut" stance. An IP risk is a finding with a citation (an *un-licensed* real dependency included).
- The single most **mechanically detectable** item is **license risk in the dependency tree** (AGPL/GPL presence, missing attribution) — that's a real PASS/FAIL via an SCA/SBOM scan. Most everything else (name clearance, "is this asset licensed," "is this infringing") is a **FLAG for human/attorney confirmation** — the reviewer raises it with evidence for a human to confirm, never renders a legal verdict.

---

## 3. Core principles / requirements

### 3.1 Trademark — clear the name before launch

A product/company **name** should be **cleared** before it ships, because a post-launch collision forces a rebrand.

- **Search tool:** the **USPTO "Trademark Search"** at **https://tmsearch.uspto.gov** — this **replaced TESS in November 2023**. (Referencing "TESS" is itself a stale-tooling tell.)
- **Relevant software classes:** **Class 9** (downloadable software / apps) and **Class 42** (SaaS / software-as-a-service / hosted software). A software product typically needs to be clear in **both**.
- **The legal test is "likelihood of confusion"** (https://www.uspto.gov/trademarks/search/likelihood-confusion) — would a reasonable consumer be confused about the source of the goods/services? This turns on similarity of the marks (sight, **sound**, meaning) AND relatedness of the goods/services — not just an exact string match.
- **A "knockout" search is not clearance.** A quick exact-string lookup misses **sound-alikes, misspellings, and unregistered common-law marks** (a name in commercial use without a registration still has rights). Real clearance is a **comprehensive search** plus, ideally, a trademark attorney's opinion. Also check **Google / the app stores / domain availability** as practical collision signals.
- **Reviewer stance:** the reviewer can verify a **documented clearance exists** (was a real search done across classes 9+42 and the web/stores/domains?) and FLAG if it's absent — it does **not** itself clear the mark. This is a **FLAG for human/attorney confirmation**.

### 3.2 Copyright — don't ship what you don't have the rights to

- **No copied code, text, images, icons, or fonts without rights.** Pasted Stack Overflow snippets under a restrictive license, scraped marketing copy, a hero image grabbed off the web, an icon set or **font** used outside its license — each is an infringement surface. **License stock assets** (images, icons, fonts) and keep proof of the license.
- **Fonts specifically** are a frequent miss: a font file bundled or `@font-face`'d without a webfont/embedding license is unlicensed use.
- **AI-generated output is NOT copyrightable (US).** Per the **US Copyright Office, "Copyright and Artificial Intelligence, Part 2: Copyrightability" (published Jan 29, 2025)** — **prompts alone do not confer authorship or copyright**; purely AI-generated material lacks the human authorship copyright requires. Practical consequence: **AI-made assets (logos, illustrations, generated copy, generated code) are not defensible proprietary IP** — they can be lawfully copied. This is the inverse of the usual risk: not "you infringed," but "you can't claim ownership."

### 3.3 Open-source license compliance — the copyleft trap

Every third-party dependency carries a license whose terms must be honored. The risk scales with the license category:

- **Permissive — MIT / Apache-2.0 / BSD.** Generally fine for closed-source use, **but** you must **keep the attribution / copyright / license text** (and the **license headers**). **Apache-2.0** additionally grants a **patent license** and requires preserving any **`NOTICE`** file — shipping Apache code while dropping its `NOTICE` is a breach.
- **GPL (GPL-2.0 / GPL-3.0) — strong copyleft on distribution.** If you **distribute** a binary that links/includes GPL code, the combined work's source generally must be offered under the GPL. For a typical hosted SaaS that doesn't distribute a binary, GPL's distribution trigger may not fire — **but AGPL closes exactly that gap.**
- **AGPL — the "SaaS trap."** **AGPL's network clause means that merely letting users interact with the software over a network counts as "conveying"** — triggering the **source-disclosure obligation even though you never distribute a binary.** An AGPL dependency in a **closed-source hosted product** can legally compel you to **release your source to your users**. This is why **AGPL is a non-starter for most closed-source companies** (see opencoreventures.com source). Flag any AGPL (or other strong network-copyleft) dependency in a closed-source product unless it's **fully isolated** (separate process/service with no derivative linkage) or covered by a **commercial license** from the vendor.
- **Transitive risk.** The dangerous license is often **not a direct dependency** but something pulled in **transitively**. You cannot eyeball this — run an **SCA / SBOM** scan (Software Composition Analysis / Software Bill of Materials) over the full resolved tree to enumerate every license, including transitive ones.

### 3.4 Patents — flag, don't adjudicate

Patent-infringement risk (does the product practice someone's patented claim?) is **not** statically reviewable and is an **attorney task**. The reviewer notes it as out-of-scope-but-acknowledged and FLAGs only if the product is in an obviously patent-dense area or copies a patented mechanism wholesale — otherwise it's a human/legal matter, not a finding.

---

## 4. Concrete examples (compliant vs non-compliant)

**Trademark clearance — DON'T / DO**
- DON'T: pick a product name, buy the domain, and launch — having only Googled it once (or having searched only the dead **TESS** tool, or only checked an exact string).
- DO: run a **comprehensive search** on **https://tmsearch.uspto.gov** across **classes 9 + 42**, consider **sound-alikes / common-law** marks under the **likelihood-of-confusion** test, check Google/app-stores/domain, and (for anything close) get a trademark attorney's opinion → the reviewer FLAGs for human confirmation if no documented clearance exists.

**Copyrighted assets — DON'T / DO**
- DON'T: drop an unlicensed hero image, a scraped icon set, or a `@font-face` font with no embedding license into the build; paste GPL-licensed code into a closed-source file.
- DO: use **licensed** stock/assets with retained proof; use openly-licensed or self-made assets; honor each asset's license terms.

**AI-generated output as "IP" — DON'T / DO**
- DON'T: brand the product around an **AI-generated** logo and treat it as a defensible proprietary mark/asset (prompts alone confer no copyright — a competitor may lawfully copy it).
- DO: treat AI-generated assets as non-defensible by default; for anything that must be ownable IP, add **substantive human authorship** or commission original work, and FLAG the reliance as a risk.

**AGPL / copyleft dependency — DON'T / DO**
- DON'T: add an **AGPL** library (e.g., a database or a graph engine under AGPL) to a closed-source SaaS and assume "we don't distribute a binary, so we're fine" — AGPL's network clause defeats that.
- DO: detect it via the **dependency licenses / SCA scan**; remove it, replace it with a permissively-licensed equivalent, **isolate** it behind a process boundary with no derivative linkage, or buy a **commercial license** — and FLAG the decision for human confirmation.

**Permissive attribution — DON'T / DO**
- DON'T: vendor an MIT/Apache library but strip its license header / `LICENSE` / `NOTICE` text from the distribution.
- DO: preserve the license text and attribution; for **Apache-2.0**, retain the **`NOTICE`** file and respect the patent grant.

---

## 5. Common failure modes

| Failure | Why it's a risk | How the reviewer detects it |
|---|---|---|
| Brand/product name never cleared | Post-launch collision forces a costly rebrand | No documented USPTO (classes 9+42) + web/store/domain clearance for the name → FLAG |
| Clearance was only a knockout / exact-string / TESS search | Misses sound-alikes, misspellings, common-law marks | Clearance evidence is a single exact lookup or references the dead TESS tool, not a comprehensive search → FLAG |
| Unlicensed third-party image/icon/font/text | DMCA takedown / infringement claim | Asset present with no license record; font `@font-face`'d/bundled without an embedding license → FLAG |
| Copied third-party code without rights | Infringement; possible license contamination | Code blocks matching an external source with an incompatible/unknown license → FLAG |
| **AGPL** (or other strong network-copyleft) in a closed-source product | Network use triggers **source-disclosure** even without distributing a binary | Dependency license = `AGPL-*` (or similar) in the resolved tree via SCA/SBOM, no isolation/commercial license = FAIL |
| GPL dependency in a distributed binary | Distribution triggers copyleft on the combined work | `GPL-*` license on a dep that ships in a distributed artifact → FLAG/FAIL by context |
| Permissive license attribution stripped | License breach (MIT/BSD/Apache) | MIT/Apache/BSD dep present but its license header / `LICENSE` / `NOTICE` not preserved in the distribution = FAIL |
| Transitive copyleft missed | The risky license is indirect, invisible to eyeballing | Only direct deps reviewed; no SCA/SBOM over the full transitive tree → FLAG |
| Treating AI-generated output as proprietary IP | Not copyrightable (US) — competitors may copy it freely | Brand/assets/copy/code are AI-generated and claimed as owned IP, with no substantive human authorship → FLAG (minor) |
| Patent risk assumed away | Infringement is an attorney call | Product copies a patented mechanism wholesale, or sits in a patent-dense space → FLAG to attorney |

**The judgment caveat (important):** almost everything here except the **license-tree scan** is a legal determination. "Is this name confusingly similar?", "is this asset actually licensed?", "is this code infringing?", "does this AGPL use require disclosure in our exact architecture?" — the reviewer **does not answer these**. It surfaces the signal with evidence for a human to confirm. Only the dependency-license facts (a license string is or isn't AGPL/GPL; a `NOTICE` is or isn't present) are hard PASS/FAIL.

---

## 6. ✅ Agent-applicable RULES

Each rule is a PASS/FAIL (or FLAG) assertion a compliance review can apply. Format: **[ID] severity — assertion → maps_to → detection (observed vs expected).** severity ∈ {critical, serious, minor}. Items needing human/legal judgment are written as FLAGs (the reviewer surfaces them with evidence for a human to confirm).

**Trademark (name clearance — human/legal judgment → FLAG)**
- **[IP-01] serious — The product/brand name has a documented trademark clearance (a comprehensive USPTO search across classes 9 + 42 via tmsearch.uspto.gov, plus Google/app-store/domain checks), applying the likelihood-of-confusion test — FLAG if absent.** → `ip-trademark`. Detect: no clearance record for the name, OR clearance is only an exact-string/knockout search / references the dead TESS tool = FLAG (observed: name shipped with no/weak clearance; expected: documented comprehensive clearance + attorney opinion for anything close).
- **[IP-06] minor — Logo/wordmark does not visibly collide with a well-known existing mark in the same space — FLAG suspected collisions for human/attorney confirmation.** → `ip-trademark`. Detect: name/logo closely resembles a known brand in a related class = FLAG.

**Copyright (assets, code, AI output)**
- **[IP-02] serious — No third-party copyrighted code, text, images, icons, or fonts are used without a license (fonts and stock assets specifically) — FLAG assets lacking a license record.** → `ip-trademark`. Detect: asset/code present with no license/attribution record, or a font bundled/`@font-face`'d with no embedding license = FAIL/FLAG (observed: unlicensed asset; expected: licensed-with-proof or self-made/openly-licensed).
- **[IP-05] minor — Reliance on AI-generated output (logos, illustrations, copy, code) as proprietary, defensible IP is flagged — purely AI-generated material is not copyrightable (US Copyright Office, AI Part 2, Jan 29 2025; prompts alone confer no copyright).** → `ip-trademark`. Detect: brand/assets/copy claimed as owned IP are AI-generated with no substantive human authorship = FLAG.

**Open-source license compliance (mechanically detectable)**
- **[IP-03] critical — No AGPL (or other strong network-copyleft) dependency is present in a closed-source product without isolation or a commercial license — detect via dependency licenses / SCA-SBOM scan over the full transitive tree.** → `ip-trademark`. Detect: a resolved dependency's license is `AGPL-*` (or equivalent network-copyleft) AND the product is closed-source AND there's no process isolation / commercial license = FAIL (observed: AGPL dep in closed SaaS; expected: removed, replaced, isolated, or commercially licensed). AGPL's network clause triggers source-disclosure even without distributing a binary.
- **[IP-04] serious — Permissive-license (MIT / Apache-2.0 / BSD) attribution, license text, headers, and Apache `NOTICE` are preserved in the distribution.** → `ip-trademark`. Detect: a permissive dep ships with its license header / `LICENSE` / (for Apache) `NOTICE` stripped = FAIL.
- **[IP-07] serious — No GPL dependency is linked into a distributed binary without honoring its copyleft terms — FLAG distribution-context cases.** → `ip-trademark`. Detect: a `GPL-*` dep ships in a distributed artifact with no source-offer / GPL compliance = FAIL/FLAG (SaaS-only, non-distributed GPL is lower risk; AGPL is covered by IP-03).
- **[IP-08] minor — A dependency-license inventory (SCA/SBOM) exists and covers transitive dependencies, not just direct ones.** → `ip-trademark`. Detect: license review covers only direct deps with no SCA/SBOM over the transitive tree = FLAG.

**Patents (attorney scope → FLAG)**
- **[IP-09] minor — Obvious patent-infringement risk (a patented mechanism copied wholesale, or a patent-dense space) is flagged to an attorney — not adjudicated by the reviewer.** → `ip-trademark`. Detect: product reproduces a known patented mechanism, or sits in an obviously patent-heavy domain = FLAG to human/attorney.

> **Coverage note for a compliance review:** only IP-03, IP-04, IP-07, IP-08 (dependency-license facts) are hard PASS/FAIL — a license string is or isn't AGPL/GPL; a `NOTICE` is or isn't present; an SBOM does or doesn't exist. IP-01, IP-02, IP-05, IP-06, IP-09 are legal determinations the reviewer must **not** decide — they are FLAGs surfaced with evidence for a human to confirm. This guide supports detection; it is not legal advice.

---

## 7. Sources

- USPTO — *Trademark Search* — https://tmsearch.uspto.gov (the live search tool; **replaced TESS in November 2023**; search software classes **9** downloadable + **42** SaaS)
- USPTO — *Likelihood of confusion* — https://www.uspto.gov/trademarks/search/likelihood-confusion (the trademark test: similarity of marks incl. sound + relatedness of goods/services; why a knockout search ≠ clearance)
- U.S. Copyright Office — *Copyright and Artificial Intelligence, Part 2: Copyrightability* (Jan 29, 2025) — https://www.copyright.gov/ai/ (purely AI-generated output is not copyrightable; prompts alone confer no authorship/copyright)
- Open Core Ventures — *The AGPL license is a non-starter for most companies* — https://www.opencoreventures.com/blog/agpl-license-is-a-non-starter-for-most-companies (the AGPL "SaaS trap": network use triggers source-disclosure even without distributing a binary)
