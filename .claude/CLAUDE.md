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
  `.claude-plugin/plugin.json`, `mcp.json` (Cursor's), `gemini-extension.json`,
  `skills/where-my-hug/SKILL.md` and the README: change one, change them all.
  The three manifests pin the version (`where-my-hug@0.1.0`), as Claude's
  plugin directory requires; the README and skill don't.
- **A release** bumps the version in `package.json`, `server.json` (twice),
  `.claude-plugin/plugin.json` (`version` and the pin), `mcp.json`,
  `gemini-extension.json` and `.claude-plugin/package.json` (then
  `npm install --package-lock-only --ignore-scripts` in `.claude-plugin/` once
  the new version is on npm, for the directory's launcher lock); then `npm publish` (staged: approve it on
  npmjs.com), a `vX.Y.Z` tag and GitHub release, and `mcp-publisher publish`
  for the MCP registry.
- **American English** in code, docs and commits.
- **General, not tied to any one project.** It came out of Thicken's vision
  work, but nothing here should know about books, slabs or Thicken.
- **Kitbash is GPL-2.0 and not ours.** This borrows its idea (a rubric the
  agent follows, then a verify step that owns the report), never its code or
  text.
- Public on bikemeardsley/where-my-hug and npm (where-my-hug), MIT. `HF_TOKEN` is read
  from the environment (the Claude plugin asks for it and passes it in), sent
  only to huggingface.co, and never recorded.
- Tests run offline: Hugging Face is mocked.
