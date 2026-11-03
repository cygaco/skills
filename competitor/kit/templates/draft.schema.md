# Draft file formats

`/competitor` writes two JSON files under `./competitor/<slug>/`, and the report script renders them:

- `draft.json`, the research, renders to `<slug>.competitor.md` and `.html` (`report.js brief`);
- `compare.json`, the side-by-side analysis, renders to `<slug>.compare.md` and `.html` (`report.js compare`).

Times are UTC in ISO 8601, for example `2026-11-01T09:30:00Z`. Text fields are plain text: the report escapes everything, so Markdown, HTML and links typed into a field show up as literal text, never as formatting or links. The only links in a report point to source records that pass the URL check.

## Before the drafts: the target, the folder and the URL check

Text found on the web never goes on a command line. The target and the URLs are written to a file, and only the file's path is passed:

- `report.js check --target-file <file>` reads the target from the file's first non-blank line (at most 300 characters). `--target "<name or URL>"` still works for a name you type yourself.
- `report.js check-url --file <file>` reads one URL per line. Lines are trimmed; blank lines and lines starting with `#` are skipped. At most 200 URLs are checked per file; each URL past the 200th prints `refused <url>: not checked; ...`, so put the rest in another file. It prints `ok <url>` or `refused <url>: <reason>` per URL and exits 2 if any was refused. URLs given as arguments still work when you run it by hand.
- The file must resolve, links included, to a regular file inside the repository (the folder you run the script from) and be at most 64 KB. Anything else is refused with exit 2.

`check` prints `slug: <slug>`, for a URL also `url: <normalised URL>`, and then `dir: competitor/<slug>/`. Before it prints the slug it makes sure `competitor/` and `competitor/<slug>/` exist as real folders inside the repository, creating them when they are missing. If either one is a symbolic link or junction, is not a folder, or resolves outside the repository, `check` prints only `refused: <reason>` and exits 2. Write `draft.json`, `compare.json` and URL list files only into that prepared folder. `brief` and `compare` check the same folder again before they write.

A URL longer than 2048 characters is refused ("URL too long").

## draft.json

| Field | What it holds |
|---|---|
| `generated_at` | When the research ran. Required. A brief less than 7 days old counts as fresh. |
| `target` | `slug` (required: copy the slug that `report.js check` printed), `name`, `url`, and `resolved_via` (how you identified the product: "the URL the user gave", "web search", ...). Needs a name or a URL besides the slug. A draft without `slug` is refused. |
| `source_records` | Every page you fetched or tried to fetch, in order. Each has `url`, `source_class` (`product`, `landing`, `devdocs`, `review` or `appimg`), `status` (`ok`, `failed` or `refused`), `failure_reason` when not ok, and `retrieved_at`. `length` (in characters) is optional: give it only if your fetch tool reports one, and leave it out otherwise; the Length column is blank without it. They are numbered S1, S2, ... in this order. |
| `product_identity` | `summary` (what it is and for whom, in two or three sentences) and `cites` (a list of URLs). |
| `jtbds` | Jobs to be done: `job`, `why` (one line) and optional `cites`. Numbered J1, J2, ... |
| `features` | `name`, `description`, `complexity` (`S`, `M`, `L` or `XL`), `coreness` (1 to 5) and `evidence_url`. Numbered F1, F2, ... |
| `voc` | Voice of customer: `quote` (word for word), `sentiment`, `source_url` and `retrieved` (the date). Numbered Q1, Q2, ... |
| `gaps` | Weaknesses: `gap`, `severity` (`low`, `medium` or `high`) and optional `cites`. Numbered G1, G2, ... |
| `opportunities` | `opportunity` and optional `cites`: URLs, or the ids of the rows it builds on (`G1`, `F2`, `J3`, `Q1`). Numbered O1, O2, ... |

### What counts as a source

A cite is valid only when it matches a `source_records` entry with status `ok` whose URL passes the URL check (`report.js check-url`). The match ignores a `#fragment` and a trailing slash.

