# twin file formats

This file is the contract between the `/twin` command, the `twin` agent and the scripts in `.claude/twin/scripts/`. The scripts check these formats.

## The twin/ folder (your files)

`node .claude/twin/scripts/setup.js init` creates it at the repository root. It never overwrites a file that exists.

| File | What it holds | Ignored by git |
|---|---|---|
| `twin/policy.md` | Decision classes, red lines, spend limit, scoring rubric | no (your choice) |
| `twin/stage.md` | What the project is, its stage, wins, priorities, what to avoid | no (your choice) |
| `twin/judgment.md` | How you decide: principles, heuristics, corrections, confidence | no (your choice) |
| `twin/notes.md` | Optional: your own notes for the twin to learn from. You create it; setup does not, and no script writes it (see mine.js) | no (your choice) |
| `twin/ledger.jsonl` | Every verdict, and what you said when you overruled one or answered an escalation | yes |
| `twin/evidence.md` | What `/twin` extracted from the ledger and notes when learning (chat history appears only as counts and references, never as text) | yes |
| `twin/proposals.md` | Proposed changes to `twin/judgment.md`, waiting for you to accept or reject them in `/twin` | yes |
| `twin/proposals-archive.md` | Every proposal after it was accepted, rejected or flagged, kept until you delete it | yes |
| `twin/inbox-<8 hex>.json` | One input Claude writes for one script call; the script reads it once and deletes it (see "Input files") | yes |
| `twin/.gitignore` | Ignores the five files marked yes above | no |

The `twin/.gitignore` written by setup is exactly:

```
# twin (local-only files: verdicts, mined evidence, proposals)
ledger.jsonl
evidence.md
proposals.md
proposals-archive.md
inbox-*.json
```

## Exit codes (every script)

| Code | Meaning |
|---|---|
| 0 | done |
| 1 | a check found problems (each printed as `line N: reason` or `file: reason`) |
| 2 | refused or usage error, or an error from the file system (see below) |
| 3 | ask the user (a red-line question, or a reply that could not be read as a verdict) |

What exit 2 leaves behind:

- Every refusal check runs before the first write, so a refusal or a usage error writes nothing, except when a file or folder is swapped while a script runs (see the limit under "Redaction and file safety"). An inbox file given with `--file` is still deleted (see "Input files").
- Every write that replaces a file (`setup.js answers`, `complete` and `rule --apply`, `mine.js`, and each of the three writes of `proposals.js apply`) goes to a temporary file first and is moved into place only when it is complete, so an error in it leaves that file as it was.
- Three commands write more than one file, one after another, and can stop part way (on an error from the file system, such as a full disk, or on a file or folder swapped while they run). The writes made before that stay: `setup.js init` (the files it created stay, and the one it was writing when it stopped can be cut short: on a first setup, delete `twin/` and run init again), `setup.js answers` (`twin/stage.md` can be written without `twin/policy.md`; run it again with the same answers) and `proposals.js apply` (the archive, or the archive and `twin/judgment.md`, can be written without the files after them; run the same apply again: it finishes the rest, and archives, applies and logs nothing twice).
- An error from the file system while a line is appended to `twin/ledger.jsonl` can leave part of that line; `ledger.js check` names it (`line N: reason`).

No script reads the network. The scripts start no other program. Text from you or from the agent never goes through a shell: not as a command-line argument and not in a heredoc.

## Input files

Claude first runs `node .claude/twin/scripts/ledger.js inbox`, which checks that `twin/` is a real folder inside the repository, that everything in it is a regular file (no link, junction or folder, whatever its name; each entry is looked at with lstat only, never followed or opened) and that each file the twin reads there (`judgment.md`, `policy.md`, `stage.md`, `ledger.jsonl`) that exists has one hard link. It also reads `.claude/agents/twin.md` and checks every file listed under its "On every call, read these first" heading, and the root `CLAUDE.md`: each one that exists must be a regular file with one hard link, with no link or junction on the way to it. Only when `.claude/agents/twin.md` does not exist (and `.claude` and `.claude/agents` are each absent or a real folder) does it check the files the agent ships with instead (`twin/judgment.md`, `twin/policy.md`, `twin/stage.md`, `CLAUDE.md`, `twin/ledger.jsonl`). An agent file that is there but is a link, a junction, a hard link or unreadable, or has no numbered list of files under that heading, and a `.claude` or `.claude/agents` that is a link or not a folder, are refused (exit 2). It then reads `twin/.gitignore` and refuses unless that file ignores `inbox-*.json`. Then it creates an empty, regular file, exclusively, with an unguessable name, `twin/inbox-<8 hex>.json`, and prints `inbox ready: <that path>`. Claude writes one JSON object to exactly that path with its own file-writing tool, and runs the script with `--file <that path>`. The script reads the file once and deletes it (also when it refuses the input), so each input is screened against its own text even when two consults run at once. A second use of the same path is refused (exit 2), and an inbox name under a linked `twin/` is refused with nothing deleted. The command line then holds only fixed words, so nothing in the text can be read by the shell. A script also accepts the same JSON on stdin, for your own scripting.

An inbox file holds its text (a question and a reply, your words, or your setup answers) in plain text, not redacted, from Claude's write until the script reads and deletes it. If a run crashes in between, or Claude never passes the file to a script, one git-ignored `twin/inbox-<8 hex>.json` stays in `twin/` with that text until you delete it. The file sits in your repository folder, so anything that copies that folder, such as sync or backup, can copy it. The same text is already in Claude Code's own record of the session. Never paste a secret or personal data into a question; describe it instead (for example "the staging database password").

