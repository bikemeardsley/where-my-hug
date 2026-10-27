// Where models and datasets are found and checked: Hugging Face, Kaggle, Zenodo, ModelScope and Roboflow Universe, one
// HUBS entry each, all searched with the same query (search) and checked the same way (lookUp). An id on any hub but
// Hugging Face carries the hub's name ("kaggle:owner/name", "zenodo:123"), so one never passes for another's. The same
// owner/name on several hubs is one finding, listed once with every hub it's on. Checked against the live APIs on
// 2026-10-26.
//
// Hugging Face is searched four ways: a task's most downloaded and its trending (where new models surface), names
// holding a keyword (its list search matches part of an id, one word at a time), and full text, which reads the model
// and dataset cards themselves, the nearest thing to a web search. Full text is the API behind the site's own search
// page and isn't documented, so its failing costs only its own hits. Its records are read where the API puts things
// (2026-10-02): license in the card data or a license: tag, base_model in the card data (one id or several), size as
// safetensors.total. The other hubs are searched once each, by the phrase, except ModelScope: its search matches names,
// so it gets each keyword, as Hugging Face's names do. Their downloads are all-time, not Hugging Face's last 30 days.
//
// Keys, each sent only to its own hub and never recorded: HF_TOKEN, so the gated and private repos it can see are
// found; ROBOFLOW_API_KEY, which Roboflow can't be searched without, so without it Roboflow is skipped, and the search
// says so. Kaggle, Zenodo and ModelScope take none (a Zenodo token changes neither its limits nor its answers).

export type Kind = 'model' | 'dataset';

export interface Entry {
  id: string;
  kind: Kind;
  exists: boolean | undefined; // undefined: its hub couldn't be asked (unreachable, rate-limited, down, or no key)
  status: number | 'unreachable' | 'invalid id' | 'no key';
  title?: string; // its own name, on hubs whose ids don't say much ("zenodo:18180184")
  task?: string;
  library?: string;
  license?: string;
  baseModels?: string[];
  params?: number;
  downloads?: number; // in the last 30 days, as Hugging Face counts them
  downloadsEver?: number; // all-time, as the other hubs count them
  likes?: number;
  updated?: string;
  gated?: boolean | string; // false, or how access is granted ("auto", "manual")
  hostedBy?: string[]; // inference providers serving it live, so it can be called without running it
  size?: string; // a dataset's: "10K to 100K rows", "1.2k images", "380.0 MB" (kept as text: the hubs measure it differently)
}

export interface Query { task?: string; keywords?: string[]; phrase?: string }
export interface Hit extends Omit<Entry, 'exists' | 'status'> {
  found: string[]; // how: "most downloaded for image-to-text", "trending for image-to-text", "name has ocr", "card text", "Kaggle search"
  also?: string[]; // the same owner/name on other hubs, by its id there: "modelscope:Qwen/Qwen2.5-VL-7B-Instruct"
  created?: string;
  snippet?: string; // what the card says, when full text found it
}

type Facts = Partial<Omit<Hit, 'found' | 'also'>>; // id: the hub's own, without its prefix
interface Hub {
  name: string;
  prefix: string; // what its ids start with: nothing, for Hugging Face's
  id: RegExp; // what its ids look like: never "." or "..", so the paths below stay put
  key?: string; // the environment variable holding its key
  needsKey?: boolean; // without the key, it isn't asked at all
  search: (kind: Kind, query: Query) => [how: string, url: string][];
  list: (json: any, kind: Kind) => any[]; // the hits in a search's answer
  hit?: (item: any) => Facts; // a search's hit, where it isn't read like a looked-up record
  lookUp: (kind: Kind, id: string) => string;
  record?: (json: any) => any; // the record in a lookup's answer, where it's wrapped
  gone: number[]; // what it answers for an id that isn't there
  read: (record: any, kind: Kind) => Facts;
  page: (kind: Kind, id: string) => string;
}

