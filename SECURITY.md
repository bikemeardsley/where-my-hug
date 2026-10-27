# Security

## Supported versions

Fixes ship on `main` and in the next npm release. Use the latest of either.

| Version | Supported |
| --- | --- |
| latest npm release, `main` | ✅ |
| older releases | ❌ |

## Reporting a vulnerability

Report it privately through
[GitHub Security Advisories](https://github.com/bikemeardsley/where-my-hug/security/advisories/new).
Please don't open a public issue for a vulnerability.

Include what you can: the version or commit, steps to reproduce, and what an
attacker gains.

## What Where My Hug At? touches

- **The network:** `GET` requests to `huggingface.co/api`: searches built from
  what the agent writes for each part of a need (a task tag, keywords, a few
  words about the job), and one lookup per model or dataset id it picks, to
  check it exists and read its facts. The same search looks for models and
  datasets on `www.kaggle.com/api`, `zenodo.org/api`, `www.modelscope.cn/openapi`
  and, with a key, `api.roboflow.com`, with one lookup per id picked from them. Every
  id is checked against its hub's id shape before it goes into a URL. Nothing
  else is contacted.
- **`HF_TOKEN`:** read from the environment if set, sent only to
  `huggingface.co`, and never written to a report, a log or a file.
- **`ROBOFLOW_API_KEY`:** the same, sent only to `api.roboflow.com`, as a
  header, never in a URL.
- **Your machine:** it reads no files, writes no files and runs no commands.
- **`--http`:** serves the same three tools on a port, on 127.0.0.1 unless you
  give it a host. Anyone who can reach that port can use them, and with
  `HF_TOKEN` set that includes looking up private repos the token can see;
  with `ROBOFLOW_API_KEY` set, searches run on your Roboflow key.
