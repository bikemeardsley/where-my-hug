# Security

## Supported versions

Fixes ship on `main` and in the next npm release. Use the latest of either.

| Version | Supported |
| --- | --- |
| latest npm release, `main` | ✅ |
| older releases | ❌ |

## Reporting a vulnerability

Report it privately through
[GitHub Security Advisories](https://github.com/bikemeardsley/wheres-my-hug/security/advisories/new).
Please don't open a public issue for a vulnerability.

Include what you can: the version or commit, steps to reproduce, and what an
attacker gains.

## What Where's My Hug? touches

- **The network:** `GET` requests to `huggingface.co/api`, one per model or
  dataset id an agent names, to check it exists and read its facts. Nothing
  else is contacted.
- **`HF_TOKEN`:** read from the environment if set, sent only to
  `huggingface.co`, and never written to a report, a log or a file.
- **Your machine:** it reads no files, writes no files and runs no commands.
- **`--http`:** serves the same two tools on a port, on 127.0.0.1 unless you
  give it a host. Anyone who can reach that port can use them, and with
  `HF_TOKEN` set that includes looking up private repos the token can see.
