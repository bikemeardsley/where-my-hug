# Installing Where My Hug At? (for an AI agent)

Where My Hug At? is a local MCP server, published on npm as `where-my-hug`.
There is nothing to clone or build and no API key to obtain.

## Requirements

- Node.js 22.18 or later. Check with `node --version`. If it is older or
  missing, ask the user to install a current Node.js LTS from
  https://nodejs.org before continuing.

## Add the server

Add this entry to the MCP settings (for Cline: `cline_mcp_settings.json`,
opened from the MCP Servers panel, Configure tab):

```json
{
  "mcpServers": {
    "where-my-hug": {
      "command": "npx",
      "args": ["-y", "where-my-hug"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Keep any servers already in the file; add `where-my-hug` beside them.

## Optional: a Hugging Face token

Everything public works without one. Only if the user wants private or gated
repos their Hugging Face account can see, ask them for a token (never invent
one) and add it as an environment variable on the same entry:

```json
"env": { "HF_TOKEN": "hf_..." }
```

The token is sent only to huggingface.co.

## Optional: a Roboflow key

Models and datasets on Kaggle, Zenodo and ModelScope are searched without a
key. Roboflow Universe is searched only with one. Only if the user wants it,
ask for their Roboflow API key (never invent one) and add it beside any token:

```json
"env": { "ROBOFLOW_API_KEY": "..." }
```

It is sent only to api.roboflow.com.

## Check it works

1. The server should show as connected with three tools: `where_my_hug`,
   `where_my_hug_search` and `where_my_hug_verify`. The first start downloads
   the package and can take a few seconds.
2. Try it: ask "Where my hug at for transcribing handwritten recipe cards?"
   Call `where_my_hug` with the need. It returns questions about compute,
   license, stack and data; ask the user, call it again with the answers, and
   follow the method it returns: search each part with `where_my_hug_search`,
   pick from what it finds, then call `where_my_hug_verify` and show the user
   the report it returns.

## If it doesn't start

- `npx` not found: Node.js isn't on the PATH; reinstall Node.js.
- Timed out on first start: start it again (the package is cached after the
  first run), or install it once with `npm install -g where-my-hug` and use
  `"command": "where-my-hug"` with no `args`.
