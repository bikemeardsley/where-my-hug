import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verify } from '../src/verify.ts';

const now = new Date().toISOString();
// A small Hub; anything not on it gets the real Hub's answer for a missing repo, a 401.
const HUB: Record<string, object> = {
  'models/acme/reader': {
    id: 'acme/reader', pipeline_tag: 'image-text-to-text', library_name: 'transformers', downloads: 52_000, likes: 900,
    lastModified: now, gated: false, cardData: { license: 'mit' }, safetensors: { total: 776e6 }, tags: ['license:mit'],
  },
  'models/acme/giant': {
    id: 'acme/giant', downloads: 9_000, lastModified: now, gated: 'manual',
    cardData: { license: ['apache-2.0', 'other'], base_model: ['acme/base'] }, safetensors: { total: 13e9 }, // over 24 GB to run, though not its parameter count
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
    id: 'acme/pages', downloads: 3_000, lastModified: now, cardData: {}, tags: ['license:cc-by-4.0', 'task_categories:image-to-text'],
  },
};
const asked: { path: string; authorization: string | null }[] = [];
let flaky = 0;
globalThis.fetch = async (input, init) => {
  const path = new URL(String(input)).pathname.replace('/api/', '');
  asked.push({ path, authorization: new Headers(init?.headers).get('authorization') });
  if (path === 'models/acme/flaky' && !flaky++) throw new TypeError('fetch failed');
  return HUB[path] ? Response.json(HUB[path]) : new Response('Unauthorized', { status: 401 });
};

const part = (id: string, verdict: 'USE' | 'TUNE' | 'TRAIN' | 'WRITE', candidates: { id: string; kind?: 'model' | 'dataset' }[]) =>
  ({ id, name: id, role: `${id}'s job`, verdict, rationale: `why ${id}`, candidates });

test("keeps the agent's order, drops what isn't there and flags what bites", async () => {
  process.env.HF_TOKEN = 'hf_secret_test_token';
  const { markdown, result } = await verify({
    need: 'read book pages',
    compute: 'one 24 GB GPU',
    components: [
      part('reader', 'USE', [{ id: 'acme/made-up' }, { id: 'acme/reader' }, { id: 'acme/giant' }]),
      part('tuner', 'TUNE', [{ id: 'acme/old-research' }, { id: 'acme/pages', kind: 'dataset' }, { id: 'acme/named-only' }]),
      part('flaky', 'USE', [{ id: 'acme/flaky' }]),
      part('rules', 'WRITE', []),
    ],
  });
  delete process.env.HF_TOKEN;
  const [reader, tuner, flaky, rules] = result.components;

  assert.equal(reader.model?.id, 'acme/reader');
  assert.deepEqual(reader.model?.flags, []);
  assert.deepEqual(reader.dropped, ['acme/made-up']);
  assert.deepEqual(reader.alternates.map((entry) => [entry.id, entry.flags]), [['acme/giant', ['GATED', 'OWN_TERMS', 'TOO_BIG']]]);
  assert.deepEqual(reader.alternates[0].baseModels, ['acme/base']);
  assert.equal(reader.alternates[0].license, 'apache-2.0, other');

  assert.equal(tuner.model?.license, 'other (acme-research)');
  assert.deepEqual(tuner.model?.flags, ['NON_COMMERCIAL', 'STALE', 'LITTLE_USED']);
  assert.equal(tuner.dataset?.license, 'cc-by-4.0');
  assert.equal(tuner.dataset?.task, 'image-to-text');
  assert.deepEqual(tuner.alternates.map((entry) => [entry.license, entry.flags]), [['other (acme-community)', ['OWN_TERMS']]]);
  assert.equal(tuner.alternates[0].baseModels, undefined); // base_model: [] is no base

  assert.deepEqual(flaky.model?.flags, ['UNCHECKED']); // kept: the Hub didn't say it's missing
  assert.deepEqual([reader, tuner, flaky, rules].map((p) => p.missing), [[], [], [], []]);
  assert.equal(result.nextAction, 'DONE');

  assert.match(markdown, /\*\*Model: \[acme\/reader\]\(https:\/\/huggingface\.co\/acme\/reader\)\*\*/);
  assert.match(markdown, /\*\*Data: \[acme\/pages\]\(https:\/\/huggingface\.co\/datasets\/acme\/pages\)\*\*/);
  assert.match(markdown, /7 named, 1 not there and dropped, 1 the Hub didn't answer for/);
  assert.match(markdown, /No model: write this one/);
  assert.match(markdown, /776\.0M parameters \(~1\.9 GB to run\)/); // what it needs, whatever the compute turns out to be

  // The token goes to the Hub, and nowhere else: not into the report or the JSON.
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
    ],
  });
  assert.equal(result.nextAction, 'RECALL_REPLACEMENTS');
  assert.deepEqual(result.components.map((p) => p.missing), [['model'], ['dataset'], ['dataset'], [], ['model'], [], []]);
  assert.match(result.instructions, /matcher \(a model\), trainer \(a dataset\), tuned \(a dataset\), forgot \(a model\)\./);
  assert.deepEqual(result.components[0].dropped, ['../../evil', 'acme/gone']);
  assert.ok(!asked.slice(before).some((call) => call.path.includes('evil'))); // a bad id is never sent
  assert.equal(result.components[5].dataset?.id, 'acme/pages');
  assert.deepEqual(result.components[5].dropped, []);
  // The Hub didn't answer the first time; that isn't remembered, so it's asked again and answers.
  assert.deepEqual(result.components[6].model?.flags, []);
  assert.equal(asked.filter((call) => call.path === 'models/acme/flaky').length, 2);
  assert.match(markdown, /Nothing on the Hub for this yet \(no dataset\): it needs new candidates/);
  assert.match(markdown, /No dataset on the Hub for this: collect the data/);
});
