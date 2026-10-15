# Where My Hug At?

An MCP server: describe an ML need, and it says which parts the Hugging Face
already covers (USE), which to fine-tune from a base model (TUNE), which need
their own training (TRAIN), and which aren't a model at all (WRITE), with every
model and dataset checked live on Hugging Face. Start with
[README.md](../README.md).

## Conventions

- **Ponytail on, full intensity.** Shortest correct diff; no abstractions,
  config or scaffolding nobody asked for.
- **TypeScript**, Node 22.18+, run straight from source (type stripping) in
  development. `tsc` builds `build/` only on install (`prepare`), because Node
  won't strip types inside `node_modules`, which is where `npx` puts it.
  Dependencies pinned to exact versions; never auto-upgrade.
- **One entry point, every client.** `npx -y where-my-hug` (the npm package)
  is what the Claude Code plugin, the Cursor plugin, the Gemini extension,
  other MCP clients and the skill's shell fallback all run. It's written in
  `plugin/.claude-plugin/plugin.json`, `plugin/mcp.json` (Agent Plugins, for
  Copilot; beside it `plugin/plugin.json`), `mcp.json` (Cursor's), `gemini-extension.json`,
  `skills/where-my-hug/SKILL.md` (copied to `plugin/skills/`, a test keeps them equal) and the README: change one, change them all. The Claude plugin lives in `plugin/` so its folder holds only what the plugin ships.
  The manifests pin the version (`where-my-hug@0.2.0`), as Claude's
  plugin directory requires; the README and skill don't.
- **A release** bumps the version in `package.json`, `server.json` (twice),
  `plugin/.claude-plugin/plugin.json` (`version` and the pin),
  `plugin/plugin.json`, `plugin/mcp.json` (the pin), `mcp.json`,
  `gemini-extension.json` and `plugin/package.json` (then
  `npm install --package-lock-only --ignore-scripts` in `plugin/` once
  the new version is on npm, for the directory's launcher lock); then `npm publish` (staged: approve it on
  npmjs.com), a `vX.Y.Z` tag and GitHub release, and `mcp-publisher publish`
  for the MCP registry.
- **The diagram** (`.github/flow.svg` and `flow-dark.svg`, kept in step) is
  drawn with the `/diagram-design` skill, which runs locally, not in the cloud: change
  it with that skill, not by hand. `.diagram-design` points the skill at the
  `where-my-hug` profile (in `~/.diagram-design/profiles/`, not the repo).
  Then re-render `.github/social-preview.png`
  from `social-preview.svg` at 1280×640 (it pulls in `logo.svg` and `flow.svg`)
  and upload it under the repo's Settings → Social preview.
- **American English** in code, docs and commits.
- **General, not tied to any one project.** It came out of Thicken's vision
  work, but nothing here should know about books, slabs or Thicken.
- **Search decides, memory only supplements.** Candidates come from a live
  search of Hugging Face (`where_my_hug_search`). What an agent remembers may
  be added, but it ranks after the search's picks and the report labels it
  "from memory". Don't add a path where a remembered id decides anything.
- **Kitbash is GPL-2.0 and not ours.** Never its code or text. The README
  no longer credits it (decided 2026-10-14): the search-first design is our
  own, and only the goal, reuse before building, is shared.
- **Git for Me!** (`P:\windsurf\git-for-me`, public as bikemeardsley/git-for-me)
  is the companion: the same tool for open-source repos on GitHub, GitLab
  and Codeberg. Each README links the other; keep the two in step where they
  share shape. It found a gap this one shares: a part searched again turns
  its earlier finds into "from memory", since verify takes one search per
  part; Git for Me! now takes a list of up to 3, which is worth porting.
- Public on bikemeardsley/where-my-hug and npm (where-my-hug), MIT. `HF_TOKEN` is read
  from the environment (the Claude plugin asks for it and passes it in), sent
  only to huggingface.co, and never recorded.
- Tests run offline: Hugging Face is mocked.
