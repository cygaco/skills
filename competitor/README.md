# competitor

Size up a rival from inside Claude Code, with every claim tied to a page you can open.

## What it does

`/competitor <name or URL>` researches a competitor's product, pricing and reviews on the public web and writes a sourced brief. `/competitor compare <name or URL>` writes the same brief, reads your project, asks you up to five questions in one message, then writes a side-by-side comparison.

It is report only. It never clones, builds or copies the competitor's product, and it never changes your code. It writes only under `./competitor/` in your repo.

## What you get

Everything lands in `competitor/<slug>/` in your repo. `<slug>` is a short lowercase name the kit makes from the product name or URL.

| Mode | Files |
|---|---|
| Research | `draft.json` (the research, written by Claude), `<slug>.competitor.md` and `<slug>.competitor.html` (the brief) |
| Compare | the research files, plus `compare.json`, `<slug>.compare.md` and `<slug>.compare.html` (the comparison) |

The brief has seven sections:

1. **Product Identity**: what the product is and who it is for, in two or three sentences, sourced from its own site.
2. **Jobs to be Done**: 3–5 jobs the product does for its users, each with a one-line reason.
3. **Feature List**: name, description, build complexity (S/M/L/XL), how core it is (1–5), and the page that shows it.
4. **Voice of Customer**: customer quotes copied word for word, with sentiment, source and retrieval date.
5. **Gaps**: 3–7 weaknesses, each rated low, medium or high.
6. **Opportunities**: 3–5 openings, each pointing to the gaps or features it builds on.
7. **Source Attribution Log**: every page the run fetched or tried to fetch, with its status and retrieval time, plus every row dropped for lacking a source.

A section with nothing to show carries a visible `[GAP …]` marker instead of a guess.

