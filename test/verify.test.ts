import assert from 'node:assert/strict';
import { test } from 'node:test';
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
    id: 'acme/pages', downloads: 3_000, lastModified: now, cardData: {}, tags: ['license:cc-by-4.0', 'task_categories:image-to-text'],
  },
};
const asked: { path: string; authorization: string | null }[] = [];
let flaky = 0;
globalThis.fetch = async (input, init) => {
  const path = new URL(String(input)).pathname.replace('/api/', '');
  asked.push({ path, authorization: new Headers(init?.headers).get('authorization') });
  if (path === 'models/acme/flaky' && !flaky++) throw new TypeError('fetch failed');
  if (path === 'datasets/acme/maybe') throw new TypeError('fetch failed'); // not a model, and the dataset can't be asked
  return HUB[path] ? Response.json(HUB[path]) : new Response('Unauthorized', { status: 401 });
};

const part = (id: string, verdict: 'USE' | 'TUNE' | 'TRAIN' | 'WRITE', candidates: { id: string; kind?: 'model' | 'dataset' }[]) =>
  ({ id, name: id, role: `${id}'s job`, verdict, rationale: `why ${id}`, candidates });

test("keeps the agent's order, drops what isn't there and flags what bites", async () => {
  process.env.HF_TOKEN = 'hf_secret_test_token';
  const { markdown, result } = await verify({
    need: 'read street signs',
    compute: 'one 24 GB GPU',
    components: [
      part('reader', 'USE', [{ id: 'acme/made-up' }, { id: 'acme/giant' }, { id: 'acme/reader' }, { id: 'acme/colossal' }]),
      part('tuner', 'TUNE', [{ id: 'acme/old-research' }, { id: 'acme/pages', kind: 'dataset' }, { id: 'acme/named-only' }]),
      part('flaky', 'USE', [{ id: 'acme/flaky' }]),
      part('rules', 'WRITE', []),
      part('bigjob', 'USE', [{ id: 'acme/colossal' }]),
    ],
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

  assert.match(markdown, /\*\*Model: \[acme\/reader\]\(https:\/\/huggingface\.co\/acme\/reader\)\*\*/);
  assert.match(markdown, /\*\*Data: \[acme\/pages\]\(https:\/\/huggingface\.co\/datasets\/acme\/pages\)\*\*/);
  assert.match(markdown, /9 named, 1 not there and dropped, 1 Hugging Face didn't answer for/);
  assert.match(markdown, /If you can make it work, bigger than one 24 GB GPU:\n- \[acme\/giant\]\(https:\/\/huggingface\.co\/acme\/giant\): a stretch: ~31\.2 GB to run, ~7\.8 GB quantized to 4 bits \(gated, own terms\)\n- \[acme\/colossal\]\(https:\/\/huggingface\.co\/acme\/colossal\): cloud: ~168\.0 GB to run, hosted by together\n/);
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
});