export const count = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const tagged = (tags: string[], prefix: string) => tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
// "size_categories:10K<n<100K" -> "10K to 100K rows"; "n<1K" -> "under 1K rows"; "n>1T" -> "over 1T rows"
const rowsOf = (tags: string[]) => tagged(tags, 'size_categories:')
  ?.replace(/^n<(.+)$/, 'under $1').replace(/^(.+)<n<(.+)$/, '$1 to $2').replace(/^n>(.+)$/, 'over $1').concat(' rows');
const bytes = (n?: number) => (!n ? undefined : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.ceil(n / 1e3)} kB`);
const seconds = (s?: number) => (typeof s === 'number' ? new Date(s * 1000).toISOString() : undefined);
/** The query as one search's words: the phrase, else the keywords, else the task. */
const phrased = ({ phrase, keywords = [], task }: Query) => {
  const words = phrase || keywords.join(' ') || task?.replace(/-/g, ' ');
  return words ? [encodeURIComponent(words)] : [];
};

const ID = /^\w[\w.-]*(\/\w[\w.-]*)?$/; // owner/name, or an old canonical name like "gpt2"
const OWNER_NAME = /^\w[\w.-]*\/\w[\w.-]*$/;
const PER_QUERY = 8;
const EXPAND: Record<Kind, string[]> = {
  model: ['pipeline_tag', 'library_name', 'downloads', 'likes', 'lastModified', 'gated', 'cardData', 'safetensors', 'tags', 'inferenceProviderMapping'],
  dataset: ['downloads', 'likes', 'lastModified', 'gated', 'cardData', 'tags'],
};
const KAGGLE = 'https://www.kaggle.com/api/v1';
const MODELSCOPE = 'https://www.modelscope.cn/openapi/v1';

const HUBS: Hub[] = [
  {
    name: 'Hugging Face', prefix: '', id: ID, key: 'HF_TOKEN',
    search: (kind, { task, keywords = [], phrase }) => {
      const api = `https://huggingface.co/api/${kind}s?limit=${PER_QUERY}&`;
      const byTask = task && (kind === 'model' ? `pipeline_tag=${encodeURIComponent(task)}` : `filter=task_categories:${encodeURIComponent(task)}`);
      return [
        ...(byTask ? [[`most downloaded for ${task}`, `${api}${byTask}&sort=downloads`], [`trending for ${task}`, `${api}${byTask}&sort=trendingScore`]] as [string, string][] : []),
        ...keywords.map((word): [string, string] => [`name has ${word}`, `${api}search=${encodeURIComponent(word)}&sort=downloads`]),
        ...(phrase ? [['card text', `https://huggingface.co/api/search/full-text?type=${kind}&limit=${PER_QUERY}&q=${encodeURIComponent(phrase)}`]] as [string, string][] : []),
      ];
    },
    // A list, or full text's hits. No hits array is a garbled answer, so a failed search, not an empty one: an empty one is what a TRAIN verdict rests on.
    list: (json, kind) => (Array.isArray(json) ? json.filter((item) => typeof item?.id === 'string') : json.hits.filter((hit: any) => hit.type === kind && ID.test(hit.name ?? ''))),
    hit: (item) => {
      if (typeof item.id !== 'string') { // full text's: what the card says
        return { id: item.name, likes: item.likes, snippet: (item.formatted?.fileContent ?? []).map((part: any) => part.text).join('').replace(/\s+/g, ' ').trim().slice(0, 200) || undefined };
      }
      const tags: string[] = Array.isArray(item.tags) ? item.tags : [];
      return {
        id: item.id, task: item.pipeline_tag ?? (tags.filter((tag) => tag.startsWith('task_categories:')).map((tag) => tag.slice('task_categories:'.length)).join(', ') || undefined),
        license: tagged(tags, 'license:'), downloads: item.downloads, likes: item.likes, created: item.createdAt, size: rowsOf(tags),
      };
    },
    lookUp: (kind, id) => `https://huggingface.co/api/${kind}s/${id}?${EXPAND[kind].map((field) => `expand[]=${field}`).join('&')}`,
    gone: [401, 404], // 401, not 404, for a repo that doesn't exist, so private ones can't be probed
    read: (json) => {
      const card = json.cardData ?? {};
      const tags: string[] = Array.isArray(json.tags) ? json.tags : [];
      // Custom terms are "other", named in license_name; some cards give only the name. Either way: "other (qwen-research)".
      const license = [card.license || tagged(tags, 'license:')].flat().filter(Boolean).join(', ');
      const base: string[] = [card.base_model ?? []].flat();
      // { provider: { status: "live" | "staging", ... } }
      const hosted = Object.entries(json.inferenceProviderMapping ?? {}).filter(([, p]) => (p as { status?: string })?.status === 'live').map(([name]) => name);
      return {
        id: json.id, task: json.pipeline_tag ?? tagged(tags, 'task_categories:'), library: json.library_name,
        license: (license.toLowerCase() === 'other' || !license) && card.license_name ? `other (${card.license_name})` : license || undefined,
        baseModels: base.length ? base : undefined, params: json.safetensors?.total, downloads: json.downloads, likes: json.likes,
        updated: json.lastModified, gated: json.gated, hostedBy: hosted.length ? hosted : undefined, size: rowsOf(tags),
      };
    },
    page: (kind, id) => `https://huggingface.co/${kind === 'dataset' ? 'datasets/' : ''}${id}`,
  },
  {
    name: 'Kaggle', prefix: 'kaggle:', id: OWNER_NAME,
    search: (kind, query) => phrased(query).map((words) => ['Kaggle search', `${KAGGLE}/${kind}s/list?search=${words}`]),
    list: (json, kind) => (kind === 'model' ? json.models : json),
    lookUp: (kind, id) => (kind === 'model' ? `${KAGGLE}/models/${id}/get` : `${KAGGLE}/datasets/view/${id}`),
    gone: [403, 404], // 403 for one that doesn't exist, or is private
    // A model's terms are on each of its instances (one a framework); a dataset has its own, and counts its downloads.
    read: (d) => ({
      id: d.ref, title: d.title, license: d.licenseName ?? ([...new Set((d.instances ?? []).map((one: any) => one.licenseName).filter(Boolean))].join(', ') || undefined),
      downloadsEver: d.downloadCount, likes: d.voteCount, updated: d.lastUpdated ?? d.updateTime, size: bytes(d.totalBytes),
    }),
    page: (kind, id) => `https://www.kaggle.com/${kind}s/${id}`,
  },
  {
    name: 'Zenodo', prefix: 'zenodo:', id: /^\d+$/,
    search: (kind, query) => phrased(query).map((words) => ['Zenodo search', `https://zenodo.org/api/records?q=${words}&type=${kind}&size=${PER_QUERY}`]),
    list: (json) => json.hits.hits,
    lookUp: (_, id) => `https://zenodo.org/api/records/${id}`, // a model's and a dataset's alike, so the record says which
    gone: [404, 410],
    read: (r) => ({
      id: String(r.id), kind: r.metadata?.resource_type?.type === 'model' ? 'model' : 'dataset', title: r.metadata?.title,
      license: r.metadata?.license?.id, downloadsEver: r.stats?.downloads, updated: r.updated,
      size: bytes((r.files ?? []).reduce((sum: number, file: any) => sum + (file.size ?? 0), 0)),
    }),
    page: (_, id) => `https://zenodo.org/records/${id}`,
  },
  {
    name: 'ModelScope', prefix: 'modelscope:', id: OWNER_NAME,
    // It matches names, every word at once, so it gets each keyword on its own; the phrase only when there are none.
    search: (kind, { keywords = [], ...query }) => (keywords.length
      ? keywords.map((word): [string, string] => [`ModelScope name has ${word}`, encodeURIComponent(word)])
      : phrased(query).map((words): [string, string] => ['ModelScope search', words])).map(([how, words]) => [how, `${MODELSCOPE}/${kind}s?search=${words}&page_size=${PER_QUERY}`]),
    list: (json, kind) => json.data[`${kind}s`],
    lookUp: (kind, id) => `${MODELSCOPE}/${kind}s/${id}`, record: (json) => json.data,
    gone: [404],
    read: (d, kind) => ({
      id: d.id, task: d.tasks?.join(', ') || undefined, license: d.license || undefined, params: d.params || undefined,
      downloadsEver: d.downloads, likes: d.likes, updated: d.last_modified, gated: d.gated, size: kind === 'dataset' ? bytes(d.file_size) : undefined,
    }),
    page: (kind, id) => `https://modelscope.cn/${kind}s/${id}`,
  },
  {
    name: 'Roboflow Universe', prefix: 'roboflow:', id: OWNER_NAME, key: 'ROBOFLOW_API_KEY', needsKey: true,
    // Every project is a dataset, and a model too once a version of it is trained. Its search answers type=model and
    // type=dataset alike (the type only keeps the two cached apart), so a model search keeps the trained ones.
    search: (kind, query) => phrased(query).map((words) => ['Roboflow Universe search', `https://api.roboflow.com/universe/search?q=${words}&type=${kind}&limit=${PER_QUERY}`]),
    list: (json, kind) => json.results.filter((project: any) => kind === 'dataset' || project.modelCount > 0),
    lookUp: (_, id) => `https://api.roboflow.com/${id}`,
    record: (json) => ({ ...json.project, modelCount: json.versions?.filter((version: any) => version.model).length }),
    gone: [404],
    // A hit names its project by its page, universe.roboflow.com/<workspace>/<project>; a looked-up one doesn't. A hit's
    // date is a date, a looked-up one's is seconds.
    read: (r, kind) => ({
      id: /universe\.roboflow\.com\/([^/?#]+\/[^/?#]+)/.exec(r.url ?? '')?.[1], kind: kind === 'model' && !r.modelCount ? 'dataset' : kind,
      title: r.name, task: r.type, license: r.license,
      size: typeof r.images === 'number' ? `${count(r.images)} images` : undefined, updated: seconds(r.updated) ?? r.updated,
    }),
    page: (_, id) => `https://universe.roboflow.com/${id}`,
  },
];

/** The hub an id is on: the one its prefix names, or Hugging Face. */
export const hubOf = (id: string) => HUBS.find((hub) => hub.prefix && id.toLowerCase().startsWith(hub.prefix)) ?? HUBS[0];
/** An id without its hub's prefix: the same owner/name on two hubs has the same one. */
export const bare = (id: string) => id.slice(hubOf(id).prefix.length);
export const pageOf = (id: string, kind: Kind) => hubOf(id).page(kind, bare(id));

const CACHE_MS = 60 * 60 * 1000; // a session asks about the same ids again and again
const TIMEOUT_MS = 15_000;
const AGENT = { 'User-Agent': 'where-my-hug (+https://github.com/bikemeardsley/where-my-hug)' }; // Zenodo turns away Node's own
const cache = new Map<string, { at: number; answer: Promise<unknown> }>();
const keyOf = (hub: Hub) => (hub.key ? process.env[hub.key] : undefined);
const headers = (hub: Hub) => ({ ...AGENT, ...(keyOf(hub) ? { Authorization: `Bearer ${keyOf(hub)}` } : {}) });

/** An answer from a cache an hour fresh; one not worth keeping (the hub didn't answer) is asked again next time. */
function cached<T>(key: string, ask: () => Promise<T>, kept: (answer: T) => boolean): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.answer as Promise<T>;
  const answer = ask().then((found) => {
    if (!kept(found)) cache.delete(key);
    return found;
  });
  cache.set(key, { at: Date.now(), answer });
  return answer;
}

