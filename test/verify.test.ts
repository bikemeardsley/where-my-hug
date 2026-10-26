import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Query } from '../src/hub.ts';
import { find } from '../src/search.ts';
import { verify } from '../src/verify.ts';

const now = new Date().toISOString();
// A small Hugging Face; anything not on it gets the real one's answer for a missing repo, a 401.
const HUB: Record<string, object> = {
  'models/acme/reader': {
    id: 'acme/reader', pipeline_tag: 'image-text-to-text', library_name: 'transformers', downloads: 52_000, likes: 900,
    lastModified: now, gated: false, cardData: { license: 'mit' }, safetensors: { total: 776e6 }, tags: ['license:mit'],
  },
  'models/acme/giant': {
    id: 'acme/giant', downloads: 9_000, lastModified: now, gated: 'manual',
    cardData: { license: ['apache-2.0', 'other'], base_model: ['acme/base'] }, safetensors: { total: 13e9 }, // 31.2 GB to run; 7.8 at 4 bits
  },
  'models/acme/colossal': {
    id: 'acme/colossal', downloads: 20_000, lastModified: now, cardData: { license: 'apache-2.0' }, safetensors: { total: 70e9 }, // 42 GB even at 4 bits
    inferenceProviderMapping: { together: { status: 'live' }, slowco: { status: 'staging' } },
  },
  'models/acme/old-research': {
    id: 'acme/old-research', downloads: 12, lastModified: '2020-01-01T00:00:00.000Z',
    cardData: { license: 'Other', license_name: 'acme-research' },
  },
  'models/acme/named-only': { // as Qwen2.5-VL's card is: a license name and no license
    id: 'acme/named-only', downloads: 500, lastModified: now, cardData: { license_name: 'acme-community', base_model: [] },
  },
  'models/acme/flaky': { id: 'acme/flaky', downloads: 500, lastModified: now, cardData: { license: 'mit' } }, // once it answers
  'datasets/acme/pages': {
    id: 'acme/pages', downloads: 3_000, lastModified: now, cardData: {}, tags: ['license:cc-by-4.0', 'task_categories:image-to-text', 'size_categories:n<1K'],
  },
};
// Its search: lists by query (the limit aside), full text by kind. A query not here finds nothing.
const LISTS: Record<string, object[]> = {
  'models?pipeline_tag=image-text-to-text&sort=downloads': [HUB['models/acme/reader'], { id: 'acme/popular', downloads: 1_000_000, pipeline_tag: 'image-text-to-text', tags: ['license:mit'] }],
  'models?pipeline_tag=image-text-to-text&sort=trendingScore': [{ id: 'acme/new-hot', downloads: 0, likes: 40, createdAt: '2026-10-10T00:00:00.000Z' }],
  'models?search=reader&sort=downloads': [HUB['models/acme/reader'], { downloads: 5 }], // an item with no id is no hit
  'datasets?filter=task_categories:image-to-text&sort=downloads': [HUB['datasets/acme/pages']],
};
const FULL_TEXT: Record<string, object[]> = {
  model: [
    { type: 'space', name: 'acme/demo' },
    { type: 'model', name: 'acme/card-only', likes: 3, formatted: { fileContent: [{ text: 'Reads  street\n' }, { text: 'signs' }] } },
    { type: 'model', name: 'Acme/Reader', likes: 900 }, // acme/reader, spelled another way
  ],
  dataset: [{ type: 'dataset', name: 'acme/pages', likes: 1 }],
};
const asked: { path: string; query: string; authorization: string | null }[] = [];
let flaky = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const path = url.pathname.replace('/api/', '');
  asked.push({ path, query: url.search, authorization: new Headers(init?.headers).get('authorization') });
  if (path === 'search/full-text') {
    if (url.searchParams.get('q') === 'down') throw new TypeError('fetch failed');
    if (url.searchParams.get('q') === 'garbled') return Response.json(42);
    return Response.json({ hits: FULL_TEXT[url.searchParams.get('type') ?? ''] ?? [] });
  }
  if (path === 'models' || path === 'datasets') {
    return Response.json(LISTS[`${path}?${[...url.searchParams].filter(([key]) => key !== 'limit').map(([key, value]) => `${key}=${value}`).join('&')}`] ?? []);
  }
  if (path === 'models/acme/flaky' && !flaky++) throw new TypeError('fetch failed');
  if (path === 'datasets/acme/maybe') throw new TypeError('fetch failed'); // not a model, and the dataset can't be asked
  return HUB[path] ? Response.json(HUB[path]) : new Response('Unauthorized', { status: 401 });
};

