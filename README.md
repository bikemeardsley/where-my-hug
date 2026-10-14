<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <img src=".github/logo.svg" width="220" alt="The Where My Hug At? mascot: a round ink-drawn character with its arms open wide, eyes glancing sideways, waiting for a hug">
  </picture>
</p>

<h1 align="center">Where My Hug At?</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/where-my-hug"><img src="https://img.shields.io/npm/v/where-my-hug?color=cb3837&logo=npm" alt="npm"></a>
  <a href="https://github.com/bikemeardsley/where-my-hug/actions/workflows/test.yml"><img src="https://github.com/bikemeardsley/where-my-hug/actions/workflows/test.yml/badge.svg" alt="Tests"></a>
  <a href="https://registry.modelcontextprotocol.io/?q=where-my-hug"><img src="https://img.shields.io/badge/MCP_Registry-111111?logo=modelcontextprotocol&logoColor=white" alt="In the official MCP Registry"></a>
  <a href="https://skills.sh/bikemeardsley/where-my-hug/where-my-hug"><img src="https://img.shields.io/badge/skills.sh-111111" alt="On skills.sh"></a>
  <a href="https://huggingface.co/models"><img src="https://img.shields.io/badge/Hugging_Face-FFD21E?logo=huggingface&logoColor=black" alt="Hugging Face"></a>
  <br>
  <a href="#development"><img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="#install"><img src="https://img.shields.io/node/v/where-my-hug?color=339933&logo=nodedotjs&logoColor=white" alt="Node 22.18 or later"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/where-my-hug?color=blue" alt="MIT license"></a>
  <a href="https://buymeacoffee.com/bikemeardsley"><img src="https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"></a>
  <a href="https://www.als.net/donate/"><img src="https://img.shields.io/badge/Donate-ALS_Research-blueviolet" alt="Donate to ALS research"></a>
</p>

Tell your AI agent what you want a model to do. It searches Hugging Face for
each part of the job and tells you which parts already exist there: which are
an exact fit, which to fine-tune, which to train, and which are just code.
Every model it names is real, current, and sized for your hardware.

Works with Claude Code, Codex, Copilot, Cursor, Gemini CLI, Cline, Devin, Open
WebUI and any other MCP client, or as an Agent Skill.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/flow-dark.svg">
    <img src=".github/flow.svg" width="820" alt="Your model need, with four questions (compute, license, stack, data), is split into parts. Parts that are just code are marked write and need no search. Find hug searches Hugging Face for every other part four ways: most downloaded, trending, names and card text. From what it found, each part gets its verdict: use, tune or train. Your report checks every pick live and sizes it for your hardware.">
  </picture>
</p>

## Contents

