# skills

Copy-in skill packs for Claude Code.

Each pack is a folder you copy into your own project. It works in any project, with nothing to install beyond Claude Code and Node 20 or newer. No framework, no agents, no npm packages. Tested on Windows; CI runs Linux and Windows; macOS is untested (plain Node, no native code).

## Packs

| Pack | Status | What it does |
|---|---|---|
| [`lastmile`](lastmile/README.md) | available | Reviews a working app for launch readiness, then plans and guides the path to the first paid customer. |
| [`competitor`](competitor/README.md) | available | Researches competitors and writes a report, optionally compared against your own project. |
| `twin` | coming soon | Sets up a read-only judgment helper that answers routine questions the way you would. |

## Install a pack

Clone the repo once:

```
git clone https://github.com/<your-github-username>/skills
```

Every pack has a `pack.json`. Its `install` list says what to copy: each entry copies `<pack>/<from>` to `<your-app>/<to>`, and a folder is copied with everything in it. Its `selfcheck` command, run from your app's root folder, confirms the install worked.

Each pack's README has the exact copy commands for bash (macOS, Linux) and for Windows PowerShell.

To remove a pack, delete the paths its `install` list copied in.

## How the check works

`npm test` installs every pack into an empty temporary project and verifies that it needs nothing outside itself. It rejects references to outside frameworks, broken links, requires that reach outside the pack, and a failing self-check.

In more detail, it:

- installs each pack into an empty temporary project, using the pack's `install` list;
- scans every file in the repo, and the git history, for forbidden shapes;
- scans the same text for hashed names (transform: NFKC, lowercase, split on anything that is not a letter or digit, then SHA-256 of every word and every adjacent word pair);
- checks slash-command closure (every namespaced slash command mentioned anywhere in the repo must be declared in some pack's `pack.json`) and link closure (every relative Markdown link in an installed pack resolves to a file inside it);
- checks that every `require` is a Node built-in or a file inside the installed pack, and that no script path climbs out of the pack;
- runs the pack's own self-check inside the temporary project;
- checks that the `files` list in `pack.json` matches the files on disk.

Two optional local lists can be added through environment variables, `STANDALONE_PERSONAL_TOKENS` and `STANDALONE_INSTANCE_TOKENS`, each holding the path to a local file. Without them the check says so and runs everything else. With `STANDALONE_REQUIRE_LOCAL=1`, both lists become mandatory and a missing one fails the run.

CI runs `npm test` on every push and pull request.

## License

MIT. See [LICENSE](LICENSE).