- **Features and quotes need one.** A feature whose `evidence_url`, or a quote whose `source_url`, is not a valid cite is dropped, and the drop is listed in the Source Attribution Log.
- **Jobs, gaps and opportunities may go without.** A row with no valid cite still shows, labelled "inferred, no source". An opportunity counts as sourced when it cites a fetched page, or a row that is itself sourced.
- **The product identity needs a page from the product's own site:** an ok record whose `source_class` is `product`, `landing` or `devdocs`. Without one, the summary is not shown and a `[GAP ...]` marker takes its place.
- **Records that were not fetched.** The Source Attribution Log lists them under their own headings: "Refused by the URL check (not fetched)" for status `refused` (the check said no, so no fetch happened, which is what the command asks for), "Fetch failed" for status `failed` (the fetch ran and the site said no, for example HTTP 403, or it timed out), and "Other records" for a missing or unknown status.
- **Records the URL check refuses.** A record whose URL fails the URL check is never shown as a source or a link, and no row may cite it. If its status is `refused`, it is listed quietly as above. With any other status it is reported loudly, on the terminal and in the log, because it means a fetch happened that should not have.
- The engine checks that each quote cites a page this session fetched; it cannot prove the quote is on that page. Copy quotes word for word.

A section with nothing to show displays a `[GAP ...]` marker instead of a guess.

### Size limits

A draft file (and `compare.json`) larger than 5 MB is refused. Each text value is cut to 8,192 characters when the file is read, and a cut value never passes a check (a URL, a status, a slug or a path). A report shows at most 4,000 characters of any one text.

### Example

```json
{
  "generated_at": "2026-11-01T09:30:00Z",
  "target": { "slug": "acme-notes", "name": "Acme Notes", "url": "https://www.example.com/", "resolved_via": "the URL the user gave" },
  "source_records": [
    { "url": "https://www.example.com/", "source_class": "product", "status": "ok", "retrieved_at": "2026-11-01T09:01:12Z" },
    { "url": "https://www.example.com/pricing", "source_class": "product", "status": "ok", "retrieved_at": "2026-11-01T09:02:40Z" },
    { "url": "https://reviews.example.org/acme-notes", "source_class": "review", "status": "ok", "retrieved_at": "2026-11-01T09:08:17Z" },
    { "url": "https://reviews.example.net/acme-notes", "source_class": "review", "status": "failed", "failure_reason": "HTTP 403", "retrieved_at": "2026-11-01T09:09:30Z" },
    { "url": "http://192.168.1.10/admin", "source_class": "landing", "status": "refused", "failure_reason": "the URL check refused it: IPv4 192.168.0.0/16 (private)", "retrieved_at": "2026-11-01T09:05:40Z" }
  ],
  "product_identity": {
    "summary": "Acme Notes is a shared note-taking app for small teams, sold per seat after a free tier.",
    "cites": ["https://www.example.com/", "https://www.example.com/pricing"]
  },
  "jtbds": [
    { "job": "Keep a team's notes in one place", "why": "Team spaces are the paid tier's headline.", "cites": ["https://www.example.com/pricing"] }
  ],
  "features": [
    { "name": "Team spaces", "description": "Shared folders with per-space permissions.", "complexity": "L", "coreness": 4, "evidence_url": "https://www.example.com/pricing" }
  ],
  "voc": [
    { "quote": "Per-seat pricing gets expensive past ten people.", "sentiment": "negative", "source_url": "https://reviews.example.org/acme-notes", "retrieved": "2026-11-01" }
  ],
  "gaps": [
    { "gap": "Pricing climbs steeply for teams past ten seats.", "severity": "medium", "cites": ["https://reviews.example.org/acme-notes"] }
  ],
  "opportunities": [
    { "opportunity": "Flat team pricing for groups of ten to fifty.", "cites": ["G1", "F1"] }
  ]
}
```

## compare.json

