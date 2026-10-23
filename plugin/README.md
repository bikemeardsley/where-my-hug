# Where My Hug At? (plugin)

Tell your AI agent what you want a model to do. It searches Hugging Face for
each part of the job and tells you which parts already exist there: which are
an exact fit, which to fine-tune, which to train, and which are just code.
Every model and dataset it picks is checked live on Hugging Face, flagged for
license, gating and staleness, and sized against your hardware.

This plugin adds two things to Claude Code:

- **The `where-my-hug` MCP server**, run with `npx -y where-my-hug@0.2.1`
  from the [npm package](https://www.npmjs.com/package/where-my-hug). It
  makes `GET` requests to `huggingface.co/api` (searches from what your agent
  writes for each part of the job, and the model and dataset ids it picks),
  and nothing else. It reads and writes no files. `npx` downloads the package
  from the npm registry (`registry.npmjs.org`) when it starts.
- **The `where-my-hug` skill**, which tells Claude when to use it. If the
  server isn't connected, the skill runs the same three steps with
  `npx -y where-my-hug` in a shell, which reaches the same two places: the npm
  registry and `huggingface.co/api`.

An optional Hugging Face token, asked for when you enable the plugin and kept
in secure storage, adds private and gated repos your account can see. It is
sent only to huggingface.co.

Try: _"Where my hug at for transcribing handwritten recipe cards?"_

Source, full documentation and other agents:
[github.com/bikemeardsley/where-my-hug](https://github.com/bikemeardsley/where-my-hug).
MIT licensed.
