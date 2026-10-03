// What the Hugging Face Hub says about a model or dataset: whether it exists, and what it is. A few GETs to
// huggingface.co/api, its fields read where the API puts them (checked against the live API, 2026-10-02):
// license in the card data or a license: tag, base_model in the card data (one id or several), size as
// safetensors.total. HF_TOKEN, if set, is sent so gated and private repos the token can see are found; it
// goes only to huggingface.co and is never recorded.

export type Kind = 'model' | 'dataset';

export interface Entry {
  id: string;
  kind: Kind;
  exists: boolean | undefined; // undefined: the Hub couldn't be asked (unreachable, rate-limited, down)
  status: number | 'unreachable' | 'invalid id';
  task?: string;
  library?: string;
  license?: string;
  baseModels?: string[];
  params?: number;
  downloads?: number; // in the last 30 days
  likes?: number;
  updated?: string;
  gated?: boolean | string; // false, or how access is granted ("auto", "manual")
  hostedBy?: string[]; // inference providers serving it live, so it can be called without running it
}

const EXPAND: Record<Kind, string[]> = {
  model: ['pipeline_tag', 'library_name', 'downloads', 'likes', 'lastModified', 'gated', 'cardData', 'safetensors', 'tags', 'inferenceProviderMapping'],
  dataset: ['downloads', 'likes', 'lastModified', 'gated', 'cardData', 'tags'],
};
const ID = /^\w[\w.-]*(\/\w[\w.-]*)?$/; // owner/name, or an old canonical name like "gpt2"; never "." or "..", so the path stays put
const CACHE_MS = 60 * 60 * 1000; // a session asks about the same ids again and again
const TIMEOUT_MS = 15_000;

const cache = new Map<string, { at: number; entry: Promise<Entry> }>();

/** The Hub's record of a model or dataset, from a cache an hour fresh. */
export function lookUp(kind: Kind, id: string): Promise<Entry> {
  const key = `${kind}:${id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.entry;
  const entry = fetchEntry(kind, id).then((found) => {
    if (found.exists === undefined) cache.delete(key); // the Hub didn't answer: ask again next time
    return found;
  });
  cache.set(key, { at: Date.now(), entry });
  return entry;
}

async function fetchEntry(kind: Kind, id: string): Promise<Entry> {
  if (!ID.test(id)) return { id, kind, exists: false, status: 'invalid id' };
  const query = EXPAND[kind].map((field) => `expand[]=${field}`).join('&');
  try {
    const response = await fetch(`https://huggingface.co/api/${kind}s/${id}?${query}`, {
      headers: process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {},
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // The Hub answers 401, not 404, for a repo that doesn't exist, so private ones can't be probed.
    if (response.status === 401 || response.status === 404) return { id, kind, exists: false, status: response.status };
    if (!response.ok) return { id, kind, exists: undefined, status: response.status };
    const json = await response.json();
    const card = json.cardData ?? {};
    const tags: string[] = Array.isArray(json.tags) ? json.tags : [];
    const tagged = (prefix: string) => tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
    // Custom terms are "other", named in license_name; some cards give only the name. Either way: "other (qwen-research)".
    const license = [card.license || tagged('license:')].flat().filter(Boolean).join(', ');
    const base: string[] = [card.base_model ?? []].flat();
    // { provider: { status: "live" | "staging", ... } }
    const hosted = Object.entries(json.inferenceProviderMapping ?? {}).filter(([, p]) => (p as { status?: string })?.status === 'live').map(([name]) => name);
    return {
      id: json.id ?? id,
      kind,
      exists: true,
      status: response.status,
      task: json.pipeline_tag ?? tagged('task_categories:'),
      library: json.library_name,
      license: (license.toLowerCase() === 'other' || !license) && card.license_name ? `other (${card.license_name})` : license || undefined,
      baseModels: base.length ? base : undefined,
      params: json.safetensors?.total,
      downloads: json.downloads,
      likes: json.likes,
      updated: json.lastModified,
      gated: json.gated,
      hostedBy: hosted.length ? hosted : undefined,
    };
  } catch {
    return { id, kind, exists: undefined, status: 'unreachable' };
  }
}