| Script call | JSON object |
|---|---|
| `ledger.js add` | `{"question": "<the question, as asked>", "reply": "<the twin's reply, as returned>"}` |
| `ledger.js outcome <id> overruled` / `answered` | `{"note": "<what you said, in your words>"}` |
| `setup.js answers` | the answers object (see setup.js) |
| `verdict.js parse` | `{"reply": "<the twin's reply>"}` |
| `verdict.js screen` | `{"text": "<any text>"}` |

`mine.js` takes no input file: it reads your notes only from `twin/notes.md` (see mine.js).

A missing key, an unknown key or a value that is not a string (except in the answers object) is refused with exit 2, and nothing is written. `--file` accepts only an inbox file: a name `inbox-<8 hex>.json` (8 lowercase hex characters) directly in `twin/`, the path `ledger.js inbox` printed, and the file there must be a regular file, not a link. Any other `--file` path is refused by its text (exit 2), with no file-system call on it: it is never read and never deleted.

## Verdict reply (from the twin agent)

Exactly one block, each field on its own line as `NAME: value`, in this order:

| Verdict | Fields |
|---|---|
| DECIDE | DECISION, CLASS (A or B), CONFIDENCE, ANSWER, REASONING, PRECEDENT |
| DIRECTIVE | DECISION, CONFIDENCE, ACTION, REASONING, PRECEDENT, TRIGGER |
| ESCALATE | DECISION, CLASS (A, B or C), CONFIDENCE, REASON, RECOMMENDATION, SUGGESTED_QUESTION |

- CONFIDENCE is a number from 0 to 1 with up to two decimals.
- A code fence around the block is allowed and ignored. A field value may continue on following lines until the next field name.
- PRECEDENT is `none`, or one or more ledger ids separated by commas or spaces.
- `verdict.js parse` treats the reply as unreadable (exit 3) when: no DECISION line; an unknown verdict; a required field missing or empty; a field given twice; an unknown CLASS; a CONFIDENCE that is not a number from 0 to 1 with up to two decimals; DECIDE with CLASS C; DECIDE below 0.70; DIRECTIVE below 0.75; more than one block; any field name that is not in its verdict's list, or any `NAME:` line outside the block. Fence lines are ignored. Text before the DECISION line is ignored by the parser, but the screen still reads it.

## The red-line screen

`verdict.js screen` reads text and answers `pass` (exit 0) or `ask-user: <the phrase it matched>` (exit 3). `ledger.js add` runs it before the main agent acts, on the whole question and the whole reply (every field, including REASONING, and any text around the block), so a DIRECTIVE to push asks even when the question was a plain "what next?". It only ever asks; it never turns an ESCALATE into anything else. Text longer than 20,000 characters asks without being matched (`too long to screen`).

Before matching, the text is normalised: Unicode NFKC, every default-ignorable (invisible) character, every combining mark and every control character that is not white space removed, common Cyrillic, Greek and other look-alike letters mapped to Latin ones, lower case, and runs of spaces collapsed. It is also read in other ways (invisible characters as spaces; capital I and its look-alikes as l after a lower-case letter or at the start of a word before one, as in `depIoy`; and capital I and its look-alikes also as l inside upper-case words, as in `DEPIOY`), and it asks if any reading matches; when the text holds an invisible character, the words of a phrase may also be read run together ("privatekey" as private key). It then matches words and phrases on word boundaries; a few checks read word by word (options before a subcommand, the target of rm or delete, curl uploads, and email followed by a person). Words that are also everyday programming words (post, token, release, drop, merge, charge, license) count only inside a phrase that makes the risky meaning clear, and a few words have code-sense exceptions ("the published API", a health check or health endpoint, the passport.js library). When nothing matches, a text that holds a default-ignorable code point (zero-width space, joiner, non-joiner, word joiner, soft hyphen, byte-order mark, bidi controls and every other one) or a control character other than tab, line feed and carriage return, directly between two letters or digits, still asks, in its own group `hidden-characters` (`ask-user: an invisible or control character between letters`); a combining mark counts as part of the letter it sits on (the check drops every combining mark that is not itself default-ignorable first), so an accent on either side of the character cannot hide it; such a character next to a space, at the start, or between emoji does not ask, and text in a script that joins letters this way (Persian with a non-joiner, or an Indic script with a joiner after a virama, for example) asks. The phrase printed after `ask-user:` shows only text that the redacted copy of the text still holds: when redaction changes the text, the phrase is looked up again in the redacted copy, and if it is not there the screen prints `a phrase that touches redacted text`.

The screen is a best-effort backstop behind the twin's own red-line floor. It catches only the phrasings listed below; every example written in backticks in the table asks, every list written "(one of: ...)" is the exact, closed list the code uses, and nothing else is promised. "Known gaps", below the table, lists the shapes it is known to miss. A wording outside this list rests on the agent's own red-line floor and on Claude Code's permission prompt, where your settings ask for one. It reads only the question the main agent wrote and the twin's reply.

The real guard for pushes, deletes, deployments and payments is Claude Code's own permission prompt. It appears only when your permission settings ask for that command: an allow rule for the command, or a mode that skips prompts (for example auto or bypass permissions), means no prompt. Keep prompts on for pushes, deletes, deployments and payments. A screen miss means Claude may act on the twin's verdict without asking you first; it does not run anything by itself, and the command then gets a permission prompt only if your settings ask for one.

What the screen is tested to catch, by floor item (letters outside the look-alike table above are not mapped). Limits that hold for every row: a text over 20,000 characters asks without being matched; the word-by-word checks look at most 40 words past their command word; "within n words" means at most n other words in between; a list written "(one of: ...)" is closed, and its letter case does not matter.

