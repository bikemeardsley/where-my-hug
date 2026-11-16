# Where My Hug At? (skill only)

The `where-my-hug` skill, for Anthropic's plugin directory, which takes no MCP
server from this plugin. The skill works through Where My Hug At's MCP tools
and runs nothing itself, so add the server once:

```sh
claude mcp add --scope user where-my-hug -- npx -y where-my-hug
```

Two optional keys go before the `--`: `-e HF_TOKEN=...` adds private and gated
repos your account can see, `-e ROBOFLOW_API_KEY=...` adds Roboflow Universe.
[USAGE.md](../USAGE.md) covers other clients.

Or install the full plugin, with the MCP server and a settings form for both
keys, from [`plugin/`](../plugin): `/plugin marketplace add bikemeardsley/where-my-hug`,
then `/plugin install where-my-hug@where-my-hug`.

**What leaves your machine:** the skill sends nothing. The server you add makes
`GET` requests to `huggingface.co/api` and to the APIs of Kaggle, Zenodo,
ModelScope and, with a key, Roboflow (searches from what your agent writes for
each part of the job, and the ids it picks); the token goes only to
huggingface.co and the key only to api.roboflow.com. `npx` fetches the package
from `registry.npmjs.org`. Nothing else ([PRIVACY.md](../PRIVACY.md)).
