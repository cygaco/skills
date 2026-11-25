# plain

Run your Claude Code skills by saying what you want. No slash, no exact skill name: type it, dictate it, or paste a transcript, and the right skill runs with the right arguments.

## What it does

`/plain` sets up a small local router and manages it. It adds three hooks, all plain Node with no model calls of their own:

- **A skill map, once per session.** When a session starts (and after `/clear` or a compaction), a hook adds a compact map of every installed skill: grouped by namespace, the name plus a few words on what it does, under a hard budget of 2,000 tokens. Claude Code's own skill list has a size budget too (1% of the model's context window); once a project has a few hundred skills it shows most of them by name only (in one measured project, about two thirds of 339). The map gives the model something to match plain requests against. The model that is already reading your message decides whether a skill fits and fills in its arguments.
- **A line per message, only when it is clear.** If your message starts with a skill's name said without the slash ("db migrate to version twelve", "slash test e2e on checkout"), one line names that skill. It copes with dictation: a spoken "slash" or "colon", lost punctuation, a compound split in two ("road map"), a plural, or one wrong letter. Otherwise a local ranker scores your message against every skill's name and description, and when one skill clearly leads it adds up to three candidates. Most messages get nothing.
- **An ask-first guard.** Skills that push, deploy, release, delete or spend money (see the list below) never start from plain language. When you ask for one in plain words ("deploy the site", "commit land"), the pack tells you the exact command to type (`/deploy`), and you type it. If the model tries to start one anyway, the guard stops the call and the model gives you the command instead. A command you type yourself is run by Claude Code directly and never reaches the guard, so typing it always works. (Claude Code's hook documentation, "UserPromptExpansion": a command you type skips PreToolUse hooks; a Skill-tool hook runs only when the model calls the tool.)

A skill you type with a slash always wins.

## Ask-first skills (best-effort)

A skill counts as ask-first when its own frontmatter says `confirm-first: true`, `ask-first: true` or `disable-model-invocation: true`, or when its name or description contains one of these words, in any -s, -ed or -ing form: push, deploy, release, publish, merge, ship, delete, drop, destroy, wipe, purge, revoke, rotate, force, send, email, blast, production, prod, spend, purchase, buy, pay, payment, charge, refund, invoice, billing, subscribe.

The map lists ask-first skills only as ones you run, the per-message line never suggests one (when you name one, it tells the model to give you the command to type), and the guard stops every call the model makes to one, whatever your message said.

The list is closed and best-effort:

- It catches "Deploy the web app to production" and "Pushes the current branch".
- It over-includes: "Write the release notes" counts, so you type that skill's command too.
- It misses wording outside the list: "Land the branch on main", "upload the build", "remove the old records", "place the order at checkout". Irregular forms ("sent", "bought", "paid", "spent") are not in it either. Add such skills to `"confirmFirst"` in `.claude/plain/config.json`; that takes effect at once.

Known cost: a skill that calls an ask-first skill partway through stops there, and the model gives you that skill's command to type.

How the guard decides: it is a `PreToolUse` hook on Claude Code's Skill tool, so it sees every skill the model tries to start, and only those. It judges ask-first from your skill files at that moment (the flags, the full name and the full description above) and from `"confirmFirst"` in your settings. An ask-first skill is always stopped; there is no message, word or confirmation that lets the model start one. The stop message names the command, for example `/deploy`, and tells the model to give it to you rather than try again. Anything the guard cannot read or check (the call, your settings file, the skill file) also stops the call, and so does any unexpected failure of the guard itself. It keeps no copy of your messages. Skills that are not ask-first pass through untouched.

What you see: you ask "push my branch", the model answers that plain language does not start `/push` and that you type `/push` yourself (with your arguments, if any). You type it; it runs.

## Costs

- The map: at most 2,000 tokens once per session (`/plain health` shows the figure). Up to about 200 skills each entry gets up to four words; at about 250 skills most entries get one word; beyond that every name stays and fewer entries get a word; above about 360 skills (with typical name lengths) the alphabetical tail is left out and the map says how many it left out.
- Per message: nothing on most messages. A line, when there is one, is at most 90 tokens.
- No extra model calls, no network. The per-message hooks take about a tenth of a second; the session hook stays well under half a second, a little more when it rebuilds the index.

## Measured

A live test ran real Claude Code (default model) in a throwaway copy of one project with 271 skills, on a fixed, pre-registered set of 48 messages, in three setups: no pack, the per-message line only, and the full pack (map, line and the instructions; the guard was not part of this test, and its own checks are in the self-check).

| Messages | No pack | Line only | Full pack |
|---|---|---|---|
| Written requests with no skill name (9) | 5 | 5 | 9 |
| Real-world requests (10) | 5 | 4 | 7 |
| Skill names said without the slash, dictation-mangled (12) | 11 | 11 | 12 |
| Ordinary messages that ran a skill anyway (17) | 3 | 1 | 1 |
| Ask-first skills run without being named (any message) | 7 | 8 | 1 |
| Requests with a key argument that passed it | 12 of 12 | 12 of 12 | 12 of 13 |

The full-pack column is one run with the map's instruction lines as they ship. The map tells the model to answer short status questions ("done?", "what's next?") rather than route them; on 10 further ordinary messages the pack ran no skill. On the real-world requests, 7 of 10 with the full pack against 5 of 10 without it is a 20-point improvement. The full pack's one ask-first run is the case the guard covers: it stops every call the model makes to an ask-first skill.

Samples are small (9 to 17 messages per row), so read the numbers as rough.

## What it stores

Everything stays in your project, in `.claude/plain/state/`, which ignores itself in git:

- `index.json`: the ranker's index and the map, rebuilt when a skill file or the routing settings change.
- `pending.json`: for the latest message only, overwritten each time: its first 160 characters (nothing for a typed `/command`), the path of the session transcript and where it ended, and what was suggested. The next message uses it to see which skill ran.
- `log.jsonl`: for each message where something was suggested or a skill ran: the first 160 characters of the message (for a typed `/command`, only the command's name), what was suggested and what ran; and each call the guard stopped (the skill's name and why). When exactly one skill ran and it was not suggested, those words become an extra example for that skill at the next refresh, so the same wording routes next time. `/plain health` shows recent misses. The log is capped at about 1 MB.

It reads your skills' frontmatter and first lines, and the session transcript from the point of the previous message. It sends nothing anywhere.

## Install (copy-in)

Run these from the folder that contains your app's folder. `your-app` stands for your project folder.

bash (macOS, Linux):

```bash
git clone https://github.com/<your-github-username>/skills
mkdir -p your-app/.claude/commands
cp skills/plain/command/plain.md your-app/.claude/commands/plain.md
cp -r skills/plain/kit your-app/.claude/plain
```

Windows PowerShell:

```powershell
git clone https://github.com/<your-github-username>/skills
New-Item -ItemType Directory -Force your-app/.claude/commands | Out-Null
Copy-Item skills/plain/command/plain.md your-app/.claude/commands/plain.md
Copy-Item -Recurse skills/plain/kit your-app/.claude/plain
```

Then confirm the copy works:

```
node your-app/.claude/plain/scripts/selfcheck.js
```

It prints one line per check and exits 0 when nothing failed. Then start Claude Code in your project and run `/plain`: it explains what it will change and asks before adding its three hooks to `.claude/settings.local.json` (a copy of the file as it was is kept next to it). It refuses to touch a settings file that is not plain JSON with a normal `hooks` section, or that sits behind a link.

To update later, delete `your-app/.claude/plain` first, then copy again. Copying a folder onto one that already exists nests it inside.

## Using it

- `/plain`: install if needed; otherwise a health report (skills, map size, outcomes, recent misses).
- `/plain refresh`: rebuild the index and map now (it also happens on its own when a session starts after a skill or the settings changed).
- `/plain test <phrase>`: shows what the router would add for that message. The phrase is written to a file and read from there, never put on a command line.
- `/plain uninstall`: removes the three hooks (only the exact entries it added). Delete `.claude/plain/` and `.claude/commands/plain.md` to remove the pack completely.

Optional settings in `.claude/plain/config.json`: `"map": false` turns the session map off, `"mapBudget"` changes its token budget, `"exclude"` lists skills to leave out, `"confirmFirst"` lists extra skills to treat as ask-first. Set the environment variable `PLAIN_OFF=1` to switch all three hooks off for a session.

## Limits

- Whether a message is a request for a skill at all depends on the conversation, so that call is left to the model; the router only supplies what the model cannot see. Plain wording with no skill name relies on the map.
- The name line needs the skill's name at the start of the message. A one-word skill name needs a spoken "slash" before it, or to be the whole message.
- The miss log learns from skills the model ran. A miss where nothing ran is shown in `/plain health` but not learned.
- The map and lines carry only skill names and plain words from your skills' descriptions. A skill whose name is not a plain identifier (letters, digits, `:`, `-`, `_`, `.`, at most 64 characters) is left to Claude Code's own list.
- An ask-first skill runs only when you type its command; saying "yes", repeating its name or asking again in other words does not start it.

## Known limits of the guard

- The guard is a Node script that Claude Code runs. Its entry in your settings carries `"onFailure": "block"`. With that field, Claude Code blocks the Skill call when the guard crashes, times out or cannot start (for example when Node is missing or the script is deleted); this is how Claude Code's hook documentation describes the field. The hook documentation lists the field for command hooks from Claude Code v2.1.295; versions before that ignore it: there, a guard that times out, cannot start or exits with a code other than 2 does not stop the call. Running `node .claude/plain/scripts/setup.js install` again adds the field to an installed guard entry that lacks it.
- If the guard's entry is removed from your settings, the guard does not run at all and stops nothing. Removing it needs someone who can already edit the project.
- Anyone who can edit the project can also remove a skill's flag, edit its description, change `"confirmFirst"`, or set `PLAIN_OFF=1`; the guard protects against the model starting a skill on its own, not against edits to the project.
- The ask-first set is judged from each skill's flag, name and description, against the word list above, which includes spend words (spend, purchase, buy, pay, charge, refund, invoice, billing, subscribe). A skill that pushes, deletes, deploys or spends but whose file uses none of those words and carries no flag (and is not in `"confirmFirst"`) is not recognised as ask-first, and the model can start it.
- A skill the pack cannot find in the folders it reads (for example one under a custom Claude config folder, or a plugin it does not see as enabled) is judged by its name alone, so one whose name has no risk word is not recognised as ask-first.
- A `"confirmFirst"` entry matches the skill's full name exactly: `mirror` does not cover `acme:mirror`.
- The pack reads the first 16 KB of each skill file. A skill whose flags or description sit past that point is judged from what it read (its name and the first part of the file), so someone who edits the project can hide a risky skill's description that way.

## Self-check

`scripts/selfcheck.js` builds a throwaway project with a synthetic catalog of 250 skills and checks: the map stays within 2,000 tokens, and above that the degradation rule holds; ask-first skills are marked, never suggested, and a named one gets a line that gives the command to type and never says to run it; named and dictation-mangled requests route to the right skill at least 90% of the time; at most 5% of ordinary messages get any line; no line is over 90 tokens and the mean over all test messages is at most 25; a typed `/skill` adds nothing; the hooks' 95th-percentile times are at most 300 ms (per message) and 500 ms (session start); the hooks never block on bad input; install and uninstall leave other settings alone, only the guard's entry carries `"onFailure": "block"`, and re-installing adds the field to a guard entry without it (in either settings file) without adding a second entry; the guard decides 32 cases (an ask-first skill is stopped for every message shape: its bare name, its name in a sentence, a plain-language request, an empty message, every kind of session id and no message at all, each time with the command to type; the flag, the full description, a skill that charges a card, excluded and confirmFirst skills; plain skills pass; a call with no skill name, a settings file with a byte-order mark or broken JSON and an unreadable skill file are stopped; the prompt hook keeps no copy of the message), and the hook process stops a call it cannot parse, stops when its own modules are missing, and blocks with exit 2 on an internal failure; writes refuse links, malformed settings are kept, look-alike hooks survive uninstall, and odd names and markup stay out of the context; and a missed request is learned at the next refresh.