| Floor item | What the screen is tested to catch, with its limits |
|---|---|
| Deleting or overwriting | a file verb (file verbs (one of: rm, rmdir, unlink, shred, remove-item, del, erase, erases, erased, erasing, trash, delete, deletes, deleted, deleting, remove, removes, removed, removing, overwrite, overwrites, overwriting, overwritten, overwrote)), also with a path before it (`/bin/rm notes.txt`), followed by its target, after any options (words that start with a hyphen): a file name with an extension, a path with a slash, a backslash or a tilde, a known file name without an extension (known file names (one of: README, LICENSE, LICENCE, Makefile, GNUmakefile, Dockerfile, Containerfile, CHANGELOG, COPYING, CONTRIBUTING, CODEOWNERS, Procfile, Gemfile, Rakefile, Jenkinsfile, Vagrantfile, Brewfile, Pipfile, Justfile, Podfile, Gulpfile, Gruntfile)), or a quoted name of any length that holds one of these, opened within the 40 words, with no space right after its opening quote mark (the straight, curly, low, reversed and angle double quotes, the straight, curly, low and reversed single quotes, and the backtick: quote marks (one of: U+0022, U+201C, U+201D, U+201E, U+201F, U+00AB, U+00BB, U+0027, U+2018, U+2019, U+201A, U+201B, U+0060)); a quoted name ends at the first later word that closes the same kind of quote, and a quoted word is a name, never an option (`delete "-draft.txt"`); after a double hyphen, the next word, whatever it is (`rm -- notes`); PowerShell's colon form takes the part after the colon as the target (path parameters (one of: -Path:, -LiteralPath:, -LP:, -PSPath:)) (`Remove-Item -Path:README`); after rm, rmdir, unlink, shred or Remove-Item the first word after the options is the target whatever it is (any quoted name of several words too), unless it is a code word such as helper or test; after the other file verbs the target may come after at most three other words, none of them ending in a question mark, an exclamation mark, a full stop, a semicolon, a colon or a comma; SQL TRUNCATE with a plain table name (letters, digits, underscores, dots and dollar signs, but not a dollar sign first; optionally in straight quotes, backticks or brackets: `TRUNCATE orders;`) or a double-quoted name of any length that may hold spaces and doubled quotes (double quotes (one of: U+0022, U+201C, U+201D, U+201E, U+201F, U+00AB, U+00BB)) (`TRUNCATE "order items";`), at the end of the statement (before a semicolon, a comma, a question mark, an exclamation mark, a full stop, a closing parenthesis or the end of the text) or before CASCADE, RESTART or CONTINUE; `TRUNCATE TABLE`, `TRUNCATE ONLY`; DROP and TABLE, DATABASE, SCHEMA, INDEX, VIEW, COLUMN, COLLECTION or KEYSPACE (`DROP TABLE orders`); ALTER TABLE and DROP within three words (`ALTER TABLE orders DROP COLUMN note`); `DELETE FROM`; kubectl and delete or drain within four words (`kubectl delete`, `kubectl drain node-1`) and helm and uninstall or delete within three words (`helm uninstall`, `helm delete web`), also after options and their values, except some quoted values (see the known gaps); terraform, tofu, pulumi or cdk and destroy within three words (`terraform destroy`); force-push, `push -f`, `push --force`; `git reset --hard` or `git reset --keep`; `rm -rf`, `rm -r`, `rm -f`; `Remove-Item -Recurse` or `Remove-Item -Force`; `rimraf`; `git clean -f`; `git branch -D`; rewriting history (within two words); discard, in that form only, and changes, work, edits or commits within two words (`discard the changes`); irreversible; cannot be undone; permanently deleting, removing or erasing; drop, delete, truncate, wipe, purge, overwrite, erase, destroy or nuke within four words before data, table, database, records, branch, history, production, backups or users, or such a word within three words before the verb |
| Pushing, deploying, publishing, sending | git and push within eight words, and git push after options and their values, except some quoted values (see the known gaps) (`git push`, `git -C repo push`); push and origin or upstream within three words; push to, into or onto main, master, origin, a remote or production (within four words, with an optional the, a, an, our, my, your, their, that or this before it); push it, this, now, up or the changes; push as the last word; merge into main, master, trunk, production or release (within four words); merge the PR or the pull request; deploy, redeploy, deployment; publish, unpublish, published (except "the published API" and the like); cut a release, release it, release to, a new release, release v1, release the package, the app or a version, tag or ship a release; go live; ship to production, users or customers (within three words), ship it; production or prod migration (within two words, or migrate within three words before production or prod); kubectl and apply, rollout, replace, patch, scale or create within four words (`kubectl apply -f app.yaml`) and helm and install, upgrade or rollback within three words (`helm upgrade web ./chart`), also after options and their values, except some quoted values (see the known gaps); terraform or tofu and apply within three words (`terraform apply`), pulumi and up within two words (`pulumi up`); docker and push within three words (`docker push app`); `vercel prod`; DNS, nameservers; roll out; send a message, report, email or file (within three words) and then to (within four words); send and to @handle within six words; send emails, newsletters, SMS, text messages, notifications or invites (within three words); upload and to within four words; email, also with I, i, L or l as either of its last two letters (`EmaiI him`, `EmaII them`, `EMAII us`), followed by a pronoun (pronouns (one of: him, her, them, me, us, you, it, yourself, yourselves, myself, ourselves, himself, herself, themselves, everyone, everybody, someone, somebody, anyone, anybody, people, others, both, all, each other, one another, whoever, whomever)), by an address (a local part of 1 to 64 characters, or a double-quoted one of 1 to 64 characters that may hold spaces and backslash escapes but no @, then an @ and, right after it, a letter, a digit or the opening bracket of a bracketed domain: `Email a@[192.0.2.1]?`), by an @handle, or, read with its letter case kept, by a capitalised name (a capital and more letters, a capital, an apostrophe and a letter, or a capital alone other than I); email the users, customers, subscribers, list, clients, everyone or people; mass email, email blast, newsletter; post on or to a site within three words (sites (one of: social, Twitter, X, LinkedIn, Reddit, Hacker News, Facebook, Instagram, Pinterest, Mastodon, Bluesky, Threads, TikTok, YouTube, Discord, Slack, forum, blog, Product Hunt, Tumblr, Weibo, Snapchat, VK, WhatsApp, Telegram, WeChat, Medium, Quora, Truth Social, Lemmy, Pixelfed, Flickr, Nextdoor, Stack Overflow)); tweet; social media post; notify the users, customers or subscribers; make it public; open source it; curl with -T or --upload-file (`curl -T notes.txt`), or with -d, a --data option, -F or --form and an @file value, alone or after a name and = (`curl -d @notes.txt`, `curl -F file=@notes.txt`) |
| Spending | a currency sign (signs (one of: $, €, £, ¥, ₹, ₽, ₩, ₪, ₺, ₱, ₫)) before a number, glued or after one space, also before a decimal point (`$30`, `$ 30`, `$.50`); a dollar prefix (dollar prefixes (one of: US$, USD$, AU$, AUD$, CA$, CAD$, NZ$, NZD$, HK$, HKD$, SG$, SGD$, NT$, MX$)) before a number or a decimal point, glued or after one space (`US$.50`, `US$ .50`), or before a word after a code (below); an amount (digits with a comma or a dot between groups, or a leading decimal point) followed, glued or after one space, by a sign that may follow a number (signs after a number (one of: $, €, £, ¥, ₹, ₽, ₩)), with or without a dollar prefix before it (`100$`, `.50€`, `1,000.50€`, `100US$`, `1,000 US$`); a currency code (codes before a number (one of: USD, EUR, GBP, CAD, AUD, NZD, CHF, JPY, CNY, RMB, INR, HKD, SGD, SEK, NOK, DKK, PLN, CZK, HUF, RUB, BRL, MXN, ZAR, KRW, ILS, AED, SAR, THB, IDR, MYR, VND, NGN, EGP, PKR, ARS, CLP, UAH, BGN, ISK, TWD, KES, BTC, USDC, USDT)) before a number or a decimal point (`USD 500`, `USD .50`), or before a number or quantity word, with an optional a or an (words after a code (one of: one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty, thirty, forty, fifty, sixty, seventy, eighty, ninety, hundred, hundreds, thousand, thousands, million, millions, billion, billions, dozen, few, several, couple)) (`USD one hundred`, `USD several hundred`, `GBP a few`); an amount followed by a currency code (codes after a number (one of: USD, EUR, GBP, CAD, AUD, NZD, CHF, JPY, CNY, RMB, INR, HKD, SGD, SEK, NOK, DKK, PLN, CZK, HUF, RUB, BRL, MXN, ZAR, KRW, ILS, AED, SAR, THB, IDR, MYR, VND, NGN, EGP, PKR, ARS, CLP, UAH, BGN, ISK, TWD, KES, BTC, ETH, USDC, USDT)) or a currency name (currency names (one of: dollar, dollars, bucks, euro, euros, pound, pounds, quid, cent, cents, pence, yen, yuan, renminbi, rupee, rupees, franc, francs, zloty, zlotys, zloties, zlote, zlotych, krona, kronor, kronur, krone, kroner, koruna, koruny, korun, forint, forints, ruble, rubles, rouble, roubles, lira, liras, lire, peso, pesos, shekel, shekels, dirham, dirhams, riyal, riyals, rial, rials, baht, ringgit, ringgits, rupiah, rupiahs, naira, nairas, hryvnia, hryvnias, reais, bitcoin, bitcoins)), with an optional k or m between (`500 CAD`, `.50 dollars`, `5k USD`); a number word (number words (one of: a, an, one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve, thirteen, fourteen, fifteen, sixteen, seventeen, eighteen, nineteen, twenty, thirty, forty, fifty, sixty, seventy, eighty, ninety, hundred, hundreds, thousand, thousands, million, millions, billion, billions, dozen, few, several, couple, some)) and up to four more number words or "and", then a currency code or name (`two hundred and fifty euros`, `a few bucks`); bucks; fee or fees; monthly, annual, yearly or weekly prices, pricing, charges, costs, plans, subscriptions, billing or rates; what we charge, how much to charge, charge per; our price, prices or rates; prices to a number or a number word; raising, increasing, lowering or doubling prices or rates; renting a server (at most one other word before server); cost to users, users pay; purchase, buy, bought; signing up for, to, with or at; creating an account on, with or at; register, in that form only, and domain or account, with an optional a or the between (`Register a domain?`); a paid plan, tier, account, version, subscription, service, API, seat or add-on; upgrading a plan, tier, subscription or account (within two words), or upgrading to pro, premium, team, business, enterprise, paid or plus; billing, billed, bill the customer, user or card; charging a card, a customer, a user, an account, a client or them; refunds; subscriptions; subscribing to a paid plan or service; credit cards; invoices; paying for something; pay, in that form only, and the, a or an and bill, invoice, fee or vendor (`Pay the bill?`); spending money, budget, credits, cash, funds or a currency (within two words); API credits; top up; costs money |
| Credentials and secrets | password, passkey, credential, API key, an access, auth, authentication or session token, JWT, private key, `.env`, `~/.ssh`, `id_rsa`, `id_ed25519`, `.npmrc`, npm login, signing certificate (the bare words access and auth, with no token, are not caught) |
| Payments, pricing, legal, compliance | NDA, non-disclosure agreement; signing or accepting a contract, agreement or deal (within four words); license or licence terms; adopting or switching to MIT, Apache, GPL or BSD; GDPR, privacy policy, compliance, legal; the pricing page; adding payments |
| Personal data | health, medical, patient, diagnosis, SSN, passport number, date of birth, full name, salary, home address, fingerprints, biometric data, PII, personal data, user or customer data, email addresses of users; exporting or sharing users, members, customers or records (within three words) |
| Going against a rule in `CLAUDE.md`; changing what users see, get or are promised | model-only (only the agent can judge these; no screen) |

