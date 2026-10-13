---
name: wheres-my-hug
description: Find out what Hugging Face already has for a machine learning need before recommending any model or dataset. Use when the user wants a model for a task, asks which Hugging Face model or dataset to use, or is planning something with ML parts. Splits the need into parts, decides for each whether to use a Hugging Face model as is (USE), fine-tune one (TUNE), train one (TRAIN), or write plain code (WRITE), and checks every model and dataset named live on Hugging Face, with licenses, gating and memory sized against the user's hardware.
---

# Where's my hug at?

Agents know Hugging Face well but misremember ids, licenses and sizes.
So you propose, and Where's My Hug checks every id live on Hugging Face and
writes the report the user sees. Two steps, always in order.

## With the MCP tools

If the `wheres_my_hug` and `wheres_my_hug_verify` tools are connected, call
`wheres_my_hug` with the need and follow what it returns. It says what to ask
the user first and when to call `wheres_my_hug_verify`.

## Without them, from a shell

The same two steps run from a shell. Node 22.18 or later is needed. Write the
JSON to a file and pass it on stdin:

1. `npx -y wheres-my-hug rubric < details.json`, where
   the file holds `{"need": "...", "compute": "...", "license": "...", "stack": "...", "data": "..."}`.
   Fill what the conversation or codebase already says and leave the rest
   out. If it returns questions, ask the user, then run it again with the
   answers ("unknown" is fine).
2. Follow the method it returns. Where it says to call
   `wheres_my_hug_verify`, write that JSON to a file and run
   `npx -y wheres-my-hug verify < slate.json`.
   If its JSON says `RECALL_REPLACEMENTS`, propose new ids for the parts it
   names and run it again.

Show the user the markdown report as it comes back, without restating its
facts from memory. Set `HF_TOKEN` in the environment to include private repos
the token can see; it is sent only to huggingface.co.
