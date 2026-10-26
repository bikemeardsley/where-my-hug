# Privacy policy

*Effective 15 October 2026.*

Where My Hug At? runs on your own machine. It has no account, no telemetry
and no server of its own, and nothing you do with it reaches the author.

## What leaves your machine

Only read-only searches and lookups, to **Hugging Face**
(`huggingface.co/api`): searches built from what your agent writes for each
part of an ML need (a task tag, keywords, a few words about the job), and one
lookup for each model or dataset it picks. The same few words about each job
also search for datasets on **Kaggle** (`www.kaggle.com/api`), **Zenodo**
(`zenodo.org/api`), **ModelScope** (`www.modelscope.cn/api`, run by Alibaba
Cloud in China) and, if you set a key, **Roboflow Universe**
(`api.roboflow.com`), with one lookup for each dataset picked from them.

An `HF_TOKEN`, if you set one, goes only to `huggingface.co`, and a
`ROBOFLOW_API_KEY` only to `api.roboflow.com`. Neither is ever written to a
report, a log or a file.

Nothing else is contacted. It reads no files, writes no files and runs no
commands on your machine. [SECURITY.md](SECURITY.md) has the full detail.

## Third parties

Hugging Face, Kaggle, Zenodo, ModelScope, Roboflow, npm (where it's
installed from) and the AI assistant you use it with each have their own
privacy policies.

## Changes

Changes to this policy are made in this file, and its history is in the
repository's commits.

## Contact

Questions: [open an issue](https://github.com/bikemeardsley/where-my-hug/issues).