Known gaps. Known misses are shapes the screen does not catch that the table could be read to cover; there is one line per kind below. Each of them, and any other wording, rests on the twin's own red-line floor and on Claude Code's permission prompt, where your settings ask for one:

- File names: a name with no extension, slash, backslash or tilde that is not a known file name; an unquoted name with spaces (`rm test notes.txt` reads only `test`, a code word); a code word right after rm or its kin (`rm helper`).
- A quoted file name of several words with a space right after its opening quote mark (`rm ' test notes.txt'`, `del " a b c d e.txt"`).
- A quote that no later word closes with the same kind of quote.
- A target after more than three other words, or past a word that ends in punctuation, after a file verb other than rm and its kin; a file verb that ends a sentence (`Delete?`).
- A target, subcommand or upload more than 40 words after its command word.
- A `TRUNCATE` table name that starts with `$`, plain or in single quotes, backticks or brackets (`TRUNCATE $a;`).
- `TRUNCATE` with a single-quoted, backtick-quoted or bracketed name that holds a space or another character outside letters, digits, `_`, `.` and `$`, or with a clause after the name other than CASCADE, RESTART or CONTINUE.
- A quoted option value with spaces before a helm, kubectl or git subcommand (`helm --kubeconfig "a b c" uninstall x`, `kubectl --context=x --kubeconfig="a b" delete ns x`, `git -C "a b.c.d.e.f.g.h" push -q --force r HEAD`).
- `curl.exe`.
- Word forms: a verb the table gives in one form only, in another form (`Discarding changes?`, `Registering a domain?`, `Paying the bill?`), and register before an (`register an account`).
- Email: email followed by a lower-case name or by I alone; a local part longer than 64 characters; a quoted local part that holds `@` (`Email "a b@c"@example.com?`); a space right after the `@` (`Email a@ b.com?`); email spelled with another look-alike (a digit 1 for its l, for example).
- A pronoun, a site, a sign, a dollar prefix, a code, a currency name or a number word that is not on its list, for example `$ one hundred` or `€ fifty` (a sign before a number word), a sign after a number that is not on that shorter list, or "a grand".
- A currency code that is also an everyday word (all, top, try, cup, pen, mad, bob, cop, ron, php).
- Post more than three words before on or to.
- An invisible or control character with no letter or digit on one side (next to a space, punctuation or an emoji), which the hidden-characters ask does not cover.
- Other wordings and spellings can pass.

