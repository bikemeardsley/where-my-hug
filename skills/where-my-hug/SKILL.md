---
name: where-my-hug
description: Find out what Hugging Face already has for a machine learning need before recommending any model or dataset. Use when the user wants a model for a task, asks which Hugging Face model or dataset to use, is looking for training data, or is planning something with ML parts. Splits the need into parts, searches Hugging Face live for each (and Kaggle, Zenodo, ModelScope and Roboflow Universe for datasets), decides from what it finds whether to use a model as is (USE), fine-tune one (TUNE), train one (TRAIN), or write plain code (WRITE), and checks every model and dataset picked, with licenses, gating, dataset sizes and memory sized against the user's hardware.
---

# Where my hug at?

What you remember of Hugging Face is as old as your training and misses the
long tail. So don't pick from memory: Where My Hug At searches Hugging Face
for each part of the need, you pick from what it finds, and it checks every
pick live and writes the report the user sees. Three steps, always in order.

## With the MCP tools

If the `where_my_hug`, `where_my_hug_search` and `where_my_hug_verify` tools
are connected, call `where_my_hug` with the need and follow what it returns.
It says what to ask the user first, what to search, and when to call
`where_my_hug_verify`.

## Without them, from a shell

The same three steps run from a shell. Node 22.18 or later is needed. Write the
JSON to a file and pass it on stdin:

1. `npx -y where-my-hug rubric < details.json`, where
   the file holds `{"need": "...", "compute": "...", "license": "...", "stack": "...", "data": "..."}`.
   Fill what the conversation or codebase already says and leave the rest
   out. If it returns questions, ask the user, then run it again with the
   answers ("unknown" is fine).
2. Follow the method it returns. Where it says to call
   `where_my_hug_search`, write `{"parts": [...]}` to a file and run
   `npx -y where-my-hug search < parts.json`.
3. Pick from what it found. Where the method says to call
   `where_my_hug_verify`, write that JSON to a file and run
   `npx -y where-my-hug verify < slate.json`.
   If its JSON says `SEARCH_FIRST` or `RECALL_REPLACEMENTS`, do what its
   instructions say and run it again.

Show the user the markdown report as it comes back, without restating its
facts from memory. Public models and datasets need no token. Private or gated
ones need the user's Hugging Face token, and Roboflow Universe needs their
Roboflow key, in the server's own configuration (a plugin's settings ask for
both); never ask for either in the chat.
