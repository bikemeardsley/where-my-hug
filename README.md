# Where's My Hug?

_Where's my hug at?_ An MCP server that tells your AI agent what the Hugging
Face Hub already has for an ML need, and what it doesn't. Every model and
dataset in its answer has been checked against the live Hub, not recalled from
memory.

## How it works

Two tools, called in order:

1. **`wheres_my_hug`**: the agent sends the need and four details that
   change the answer: compute (where it runs and trains), license (what the
   result may be used for), stack (what calls the model), and data (what
   there is to train on). If any is missing, it gets back questions to ask
   you first, after filling in what the conversation or codebase already
   says. "Not sure yet" is a fine answer: the picks then cover the range.
   With all four, it gets back a method: split the need into parts, decide
   what each part takes, and name exact Hub ids for the parts a model can
   do, with the traps in mind.
2. **`wheres_my_hug_verify`**: the agent sends its slate. Every id is looked up
   on the Hub API. Ids that aren't there are dropped, and a part left with
   nothing goes back to the agent for new candidates. The rest are flagged
   and sized against your compute, and the tool returns the report the user
   sees.

The agent decides what fits and in what order, since fit comes first. Every
fact in the report (license, size, downloads, freshness) comes from the Hub.
Each model shows the memory it needs to run, so a report is still useful
before the hardware is decided.

### Verdicts

| Verdict | Meaning |
|---|---|
| USE | A model on the Hub does this job as it is. |
| TUNE | A model on the Hub comes close: fine-tune it, ideally on a named dataset. |
| TRAIN | Nothing on the Hub comes close: train a model, seeded by named datasets. |
| WRITE | Not a model's job (rules, geometry, parsing, lookups): write the code. |

### Flags

| Flag | When |
|---|---|
| UNCHECKED | The Hub didn't answer (down, rate-limited). The id is kept, and asked again next time. |
| GATED | You must accept its terms on the Hub before downloading. |
| NO_LICENSE | No license on its card. |
| NON_COMMERCIAL | Non-commercial or research-only terms (`cc-by-nc-*`, `*-research`, …). |
| OWN_TERMS | Custom, use-restricted or no-derivatives terms (`other`, Llama, Gemma, RAIL, `-nd-`). |
| STALE | Not updated in two years. |
| LITTLE_USED | Under 100 downloads in the last month. |

### Sizes: what runs here, and what might do better

Every model shows the memory it needs to run: 2.4 bytes per parameter, half
precision plus room for activations. Against the compute you gave (its first
"N GB"):

- The first model that **fits** heads its part.
- Bigger ones follow under "If you can make it work", in the agent's order.
  **A stretch** fits only quantized to 4 bits (0.6 bytes per parameter), or
  on a bigger GPU. **Cloud** needs more than that: the report names the
  providers serving it on the Hub, or says rented GPUs.
- A part where nothing fits still shows its bigger options. It isn't sent
  back for replacements, since the hardware might be found.

With the compute unknown, the agent covers the range and each model's memory
is shown, so the report helps pick the hardware.

A model named as a dataset (or the other way round) is found under the right
kind. Licenses come from the card's metadata: `license`, `license_name` for
custom terms (reported as `other (qwen-research)`), or a `license:` tag.

## Example

From a live run, need: _find a book's cover, spine and page edges in a phone
photo, and read its title_, on one 24 GB GPU (abridged):

```
## TUNE  ·  Find the faces
**Model: microsoft/Florence-2-large**
image-text-to-text · transformers · license mit · 776.7M parameters (~1.9 GB to run) · 404.2k downloads a month
**Data: HuggingFaceM4/DocumentVQA**
Watch out: no license on its card; not updated in two years.
Dropped, not on the Hub (or private): acme/book-corners-v2

## USE  ·  Read the title
**Model: Qwen/Qwen2.5-VL-7B-Instruct**
license apache-2.0 · 8.3B parameters (~19.9 GB to run) · 5.8M downloads a month
If you can make it work, bigger than one 24 GB GPU:
- Qwen/Qwen2.5-VL-32B-Instruct: a stretch: ~80.3 GB to run, ~20.1 GB quantized to 4 bits, hosted by featherless-ai
- Qwen/Qwen2.5-VL-72B-Instruct: cloud: ~176.2 GB to run, hosted by featherless-ai, ovhcloud (own terms)

## WRITE  ·  Straighten
No model: write this one.
```

## Install

Needs Node 22.18 or later (it runs its TypeScript directly).

```sh
git clone https://github.com/bikemeardsley/wheres-my-hug.git
cd wheres-my-hug && npm install
claude mcp add --scope user wheres-my-hug -- node /absolute/path/to/wheres-my-hug/src/server.ts
```

Then ask your agent something like _"Where's my hug at for transcribing
handwritten recipe cards?"_

**`HF_TOKEN` (optional).** Everything public works without one. To include
private repos your account can see, add `-e HF_TOKEN=hf_…` to the
`claude mcp add` line. Claude Code keeps it in its config. Without a token, a
private repo looks missing, because the Hub answers 401 for both.

## What leaves your machine

Only the ids, as GETs to `huggingface.co/api`, plus your token if you set one.
The token is sent only there and never appears in a report. The need, the
method and the report stay between you and your agent.

## Limits

- Sizes come from `safetensors` metadata. Repos with only GGUF or `.bin`
  weights show no parameter count, so they can't be sized against the
  compute.
- License flags read the card's metadata, not the license text.

## Development

```sh
npm test        # offline: the Hub is mocked, and the server is driven over stdio
npm run check   # types
```

## Credits

The two-step shape (a method the agent follows, then a check that owns the
report) comes from [kitbash](https://github.com/Open-Dev-Society/kitbash),
which does this for GitHub repos. No code or text is shared.

## License

MIT