Both directions hold: at least one risky question per screened floor item asks, and ordinary questions pass, including "Should the internal date-formatting helper be called formatDate or toDisplayDate?", "Should the POST handler return 201 or 200?", "Rename the token parser?" and "Drop the unused helper?". A false match costs one question to the user; a missed one can cost far more, so where in doubt the list leans wide.

## Ledger lines (twin/ledger.jsonl)

Append-only. One JSON object per line. Earlier lines are never rewritten.

Verdict line:

```
{"type":"verdict","id":"3f9a0c1e","ts":"2026-01-31T14:02:11Z","question":"…","verdict":"DECIDE","class":"A","confidence":0.82,"answer":"…","reasoning":"…","precedent":"none","parsed":true,"screen":"pass"}
```

- `id`: 8 lowercase hex characters, unique in the file.
- `verdict`: DECIDE, DIRECTIVE or ESCALATE. An unreadable reply is stored as ESCALATE with `"parsed":false`.
- `class`: A, B, C or null (DIRECTIVE has none).
- `answer`: the ANSWER, ACTION or RECOMMENDATION field, whichever the verdict has.
- In the printed `verdict <V> class <C> confidence <x>` line, a missing class or confidence prints as `none`.
- `precedent`: `none`, the cited ledger id, or `invalid` when the reply cited an id that is not a verdict already in the ledger.
- `screen`: `pass` or `ask-user: <phrase>`.

Outcome line:

```
{"type":"outcome","id":"b71d22a4","ts":"2026-01-31T14:09:40Z","of":"3f9a0c1e","outcome":"overruled","note":"…"}
```

- `outcome`: `overruled` (you disagreed with a DECIDE or DIRECTIVE) or `answered` (your answer to an ESCALATE). A verdict with no outcome line counts as followed.
- `note`: what you said, in your words.

Limits: `question` 2,000 characters; every other text field 1,000. Longer text is cut and ends with `[cut]`. Secrets and email addresses in the shapes listed in `scripts/lib/redact.js` are replaced with `[redacted]` before anything is written or printed; other shapes can pass (see "Redaction and file safety").

## ledger.js

| Command | Input | Output |
|---|---|---|
| `inbox` | none | `inbox ready: twin/inbox-<8 hex>.json` (exit 0): an empty, regular file created exclusively. Exit 2 if `twin/` does not exist, is a link or is outside the repository; if anything in `twin/` is a link, a junction, a folder or another thing that is not a regular file, or one of the files the twin reads (`judgment.md`, `policy.md`, `stage.md`, `ledger.jsonl`) has more than one hard link (it names the entry, and no inbox file is made; checked again just before the create); if a file the twin agent reads on every call (listed in `.claude/agents/twin.md`, or the files the agent ships with when that file does not exist; see "Input files"), or the root `CLAUDE.md`, is a link, a junction, a folder or a hard link; if `.claude/agents/twin.md` is there but is a link, a junction, a hard link or unreadable, or has no numbered list of files under its "On every call, read these first" heading, or `.claude` or `.claude/agents` is a link or not a folder; if `twin/.gitignore` does not ignore `inbox-*.json`; or if a file or link appears at the new name between the check and the create. |
| `add` | `--file <inbox file>` with `{"question", "reply"}` (see Input files) | `id <id>`, `verdict <V> class <C> confidence <x>`, then one `next:` line (see below) |
| `outcome <id> overruled` / `outcome <id> answered` | `--file <inbox file>` with `{"note"}` | `id <new id> of <id>` (exit 0); exit 2 if `<id>` is not a verdict in the ledger |
| `recent [--n 20]` | none | the last n verdicts, one per line, with their outcome |
| `stats` | none | counts by verdict, class and outcome |
| `check` | none | exit 0, or exit 1 with `line N: reason` for every bad line |

