# Where My Hug At? (skill only)

The `where-my-hug` skill, for Anthropic's plugin directory, which takes no MCP
server from this plugin. Claude runs the same three steps from the shell
instead (`npx -y where-my-hug rubric`, `search`, `verify`). Two optional keys
go in your environment: `HF_TOKEN` adds private and gated repos your account
can see, `ROBOFLOW_API_KEY` adds Roboflow Universe.

The full plugin, with the MCP server and a settings form for both keys, is in
[`plugin/`](../plugin): `/plugin marketplace add bikemeardsley/where-my-hug`,
then `/plugin install where-my-hug@where-my-hug`.

**What leaves your machine:** `GET` requests to `huggingface.co/api` and to
the APIs of Kaggle, Zenodo, ModelScope and, with a key, Roboflow (searches
from what your agent writes for each part of the job, and the ids it picks);
the token only to huggingface.co and the key only to api.roboflow.com; and the
package itself, from `registry.npmjs.org`. Nothing else.