const part = (id: string, verdict: 'USE' | 'TUNE' | 'TRAIN' | 'WRITE', candidates: { id: string; kind?: 'model' | 'dataset' }[],
  search: Query | undefined = verdict === 'WRITE' ? undefined : { keywords: [id] }) =>
  ({ id, name: id, role: `${id}'s job`, verdict, rationale: `why ${id}`, candidates, search });

test("keeps the agent's order, drops what isn't there and flags what bites", async () => {
  process.env.HF_TOKEN = 'hf_secret_test_token';
  const { markdown, result } = await verify({
    need: 'read street signs',
    compute: 'one 24 GB GPU',
    components: [
      part('reader', 'USE', [{ id: 'acme/made-up' }, { id: 'acme/giant' }, { id: 'acme/reader' }, { id: 'acme/colossal' }],
        { task: 'image-text-to-text', keywords: ['reader'], phrase: 'read street signs' }),
      part('tuner', 'TUNE', [{ id: 'acme/old-research' }, { id: 'acme/pages', kind: 'dataset' }, { id: 'acme/named-only' }],
        { task: 'image-to-text', phrase: 'street sign pages' }),
      part('flaky', 'USE', [{ id: 'acme/flaky' }]),
      part('rules', 'WRITE', []),
      part('bigjob', 'USE', [{ id: 'acme/colossal' }]),
    ],
    recommendation: ' Try acme/reader first.\n',
  });
  delete process.env.HF_TOKEN;
  const [reader, tuner, flaky, rules, bigjob] = result.components;

  // What runs on the compute heads the part, though named after a bigger one; the bigger follow, in order.
  assert.deepEqual([reader.model?.id, reader.model?.tier, reader.model?.flags], ['acme/reader', 'fits', []]);
  assert.deepEqual(reader.dropped, ['acme/made-up']);
  assert.deepEqual(reader.bigger.map((entry) => [entry.id, entry.tier, entry.flags]), [['acme/giant', 'stretch', ['GATED', 'OWN_TERMS']], ['acme/colossal', 'cloud', []]]);
  assert.deepEqual([reader.bigger[0].baseModels, reader.bigger[0].license], [['acme/base'], 'apache-2.0, other']);
  assert.deepEqual(reader.bigger[1].hostedBy, ['together']); // live only, not staging
  assert.deepEqual(reader.alternates, []);
  // Nothing that fits isn't nothing at all: the big option stands, and the agent isn't sent back.
  assert.deepEqual([bigjob.model, bigjob.bigger.map((entry) => entry.id)], [undefined, ['acme/colossal']]);

  assert.equal(tuner.model?.license, 'other (acme-research)');
  assert.deepEqual(tuner.model?.flags, ['NON_COMMERCIAL', 'OWN_TERMS', 'STALE', 'LITTLE_USED']); // research-only, and custom
  assert.equal(tuner.dataset?.license, 'cc-by-4.0');
  assert.equal(tuner.dataset?.task, 'image-to-text');
  assert.deepEqual(tuner.alternates.map((entry) => [entry.license, entry.flags]), [['other (acme-community)', ['OWN_TERMS']]]);
  assert.equal(tuner.alternates[0].baseModels, undefined); // base_model: [] is no base

  assert.deepEqual(flaky.model?.flags, ['UNCHECKED']); // kept: Hugging Face didn't say it's missing
  assert.deepEqual([reader, tuner, flaky, rules, bigjob].map((p) => p.missing), [[], [], [], [], []]);
  assert.equal(result.nextAction, 'DONE');

  // What the search turned up is marked, what it didn't is from memory, and what it found but nobody picked is shown.
  assert.deepEqual(reader.model?.found, ['most downloaded for image-text-to-text', 'name has reader', 'card text']); // Acme/Reader is acme/reader
  assert.deepEqual(reader.bigger.map((entry) => entry.found), [[], []]);
  assert.deepEqual(reader.unpicked.map((hit) => hit.id), ['acme/new-hot', 'acme/card-only', 'acme/popular']); // in turns, one way after another
  // Any part's search counts: the reader's found the dataset by its card, the tuner's by its task.
  assert.deepEqual([tuner.model?.found, tuner.dataset?.found], [[], ['card text', 'most downloaded for image-to-text']]);
  assert.deepEqual(tuner.unpicked.map((hit) => hit.id), ['acme/card-only']);

  assert.match(markdown, /\*\*Model: \[acme\/reader\]\(https:\/\/huggingface\.co\/acme\/reader\)\*\*\n.*found: most downloaded for image-text-to-text, name has reader, card text\n/);
  assert.match(markdown, /\*\*Model: \[acme\/old-research\]\(https:\/\/huggingface\.co\/acme\/old-research\)\*\* _from memory: the search didn't turn it up_/);
  assert.match(markdown, /\*\*Data: \[acme\/pages\]\(https:\/\/huggingface\.co\/datasets\/acme\/pages\)\*\*\nimage-to-text {2}· {2}under 1K rows {2}· {2}license cc-by-4\.0/);
  // Every id says what it is, not only the lead picks.
  assert.match(markdown, /Also: \[acme\/named-only\]\(https:\/\/huggingface\.co\/acme\/named-only\) \(model, own terms, from memory\)/);
  assert.match(markdown, /2\. tuner {3}TUNE {3}model acme\/old-research \+ dataset acme\/pages\n.*\n.*\n5\. bigjob {2}USE {4}model acme\/colossal \(cloud\)\n```/);
  assert.match(markdown, /```\n\n---\n\n## Start here\n\nTry acme\/reader first\.$/);
  assert.match(markdown, /9 named, 6 from memory rather than the search, 1 not there and dropped, 1 Hugging Face didn't answer for/);
  assert.match(markdown, /If you can make it work, models too big for one 24 GB GPU:\n- \[acme\/giant\]\(https:\/\/huggingface\.co\/acme\/giant\): a stretch: ~31\.2 GB to run, ~7\.8 GB quantized to 4 bits \(gated, own terms, from memory\)\n- \[acme\/colossal\]\(https:\/\/huggingface\.co\/acme\/colossal\): cloud: ~168\.0 GB to run, hosted by together \(from memory\)\n/);
  assert.match(markdown, /Models the search also found, not picked:\n- \[acme\/new-hot\]\(https:\/\/huggingface\.co\/acme\/new-hot\) \(0 downloads a month\): found as trending for image-text-to-text\n- \[acme\/card-only\]\(https:\/\/huggingface\.co\/acme\/card-only\): found as card text\n- \[acme\/popular\]\(https:\/\/huggingface\.co\/acme\/popular\) \(1\.0M downloads a month\): found as most downloaded for image-text-to-text/);
  assert.match(markdown, /Nothing named runs on one 24 GB GPU: the options below need more/);
  assert.match(markdown, /No model: write this one/);
  assert.match(markdown, /776\.0M parameters \(~1\.9 GB to run\)/); // what it needs, whatever the compute turns out to be

  // The token goes to Hugging Face, and nowhere else: not into the report or the JSON.
  assert.ok(asked.every((call) => call.authorization === 'Bearer hf_secret_test_token'));
  assert.doesNotMatch(markdown + JSON.stringify(result), /hf_secret/);
});

test('sends the agent back for parts left with nothing', async () => {
  const before = asked.length;
  const { result, markdown } = await verify({
    need: 'sort socks',
    components: [
      part('matcher', 'USE', [{ id: '../../evil' }, { id: 'acme/gone' }]),
      part('trainer', 'TRAIN', [{ id: 'acme/no-data', kind: 'dataset' }]),
      part('tuned', 'TUNE', [{ id: 'acme/reader' }, { id: 'acme/no-data', kind: 'dataset' }]),
      part('scratch', 'TRAIN', []),
      part('forgot', 'USE', []),
      part('mislabeled', 'TRAIN', [{ id: 'acme/pages' }]), // a dataset, named as a model
      part('again', 'USE', [{ id: 'acme/flaky' }]),
      part('unsure', 'USE', [{ id: 'acme/maybe' }]),
    ],
  });
  assert.equal(result.nextAction, 'RECALL_REPLACEMENTS');
  assert.deepEqual(result.components.map((p) => p.missing), [['model'], ['dataset'], ['dataset'], [], ['model'], [], [], []]);
  // Not a model, but whether it's a dataset couldn't be asked: kept unchecked, not dropped as missing.
  assert.deepEqual([result.components[7].model?.flags, result.components[7].dropped], [['UNCHECKED'], []]);
  assert.match(result.instructions, /matcher \(a model\), trainer \(a dataset\), tuned \(a dataset\), forgot \(a model\)\./);
  assert.deepEqual(result.components[0].dropped, ['../../evil', 'acme/gone']);
  assert.ok(!asked.slice(before).some((call) => call.path.includes('evil'))); // a bad id is never sent
  assert.equal(result.components[5].dataset?.id, 'acme/pages');
  assert.deepEqual(result.components[5].dropped, []);
  // Hugging Face didn't answer the first time; that isn't remembered, so it's asked again and answers.
  assert.deepEqual(result.components[6].model?.flags, []);
  assert.equal(asked.filter((call) => call.path === 'models/acme/flaky').length, 2);
  assert.match(markdown, /No dataset on Hugging Face for this yet: it needs new candidates/);
  assert.match(markdown, /\(~1\.9 GB to run; to fine-tune, ~0\.8 GB with QLoRA, ~12\.4 GB in full\)/); // the TUNE part's model
  assert.match(markdown, /No dataset on Hugging Face for this: collect the data/);
  assert.doesNotMatch(markdown, /Start here/); // none given, none shown
});

test('sends the agent to search first, and a TRAIN verdict shows what the search found', async () => {
  const { result, markdown } = await verify({
    need: 'read street signs',
    components: [
      { ...part('guess', 'USE', [{ id: 'acme/reader' }]), search: undefined },
      part('empty', 'TUNE', [{ id: 'acme/giant' }], {}), // a search for nothing is no search
      part('trainer', 'TRAIN', [], { task: 'image-text-to-text' }),
      part('rules', 'WRITE', []),
    ],
  });
  assert.equal(result.nextAction, 'SEARCH_FIRST');
  assert.deepEqual(result.components.map((p) => p.unsearched), [true, true, false, false]);
  assert.match(result.instructions, /picked without searching: guess, empty\./);
  // Unsearched picks are still marked: one another part's search turned up counts, the rest are memory.
  assert.deepEqual([result.components[0].model?.found, result.components[1].model?.found], [['most downloaded for image-text-to-text'], []]);
  // acme/reader is the search's top hit, but another part picked it, so it isn't "not picked".
  assert.deepEqual(result.components[2].unpicked.map((hit) => hit.id), ['acme/new-hot', 'acme/popular']);
  assert.match(markdown, /\*\*The search found models for this job: check them before training one\.\*\*\n- \[acme\/new-hot\]/);
});

test('searches every way in, takes the ways in turns, and says which failed', async () => {
  const wanted = [{ id: 'reader', name: 'Read signs', task: 'image-text-to-text', keywords: ['reader'], phrase: 'down' }];
  const found = await find(wanted);
  assert.deepEqual([...found.matchAll(/^- (acme\/[\w-]+)/gm)].map((match) => match[1]), ['acme/reader', 'acme/new-hot', 'acme/popular']);
  assert.match(found, /^- acme\/reader {2}· {2}image-text-to-text {2}· {2}license mit {2}· {2}52\.0k downloads a month {2}· {2}900 likes {2}· {2}found: most downloaded for image-text-to-text, name has reader$/m);
  assert.match(found, /^- acme\/new-hot .*created 2026-10-10 {2}· {2}found: trending for image-text-to-text$/m);
  assert.match(found, /Datasets:\n- none\n/);
  assert.match(found, /Hugging Face didn't answer: models: card text; datasets: card text\./);

  // What didn't answer isn't remembered, so it's asked again; what did is.
  const downs = () => asked.filter((call) => call.query.includes('q=down')).length;
  const lists = () => asked.filter((call) => call.path === 'models').length;
  const [before, listed] = [downs(), lists()];
  await find(wanted);
  assert.deepEqual([downs() - before, lists() - listed], [2, 0]);
  assert.doesNotMatch(found, /undefined/);
  assert.match(await find([{ id: 'g', name: 'G', phrase: 'garbled' }]), /Hugging Face didn't answer: models: card text; datasets: card text\./); // not "none"

  // A search that didn't answer may have held what it didn't turn up: no pick is called memory then.
  const partial = await verify({ need: 'x', components: [part('reader', 'USE', [{ id: 'acme/reader' }, { id: 'acme/giant' }], { keywords: ['reader'], phrase: 'down' })] });
  assert.deepEqual(partial.result.components[0].alternates.map((entry) => [entry.id, entry.found]), [['acme/giant', undefined]]);
  assert.match(partial.markdown, /; 2 searches didn't answer, so no pick is marked from memory\._/);
  assert.doesNotMatch(partial.markdown, /from memory:|, from memory\)|\(from memory\)/);

  const cards = await find([{ id: 'signs', name: 'Signs', phrase: 'signs' }]);
  assert.match(cards, /^- acme\/card-only {2}· {2}3 likes {2}· {2}found: card text\n {2}> Reads street signs$/m);
  assert.doesNotMatch(cards, /acme\/demo/); // a Space is a demo, not a model
  const both = await find([{ id: 'r', name: 'R', keywords: ['reader'], phrase: 'signs' }]);
  assert.deepEqual([...both.matchAll(/^- (acme\/reader) .*found: (.*)$/gim)].map((match) => [match[1], match[2]]), [['acme/reader', 'name has reader, card text']]); // Acme/Reader too
  assert.match(cards, /Datasets:\n- acme\/pages {2}· {2}1 likes {2}· {2}found: card text\n/);
  const listedData = await find([{ id: 'p', name: 'P', task: 'image-to-text' }]);
  assert.match(listedData, /^- acme\/pages {2}· {2}image-to-text {2}· {2}under 1K rows {2}· {2}license cc-by-4\.0 /m);
});
