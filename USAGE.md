# Using Where My Hug At?

Setup for each agent, then what to expect when you use it. The
[README](README.md) has the short version.

- [Before you start](#before-you-start)
- [Using it](#using-it)
- Agents: [Claude Code](#claude-code) · [Claude Desktop](#claude-desktop) ·
  [Codex](#codex) · [GitHub Copilot CLI](#github-copilot-cli) ·
  [VS Code (Copilot)](#vs-code-copilot) · [Cursor](#cursor) ·
  [Windsurf / Devin Desktop](#windsurf--devin-desktop) · [Devin](#devin) ·
  [Cline](#cline) · [Gemini CLI](#gemini-cli) · [Goose](#goose) ·
  [OpenCode](#opencode) · [Zed](#zed) · [JetBrains Junie](#jetbrains-junie) ·
  [Kiro](#kiro) · [Amp](#amp) · [Warp](#warp) · [Continue](#continue) ·
  [LM Studio](#lm-studio) · [Hermes Agent](#hermes-agent) ·
  [Mistral Vibe](#mistral-vibe) · [Open WebUI](#open-webui)
- [As an Agent Skill](#as-an-agent-skill)
- [Updating](#updating) · [Troubleshooting](#troubleshooting)

## Before you start

- **Node.js 22.18 or later** ([nodejs.org](https://nodejs.org)). Every route
  below runs `npx -y where-my-hug`, which downloads the
  [npm package](https://www.npmjs.com/package/where-my-hug) and runs it.
- **A Hugging Face token is optional.** Everything public works without one.
  To include private or gated repos your account can see, create a read token
  at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
  and pass it as `HF_TOKEN`, shown for each agent below. It is sent only to
  huggingface.co.
- **A Roboflow key is optional too.** Models and datasets on Kaggle, Zenodo
  and ModelScope are searched without one. Roboflow Universe, a large home of
  labeled image sets and the models trained on them, is searched only with a
  key: sign up free at [roboflow.com](https://roboflow.com), copy your private
  API key from your workspace's settings (Settings → API Keys), and pass it as
  `ROBOFLOW_API_KEY` the same way as `HF_TOKEN`. It is sent only to
  api.roboflow.com. Without it, the search says Roboflow wasn't searched.
- **On Windows, a key can live in your user environment** instead of a
  config file, typed without it showing on screen. In PowerShell, one line per
  key; agents started afterwards pass it on to the server:

  ```powershell
  [Environment]::SetEnvironmentVariable('ROBOFLOW_API_KEY', [Net.NetworkCredential]::new('', (Read-Host 'Roboflow API key' -AsSecureString)).Password, 'User')
  ```

The server config most agents take, in one place:

```json
{ "mcpServers": { "where-my-hug": { "command": "npx", "args": ["-y", "where-my-hug"] } } }
```

## Using it

Ask your agent in plain words, starting with the hook if you like:

> Where my hug at for transcribing handwritten recipe cards?

1. **Four questions.** The agent fills in what the conversation or your
   codebase already says about compute (where it runs and trains), license
   (what the result may be used for), stack (what calls the model) and data
   (what there is to train on), and asks you the rest. "Not sure yet" is a
   fine answer.
2. **Parts and verdicts.** It splits the job into parts and marks each USE,
   TUNE, TRAIN or WRITE, naming exact models and datasets.
3. **The live check.** Every name is looked up where it lives: Hugging Face,
   or the dataset hub it came from. Missing ones
   are dropped and the agent proposes others; the rest are flagged and sized
   against your hardware. The report you see comes from that check.

Agents usually call it on their own when you ask which Hugging Face model to
use. To be sure, name it: "use where my hug at".

## Claude Code

As a plugin (the tools plus a skill that knows when to use them):

```
/plugin marketplace add bikemeardsley/where-my-hug
/plugin install where-my-hug@where-my-hug
```

It asks for the optional Hugging Face token and Roboflow key and keeps them in
secure storage.

Or the tools alone:

```sh
claude mcp add --scope user where-my-hug -- npx -y where-my-hug
# with keys (the name comes before -e, which takes every value after it):
# claude mcp add --scope user where-my-hug -e HF_TOKEN=hf_... -e ROBOFLOW_API_KEY=... -- npx -y where-my-hug
```

Docs: [plugins](https://code.claude.com/docs/en/plugins/install) ·
[MCP](https://code.claude.com/docs/en/mcp)

## Claude Desktop

Settings → Developer → Edit Config opens `claude_desktop_config.json`. Add the
server under `mcpServers` (with `"env": { "HF_TOKEN": "hf_...", "ROBOFLOW_API_KEY": "..." }`
for any key you want), save, and restart Claude Desktop.

Docs: [local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)

## Codex

As a plugin (tools plus skill):

```sh
codex plugin marketplace add bikemeardsley/where-my-hug
codex plugin add where-my-hug@where-my-hug
```

Or in `~/.codex/config.toml`. Codex gives a server 10 seconds to start by
default, so allow more for the first download:

```toml
[mcp_servers.where-my-hug]
command = "npx"
args = ["-y", "where-my-hug"]
startup_timeout_sec = 120
# env = { HF_TOKEN = "hf_...", ROBOFLOW_API_KEY = "..." }
```

Docs: [Codex MCP](https://developers.openai.com/codex/mcp) ·
[config reference](https://developers.openai.com/codex/config-reference)

## GitHub Copilot CLI

```sh
copilot plugin marketplace add bikemeardsley/where-my-hug
copilot plugin install where-my-hug@where-my-hug
```

Docs: [Copilot CLI plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing)

## VS Code (Copilot)

Add `.vscode/mcp.json` to a project, or run **MCP: Open User Configuration**
for every project. VS Code's key is `servers`:

```json
{
  "servers": {
    "where-my-hug": { "type": "stdio", "command": "npx", "args": ["-y", "where-my-hug"] }
  }
}
```

Docs: [MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

## Cursor

Add the server to `~/.cursor/mcp.json` (every project) or `.cursor/mcp.json`
(one project), under `mcpServers`.

Docs: [Cursor MCP](https://cursor.com/docs/context/mcp)

## Windsurf / Devin Desktop

Open the MCP settings from Cascade (the hammer icon → Configure), which edits
`mcp_config.json`, and add the server under `mcpServers`.

Docs: [Cascade MCP](https://docs.devin.ai/desktop/cascade/mcp)

## Devin

- **Devin CLI:** `devin plugins install bikemeardsley/where-my-hug` (it reads
  the same plugin as Claude Code).
- **Devin (cloud):** Customize → MCPs → Add custom MCP, transport stdio,
  command `npx`, args `-y where-my-hug`.

Docs: [Devin CLI plugins](https://docs.devin.ai/cli/extensibility/plugins/overview) ·
[Devin MCP](https://docs.devin.ai/work-with-devin/mcp.md)

## Cline

MCP Servers panel → Configure → edit `cline_mcp_settings.json` and add the
server under `mcpServers`. Or ask Cline to install it: it follows
[llms-install.md](llms-install.md).

Docs: [Cline MCP](https://docs.cline.bot/mcp-servers/configuring-mcp-servers)

## Antigravity CLI

```sh
agy plugin install https://github.com/bikemeardsley/where-my-hug/tree/main/plugin
```

The plugin brings the skill and the MCP server. Coming from the Gemini CLI
extension? `agy plugin import gemini` converts it.

## Gemini CLI

```sh
gemini extensions install https://github.com/bikemeardsley/where-my-hug
```

Or add the server under `mcpServers` in `~/.gemini/settings.json`.

Docs: [Gemini CLI extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/) ·
[MCP](https://geminicli.com/docs/tools/mcp-server)

## Goose

`goose configure` → Add Extension → Command-line Extension, command
`npx -y where-my-hug`. Or in `~/.config/goose/config.yaml`:

```yaml
extensions:
  where-my-hug:
    type: stdio
    cmd: npx
    args: ["-y", "where-my-hug"]
    enabled: true
    timeout: 300
```

Docs: [Goose extensions](https://goose-docs.ai/docs/guides/config-files)

## OpenCode

In `opencode.json`:

```json
{ "mcp": { "where-my-hug": { "type": "local", "command": ["npx", "-y", "where-my-hug"] } } }
```

Docs: [OpenCode MCP](https://opencode.ai/docs/mcp-servers)

## Zed

In Zed's `settings.json`:

```json
{ "context_servers": { "where-my-hug": { "command": "npx", "args": ["-y", "where-my-hug"] } } }
```

Docs: [Zed MCP](https://zed.dev/docs/ai/mcp)

## JetBrains Junie

Add the server under `mcpServers` in `~/.junie/mcp/mcp.json` (or
`.junie/mcp/mcp.json` in a project). JetBrains AI Assistant takes the same
JSON in Settings → Tools → AI Assistant → MCP.

Docs: [Junie MCP](https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html) ·
[AI Assistant MCP](https://www.jetbrains.com/help/ai-assistant/mcp.html)

## Kiro

Add the server under `mcpServers` in `~/.kiro/settings/mcp.json` (or
`.kiro/settings/mcp.json` in a project).

Docs: [Kiro MCP](https://kiro.dev/docs/cli/mcp/configuration)

## Amp

In `~/.config/amp/settings.json`:

```json
{ "amp.mcpServers": { "where-my-hug": { "command": "npx", "args": ["-y", "where-my-hug"] } } }
```

Docs: [Amp MCP](https://ampcode.com/docs/customize/mcp)

## Warp

Settings → AI → MCP Servers → Add, then paste the JSON from
[Before you start](#before-you-start). Warp also picks up servers already set
up for Claude Code or Codex.

Docs: [Warp MCP](https://docs.warp.dev/agents/capabilities/mcp)

## Continue

In `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: where-my-hug
    type: stdio
    command: npx
    args: ["-y", "where-my-hug"]
```

Docs: [Continue MCP](https://docs.continue.dev/customize/deep-dives/mcp)

## LM Studio

Program → Install → Edit mcp.json, and add the server under `mcpServers`.
Use a model with tool calling.

Docs: [LM Studio MCP](https://lmstudio.ai/docs/app/mcp)

## Hermes Agent

In `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  where-my-hug:
    command: npx
    args: ["-y", "where-my-hug"]
```

Docs: [Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)

## Mistral Vibe

In `~/.vibe/config.toml`:

```toml
[[mcp_servers]]
name = "where-my-hug"
transport = "stdio"
command = "npx"
args = ["-y", "where-my-hug"]
```

Docs: [Vibe MCP](https://docs.mistral.ai/en/vibe/code/cli/mcp-servers)

## Open WebUI

Open WebUI speaks MCP over HTTP, so run the server in HTTP mode:

```sh
npx -y where-my-hug --http 0.0.0.0:8000
```

Then Admin Settings → External Tools → add `http://<host>:8000/mcp`, type
MCP (Streamable HTTP). Without a host it listens on 127.0.0.1 only. Anyone who
can reach the port can use it, including, with `HF_TOKEN` set, looking up
private repos the token can see, and, with `ROBOFLOW_API_KEY` set, searching
Roboflow on your key.

Docs: [Open WebUI MCP](https://docs.openwebui.com/features/extensibility/mcp/)

## As an Agent Skill

For agents that read `SKILL.md` (Cline, Cursor, Copilot, Goose, OpenCode,
Amp, Zed, Junie, Hermes, Mistral Vibe and more):

```sh
npx skills add bikemeardsley/where-my-hug
```

The skill uses the MCP tools when they're connected, and otherwise runs the
same three steps from a shell:

```sh
npx -y where-my-hug rubric < details.json
npx -y where-my-hug search < parts.json
npx -y where-my-hug verify < slate.json
```

Listing: [skills.sh](https://skills.sh/bikemeardsley/where-my-hug/where-my-hug)

## Updating

`npx -y where-my-hug` runs the latest release. The Claude Code, Codex,
Copilot, Cursor and Gemini plugins pin a version and update with the plugin
(`/plugin update` in Claude Code). A global install updates with
`npm install -g where-my-hug@latest`.

## Troubleshooting

- **It never connects:** check `node --version` is 22.18 or later, and that
  `npx -y where-my-hug --help` prints the usage.
- **It times out on first start:** the first run downloads the package. Give
  the agent longer (Claude Code reads `MCP_TIMEOUT`; Codex
  `startup_timeout_sec`), or install it once with
  `npm install -g where-my-hug` and use `where-my-hug` as the command.
- **A private repo shows as missing:** set `HF_TOKEN`. Without one, Hugging
  Face answers "not found" for private repos.
- **"Not searched: Roboflow Universe":** set `ROBOFLOW_API_KEY`. A Roboflow
  pick without it is kept but marked unchecked.
- **Anything else:** [open an issue](https://github.com/bikemeardsley/where-my-hug/issues).
