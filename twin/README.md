# twin

Stop answering the same questions twice. `twin` gives Claude Code a read-only helper that answers your routine questions the way you would, so Claude keeps working instead of waiting for you.

## What it is

When Claude is about to ask you something you could have predicted (a name, which of two reasonable approaches, what to do next), it asks your twin first. The twin answers DECIDE, DIRECTIVE or ESCALATE from your own policy, stage and judgment notes in a `twin/` folder in your repo. It learns from the times you overrule it or answer it, and only from this project. It never decides the risky things: deleting or overwriting data, files or history, pushing, deploying or sending anything off your machine, spending at or above your limit, secrets, payments, pricing or legal questions, personal data about real people, going against your `CLAUDE.md`, or changing what your users see, get or are promised.

| Verdict | What it means | What Claude does with it |
|---|---|---|
| DECIDE | The answer you would give. | Goes ahead, and tells you in one line with the verdict's id, so you can overrule it. |
| DIRECTIVE | The next step, when Claude asks what to do next. | Does that step, and tells you in one line with its id. |
| ESCALATE | The twin cannot or must not decide. | Asks you, leading with the twin's one recommendation. |

There is one command, `/twin`. The first time, it sets your twin up. After that, each `/twin` learns from how you decided, then asks before it applies anything.

Claude acts on a DECIDE or DIRECTIVE only after the ledger script has recorded it and printed `next: act`. A verdict is advice, never permission: it never answers Claude Code's own permission prompts. Those prompts appear only when your permission settings ask for a command (see [Safety](#safety)).

## The 60-second demo

