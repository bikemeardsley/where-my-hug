// Datasets on hubs other than Hugging Face: Kaggle, Zenodo, ModelScope and Roboflow Universe, searched with the same
// words and checked the same way. Their ids carry the hub's name ("kaggle:owner/name", "zenodo:123"), so one never
// passes for a Hugging Face id. Checked against the live APIs on 2026-10-26: Kaggle, Zenodo and ModelScope answer
// without a key. Roboflow needs one, ROBOFLOW_API_KEY, sent only to api.roboflow.com and never recorded; without it
// Roboflow is skipped, and the search says so. ModelScope's search is the one its own site uses and isn't documented,
// so its failing costs only its own hits. Their download counts are all-time, not Hugging Face's last 30 days.
import { count, get, inTurns, TIMEOUT_MS, type Entry, type Hit, type Query } from './hub.ts';

type Facts = Partial<Omit<Entry, 'kind' | 'exists' | 'status'>>; // id: the hub's own, without the prefix
interface Hub {
  name: string;
  page: string; // a dataset's page is this, then its id
  id: RegExp; // what its ids look like: never "." or "..", so the paths below stay put
  key?: string; // the environment variable holding its key, where it wants one
  search: (words: string) => string;
  list: (json: any) => any[]; // the hits in a search's answer
  lookUp: (id: string) => string;
  record?: (json: any) => any; // the dataset in a lookup's answer, where it's wrapped
  gone: number[]; // what it answers for a dataset that isn't there
  read: (item: any) => Facts; // a search hit or a looked-up record
}