| Field | What it holds |
|---|---|
| `generated_at` | When the comparison was written. Required. The report states the brief's date next to it. |
| `features` | One row per feature: `name`, `them` (`status`: `yes`, `no` or `partial`, and `evidence_url`, a fetched page from the brief) and `you` (`status`, and `cite`). |
| `jobs_overlap` | The brief's jobs you also do: `job`, `overlap` (`full`, `partial` or `none`) and `note`. A plain string is accepted as a job. |
| `openings` | The competitor's gaps that are openings for you: `opening` and `cites` (the brief's row ids such as `G1`, fetched URLs, or files in the user's repository). |
| `pricing` | `them` (`summary` and `cites`: fetched URLs or row ids) and `you` (`summary` and `cite`). Leave `you.summary` out when the user did not say; it shows as "not answered". |
| `positioning` | Two or three one-line positioning statements, as strings. |
| `risks` | `risk` and `cites`, like openings: a risk grounded in the user's own code cites that file. A plain string is accepted. |
| `next_steps` | Recommended next steps, as strings, or as objects with `text` and optional `cites` like risks. They are advice only. |
| `your_side` | Facts about the user's product: `fact` and `cite`. |
| `unanswered` | The questions the user skipped, as strings. They show as "not answered". |

### Your-side cites

A `cite` on your side is either the literal `you said` (a fact from the user's answers) or the path of a file in the user's repository, relative to its root, such as `README.md`, `src/app.ts`, `src/app.ts:12` or `docs/pricing.md#plans`. The report checks that the file exists inside the repository. An absolute path, a drive letter, a `..` segment, a `.env` file, a path over 1,024 characters or a missing file shows as **unverified**, with the reason. The report shows file cites, `you said` and unverified cites differently, so a reader can tell them apart.

Openings, risks and next steps may cite such files too, next to row ids and fetched URLs. A cite that does not start with a URL scheme (`https:`, ...) is read as a path and checked the same way: a valid one shows as a verified file cite, an invalid one as **unverified**. Neither is ever labelled "inferred, no source" or "refused by the URL check".

### Their side

Their side follows the brief's rules. A feature's competitor status shows only with an `evidence_url` that is a valid cite. When `evidence_url` is missing, is not text, is refused by the URL check, or matches no ok source record, the Them column reads "— (no source)" instead of the claimed status, your side of the row is kept, and the drop is listed under Dropped rows in the Sources section and counted in the script's "rows dropped" line. An opening or risk with no valid cite is labelled "inferred, no source".

### Example

```json
{
  "generated_at": "2026-11-03T10:00:00Z",
  "features": [
    { "name": "Team spaces", "them": { "status": "yes", "evidence_url": "https://www.example.com/pricing" }, "you": { "status": "no", "cite": "you said" } },
    { "name": "Quick capture", "them": { "status": "yes", "evidence_url": "https://www.example.com/" }, "you": { "status": "yes", "cite": "src/editor.ts" } }
  ],
  "jobs_overlap": [
    { "job": "Keep a team's notes in one place", "overlap": "none", "note": "No team features yet." }
  ],
  "openings": [
    { "opening": "A flat price for small teams.", "cites": ["G1"] }
  ],
  "pricing": {
    "them": { "summary": "Free tier, then a per-seat monthly price.", "cites": ["https://www.example.com/pricing"] },
    "you": { "summary": "Free while in beta.", "cite": "you said" }
  },
  "positioning": [
    "Fast capture for freelancers, without team overhead.",
    "Flat pricing that does not punish growth."
  ],
  "risks": [
    { "risk": "Their capture is already fast, so speed alone will not win.", "cites": ["F1"] },
    { "risk": "Your sync has no conflict handling yet.", "cites": ["src/sync.ts"] }
  ],
  "next_steps": [
    "Interview five users who left the competitor over pricing.",
    { "text": "Add conflict handling to sync before launch.", "cites": ["src/sync.ts"] }
  ],
  "your_side": [
    { "fact": "A notes editor for freelancers.", "cite": "README.md" },
    { "fact": "Targets freelancers, not teams.", "cite": "you said" }
  ],
  "unanswered": [
    "What budget and team size do you have?"
  ]
}
```