The comparison covers features side by side (the competitor's yes, no or partial, and yours), the jobs you both serve, the competitor's gaps that are openings for you, pricing, two or three positioning statements, risks, and recommended next steps (advice only). It states the date of the brief it compared against, and marks any question you skipped "not answered".

Every quote and feature cites a page fetched in the session.

## How sourcing works, and its limits

Claude does the research with its own WebSearch and WebFetch tools and writes what it found to `draft.json`, including a list of every page it fetched. A script in the kit, `report.js`, then renders the reports from that file and enforces the source rules:

- A valid source is a page from that list that was fetched successfully and passes the URL check (see Safety).
- Feature rows and quotes without a valid source are dropped. The script prints how many it dropped, and the Source Attribution Log records each drop.
- Jobs, gaps and opportunities without a valid source still appear, labelled "inferred, no source", so you can tell Claude's reading from what a page said.
- Product Identity without a valid source for the product's own site shows a `[GAP …]` marker.
- In compare mode, each fact about your side cites one of your own files, by its path inside your repo, or "you said" for something from your answers. The report shows the two differently. A cited file that does not exist, or a path that reaches outside your repo, makes that row show as unverified.

The limit, stated plainly: every quote cites a page this session fetched; the engine cannot prove the quote is on that page. Claude is told to copy quotes word for word from the fetched page (never from a search summary) and to keep them short. Claude's fetch tool returns a processed reading of the page, not the raw HTML, and long quotes can be cut off. The Source Attribution Log lists each page, so you can open it and check any quote yourself.

Claude is also told to be fair: to describe what the competitor does well as plainly as what it does badly, and never to invent a quote, number, price or feature.

## Safety

- **Every URL is checked before it is fetched.** Claude runs the kit's URL check before every fetch, including links found on fetched pages, and never fetches a URL the check refuses. URLs reach the check through a file, never pasted into a shell command, so a hostile link cannot run anything. The check refuses non-http(s) links, URLs with credentials (`user:pass@`), local and internal names (`localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`), and private, loopback, link-local and other reserved IPv4 and IPv6 addresses. As a backstop, the report script will not render a source whose URL fails the check, and flags it loudly.
- **Fetched pages are data, never instructions.** If a page or review says to run a command, edit a file, change the plan or reveal something, Claude does not do it. It treats that text as material to describe.
- **Public pages only.** No logins, no forms, and no getting around paywalls or rate limits. The check does not read robots rules; when a site blocks the fetch (some big review sites do), Claude records it as failed and moves on.
- **Page text cannot act in your reports.** Text from pages is escaped in both the Markdown and the HTML report, so it cannot add scripts or links. The only links are to pages in the source list that passed the check.
- **Report only.** It writes only under `./competitor/`. It never installs packages, changes your code, commits or pushes. The kit's scripts make no network calls.
- **Your files.** In compare mode it reads what describes your product (`README*`, `PROJECT.md`, `docs/`, `package.json`, the top-level folder layout and the main pages or routes). It never opens `.env` files or anything holding secrets.
- **Known limits: DNS rebinding and redirects.** The check sees the URL Claude asked for, not where the fetch ends up. A public name that resolves to a private address, or a public page that redirects to one, is not caught by the check.
- **Known limit: a local attacker racing the writes.** The script writes only into a folder it has just checked is a real folder inside your repo, and it replaces files rather than writing through them. Someone who can change your repo's folders while the command runs could still swap one in between the check and the write. That needs write access to your machine already.
- **Not legal advice.** If a trademark, patent or copyright question comes up, it says so and suggests a lawyer.

## Install (copy-in)

Run these from the folder that contains your app's folder. `your-app` stands for your project folder. (No git? Download the repo as a ZIP and unpack it into a folder named `skills` instead of the first line.)

bash (macOS, Linux):

```bash
git clone https://github.com/<your-github-username>/skills
mkdir -p your-app/.claude/commands
cp skills/competitor/command/competitor.md your-app/.claude/commands/competitor.md
cp -r skills/competitor/kit your-app/.claude/competitor
```

Windows PowerShell:

```powershell
git clone https://github.com/<your-github-username>/skills
New-Item -ItemType Directory -Force your-app/.claude/commands | Out-Null
Copy-Item skills/competitor/command/competitor.md your-app/.claude/commands/competitor.md
Copy-Item -Recurse skills/competitor/kit your-app/.claude/competitor
```

Then confirm the install:

```
node your-app/.claude/competitor/scripts/selfcheck.js
```

It tests the kit offline, prints one line per check, and exits 0 when nothing failed.

To update later, delete `your-app/.claude/competitor` first, then copy again. Copying a folder onto one that already exists nests it inside.

## 60-second demo

```
cd your-app
claude    # starts Claude Code
```

Then type `/competitor <a product>`, using the product's name or its https URL. What happens:

1. Claude checks the target with the kit and finds the product's official site. If two different products fit the name, it asks which one you meant.
2. It fetches the home page and up to 8 pages it links to on the same site (pricing, features, docs, changelog and the like), then independent review pages found by search until 5 were fetched (trying at most 10). `--max-review-sources <1-10>` changes that number. Every URL is checked first.
3. It writes `competitor/<slug>/draft.json` and runs the report script, which writes the brief as Markdown and HTML.
4. You see five lines or fewer: the product, its top three jobs, its top three gaps, the number of sources, and the two file paths.

`/competitor compare <a product>` does the same, then reads your project, asks you up to five questions in one message (positioning, audience, pricing, what makes you different, and any constraint such as budget, team size or deadline), and writes the comparison. You see the strongest opening, the biggest risk, the recommended positioning and the two file paths.

If a brief for that product is less than 7 days old, it first asks whether to reuse it or refresh it.

What the kit's part looks like. This is real output from a real research run on Plausible Analytics (11 pages fetched, 11 quotes later re-checked against their pages); each `…` marks a cut:

```
$ node .claude/competitor/scripts/report.js check --target 'Plausible Analytics'
slug: plausible-analytics
dir: competitor/plausible-analytics/
…
$ node .claude/competitor/scripts/report.js brief --draft ./competitor/plausible-analytics/draft.json
wrote competitor/plausible-analytics/plausible-analytics.competitor.md
wrote competitor/plausible-analytics/plausible-analytics.competitor.html
rows dropped: 0
records refused: 0
gaps: 0 [GAP] markers
inferred, no source: 0 rows
```

And a few rows of the brief's feature table:

```
## 03 — Features
…
| F1 | Single-page dashboard | All key stats on one page, filterable by source, page, location, device and goal. | L | 5 | [S3](…) |
| F2 | Lightweight tracking script | A 2.5KB script added with one tag. | M | 5 | [S9](…) |
…
| F4 | Goals and custom events | Conversion goals and custom events, included from the Starter plan. | M | 4 | [S1](…) |
…
```

In the real file each `S` number links to the page it came from, and the Source Attribution Log lists every page.

## Run the renderer without Claude

From your app's root folder:

```
node .claude/competitor/scripts/report.js check-url 'https://example.com/'
node .claude/competitor/scripts/report.js check-url --file urls.txt
node .claude/competitor/scripts/report.js brief --draft ./competitor/<slug>/draft.json
```

- `check-url` takes one or more URLs, or `--file` with one URL per line (the form Claude uses). For each URL it prints `ok <url>` or `refused <url>: <reason>`, and it exits non-zero if any was refused.
- `brief` renders the brief from a draft file and writes `competitor/<slug>/<slug>.competitor.md` and `.html`. It prints how many rows it dropped for missing sources, and reports any source it refused. The draft format is described in `.claude/competitor/templates/draft.schema.md`, so you can write a draft by hand to try it.

Two more subcommands, which Claude runs for you during `/competitor`:

```
node .claude/competitor/scripts/report.js check --target '<name or URL>'
node .claude/competitor/scripts/report.js compare --draft ./competitor/<slug>/compare.json --brief ./competitor/<slug>/draft.json
```

`check` prints the slug the reports will use (and, for a URL, the normalised URL), prepares the folder `competitor/<slug>/` (refusing if it is a link or reaches outside your repo), or refuses the target with a reason. `compare` renders the comparison from `compare.json`, whose format is in the same schema file, and writes `<slug>.compare.md` and `.html`.

The scripts never touch the network. They only render what is in the draft.

## Uninstall

Delete `.claude/commands/competitor.md` and `.claude/competitor/` from your app. Optionally delete `competitor/` too; it holds your briefs and comparisons. From your app's root folder:

```bash
rm -rf .claude/commands/competitor.md .claude/competitor
```

```powershell
Remove-Item -Recurse -Force .claude/commands/competitor.md, .claude/competitor
```

## Requirements

- Claude Code, with its WebSearch and WebFetch tools available
- Node 20 or newer

Tested on Windows. CI runs Linux and Windows. macOS is untested, but the scripts are plain Node with no native code.
