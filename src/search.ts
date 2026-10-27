// The middle step: what the hubs have for each part the agent split the need into, found by searching them, not
// recalled. The agent picks from this list; ids it knows that aren't on it may be added, and the report marks them as
// from memory, so what an agent happens to remember never outranks what the search turned up.
import { count, search, type Hit, type Query } from './hub.ts';

export interface Wanted extends Query { id: string; name: string }

const MOST = 20; // of each kind: a dozen ways in, so the first hit or two of each

const line = (hit: Hit) => `- ${[
  hit.id, hit.title && `"${hit.title}"`, hit.task, hit.size, hit.license && `license ${hit.license}`,
  hit.downloads !== undefined && `${count(hit.downloads)} downloads a month`,
  hit.downloadsEver !== undefined && `${count(hit.downloadsEver)} downloads in all`,
  hit.likes !== undefined && `${count(hit.likes)} likes`,
  hit.created && `created ${hit.created.slice(0, 10)}`,
  hit.also && `also on ${hit.also.join(', ')}`,
  `found: ${hit.found.join(', ')}`,
].filter(Boolean).join('  ·  ')}${hit.snippet ? `\n  > ${hit.snippet}` : ''}`;
const section = (label: string, hits: Hit[]) => [
  `${label}${hits.length > MOST ? ` (${MOST} of ${hits.length})` : ''}:`, ...(hits.length ? hits.slice(0, MOST).map(line) : ['- none']), '',
];

export async function find(parts: Wanted[]): Promise<string> {
  const lines = ['# Found on Hugging Face and the other hubs just now', ''];
  for (const part of parts) {
    const [models, datasets] = await Promise.all([search('model', part), search('dataset', part)]);
    const failed = ([['models', models.failed], ['datasets', datasets.failed]] as const).filter(([, ways]) => ways.length).map(([kind, ways]) => `${kind}: ${ways.join(', ')}`);
    lines.push(
      `## ${part.name} (${part.id})`, '',
      ...section('Models', models.hits),
      ...section('Datasets', datasets.hits),
      ...(failed.length ? [`Didn't answer: ${failed.join('; ')}.`, ''] : []),
      ...(models.skipped.length ? [`Not searched: ${models.skipped.join(', ')}.`, ''] : []),
    );
  }
  lines.push(`Now give each part its verdict from these results, and pick its candidates from them:
- USE: a model listed here does the job as it is.  TUNE: one comes close.  TRAIN: none of them does the job, which these results have to show.
- Judge by what the results say (task, card, use, recency), not by what you remember. A model you know that isn't listed may be added; the report will mark it as from memory.
- An id from another hub keeps its prefix (kaggle:, zenodo:, modelscope:, roboflow:): pass it as listed, with its kind. One on several hubs is listed once, with the others after "also on": pass its first id, and the report names the rest. Downloads on the other hubs are all-time, not monthly.
- Then call where_my_hug_verify, passing each part's search query (task, keywords, phrase) unchanged, so the report can show what the search turned up.`);
  return lines.join('\n');
}