/** A search's answer as read, or undefined if the hub didn't answer or garbled it. */
const get = <T>(url: string, read: (json: any) => T, auth: Record<string, string>) => cached(url,
  () => fetch(url, { headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then(async (response) => (response.ok ? read(await response.json()) : undefined)).catch(() => undefined),
  (found) => found !== undefined);

/** What a hub says about a model or dataset: whether it's there, and what it is. An id with no prefix is Hugging Face's. */
export function lookUp(kind: Kind, prefixed: string): Promise<Entry> {
  const hub = hubOf(prefixed);
  const id = bare(prefixed);
  const entry = (status: Entry['status'], exists: boolean | undefined, { id: spelled, ...facts }: Facts = {}): Entry =>
    ({ kind, ...facts, id: hub.prefix + (spelled && hub.id.test(spelled) ? spelled : id), exists, status }); // the hub's spelling of it, if it's an id at all
  if (!hub.id.test(id)) return Promise.resolve(entry('invalid id', false));
  if (hub.needsKey && !keyOf(hub)) return Promise.resolve(entry('no key', undefined));
  return cached(`${kind}:${prefixed}`, async () => {
    try {
      const response = await fetch(hub.lookUp(kind, id), { headers: headers(hub), signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (hub.gone.includes(response.status)) return entry(response.status, false);
      if (!response.ok) return entry(response.status, undefined);
      const json = await response.json();
      return entry(response.status, true, hub.read(hub.record ? hub.record(json) : json, kind));
    } catch {
      return entry('unreachable', undefined);
    }
  }, (found) => found.exists !== undefined);
}

/** Lists taken in turns: each one's first, then each one's second, and so on. */
const inTurns = <T>(lists: (T[] | undefined)[]): T[] =>
  Array.from({ length: PER_QUERY }, (_, rank) => lists.flatMap((list) => list?.[rank] ?? [])).flat();

/**
 * Each finding once. Another way to the same one adds how it was found, and the facts the first didn't have (full text
 * knows the card, the list the counts); the same owner/name on another hub adds that hub, and Hugging Face leads where
 * it has it, since it says the most.
 */
function consolidate(hits: Hit[]): Hit[] {
  const merged = new Map<string, Hit>();
  for (const hit of hits) {
    const key = bare(hit.id).toLowerCase(); // the Hub's ids are case-insensitive
    const seen = merged.get(key);
    if (!seen) {
      merged.set(key, { ...hit, found: [...hit.found] });
      continue;
    }
    const found = [...new Set([...seen.found, ...hit.found])];
    if (seen.id.toLowerCase() === hit.id.toLowerCase()) {
      for (const [field, value] of Object.entries(hit)) if ((seen as any)[field] === undefined) (seen as any)[field] = value;
      seen.found = found;
    } else if (!hubOf(hit.id).prefix && hubOf(seen.id).prefix) merged.set(key, { ...hit, found, also: [...(seen.also ?? []), seen.id] });
    else Object.assign(seen, { found, also: [...new Set([...(seen.also ?? []), hit.id])] });
  }
  return [...merged.values()];
}

/**
 * Everything the hubs turn up for a query, taken in turns: each way's first hit, then each way's second, and so on.
 * Sorting the lot by downloads would bury what only a keyword, a card or a smaller hub found under whatever is
 * popular for the task, and those are often the closest fit.
 */
export async function search(kind: Kind, query: Query): Promise<{ hits: Hit[]; failed: string[]; skipped: string[] }> {
  const ways = HUBS.filter((hub) => !hub.needsKey || keyOf(hub)).flatMap((hub) => hub.search(kind, query).map(([how, url]) => ({ hub, how, url })));
  const answers = await Promise.all(ways.map(({ hub, how, url }) => get(url, (json): Hit[] => hub.list(json, kind)
    .map((item) => (hub.hit ?? hub.read)(item, kind)).filter(({ id }) => typeof id === 'string' && hub.id.test(id))
    .map((facts) => ({ ...facts, id: hub.prefix + facts.id, kind, found: [how] })), headers(hub))));
  return {
    hits: consolidate(inTurns(answers)),
    failed: ways.filter((_, i) => !answers[i]).map(({ how }) => how),
    skipped: HUBS.filter((hub) => hub.needsKey && !keyOf(hub)).map((hub) => `${hub.name} (it needs ${hub.key})`),
  };
}