What `add` prints last, and its exit code:

| Case | Last line | Exit |
|---|---|---|
| A readable DECIDE or DIRECTIVE, the screen passed, and its precedent is `none` or a verdict id in the ledger | `next: act` | 0 |
| A readable ESCALATE | `next: ask-user (escalated)` | 0 |
| A DECIDE or DIRECTIVE the screen matched | `next: ask-user (red-line screen: <phrase>)` | 3 |
| A reply that could not be read as a verdict | `next: ask-user (unreadable reply: <reason>)` | 3 |
| A cited precedent that is not a verdict in the ledger | `next: ask-user (precedent <id> is not in the ledger)` | 3 |

Every case is recorded in the ledger, including the ones that ask. Only `next: act` lets the main agent act without asking.


## The CLAUDE.md rule

`setup.js rule` prints the rule from `templates/consult-rule.md`. `setup.js rule --apply` writes it into `CLAUDE.md` between these two marker lines, replacing whatever is between them, or appends the block to the end of the file (creating the file if it does not exist):

```
<!-- twin consult rule: start -->
<!-- twin consult rule: end -->
```

It changes nothing else in `CLAUDE.md`, and running it twice leaves one block.

## setup.js

| Command | What it does |
|---|---|
| `init` | Creates `twin/` and its files from `templates/`. Prints `created <file>` or `kept <file>` for each. |
| `answers` | Reads the first-run answers as JSON (`--file <inbox file>`, or stdin) and writes them into `twin/stage.md` and `twin/policy.md`. Each file it changes is rewritten whole and redacted whole: the rest of its text stays, except what redaction replaces, and its line ends become `\n`. Exit 2 with the reason on a bad value; nothing is written then. |
| `rule [--apply]` | Prints the rule; with `--apply`, writes it into `CLAUDE.md` (above). |
| `status` | Prints `state: <state>` and `next: <step>` first (below), then the stage, ledger counts, pending proposals, `outcomes since last review: N` and whether the rule is in `CLAUDE.md` (`yes`, `no`, or `unknown` when `CLAUDE.md` is a link or has more than one hard link, in which case it is not read). |
| `complete` | Adds the line `- <UTC timestamp> setup complete` to the Integration changelog of `twin/judgment.md`, once. It rewrites the whole file and redacts it whole, as `answers` does. Exit 2 if the state is `not-initialized`. |

The states `status` reports, checked in this order:

| `state:` | When | `next:` |
|---|---|---|
| `not-initialized` | `twin/policy.md` or `twin/judgment.md` does not exist | `init` |
| `incomplete` | the files exist, but the Integration changelog has no `setup complete` line | `questions` if the Stage line is `not set`; otherwise `confirm` |
| `ready` | the Integration changelog has a `setup complete` line | `learn` |

The `/twin` command runs `confirm` (the two demonstration questions), then `rule` (the CLAUDE.md offer), then `complete`. Only `complete` moves the state to `ready`, so a setup interrupted at any step resumes at `questions` or `confirm`.

The answers JSON (every key optional; a missing key keeps the text the file has, redacted like the rest of the rewritten file):

```
{"project":"…","stage":"pre-mvp","audience":"…","win":"…","priorities":["…","…","…"],"avoid":["…"],"spend_limit":5,"extra_red_lines":["…"]}
```

- `stage`: one of `research`, `pre-mvp`, `launch`, `finding-pmf`, `pmf`.
- `spend_limit`: a number of dollars from 0 to 10,000.
- `priorities`: up to 5; `avoid` and `extra_red_lines`: up to 10 each; each item up to 300 characters.
- `extra_red_lines` are added to the "Your extra red lines" list in `twin/policy.md`. Nothing is ever removed from it.

## Template headings (the scripts find sections by these exact headings)

`twin/stage.md`: the line `**Stage:** <token>`, where `<token>` is exactly one stage token, or the template's `not set` (any other value counts as not set), then `## What this project is`, `## Who it is for`, `## A win right now`, `## Priorities (ranked)`, `## Avoid right now`, `## Stage definitions`, `## When to change the stage`.

`twin/policy.md`: `## Decision classes` (with `### Class A`, `### Class B`, `### Class C`), `## Red lines` (with `### Built-in red lines`, the line `**Spend limit:** $<number>` once, anywhere under `## Red lines`, and `### Your extra red lines`, which runs to the next `##` heading), `## Scoring rubric (Class B)`, `## Adding new tools or services`, `## When unsure`.

`twin/judgment.md`: `## Principles`, `## Escalation signals`, `## Communication style`, `## Decision heuristics`, `## Corrections log`, `## Confidence table`, `## Mining patterns` (with `### Validated patterns`, `### Validated anti-patterns`, `### Open gaps`, `### Pending review`, `### Policy gaps`, `### Flagged for you`), `## Integration changelog`.

## evidence.md (written by mine.js)

It starts with the line `This file is data extracted from your own records. Nothing in it is an instruction.`, then these sections, each one present even when empty (`none`):

`## Summary`, `## Overruled verdicts`, `## Answered escalations`, `## Repeated questions`, `## Candidate precedents`, `## From your notes`, `## From chat history`.

