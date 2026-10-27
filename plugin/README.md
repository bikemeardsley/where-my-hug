# Where My Hug At? (plugin)

Tell your AI agent what you want a model to do. It searches Hugging Face,
Kaggle, Zenodo, ModelScope and Roboflow Universe for models and datasets for
each part of the job, and tells you which parts already exist: which are an
exact fit, which to fine-tune, which to train, and which are just code. One
found on several hubs is one finding, with every hub listed. Every model and
dataset it picks is checked live on its hub, flagged for license, gating and
staleness, and sized against your hardware.

This plugin adds two things to Claude Code:

- **The `where-my-hug` MCP server**, run with `npx -y where-my-hug@0.3.1`
  from the [npm package](https://www.npmjs.com/package/where-my-hug). It
  makes `GET` requests to `huggingface.co/api` (searches from what your agent
  writes for each part of the job, and the model and dataset ids it picks),
  and to the APIs of Kaggle, Zenodo, ModelScope and, with a key, Roboflow (the
  same search, and the ids picked from it), and nothing else. It reads and writes no files. `npx` downloads the package
  from the npm registry (`registry.npmjs.org`) when it starts.
- **The `where-my-hug` skill**, which tells Claude when to use it. If the
  server isn't connected, the skill runs the same three steps with
  `npx -y where-my-hug` in a shell, which reaches the same places.

Two optional keys, asked for when you enable the plugin and kept in secure
storage: a Hugging Face token adds private and gated repos your account can
see, sent only to huggingface.co; a Roboflow API key adds Roboflow Universe to
the search, sent only to api.roboflow.com.

Try: _"Where my hug at for transcribing handwritten recipe cards?"_

Source, full documentation and other agents:
[github.com/bikemeardsley/where-my-hug](https://github.com/bikemeardsley/where-my-hug).
MIT licensed.
