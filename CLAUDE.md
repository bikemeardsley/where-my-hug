# Where's My Hug?

An MCP server: describe an ML need, and it says which parts the Hugging Face
Hub already covers (USE), which to fine-tune from a base model (TUNE), which
need their own training (TRAIN), and which aren't a model at all (WRITE), with
every model and dataset checked against the live Hub. Start with
[README.md](README.md).

## Conventions

- **Ponytail on, full intensity.** Shortest correct diff; no abstractions,
  config or scaffolding nobody asked for.
- **TypeScript**, Node 22.18+, run straight from source (type stripping); `tsc`
  only checks. Dependencies pinned to exact versions; never auto-upgrade.
- **American English** in code, docs and commits.
- **General, not tied to any one project.** It came out of Thicken's vision
  work, but nothing here should know about books, slabs or Thicken.
- **Kitbash is GPL-2.0 and not ours.** This borrows its idea (a rubric the
  agent follows, then a verify step that owns the report), never its code or
  text.
- Private for now on bikemeardsley, MIT, public once clean. `HF_TOKEN` is read
  from the environment, sent only to huggingface.co, and never recorded.
- Tests run offline: the Hub is mocked.