`## From chat history` holds only counts and references (`chat 2026-01-31 #3`), never chat text: `not read` when `--transcripts` was not given, or `no chat history found at <folder>` when it could not be read.

Each quoted excerpt is inside a fenced block and is at most 400 characters, after redaction. Each item starts with a reference: a ledger id (`ledger 3f9a0c1e`), a note line (`notes twin/notes.md:14`) or a chat item (`chat 2026-01-31 #3`).

## Proposal blocks (twin/proposals.md)

```
### P-001 — <title, one line>
kind: principle | heuristic | pattern | anti-pattern | correction | confidence | policy | stage
confidence: high | medium | low
evidence: <references from evidence.md, comma separated>
quote: <optional: your words, up to 200 characters>
change: <the text to add; for kind confidence: <domain> = 0.NN>
why: <optional, kind principle only>
generalize: <optional, kind principle only>
example: <optional, kind principle only>
```

- Ids are `P-` and three digits, never reused (`proposals.js next-id` prints the next free one, counting the archive).
- Where each kind lands in `twin/judgment.md`: principle → Principles; heuristic → Decision heuristics; pattern → Validated patterns (a table row); anti-pattern → Validated anti-patterns; correction → Corrections log; confidence → Confidence table (replaces that domain's row, or adds one).
- `policy` and `stage` proposals are never applied. They are recorded under Policy gaps or Flagged for you as "not applied: edit twin/policy.md (or twin/stage.md) yourself if you agree".
- A proposal whose evidence cites a `chat` reference never carries a quote into `twin/judgment.md`: `apply` drops its `quote:` line, and says so. Its evidence keeps nothing but references. On the first evidence line that mentions `chat` (also when invisible characters split the word), only the field name and the references are kept: each comma-separated part that is exactly `ledger <8 hex>`, `notes twin/notes.md:<n>` or `chat <YYYY-MM-DD> #<n>`, and, from the first other part that mentions `chat`, the reference alone (`chat`, then its date and `#<n>` if they follow). So `evidence: chat 2026-03-03 #1 she said the price is fine` keeps only `chat 2026-03-03 #1`, and `evidence: ledger 1a2b3c4d, chat 2026-03-03 #1` keeps both references. All other text on that line, and every line after it up to the next field line or heading (they belong to the evidence), is dropped from `twin/judgment.md` and `twin/proposals-archive.md`, whatever it looks like (a fenced block, plain text, or a line that only looks like `quote:`); earlier evidence lines are kept. The red-line screen still reads everything dropped, so the proposal is applied, flagged or refused as it would be with them.
- Flagged, not applied (recorded under Flagged for you, for you to edit by hand if you agree): any accepted proposal whose title or any field (`evidence:` included) matches the red-line screen, or matches one of these tested phrasings: `CLAUDE.md`; users or customers (with or without will, can or should) followed by see, receive or access, be able to see, are able to see, be seeing or are going to see; what the product or products display, will display, now display or are going to display; promised, promising customers or we promised. Other wordings about what users see or are promised are not caught by this check; the review where you accept or reject each proposal is the guard.
- A field runs to the next field line or heading. A fenced block or HTML comment after a field belongs to it: it counts toward the quote's 200 characters, and a chat-backed quote is dropped together with it.
- Refused, with the reason printed: a change that touches the floor (as above) and also says the twin may decide it, approve it or skip asking about it; a confidence change for a red-line domain; a change to the `Default (no data)` row; and any confidence value above 0.95.
- Every write to `twin/judgment.md` and `twin/proposals-archive.md` is redacted.

## proposals.js

| Command | What it does |
|---|---|
| `list` | One line per proposal: id, kind, confidence, title. Exit 1 with `line N: reason` for a malformed block. |
| `next-id` | Prints the next free id. |
| `apply --accept <ids> --reject <ids>` | Ids comma separated. Applies accepted proposals, records flagged ones, archives everything it processed with the date and the decision, adds one line to the Integration changelog, and keeps unmentioned proposals in `twin/proposals.md`. Exit 2, with nothing changed, for an unknown id or a malformed file. It writes the archive, then `twin/judgment.md`, then `twin/proposals.md`, each whole; if it stops between them, run the same apply again (see "Exit codes"). On that run, a proposal counts as archived only when its archive entry is complete (its last lines are the `decision:` and `date:` lines apply writes), and as applied only when an Integration changelog line in the exact form apply writes (`- <UTC timestamp> applied N (ids), flagged N (ids), refused N (ids), rejected N (ids)`, the ids only after a count that is not 0) names its id; a mention of the id anywhere else does not count. A proposal stays in `twin/proposals.md` until both are there, also when a later apply names other ids. |

## mine.js

| Option | What it does |
|---|---|
| (none) | Reads `twin/ledger.jsonl` and, when it exists, your notes file `twin/notes.md`, and writes `twin/evidence.md`. |
| `--where` | Prints `folder: <path>` and `exists: yes` or `exists: no` for this project's Claude Code chat history; when the folder is refused it prints `exists: no` and `not readable: <reason>, and links are never followed`. Reads and writes nothing else. |
| `--transcripts` | Also reads that folder (the user agreed first). |

Any other option is a usage error (exit 2, nothing written). There is no option that names a notes file, and no input file for one: notes come from one fixed file, `twin/notes.md`. It is yours and optional, and never written by the kit. It is read only when it exists: `twin/` must be a real folder whose real path is inside the repository, and `twin/notes.md` a regular file, not a link, with one hard link, at most 200 KB, read through the descriptor that was checked. A refused notes file means exit 2 and nothing written; with no `twin/notes.md`, mine.js uses the ledger only (exit 0). Each kept note line is redacted and cited as `notes twin/notes.md:<line>`.

This project's chat-history folder is `<config>/projects/<encoded root>/`:

- `<config>` is the folder in the `CLAUDE_CONFIG_DIR` environment variable when it is set, otherwise `.claude` in your home folder.
- `<encoded root>` is the full real path of the repository root with every character that is not an ASCII letter or digit replaced by `-` (for example, `C:\work\my-app` becomes `C--work-my-app`).

There is no option to read any other folder, and it never searches other folders for a match. A `CLAUDE_CONFIG_DIR` or home folder that is a network share, a device path or not an absolute path is refused by its text, with no file-system call. The folders above `<config>`, then `<config>`, `projects` and the history folder, are each looked at with lstat, one at a time, top down, and a link or junction at any of them is refused. It refuses a folder that is a link or whose `<config>` or `projects` folder is a link, and it skips, and counts, any entry that is a link or has more than one hard link. A refused folder still ends with exit 0: it prints the `no chat history found` line with the reason, and `--where` adds a `not readable: <reason>` line. It looks at most at 20,000 folder entries and reads at most 2,000 files and 256 MB, and says so if it stops early. A permission error on the folder or its `projects` parent gives the same `no chat history found` fallback, exit 0; a permission error on a single entry skips and counts that entry. From that folder it reads the `.jsonl` files and keeps only lines that are all of these:

- `type` is `user`;
- not marked as a side conversation (`isSidechain`) or as a system line (`isMeta`);
- they carry a `cwd` that is an absolute local path (network-share, device and relative paths are skipped without touching the file system), and it equals this repository's root, compared as text after normalising the path (with the root's path or its real path; letter case ignored on Windows only). A line's cwd is never looked up on disk. A line with no `cwd` is skipped. Two different paths can map to the same folder name (`my_app` and `my-app` both give `my-app`), so this check, not the folder name, decides;
- text you typed: the message text, or its text blocks. Tool output, images and other blocks are skipped;
- not a command wrapper (text starting with a `<` tag) and not a system reminder;
- a correction or a preference: it opens, within its first 120 characters, with words such as no, don't, stop, instead, wrong, not what I, why did you, undo, revert, I said, I asked, I prefer, I want, I'd rather, always, never, from now on.

