// The middle step: what Hugging Face has for each part the agent split the need into, found by searching it, not
// recalled. The agent picks from this list; ids it knows that aren't on it may be added, and the report marks them as
// from memory, so what an agent happens to remember never outranks what Hugging Face turned up.
import { search, type Hit, type Query } from './hub.ts';

export interface Wanted extends Query { id: string; name: string }

const MODELS = 15;
const DATASETS = 10;

const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const line = (hit: Hit) => `- ${[
  hit.id, hit.task, hit.rows && `${hit.rows} rows`, hit.license && `license ${hit.license}`,
  hit.downloads !== undefined && `${count(hit.downloads)} downloads a month`,
  hit.likes !== undefined && `${count(hit.likes)} likes`,
  hit.created && `created ${hit.created.slice(0, 10)}`,
  `found: ${hit.found.join(', ')}`,
].filter(Boolean).join('  ·  ')}${hit.snippet ? `\n  > ${hit.snippet}` : ''}`;

export async function find(parts: Wanted[]): Promise<string> {
  const lines = ['# Found on Hugging Face just now', ''];
  for (const part of parts) {
    const [models, datasets] = await Promise.all([search('model', part), search('dataset', part)]);
    const failed = [...models.failed.map((how) => `models: ${how}`), ...datasets.failed.map((how) => `datasets: ${how}`)];
    lines.push(
      `## ${part.name} (${part.id})`, '',
      `Models${models.hits.length > MODELS ? ` (${MODELS} of ${models.hits.length})` : ''}:`,
      ...(models.hits.length ? models.hits.slice(0, MODELS).map(line) : ['- none']), '',
      `Datasets${datasets.hits.length > DATASETS ? ` (${DATASETS} of ${datasets.hits.length})` : ''}:`,
      ...(datasets.hits.length ? datasets.hits.slice(0, DATASETS).map(line) : ['- none']), '',
      ...(failed.length ? [`Hugging Face didn't answer: ${failed.join('; ')}.`, ''] : []),
    );
  }
  lines.push(`Now give each part its verdict from these results, and pick its candidates from them:
- USE: a model listed here does the job as it is.  TUNE: one comes close.  TRAIN: none of them does the job, which these results have to show.
- Judge by what the results say (task, card, use, recency), not by what you remember. A model you know that isn't listed may be added; the report will mark it as from memory.
- Then call where_my_hug_verify, passing each part's search query (task, keywords, phrase) unchanged, so the report can show what the search turned up.`);
  return lines.join('\n');
}
