# Draft file formats

`/competitor` writes two JSON files under `./competitor/<slug>/`, and the report script renders them:

- `draft.json`, the research, renders to `<slug>.competitor.md` and `.html` (`report.js brief`);
- `compare.json`, the side-by-side analysis, renders to `<slug>.compare.md` and `.html` (`report.js compare`).

Times are UTC in ISO 8601, for example `2026-11-01T09:30:00Z`. Text fields are plain text: the report escapes everything, so Markdown, HTML and links typed into a field show up as literal text, never as formatting or links. The only links in a report point to source records that pass the URL check.

## draft.json

| Field | What it holds |
|---|---|
| `generated_at` | When the research ran. Required. A brief less than 7 days old counts as fresh. |
| `target` | `slug` (copy the slug that `report.js check` printed), `name`, `url`, and `resolved_via` (how you identified the product: "the URL the user gave", "web search", ...). Needs a name or a URL. Without `slug`, the slug is made from the name, or from the URL's host when there is no name. |
| `source_records` | Every page you fetched or tried to fetch, in order. Each has `url`, `source_class` (`product`, `landing`, `devdocs`, `review` or `appimg`), `status` (`ok`, `failed` or `refused`), `failure_reason` when not ok, `length` (approximate, in characters) and `retrieved_at`. They are numbered S1, S2, ... in this order. |
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
- **Refused records.** A record whose URL fails the URL check is never shown as a source or a link, and no row may cite it. If its status is `refused`, it is listed quietly as "not fetched", which is what the command asks for. With any other status it is reported loudly, on the terminal and in the log, because it means a fetch happened that should not have.
- The engine checks that each quote cites a page this session fetched; it cannot prove the quote is on that page. Copy quotes word for word.

A section with nothing to show displays a `[GAP ...]` marker instead of a guess.

### Example

```json
{
  "generated_at": "2026-11-01T09:30:00Z",
  "target": { "slug": "acme-notes", "name": "Acme Notes", "url": "https://www.example.com/", "resolved_via": "the URL the user gave" },
  "source_records": [
    { "url": "https://www.example.com/", "source_class": "product", "status": "ok", "length": 18400, "retrieved_at": "2026-11-01T09:01:12Z" },
    { "url": "https://www.example.com/pricing", "source_class": "product", "status": "ok", "length": 9600, "retrieved_at": "2026-11-01T09:02:40Z" },
    { "url": "https://reviews.example.org/acme-notes", "source_class": "review", "status": "ok", "length": 31000, "retrieved_at": "2026-11-01T09:08:17Z" },
    { "url": "https://www.example.com/changelog", "source_class": "product", "status": "failed", "failure_reason": "HTTP 404", "retrieved_at": "2026-11-01T09:05:12Z" }
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
| `openings` | The competitor's gaps that are openings for you: `opening` and `cites` (the brief's row ids such as `G1`, or fetched URLs). |
| `pricing` | `them` (`summary` and `cites`) and `you` (`summary` and `cite`). Leave `you.summary` out when the user did not say; it shows as "not answered". |
| `positioning` | Two or three one-line positioning statements, as strings. |
| `risks` | `risk` and `cites`, like openings. A plain string is accepted. |
| `next_steps` | Recommended next steps, as strings. They are advice only. |
| `your_side` | Facts about the user's product: `fact` and `cite`. |
| `unanswered` | The questions the user skipped, as strings. They show as "not answered". |

### Your-side cites

A `cite` on your side is either the literal `you said` (a fact from the user's answers) or the path of a file in the user's repository, relative to its root, such as `README.md`, `src/app.ts`, `src/app.ts:12` or `docs/pricing.md#plans`. The report checks that the file exists inside the repository. An absolute path, a drive letter, a `..` segment, a `.env` file or a missing file shows as **unverified**, with the reason. The report shows file cites, `you said` and unverified cites differently, so a reader can tell them apart.

Their side follows the brief's rules: a status without a valid fetched page, and an opening or risk with no valid cite, are labelled "inferred, no source".

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
    { "risk": "Their capture is already fast, so speed alone will not win.", "cites": ["F1"] }
  ],
  "next_steps": [
    "Interview five users who left the competitor over pricing."
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
