// The middle step: what Hugging Face has for each part the agent split the need into, found by searching it, not
// recalled. The agent picks from this list; ids it knows that aren't on it may be added, and the report marks them as
// from memory, so what an agent happens to remember never outranks what Hugging Face turned up.
import { searchElsewhere } from './elsewhere.ts';
import { count, search, type Hit, type Query } from './hub.ts';

export interface Wanted extends Query { id: string; name: string }

const MODELS = 15;
const DATASETS = 10;

const line = (hit: Hit) => `- ${[
  hit.id, hit.title && `"${hit.title}"`, hit.task, hit.size, hit.license && `license ${hit.license}`,
  hit.downloads !== undefined && `${count(hit.downloads)} downloads a month`,
  hit.downloadsEver !== undefined && `${count(hit.downloadsEver)} downloads in all`,
  hit.likes !== undefined && `${count(hit.likes)} likes`,
  hit.created && `created ${hit.created.slice(0, 10)}`,
  `found: ${hit.found.join(', ')}`,
].filter(Boolean).join('  ·  ')}${hit.snippet ? `\n  > ${hit.snippet}` : ''}`;
const section = (label: string, hits: Hit[], most: number) => [
  `${label}${hits.length > most ? ` (${most} of ${hits.length})` : ''}:`, ...(hits.length ? hits.slice(0, most).map(line) : ['- none']), '',
];

export async function find(parts: Wanted[]): Promise<string> {
  const lines = ['# Found on Hugging Face and other dataset hubs just now', ''];
  for (const part of parts) {
    const [models, datasets, elsewhere] = await Promise.all([search('model', part), search('dataset', part), searchElsewhere(part)]);
    const failed = [...models.failed.map((how) => `models: ${how}`), ...datasets.failed.map((how) => `datasets: ${how}`)];
    lines.push(
      `## ${part.name} (${part.id})`, '',
      ...section('Models', models.hits, MODELS),
      ...section('Datasets', datasets.hits, DATASETS),
      ...section('Datasets on other hubs', elsewhere.hits, DATASETS),
      ...(failed.length ? [`Hugging Face didn't answer: ${failed.join('; ')}.`, ''] : []),
      ...(elsewhere.failed.length ? [`Didn't answer: ${elsewhere.failed.join(', ')}.`, ''] : []),
      ...(elsewhere.skipped.length ? [`Not searched: ${elsewhere.skipped.join(', ')}.`, ''] : []),
    );
  }
  lines.push(`Now give each part its verdict from these results, and pick its candidates from them:
- USE: a model listed here does the job as it is.  TUNE: one comes close.  TRAIN: none of them does the job, which these results have to show.
- Judge by what the results say (task, card, use, recency), not by what you remember. A model you know that isn't listed may be added; the report will mark it as from memory.
- A dataset from another hub keeps its prefix (kaggle:, zenodo:, modelscope:, roboflow:): pass its id as listed, with kind "dataset". Their downloads are all-time, not monthly.
- Then call where_my_hug_verify, passing each part's search query (task, keywords, phrase) unchanged, so the report can show what the search turned up.`);
  return lines.join('\n');
}