- [Try it](#try-it)
- [How it works](#how-it-works): [four questions](#1-four-questions-first) ·
  [parts](#2-split-the-job) · [the search](#3-search-hugging-face-for-each-part) ·
  [verdicts](#4-decide-each-part-from-what-turned-up) ·
  [the live check](#5-check-every-pick) · [flags](#flags) ·
  [sizes](#sizes-what-runs-here-and-what-might-do-better)
- [Example: recipe cards](#example-recipe-cards)
- [Install](#install) (every agent, step by step: [USAGE.md](USAGE.md))
- [What leaves your machine](#what-leaves-your-machine) · [Limits](#limits) ·
  [Security](#security)
- [Development](#development) · [Credits](#credits) · [License](#license)

## Try it

Add it to your agent (Claude Code here; [every other option](#install) below):

```sh
claude mcp add --scope user where-my-hug -- npx -y where-my-hug
```

Then ask:

> **Where my hug at for transcribing handwritten recipe cards?**

Your agent asks the few things it can't guess, splits the job into parts, and
comes back with a report like the [one below](#example-recipe-cards), every
model and dataset in it looked up on Hugging Face moments before. It works for
any job a model might do:

> Where my hug at for spotting which birds visit my feeder camera?<br>
> Where my hug at for sorting support emails by how urgent they are?<br>
> Where my hug at for pulling the totals off scanned receipts?

## How it works

### 1. Four questions first

Ask for "a model that reads handwriting" and you get whatever is popular:
often too big for your GPU, under a license you can't ship, or in a format
your code can't load. So before anything is named, four details come first.
Your agent fills in what the conversation or your codebase already says, and
asks you the rest:

| | What it asks | What that decides |
|---|---|---|
| **Compute** | Where will it run, and train if it needs to?<br>_one 24 GB GPU, CPU only, a phone, rented GPUs_ | How big a model can be, and whether fine-tuning is possible at all |
| **License** | What may the result be used for?<br>_commercial, open source, personal_ | Which licenses are allowed |
| **Stack** | What will call the model?<br>_a Python service, Node, the browser, a mobile app_ | Which weight formats work |
| **Data** | What training data is there, or could be?<br>_none, about 300 labeled photos, can collect more_ | Whether fine-tuning or training is realistic |

"Not sure yet" is a fine answer: the picks then cover the range, and every
model shows the memory it needs, so the report helps you decide.

### 2. Split the job

The agent breaks the need into parts, each with an input and an output
(photo → text, text → fields). A part that isn't a model's job (rules,
geometry, parsing, lookups) is marked **WRITE**: code does it exactly. Most
needs have one. A model doing work that code does exactly is a cost, not a
feature.

### 3. Search Hugging Face for each part

What an agent remembers of Hugging Face is as old as its training, and misses
the long tail. So nothing is picked from memory. For every other part, the
agent writes a search (the Hub's task tag, a few keywords, the job in a few
words), and it runs four ways:

| Way | What it finds |
|---|---|
| Most downloaded for the task | What's proven |
| Trending for the task | What's new, including models released after the agent's training |
| Names holding each keyword | Fine-tunes and niche models |
| The text of model and dataset cards | The long tail, by what the card says, like a web search |

The ways take turns in the results, so a niche fine-tune isn't buried under
whatever is popular for the task.

### 4. Decide each part from what turned up

| Verdict | Meaning |
|---|---|
| **USE** | A model the search found does this job as it is. |
| **TUNE** | One comes close: fine-tune it, ideally on a dataset the search found. |
| **TRAIN** | Nothing it found comes close: train a model, seeded by datasets it found. |
| **WRITE** | Not a model's job: write the code. |

The agent judges the results by what they say: task, card, downloads, age. It
may add a model it knows that the search missed, but that pick ranks after
the search's, and the report marks it **from memory**.

### 5. Check every pick

Every pick is looked up on Hugging Face, live. Any that don't exist are
dropped, and the agent goes back to the search for others. The rest are
flagged for what would bite later and sized against your compute, and that
report is what you see. It also lists what the search found that wasn't
picked, so nothing it turned up is hidden. A TRAIN part whose search found
models says to check them before training one. Every fact in the report
(license, size, downloads, freshness) comes from Hugging Face.

Under the hood it's an MCP server with three tools: `where_my_hug` for the
method (steps 1, 2 and 4), `where_my_hug_search` for step 3, and
`where_my_hug_verify` for step 5.

### Flags

| Flag | When |
|---|---|
| UNCHECKED | Hugging Face didn't answer (down, rate-limited). The id is kept, and asked again next time. |
| GATED | You must accept its terms on Hugging Face before downloading. |
| NO_LICENSE | No license on its card. |
| NON_COMMERCIAL | Non-commercial or research-only terms (`cc-by-nc-*`, `*-research`, …). |
| OWN_TERMS | Custom, use-restricted or no-derivatives terms (`other`, Llama, Gemma, RAIL, `-nd-`). Can come with NON_COMMERCIAL: `cc-by-nc-nd` is both. |
| STALE | Not updated in two years. |
| LITTLE_USED | Under 100 downloads in the last month. |

### Sizes: what runs here, and what might do better

Every model shows the memory it needs to run: 2.4 bytes per parameter, half
precision plus room for activations. A model to fine-tune also shows what that
takes: about 1 byte per parameter with QLoRA, 16 in full. Against the compute
you gave (its first "N GB"):

- The first model that **fits** heads its part.
- Bigger ones follow under "If you can make it work": the search's picks
  first, then any from memory.
  **A stretch** fits only quantized to 4 bits (0.6 bytes per parameter), or
  on a bigger GPU. **Cloud** needs more than that: the report names the
  providers serving it on Hugging Face, or says rented GPUs.
- A part where nothing fits still shows its bigger options. It isn't sent
  back for replacements, since the hardware might be found.

A model named as a dataset (or the other way round) is found under the right
kind. Licenses come from the card's metadata: `license`, `license_name` for
custom terms (reported as `other (qwen-research)`), or a `license:` tag.

## Example: recipe cards

The prompt above, from a live run on 2026-10-14 for one 24 GB GPU (abridged):

```
_Searched and checked on Hugging Face just now: 7 named, 1 from memory rather than the search, 0 not there and dropped._

## USE  ·  Read the card
**Model: zai-org/GLM-OCR**
license mit · 1.3B parameters (~3.2 GB to run) · 1.7M downloads a month · found: name has ocr, most downloaded for image-to-text
If you can make it work, bigger than one 24 GB GPU:
- Qwen/Qwen3.8-27B: a stretch: ~66.7 GB to run, ~16.7 GB quantized to 4 bits, hosted by novita, cerebras, …
- google/gemma-4-31B-it: a stretch: ~75.1 GB to run, ~18.8 GB quantized to 4 bits, hosted by novita, …
Also: deepseek-ai/DeepSeek-OCR
The search also found, not picked:
- google/gemma-4-26B-A4B-it (11.3M downloads a month): found as most downloaded for image-text-to-text
- openbmb/MiniCPM-V-4.7-35B-A3B (4.2k downloads a month): found as trending for image-text-to-text

## TUNE  ·  Read the hard hands
**Model: microsoft/trocr-base-handwritten**
license mit · 333.3M parameters (~0.8 GB to run; to fine-tune, ~0.3 GB with QLoRA, ~5.3 GB in full) · found: name has handwritten
**Data: Voxel51/iam_handwriting_finevision**
license cc · 1.9k downloads a month · found: name has handwriting
Also: Teklia/IAM-line (stale, from memory)

## WRITE  ·  Parse the amounts
No model: write this one.
```

Every model there was turned up by the search, including ones released this
year. The one dataset the agent added from what it remembered is marked.

## Install

Needs Node 22.18 or later. **[USAGE.md](USAGE.md) has step-by-step setup
and links for 20+ agents**: Claude Code and Desktop, Codex, Copilot (CLI and
VS Code), Cursor, Windsurf, Devin, Cline, Gemini CLI, Goose, OpenCode, Zed,
Junie, Kiro, Amp, Warp, Continue, LM Studio, Hermes, Mistral Vibe and Open
WebUI. The quick routes:

**Claude Code, Codex, Copilot CLI**, as a plugin: the tools, plus a skill that
knows when to reach for them. One marketplace serves all three.

```sh
/plugin marketplace add bikemeardsley/where-my-hug          # Claude Code
/plugin install where-my-hug@where-my-hug

codex plugin marketplace add bikemeardsley/where-my-hug      # Codex
codex plugin add where-my-hug@where-my-hug

copilot plugin marketplace add bikemeardsley/where-my-hug    # Copilot CLI
copilot plugin install where-my-hug@where-my-hug
```

**Any other MCP client**: a stdio server in the client's config. Most call the
key `mcpServers` ([USAGE.md](USAGE.md) has the exceptions).

```json
{ "mcpServers": { "where-my-hug": { "command": "npx", "args": ["-y", "where-my-hug"] } } }
```

**Gemini CLI**, as an extension: `gemini extensions install https://github.com/bikemeardsley/where-my-hug`

**As an Agent Skill**, for agents that read `SKILL.md`:
`npx skills add bikemeardsley/where-my-hug`.

**`HF_TOKEN` (optional).** Everything public works without one. To include
private or gated repos your account can see, pass a Hugging Face token as
`HF_TOKEN` ([how, per agent](USAGE.md#before-you-start)); the Claude Code
plugin asks for it and keeps it in secure storage. Without a token, a private
repo looks missing, because Hugging Face answers 401 for both.

## What leaves your machine

The search the agent writes for each part (a task tag, keywords, a few words
about the job) and the ids it picks, as GETs to `huggingface.co/api`, plus
your token if you set one. The token is sent only there and never appears in
a report. The need as you wrote it, the method and the report stay between you
and your agent.

Starting it with `npx` (as the MCP server, or the skill's shell fallback)
downloads the `where-my-hug` package from the npm registry, `registry.npmjs.org`.
Nothing is sent there but the request for the package.

## Limits

- Sizes come from `safetensors` metadata. Repos with only GGUF or `.bin`
  weights show no parameter count, so they can't be sized against the
  compute.
- License flags read the card's metadata, not the license text.
- The search finds what the Hub's own search can: names and tags, and the
  text of cards. A model with an unrelated name and a bare card can still be
  missed.
- Card text is searched through the API behind the Hub's search page, which
  isn't documented. If it changes, that way fails and the results say so; the
  other three carry on.

## Security

Report a vulnerability privately through
[GitHub Security Advisories](https://github.com/bikemeardsley/where-my-hug/security/advisories/new),
not a public issue. [SECURITY.md](SECURITY.md) lists what it touches: GETs to
Hugging Face, and nothing on your machine.

## Development

```sh
node src/server.ts   # the server, straight from source
npm test             # offline: Hugging Face is mocked, and the server is driven over stdio and HTTP
npm run check        # types
```

`npm install` also builds JavaScript into `build/`, which is what `npx` runs:
Node won't strip types from a package inside `node_modules`.

## Credits

Inspired by [kitbash](https://github.com/Open-Dev-Society/kitbash), which does
the same for GitHub repos: a method the agent follows, then a check that owns
the report. Where My Hug At? adds the search, so the picks don't rest on what
the agent remembers. No code or text is shared.

## License

MIT