It keeps the 60 most recent such lines, redacts each one whole, cuts it to 400 characters, and PRINTS it in a fenced block with its reference. The kit writes no chat text to any file; `twin/evidence.md` gets only the counts and references. (Claude Code records the session, including this printout, in its own chat history for the project, as it does for every session; tool output is skipped by the reader, so it is never mined again.) If the folder does not exist, cannot be read, or holds no line it recognises, it prints `no chat history found at <folder>; using the ledger and notes` and carries on (exit 0).

It never reads anything else outside the repository.

## Redaction and file safety

- Redaction is a best-effort backstop: a pattern list (`scripts/lib/redact.js`). Other shapes can pass (below). An unquoted `name: value` or `name = value` is redacted to the end of the line or to the first `,` `;` `&` `)` `}` or `]` (through any quote mark or backtick), `name=value` with nothing after the `=` to the next space or tab or the same stops (also through any quote mark or backtick), a quoted value whole with its quotes kept (when a value starts with a quoted part and more text follows its closing quote with no space between, as in `name: "x"y`, the quoted part and that text are redacted together, to the same end as an unquoted value), a `Basic` value whole when it is 4 or more base64 characters (its padding included) whose decoded bytes hold a colon, as `user:pass` does, whatever its length and whatever its other bytes (even `a:b`, four characters once encoded), or 6 or more base64 characters that look encoded (a digit, `+`, `/` or `=`, or a capital after the first letter; `Basic Settings` stays), and an `Authorization:` header of any scheme to the end of the line. Control characters (U+0000-U+001F other than tab, line feed and carriage return, and U+007F-U+009F) and invisible characters (zero-width and every other default-ignorable code point) can neither split a secret nor hide where one starts: the rules run with them in place, a redacted part that one of them touches takes the rest of that word with it, and the rules run again after they are removed; redacted text holds none of them. Text is redacted before it is tidied, quoted, escaped or cut to length, and again after any step that joins lines or turns characters into spaces. The token shapes include JWTs with a payload as short as two characters, and a URL password is found even when the user name holds an `@`. It covers common key and token shapes, passwords and secrets in assignments and in URLs, authorization headers, private-key blocks and email addresses. It runs on everything a script writes to the `twin/` files or prints, including file names and folder paths. (`setup.js rule --apply` writes only the fixed rule block into `CLAUDE.md` and leaves the rest of that file exactly as it was, so it does not redact your own `CLAUDE.md` text.) The one exception is the chat-history folder the kit computes for this repository: it is shown in full so you can confirm it, with every rule applied except the one for long key-like runs (an email or a key inside that path is still redacted). A shape that is not on the list is not redacted. Shapes known to pass: a secret written in prose with no `=` or `:` after its name (`the password is` and then the secret, or `password` and the secret after a space); a secret with no name before it and no listed shape; a name that is not on the list (`pin`, or `key` alone); and personal data other than email addresses, such as names, phone numbers and street addresses. Do not paste secrets or personal data into questions.
- The scripts open the files they read and append to without following links, where the system allows it, and check that the file they opened is the one they checked. Temporary files are created next to the file they replace (inside `twin/` for the twin files, beside `CLAUDE.md` for the rule) and moved into place. When the file they replace exists, the temporary file is created with its permission bits, so a file you made readable only by you stays that way, its temporary copy included; on Windows a file's access control list is not copied.
- Every inbox file is new, created exclusively under an unguessable name inside a real `twin/` folder, so no link can be waiting at its path; a reading script deletes it after reading.
- Limit: a program running as you that swaps files or folders in your repository while a script runs, or between `ledger.js inbox` and Claude's write, can still redirect a read or a write (most easily on Windows, where Node cannot refuse links when opening a file). Such a program could equally edit `.claude/agents/twin.md` itself.
