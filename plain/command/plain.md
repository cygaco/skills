---
description: "Use your skills by just saying what you want: no slash, no exact name, typed or dictated. Sets up a small local router (three hooks, no model calls) and manages it: refresh, health, recent misses, test a phrase, uninstall."
argument-hint: "[health | refresh | test <phrase> | uninstall]"
---

# /plain: run your skills from plain language

You are running `/plain` in the user's project. It manages a local router that lets the user run any installed skill by saying what they want, without typing `/` and the skill's name. Everything it uses is in `.claude/plain/`. It never calls a model on its own and never sends anything anywhere.

Run every command below from the project root. Show the user short plain-language results, not raw JSON.

## Step 1: check the state

Run `node .claude/plain/scripts/setup.js status`. It prints JSON with a `state` of `not-installed`, `partly-installed` or `installed`.

## Step 2a: not installed (or partly installed)

Explain it in exactly three lines, then ask one question:

1. "Say what you want, typed or dictated, and the right skill runs: no slash and no exact name needed."
2. "It adds three hooks to `.claude/settings.local.json`: one puts a short map of your skills into each new session (at most 2,000 tokens), one adds a single line to a message only when you name a skill or a match is very clear, and one stops the model from starting a skill that pushes, deploys, releases, deletes or spends money: for those it tells you the command, and you type it."
3. "It runs locally with no extra model calls. It keeps a small log of misses in `.claude/plain/state/` (ignored by git) so it gets better next time."

Ask: "Install it?" and wait for the answer.

- Yes: run `node .claude/plain/scripts/setup.js install`. Report the number of skills it found and the map size in tokens. Say that the map starts with the next session (or after `/clear`), and that the name line works from the next message.
- No: stop. Change nothing.

`partly-installed` means one or two of the three hooks are missing. Say which one, and offer to run install again to add it.

## Step 2b: installed

Look at the argument the user gave after `/plain`:

- No argument, or `health`: run `node .claude/plain/scripts/setup.js health`. Report in a few lines: the number of skills, whether the index is fresh (`index.fresh`), the map size in tokens and how many skills it shows, the outcome counts from `log.counts` (hit, miss, unsuggested, unused, typed), and the recent misses from `log.recentMisses` (the message excerpt, what was suggested and what ran). If the index is not fresh, offer to refresh. Then offer the other actions in one line: refresh, test a phrase, uninstall.
- `refresh`: run `node .claude/plain/scripts/setup.js refresh`. Report the skill count, how many learned phrases from past misses went into the index, and the map size.
- `test <phrase>`: never put the phrase on a command line. Use your file-writing tool to write the phrase, exactly as the user gave it, to `.claude/plain/state/test-phrase.txt`, then run `node .claude/plain/scripts/setup.js test --file .claude/plain/state/test-phrase.txt`. Report which layer would answer (`name`, `hint` or `none`), the skills it would name, the exact line it would add and its size in tokens, and the top three ranker scores. If the layer is `none`: when `mapListsAll` is true, say the session map lists every skill, so you would choose from the map; when it is false, say the map names only some of the skills (it is over its budget) and the rest are in Claude Code's own list.
- `uninstall`: ask "Remove the three hooks? Your files in `.claude/plain/` stay until you delete them." On yes, run `node .claude/plain/scripts/setup.js uninstall` and report what it removed and the two paths the user can delete to remove the pack completely. On no, change nothing.

## Rules

- A skill the user types with a slash always wins over anything the router suggests.
- Ask-first skills (ones that push, deploy, release, delete or spend money) never start from plain language. When the user asks for one in plain words, do not call it: tell them the exact command to type, such as `/deploy`. The guard stops every call to one, whatever the message said.
- Never edit the user's skills or their descriptions.
- The install changes one settings file (`.claude/settings.local.json` by default) and keeps a copy of it next to it as `settings.local.json.before-plain`; it adds nothing already present in either settings file. If the file is not valid JSON, has a `hooks` section that is not plain lists, or sits behind a link, the install stops and says so; do not repair it yourself without asking.