const OWNER_NAME = /^\w[\w.-]*\/\w[\w.-]*$/;
const PER_HUB = 8;
const AGENT = { 'User-Agent': 'where-my-hug (+https://github.com/bikemeardsley/where-my-hug)' }; // Zenodo turns away Node's own
const bytes = (n?: number) => (!n ? undefined : n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.ceil(n / 1e3)} kB`);
const seconds = (s?: number) => (typeof s === 'number' ? new Date(s * 1000).toISOString() : undefined);

const HUBS: Record<string, Hub> = {
  kaggle: {
    name: 'Kaggle', page: 'https://www.kaggle.com/datasets/', id: OWNER_NAME,
    search: (words) => `https://www.kaggle.com/api/v1/datasets/list?search=${words}`, list: (json) => json,
    lookUp: (id) => `https://www.kaggle.com/api/v1/datasets/view/${id}`, gone: [403, 404], // 403 for one that doesn't exist, or is private
    read: (d) => ({
      id: d.ref, title: d.title, license: d.licenseName, downloadsEver: d.downloadCount, likes: d.voteCount,
      updated: d.lastUpdated, size: bytes(d.totalBytes),
    }),
  },
  zenodo: {
    name: 'Zenodo', page: 'https://zenodo.org/records/', id: /^\d+$/,
    search: (words) => `https://zenodo.org/api/records?q=${words}&type=dataset&size=${PER_HUB}`, list: (json) => json.hits.hits,
    lookUp: (id) => `https://zenodo.org/api/records/${id}`, gone: [404, 410],
    read: (r) => ({
      id: String(r.id), title: r.metadata?.title, license: r.metadata?.license?.id, downloadsEver: r.stats?.downloads, updated: r.updated,
      size: bytes((r.files ?? []).reduce((sum: number, file: any) => sum + (file.size ?? 0), 0)),
    }),
  },
  modelscope: {
    name: 'ModelScope', page: 'https://modelscope.cn/datasets/', id: OWNER_NAME,
    search: (words) => `https://www.modelscope.cn/api/v1/dolphin/datasets?PageSize=${PER_HUB}&PageNumber=1&Query=${words}`, list: (json) => json.Data,
    lookUp: (id) => `https://www.modelscope.cn/api/v1/datasets/${id}`, record: (json) => json.Data, gone: [404],
    read: (d) => ({
      id: `${d.Namespace}/${d.Name}`, license: d.License || undefined, downloadsEver: d.Downloads, likes: d.Likes,
      updated: seconds(d.GmtModified), size: bytes(d.StorageSize),
    }),
  },
  roboflow: {
    name: 'Roboflow Universe', page: 'https://universe.roboflow.com/', id: OWNER_NAME, key: 'ROBOFLOW_API_KEY',
    search: (words) => `https://api.roboflow.com/universe/search?q=${words}&type=dataset&limit=${PER_HUB}`, list: (json) => json.results,
    lookUp: (id) => `https://api.roboflow.com/${id}`, record: (json) => json.project, gone: [404],
    // A hit names its project by its page, universe.roboflow.com/<workspace>/<project>; a looked-up one doesn't.
    read: (r) => ({
      id: /universe\.roboflow\.com\/([^/?#]+\/[^/?#]+)/.exec(r.url ?? '')?.[1], title: r.name, license: r.license,
      size: typeof r.images === 'number' ? `${count(r.images)} images` : undefined, updated: seconds(r.updated),
    }),
  },
};

/** The hub a prefixed id is on; undefined for a Hugging Face id. */
export const sourceOf = (id: string) => Object.keys(HUBS).find((source) => id.toLowerCase().startsWith(`${source}:`));

const keyOf = (hub: Hub) => (hub.key ? process.env[hub.key] : undefined);
const headers = (hub: Hub) => ({ ...AGENT, ...(keyOf(hub) ? { Authorization: `Bearer ${keyOf(hub)}` } : {}) });

/** Every other hub's datasets for a query, taken in turns like Hugging Face's ways in; which hubs didn't answer, and which need a key. */
export async function searchElsewhere({ phrase, keywords = [], task }: Query): Promise<{ hits: Hit[]; failed: string[]; skipped: string[] }> {
  const words = phrase || keywords.join(' ') || task?.replace(/-/g, ' ');
  const hubs = Object.entries(HUBS);
  const asked = hubs.filter(([, hub]) => !hub.key || keyOf(hub));
  if (!words) return { hits: [], failed: [], skipped: [] };
  const answers = await Promise.all(asked.map(([source, hub]) => get(hub.search(encodeURIComponent(words)), (json): Hit[] =>
    hub.list(json).map(hub.read).filter(({ id }) => typeof id === 'string' && hub.id.test(id)).map((facts) => ({
      ...facts, id: `${source}:${facts.id}`, kind: 'dataset', found: [`${hub.name} search`], page: hub.page + facts.id,
    })), headers(hub))));
  return {
    hits: inTurns(answers),
    failed: asked.filter((_, i) => !answers[i]).map(([, hub]) => hub.name),
    skipped: hubs.filter(([, hub]) => hub.key && !keyOf(hub)).map(([, hub]) => `${hub.name} (it needs ${hub.key})`),
  };
}

/** What a hub says about one of its datasets: whether it exists, and what it is. */
export async function lookUpElsewhere(prefixed: string): Promise<Entry> {
  const source = sourceOf(prefixed)!;
  const hub = HUBS[source];
  const id = prefixed.slice(source.length + 1);
  const entry = (status: Entry['status'], exists: boolean | undefined, { id: spelled, ...facts }: Facts = {}): Entry => {
    const own = spelled && hub.id.test(spelled) ? spelled : id; // the hub's spelling of it, if it's an id at all
    return { ...facts, id: `${source}:${own}`, kind: 'dataset', exists, status, page: hub.page + own };
  };
  if (!hub.id.test(id)) return entry('invalid id', false);
  if (hub.key && !keyOf(hub)) return entry('no key', undefined);
  try {
    const response = await fetch(hub.lookUp(id), { headers: headers(hub), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (hub.gone.includes(response.status)) return entry(response.status, false);
    if (!response.ok) return entry(response.status, undefined);
    const json = await response.json();
    return entry(response.status, true, hub.read(hub.record ? hub.record(json) : json));
  } catch {
    return entry('unreachable', undefined);
  }
}