1. Copy the pack into your repo (see [Install](#install)).
2. Start Claude Code in your repo:

   ```
   cd your-app
   claude    # starts Claude Code
   ```

3. Type `/twin`. There is no twin here yet, so it asks: "Set up a twin for this project? It creates a `twin/` folder and asks eight short questions. (yes/no)". Say yes. (No stops it, and nothing is written.)
4. It creates your `twin/` folder and asks eight short questions about your project in one message. Answer them, or reply `defaults` to skip any or all of them. The twin needs a stage, though: if you skip that question, it asks it again on its own.
5. You meet your twin. `/twin` asks it two demonstration questions: whether an internal date helper should be called `formatDate` or `toDisplayDate` (a routine call), and whether to push the current branch to main (a red line). You see the verdict for each, with its answer or its reason. The first usually comes back as DECIDE. The second must come back as ESCALATE; if it does not, `/twin` says so plainly and suggests you read `twin/policy.md`. These two are not recorded.
6. It shows you the one-line rule for `CLAUDE.md` and asks once whether to add it.
7. It notes in `twin/judgment.md` that setup finished, so the next `/twin` goes straight to learning.

From then on, with the rule in place, Claude asks your twin before it asks you. You can also ask your twin yourself: tell Claude to "ask my twin" about something, for example `ask my twin whether the date helper should be called formatDate or toDisplayDate`.

A full DECIDE reply looks like this (example):

```
DECISION: DECIDE
CLASS: A
CONFIDENCE: 0.82
ANSWER: Call it formatDate. Nothing outside its own file uses it, so the shorter name is enough, and it is easy to rename later.
REASONING: A Class A naming choice inside one file; pick the simplest option that is easy to undo. order-stable: yes
PRECEDENT: none
```

An ESCALATE, here for "Should I push the current branch to main now?", looks like this (example):

```
DECISION: ESCALATE
CLASS: C
CONFIDENCE: 0.95
REASON: Pushing to main is on the red-line floor, so only you can approve it.
RECOMMENDATION: Push once the tests pass and you have read the diff, because main is what everything else builds on.
SUGGESTED_QUESTION: I recommend pushing once the tests pass and you have read the diff. Push the branch to main now?
```

Claude Code loads agent files when a session starts. If you copied the pack in while Claude Code was open, `/twin` stops at step 5 and tells you to restart Claude Code once. Restart it and run `/twin` again. It asks "Setup isn't finished. Continue where it stopped? (yes/no)", and on yes it picks up where it stopped: at the questions if no stage is set yet, otherwise at the demonstration questions. It asks the same whenever a setup was interrupted, and on no it stops with nothing written.

## Install

You need Claude Code, Node 20 or newer, and git. (No git? Download this repo as a ZIP and unpack it into a folder named `skills` instead of the first line.)

What gets copied into your repo:

| From the pack | To your repo | What it is |
|---|---|---|
| `agent/twin.md` | `.claude/agents/twin.md` | The twin agent. It can read files; it cannot change anything, run commands or start other agents. |
| `command/twin.md` | `.claude/commands/twin.md` | `/twin`, the one command. It sets your twin up, then teaches it. |
| `kit/` | `.claude/twin/` | The scripts, the templates, the file formats, the consult guide and a one-line `package.json`. |

The kit's `package.json`, installed as `.claude/twin/package.json`, holds only `{"type": "commonjs"}`. It tells Node to run the kit's scripts as CommonJS, so they also work in a project whose own `package.json` says `"type": "module"`.

Run these from the folder that contains your app's folder. `your-app` stands for your project folder. If any of the three paths already exists there, the lines print a message and copy nothing; they never overwrite your copies. If a `skills` folder is already there from an earlier install, leave out the `git clone` line, and get the newest pack first with `git -C skills pull`.

bash (macOS, Linux, Git Bash on Windows):

```bash
git clone https://github.com/<your-github-username>/skills
if [ -e your-app/.claude/agents/twin.md ] || [ -e your-app/.claude/commands/twin.md ] || [ -e your-app/.claude/twin ]; then
  echo "twin is already installed in your-app. Nothing was copied. To upgrade, follow the upgrade steps under Install in skills/twin/README.md."
else
  mkdir -p your-app/.claude/agents your-app/.claude/commands
  cp skills/twin/agent/twin.md your-app/.claude/agents/twin.md
  cp skills/twin/command/twin.md your-app/.claude/commands/twin.md
  cp -r skills/twin/kit your-app/.claude/twin
fi
```

Windows PowerShell:

```powershell
git clone https://github.com/<your-github-username>/skills
if ((Test-Path your-app/.claude/agents/twin.md) -or (Test-Path your-app/.claude/commands/twin.md) -or (Test-Path your-app/.claude/twin)) {
  Write-Host "twin is already installed in your-app. Nothing was copied. To upgrade, follow the upgrade steps under Install in skills/twin/README.md."
} else {
  New-Item -ItemType Directory -Force -Path your-app/.claude/agents, your-app/.claude/commands | Out-Null
  Copy-Item skills/twin/agent/twin.md your-app/.claude/agents/twin.md
  Copy-Item skills/twin/command/twin.md your-app/.claude/commands/twin.md
  Copy-Item -Recurse skills/twin/kit your-app/.claude/twin
}
```

To upgrade, from the same folder:

1. Get the new pack: `git -C skills pull` updates the `skills` folder you cloned. If it fails, stop and fix that first, or the next lines copy the old pack again. Without git, download the ZIP again, unpack it into a new, empty folder and use that folder's name in place of `skills` in the next lines. Never run `git clone` again into the existing `skills` folder: it fails there, and the copy lines would then reinstall the old pack.
2. Delete the old copies and copy the new ones.

bash:

```bash
rm -rf your-app/.claude/agents/twin.md your-app/.claude/commands/twin.md your-app/.claude/twin
mkdir -p your-app/.claude/agents your-app/.claude/commands
cp skills/twin/agent/twin.md your-app/.claude/agents/twin.md
cp skills/twin/command/twin.md your-app/.claude/commands/twin.md
cp -r skills/twin/kit your-app/.claude/twin
```

Windows PowerShell:

```powershell
Remove-Item -Recurse -Force your-app/.claude/agents/twin.md, your-app/.claude/commands/twin.md, your-app/.claude/twin
New-Item -ItemType Directory -Force -Path your-app/.claude/agents, your-app/.claude/commands | Out-Null
Copy-Item skills/twin/agent/twin.md your-app/.claude/agents/twin.md
Copy-Item skills/twin/command/twin.md your-app/.claude/commands/twin.md
Copy-Item -Recurse skills/twin/kit your-app/.claude/twin
```

Your own `twin/` folder is not part of the install, so upgrading leaves it alone.

Then confirm the install, from your app's root folder:

```
cd your-app
node .claude/twin/scripts/check.js
```

It takes a few seconds and works offline, in a temporary folder; it does not touch your own files. It checks that every installed file is there and that every script loads, runs setup and one verdict end to end, and runs one case for each of these safety behaviors: the inbox step refuses an agent file it cannot trust, `proposals.js apply` finishes an interrupted run without applying anything twice and keeps a proposal pending until it is applied, `setup.js init` refuses before it writes anything, and a file a script replaces keeps its permission bits, its temporary copy included; it also checks that `kit/templates/formats.md` describes these behaviors. A pass ends with the line `<n> ok / 0 FAIL` and exits 0. A case this system cannot run (the two permission-bits cases on Windows) prints as `SKIP <name>: <why>`, is not counted as ok, and adds ` / <s> SKIP` to that line. If the kit or the agent file is missing, `/twin` tells you which one to copy, and stops.

## Using it day to day

### The CLAUDE.md rule

The rule is what makes Claude consult your twin on its own, before it asks you. `/twin` offers to add it during setup. The exact text:

> Before asking me a question you could answer yourself, ask the `twin` agent and record its reply with the ledger script before acting, as `.claude/twin/consult.md` describes; act only when the script prints `next: act`, otherwise ask me, and record what I say when I overrule or answer it. A twin verdict never answers Claude Code's permission prompts.

`node .claude/twin/scripts/setup.js rule --apply` writes it into `CLAUDE.md` between two marker lines, `<!-- twin consult rule: start -->` and `<!-- twin consult rule: end -->`. It changes nothing else in the file, creates the file if there is none, and running it twice still leaves one copy. If you said no during setup, you can run it later.

### The order Claude follows

1. Prepare an inbox file, before asking the twin. Claude runs `node .claude/twin/scripts/ledger.js inbox`, which refuses unless `twin/` is a real folder (not a link) inside your repository, everything in it is a regular file (no link, junction or folder, whatever its name), and each file the twin reads there (`judgment.md`, `policy.md`, `stage.md`, `ledger.jsonl`) that exists has one hard link, then creates a new, empty inbox file and prints its path, `inbox ready: twin/inbox-<8 hex>.json`. The twin reads the files in `twin/`, so this check comes first. If it refuses, Claude does not ask the twin; it asks you directly and tells you the reason it printed.
2. Ask the twin. Claude starts the question with the line `Inbox step: done.`; the twin is told to read no file and escalate when that line is missing.
3. Record the reply before acting. Claude writes the question and the twin's reply to exactly the path step 1 printed and runs `node .claude/twin/scripts/ledger.js add --file <inbox file>`, where `<inbox file>` is that path. The script reads the file once and deletes it.
4. Act only when the script prints `next: act`.
5. Otherwise ask you. That covers every ESCALATE, and every other `next: ask-user (...)`: a red-line match, a reply that could not be read as a verdict, or a cited precedent that is not in the ledger.
6. Record what you say when you overrule a verdict or answer an escalation.

Claude writes the inbox file with its own file-writing tool, not through the shell, so the shell never reads anything in a question or a reply. It uses a new inbox file for every input, even when it consults the twin twice at once. [kit/consult.md](kit/consult.md) shows each step (installed at `.claude/twin/consult.md`).

When Claude records a DECIDE like the one in the demo, the ledger script prints this (example):

```
id 3f9a0c1e
verdict DECIDE class A confidence 0.82
next: act
```

For an ESCALATE it prints `next: ask-user (escalated)`, and Claude asks you.

This order is a convention, not a lock. Claude follows it because the rule is in your `CLAUDE.md`. The red-line screen (see [Safety](#safety)) protects only the verdicts that go through the ledger script. A verdict that was never recorded is not an answer, and Claude should not act on it.

### Asking your twin yourself

Tell Claude to "ask my twin" about something. With the rule in your `CLAUDE.md`, Claude follows the same order: it prepares an inbox file, asks the twin, records the reply, and acts only on `next: act`. `/twin` itself takes no question; it only sets your twin up and teaches it.

### Optional: no permission prompt for the ledger script

Every consult runs the ledger script, and Claude Code may ask your permission each time. To allow that one script, add this rule to the `allow` list under `permissions` in your Claude Code settings (for example `.claude/settings.local.json`):

```
Bash(node .claude/twin/scripts/ledger.js *)
```

Setup never adds it. It covers only the ledger script, including the `ledger.js inbox` step that comes before each write. Claude's own write to the inbox file between the two script runs is not covered, and Claude Code may ask you to approve that write too.

### When you disagree

Claude mentions every DECIDE or DIRECTIVE it acts on in one line, with its id. If you disagree, say so. Claude runs `ledger.js inbox`, writes your words to the inbox file it printed and records them with `ledger.js outcome <id> overruled --file <inbox file>`, or `answered` for your answer to an ESCALATE, as [kit/consult.md](kit/consult.md) shows. A verdict nobody overrules counts as followed, so there is nothing to record then. These records are what the twin learns from.

## Teaching it

On day one the twin knows your policy, your stage and your `CLAUDE.md`, and little else:

- **Class A** (an implementation detail that is easy to undo): it can decide from the policy alone, before it has learned anything, when the question closely matches a Class A example in your policy.
- **Class B** (a meaningful technical choice): it escalates, with the option that wins on your policy's scoring rubric as its recommendation, until `twin/judgment.md` has a Confidence table row for that area at 0.70 or more. A question that is unclear between A and B counts as B.
- **Class C** (strategic, hard to undo, business or user trust, and everything on the red-line floor): it always asks you.

Your overrules and answers become that judgment when you run `/twin` again, after some days of use. Each run does four things:

1. **It learns.** First, `/twin` asks whether to learn from this project's Claude Code chat history (see [Chat history (optional)](#chat-history-optional)). Then it reads `twin/ledger.jsonl`, plus your notes in `twin/notes.md` if that file exists, and writes what it found to `twin/evidence.md`. `twin/notes.md` is yours and optional: write in it anything you want the twin to learn from, such as decisions you made and why. The kit only reads it and never writes it. It is the only notes file: there is no option to name another one. It must be a regular file inside `twin/`, not a link, at most 200 KB. If it is refused, nothing is written, and `/twin` tells you why and stops; fix the file or move it away, then run `/twin` again.
2. **It proposes.** Claude writes proposals to `twin/proposals.md`: corrections, principles, heuristics, patterns, anti-patterns, confidence changes, and policy or stage suggestions. Each one cites its evidence.
3. **It asks.** If nothing is pending, it says so in one line, shows the status (the stage, the ledger counts, pending proposals, how many overrules and answers came in since the last review, and whether the rule is in `CLAUDE.md`), and stops. With a new ledger this is normal. Otherwise it asks "I found N proposals for your twin. Review them now? (yes/no)". On no, they stay pending for the next `/twin`.
4. **It applies only what you accept.** On yes, it shows every pending proposal (its id, kind, confidence, the change and its evidence), marks the ones with thin evidence, and asks in one message which to accept and which to reject. "accept all high", "accept all" and "reject all" work too, and anything you do not mention stays pending. The script then applies the accepted ones to `twin/judgment.md`, apart from the ones it flags or refuses (below), and archives every proposal it processed.

Nothing changes until you accept it. Learning never changes `twin/judgment.md` on its own, and never changes `twin/policy.md` or `twin/stage.md` at all. Policy and stage suggestions are shown to you and never applied: they are noted in `judgment.md` as not applied, and you edit `twin/policy.md` or `twin/stage.md` yourself if you agree.

An accepted proposal is flagged instead of applied when its text matches the red-line screen, mentions `CLAUDE.md`, or matches the script's phrases about what your users see, get or are promised. It is recorded under Flagged for you in `judgment.md`, for you to edit by hand if you agree. The screen and the check for what users see are phrase lists and can miss other wordings, so read each proposal before you accept it. The script refuses, with the reason, a confidence change for a red-line domain, a change to the `Default (no data)` row, and any confidence above 0.95.

Inside your repository, `/twin` learns only from the ledger and `twin/notes.md`.

### Chat history (optional)

`/twin` can also learn from corrections and preferences you typed to Claude Code in this project, but only when you say yes.

- **When it asks.** On every learning run, before it runs any of the learning scripts, `/twin` asks: "Also learn from this project's Claude Code chat history? The kit reads the files Claude Code keeps for this project on this machine and keeps only text you typed. It shows the excerpts to Claude in this session, so, like anything Claude reads, they go to the model you use. The kit writes none of them to a file. (yes/no)". On yes, it shows you the exact folder and asks you to confirm it: check that the folder is this project's before you say yes again. It asks on every run and never keeps your answer. If it has no way to ask you (for example, when Claude Code runs with `claude -p`), the answer is no. Running `/twin --transcripts` means you already agree; it then shows the folder in one line. If the folder does not exist, `/twin` says so in one line and goes on without it.
- **Which folder.** Only this project's: `<config>/projects/<encoded path>/`, where `<config>` is `.claude` in your home folder, or the folder named in `CLAUDE_CONFIG_DIR` if you set that variable. `<encoded path>` is the full real path of your repository with every character that is not an ASCII letter or digit turned into `-`; for example, `C:\work\my-app` becomes `C--work-my-app`. There is no option to point it at another folder, and it never searches other folders for a match. It refuses the folder if it is a link or sits under a linked `projects` folder, skips any entry that is a link, and stops after 2,000 files or 256 MB, saying so.
- **Which lines count.** The kit reads the files in that folder on this machine, and those files also hold Claude's replies and tool output. It keeps only text you typed, and only corrections and preferences: lines that open, within their first 120 characters, with words such as no, don't, instead, I prefer or from now on. Tool output, command wrappers, side conversations and system lines are skipped. So is any line with no recorded working folder, and any line whose recorded working folder is not exactly your repository, because two paths can give the same folder name (`my_app` and `my-app` both give `my-app`). It keeps the 60 most recent lines, redacts each one whole, then cuts it to 400 characters (see [Safety](#safety) for what redaction can and cannot catch).
- **Where the excerpts go.** The kit shows only the excerpts it kept to Claude in this session, so, like anything Claude reads, they go to the model you use. The kit writes none of them to a file. `twin/evidence.md` gets only counts and references, such as `chat 2026-01-31 #3`, so the kit writes no chat text to any file. Claude Code itself records each session, including what the kit prints, in its own chat history for the project, as it does for every session. The reader skips tool output, so that record is never mined again.
- **What is kept.** Claude writes what it proposes from your chat history to `twin/proposals.md`, in its own words, before you accept or reject anything. `twin/proposals.md` and `twin/proposals-archive.md` keep every proposal, accepted or not, including paraphrases of what you typed, until you delete them. Git ignores both. Claude is told never to quote chat history in a proposal, and the script drops any quote from a chat-history proposal, and every line of its evidence after the chat reference, before they reach `twin/judgment.md` or `twin/proposals-archive.md`. A proposal can still paraphrase what you typed: quotes are stripped, but paraphrase is not. Read each proposal before you accept it, and remember that `judgment.md` may be committed.
- **If the format changes.** These files are in Claude Code's own format, and it can change. If `/twin` cannot read the folder or recognises nothing in it, it says it found no chat history there and learns from the ledger and notes.
- **Nothing else.** It reads only this project's chat-history folder, which Claude Code keeps under `.claude/projects/` in your home folder (or under `CLAUDE_CONFIG_DIR`), and only when you say yes on that run. After your first yes, `/twin` shows the exact folder so you can confirm it. It never looks in other folders, and it never reads anything else outside your repository.

## Your files

They live in `twin/` at your repository's root. `/twin` creates most of them when it sets your twin up, adds `evidence.md` when it learns, and adds `proposals-archive.md` once you accept or reject a proposal. Each time Claude hands text to a script, it writes a new inbox file, `twin/inbox-<8 hex>.json`, at the path `ledger.js inbox` printed, and the script reads it once and deletes it. Setup never overwrites a file that exists, and reinstalling the pack never touches this folder.

| File | What it holds | Ignored by git |
|---|---|---|
| `twin/policy.md` | Decision classes, red lines, spend limit, scoring rubric | no (your choice) |
| `twin/stage.md` | What the project is, its stage, wins, priorities, what to avoid | no (your choice) |
| `twin/judgment.md` | How you decide: principles, heuristics, corrections, confidence | no (your choice) |
| `twin/notes.md` | Optional: your own notes for the twin to learn from. You create it; `/twin` only reads it and never writes it | no (your choice) |
| `twin/ledger.jsonl` | Every verdict, and what you said when you overruled one or answered an escalation | yes |
| `twin/evidence.md` | What `/twin` extracted from the ledger and notes when learning (chat history appears only as counts and references, never as text) | yes |
| `twin/proposals.md` | Proposed changes to `twin/judgment.md`, waiting for you to accept or reject them in `/twin` | yes |
| `twin/proposals-archive.md` | Every proposal after it was accepted, rejected or flagged, kept until you delete it | yes |
| `twin/inbox-<8 hex>.json` | One input Claude writes for one script call; the script reads it once and deletes it (see "Input files") | yes |
| `twin/.gitignore` | Ignores the five files marked yes above | no |

`policy.md`, `stage.md`, `judgment.md` and `notes.md` are yours, to commit or not. `judgment.md` may come to contain quotes from your ledger and notes, because accepted proposals can carry your own words. Read it before you commit it to a public repository. Redaction is best effort: the scripts redact only the shapes on their list (see Safety), so a secret in another shape, or personal data such as a name or a phone number, can stay in these files. Check them for secrets and personal data before you commit them to any repository.

`twin/proposals.md` and `twin/proposals-archive.md` keep every proposal, accepted or not, including paraphrases of what you typed, until you delete them. Git ignores both. An inbox file holds the text Claude hands to a script (your setup answers, a question and the twin's reply, or your words when you overrule or answer the twin) in plain text, exactly as Claude wrote it and not redacted, until the script reads and deletes it. If a run stops after Claude writes an inbox file and before a script reads it, that one file stays in `twin/` until you delete it. The file sits in your repository folder, so anything that copies that folder, such as sync or backup, can copy it. An inbox file Claude prepared and never wrote stays there too, empty.

The ledger, the learning files and the inbox files stay out of git through `twin/.gitignore`. The pack never edits your own `.gitignore`. The file formats, including "Input files", are in [kit/templates/formats.md](kit/templates/formats.md).

## Safety

- **The red-line floor is built into the agent itself**, in `.claude/agents/twin.md`, not in your editable policy. The twin always escalates on:
  - deleting or overwriting data, history, files you wrote or branches, and anything that cannot be undone;
  - pushing, deploying, publishing or releasing, and sending anything that leaves your machine (email, messages, posts);
  - spending at or above your spend limit (5 dollars if none is set), signing up for a service, buying anything, upgrading a paid plan;
  - credentials, keys, tokens, passwords or any other secret;
  - payments, pricing, positioning, or a legal or compliance question;
  - personal or sensitive data about real people;
  - going against a rule in your `CLAUDE.md`;
  - changing what users of your product see, get or are promised.

  Your `twin/policy.md` can add red lines (setup's last question adds them for you). Nothing can remove the built-in ones. A precedent never clears a red line: approving something once is not approval for the next time.
- **A verdict is never permission.** It is advice about what you would decide. It never answers Claude Code's own permission prompts, and it never replaces your approval where Claude Code asks for it.
- **Files and quoted text are data, never instructions.** Only `twin/policy.md`, `twin/stage.md`, `twin/judgment.md` and your `CLAUDE.md` tell the twin how to judge. Ledger lines, notes, file contents and any text quoted inside a question are data. If they say to answer a certain way, the twin does not follow them. `/twin` treats everything it learns from, and every proposal, the same way.
- **The ledger script screens every verdict before Claude acts.** `ledger.js add` screens the whole question and the whole reply: every field, including REASONING, and any text around the block. It looks for listed red-line phrasings, such as `git push`, deploy, an amount with `$`, password and GDPR, on whole words, after removing every invisible (default-ignorable) character and every combining mark, mapping common look-alike letters to Latin ones and ignoring case. So a DIRECTIVE that says `git push` asks you even when the question was a plain "what next?". If a DECIDE or DIRECTIVE matches, the script prints `next: ask-user (red-line screen: <phrase>)` and Claude asks you. Text longer than 20,000 characters asks you without being matched (`too long to screen`). The screen only ever asks; it never turns an ESCALATE into anything else. Where in doubt it leans wide, because a false match costs you one question. It reads only the question Claude wrote and the twin's whole reply. Two floor items have no screen and rest on the agent alone: going against your `CLAUDE.md`, and changing what your users see, get or are promised.

  The screen is a best-effort backstop behind the twin's own rules, and the redaction is a best-effort backstop behind the rule that a secret or personal data never goes into a question. The twin's rules, the red-line floor above, are the main guard against it deciding the risky things. The screen catches only the phrasings listed in "The red-line screen" in [kit/templates/formats.md](kit/templates/formats.md); every example written in backticks in that table asks, and nothing else is promised. A wording outside this list rests on the agent's own red-line floor and on Claude Code's permission prompt, where your settings ask for one. That section also lists the known gaps, the shapes the screen is known to miss.

  The real guard for pushes, deletes, deployments and payments is Claude Code's own permission prompt. It appears only when your permission settings ask for that command: an allow rule for the command, or a mode that skips prompts (for example auto or bypass permissions), means no prompt. Keep prompts on for pushes, deletes, deployments and payments. A screen miss means Claude may act on the twin's verdict without asking you first; it does not run anything by itself, and the command then gets a permission prompt only if your settings ask for one.
- **The ledger script checks every precedent.** A verdict may cite only `none`, or the ids of verdicts already in the ledger. If it cites anything else, the script records the precedent as invalid and Claude asks you.
- **Replies that do not read as a verdict ask you.** No DECISION line, an unknown verdict, a required field missing or empty, a field given twice, an unknown class, a confidence that is not a number from 0 to 1 with up to two decimals, a DECIDE on a Class C question, a DECIDE below 0.70 confidence, a DIRECTIVE below 0.75, more than one block, a field name that is not in its verdict's list, or a `NAME:` line outside the block: each one is recorded and comes to you.
- **No text goes through the shell.** Every text input for the scripts goes through an inbox file, in three steps. First, `node .claude/twin/scripts/ledger.js inbox` checks that `twin/` is a real folder inside your repository, that everything in it is a regular file (no link, junction or folder) and that each file the twin reads there that exists has one hard link, creates a new, empty, regular file with an unguessable name, `twin/inbox-<8 hex>.json`, and prints `inbox ready: <that path>`. Next, Claude writes one JSON object to exactly that path with its own file-writing tool. Last, Claude runs the script with `--file <that path>`, and the script reads the file once and deletes it, so each input is screened against its own text even when two consults run at once. Claude uses a new inbox file for every input. If `ledger.js inbox` refuses, Claude writes no inbox file and tells you the reason it printed; in a consult, it does not ask the twin and asks you the question directly. The command line holds only fixed words and the path `ledger.js inbox` printed, never your text or the twin's text, and no step uses a heredoc, so the shell never reads any of them. `--file` takes only an inbox file `ledger.js inbox` printed: any other path is refused (exit 2) without being read, and so is an inbox file that is a link or not a regular file. Input that is not the expected JSON is refused too; nothing is written then. The scripts also read the same JSON on stdin, for your own scripting.
- **The scripts redact what they write and print, as a best-effort backstop behind the rule never to paste a secret or personal data into a question.** They replace the shapes listed in `.claude/twin/scripts/lib/redact.js` with `[redacted]`; other shapes can pass (see the limits below). The shapes: common key and token shapes, passwords and secrets in assignments and in URLs, authorization headers, private-key blocks and email addresses. This runs on every line a script prints, file names and folder paths included, and on what the scripts write: every ledger line, `twin/evidence.md`, every write to `twin/judgment.md` and `twin/proposals-archive.md`, and your setup answers. A script that changes `twin/stage.md`, `twin/policy.md`, `twin/judgment.md`, `twin/proposals.md` or `twin/proposals-archive.md` rewrites the whole file and redacts all of it, your own text in it included. Long text is cut only after it is redacted. The chat-history folder the kit computes for this repository is shown in full so you can confirm it, with every rule applied except the one for long key-like runs (an email or a key inside that path is still redacted). `setup.js rule --apply` leaves the rest of `CLAUDE.md` as it was, so nothing else in that file is redacted. Claude's own file writes are not redacted: an inbox file holds your text as Claude wrote it (see the limits below).
- **The scripts check the files they open.** They open the files they read and append to without following links, where the system allows it, and check that the file they opened is the one they checked. Temporary files are created next to the file they replace (inside `twin/` for the twin files, beside `CLAUDE.md` for the rule) and moved into place. Every inbox file is new, created exclusively under an unguessable name inside a real `twin/` folder, so no link can be waiting at its path; a reading script deletes it after reading.
- **The scripts make no network connections of their own. The scripts start no other program.** `/twin` writes only inside `twin/`, plus `CLAUDE.md` when you say yes to the rule.

**Limits, stated plainly:**

- The twin is a model, and it can be wrong, even on routine questions. That is why the floor and the screen exist, and why Claude tells you about every verdict it acts on, with its id.
- A hostile `twin/policy.md`, `twin/judgment.md` or ledger cannot remove the floor or the screen. But a repository you clone that ships its own `.claude/agents/twin.md` or `.claude/twin/scripts/` replaces both. After cloning such a repository, reinstall from this pack before you trust the twin. Anyone who can edit those files can change the floor.
- The screen is a phrase list, not an understanding. It catches only the tested phrasings in formats.md, which also lists its known gaps, and a risky request worded any other way can pass it; some such wording will always exist. What stands behind it is the agent's own red-line floor and, for pushes, deletes, deployments and payments, Claude Code's own permission prompt, which appears only when your permission settings ask for that command (an allow rule, or a mode that skips prompts such as auto or bypass permissions, means no prompt). The screen is a backstop that only ever adds a question to you.
- Redaction is a pattern list too, and best effort. A secret in a shape that is not on the list is not redacted. Shapes known to pass: a secret written in prose with no `=` or `:` after its name (for example "the password is" and then the secret), a secret with no name before it and no listed shape, a name that is not on the list (such as `pin`), and personal data other than email addresses, such as names, phone numbers and street addresses. So do not paste secrets or personal data into questions.
- An inbox file is not redacted. It holds the question and the reply (or your answers, or your words) in plain text from Claude's write until the script reads and deletes it. If a run crashes in between, one git-ignored `twin/inbox-<8 hex>.json` stays in `twin/` until you delete it. The file sits in your repository folder, so anything that copies that folder, such as sync or backup, can copy it. The same text is already in Claude Code's own record of the session. So never paste a secret or personal data into a question; describe it instead (for example "the staging database password").
- A program running as you that swaps files or folders in your repository while a script runs, or between `ledger.js inbox` and the twin's reads or Claude's write, can still redirect a read or a write (most easily on Windows, where Node cannot refuse links when opening a file). Such a program could equally edit `.claude/agents/twin.md` itself.
- The consult order is a rule in your `CLAUDE.md` that Claude follows, not a lock. The screen protects only the verdicts that go through the ledger script.

## Known issues

- On Windows, a file a script replaces (for example `twin/stage.md` when you change the stage) does not keep its own access control list: the replacement gets the default permissions of its folder. On Linux and macOS it keeps the file's permission bits.
- When `twin/.gitignore` already exists but lacks some of its lines, `setup.js init` adds them and prints `repaired twin/.gitignore`. The list of what `init` prints in `kit/templates/formats.md` names only `created` and `kept`.
- If `setup.js init` stops part way, for example on a full disk, the file it was writing can be left cut short, and running `init` again keeps that file as it is. On a first setup, delete `twin/` and run `init` again.
- A cut-short entry in `twin/proposals-archive.md` is replaced only when `proposals.js apply` processes that same proposal again; any other cut-short entry stays in the file as it is.

## Remove it

Delete the three installed paths: `.claude/agents/twin.md`, `.claude/commands/twin.md` and the `.claude/twin/` folder. From your app's root folder:

```bash
rm -rf .claude/agents/twin.md .claude/commands/twin.md .claude/twin
```

```powershell
Remove-Item -Recurse -Force .claude/agents/twin.md, .claude/commands/twin.md, .claude/twin
```

If you want, also delete your `twin/` folder (your policy, stage, judgment notes, ledger, proposals and their archive; this cannot be undone), and remove the block in `CLAUDE.md` from `<!-- twin consult rule: start -->` to `<!-- twin consult rule: end -->`, both marker lines included.

## Tested on

Tested on Windows. CI runs Linux and Windows. macOS is untested, but the scripts are plain Node with no native code.
