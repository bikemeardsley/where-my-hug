// What Hugging Face has for a job (search), and what it says about a model or dataset: whether it exists, and what it is (lookUp). GETs to
// huggingface.co/api, its fields read where the API puts them (checked against the live API, 2026-10-02):
// license in the card data or a license: tag, base_model in the card data (one id or several), size as
// safetensors.total. HF_TOKEN, if set, is sent so gated and private repos the token can see are found; it
// goes only to huggingface.co and is never recorded.

export type Kind = 'model' | 'dataset';

export interface Entry {
  id: string;
  kind: Kind;
  exists: boolean | undefined; // undefined: Hugging Face couldn't be asked (unreachable, rate-limited, down)
  status: number | 'unreachable' | 'invalid id' | 'no key';
  title?: string; // a dataset's own name, on hubs whose ids don't say much ("zenodo:18180184")
  task?: string;
  library?: string;
  license?: string;
  baseModels?: string[];
  params?: number;
  downloads?: number; // in the last 30 days
  downloadsEver?: number; // all-time, as the other dataset hubs count them
  likes?: number;
  updated?: string;
  page?: string; // its page, where it isn't on Hugging Face
  gated?: boolean | string; // false, or how access is granted ("auto", "manual")
  hostedBy?: string[]; // inference providers serving it live, so it can be called without running it
  size?: string; // a dataset's: "10K to 100K rows", "1.2k images", "380.0 MB" (kept as text: the hubs measure it differently)
}

export const count = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const tagged = (tags: string[], prefix: string) => tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
// "size_categories:10K<n<100K" -> "10K to 100K rows"; "n<1K" -> "under 1K rows"; "n>1T" -> "over 1T rows"
const rowsOf = (tags: string[]) => tagged(tags, 'size_categories:')
  ?.replace(/^n<(.+)$/, 'under $1').replace(/^(.+)<n<(.+)$/, '$1 to $2').replace(/^n>(.+)$/, 'over $1').concat(' rows');

const EXPAND: Record<Kind, string[]> = {
  model: ['pipeline_tag', 'library_name', 'downloads', 'likes', 'lastModified', 'gated', 'cardData', 'safetensors', 'tags', 'inferenceProviderMapping'],
  dataset: ['downloads', 'likes', 'lastModified', 'gated', 'cardData', 'tags'],
};
const ID = /^\w[\w.-]*(\/\w[\w.-]*)?$/; // owner/name, or an old canonical name like "gpt2"; never "." or "..", so the path stays put
const CACHE_MS = 60 * 60 * 1000; // a session asks about the same ids again and again
export const TIMEOUT_MS = 15_000;

const cache = new Map<string, { at: number; answer: Promise<unknown> }>();
const headers = (): Record<string, string> => (process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {});

/** An answer from a cache an hour fresh; one not worth keeping (the host didn't answer) is asked again next time. */
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

/** Hugging Face's record of a model or dataset. */
export const lookUp = (kind: Kind, id: string) => cached(`${kind}:${id}`, () => fetchEntry(kind, id), (found) => found.exists !== undefined);

/** A search's answer as read, or undefined if the host didn't answer or garbled it. */
export const get = <T>(url: string, read: (json: any) => T, auth: Record<string, string> = {}) => cached(url,
  () => fetch(url, { headers: auth, signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then(async (response) => (response.ok ? read(await response.json()) : undefined)).catch(() => undefined),
  (found) => found !== undefined);

async function fetchEntry(kind: Kind, id: string): Promise<Entry> {
  if (!ID.test(id)) return { id, kind, exists: false, status: 'invalid id' };
  const query = EXPAND[kind].map((field) => `expand[]=${field}`).join('&');
  try {
    const response = await fetch(`https://huggingface.co/api/${kind}s/${id}?${query}`, {
      headers: headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Hugging Face answers 401, not 404, for a repo that doesn't exist, so private ones can't be probed.
    if (response.status === 401 || response.status === 404) return { id, kind, exists: false, status: response.status };
    if (!response.ok) return { id, kind, exists: undefined, status: response.status };
    const json = await response.json();
    const card = json.cardData ?? {};
    const tags: string[] = Array.isArray(json.tags) ? json.tags : [];
    // Custom terms are "other", named in license_name; some cards give only the name. Either way: "other (qwen-research)".
    const license = [card.license || tagged(tags, 'license:')].flat().filter(Boolean).join(', ');
    const base: string[] = [card.base_model ?? []].flat();
    // { provider: { status: "live" | "staging", ... } }
    const hosted = Object.entries(json.inferenceProviderMapping ?? {}).filter(([, p]) => (p as { status?: string })?.status === 'live').map(([name]) => name);
    return {
      id: json.id ?? id,
      kind,
      exists: true,
      status: response.status,
      task: json.pipeline_tag ?? tagged(tags, 'task_categories:'),
      library: json.library_name,
      license: (license.toLowerCase() === 'other' || !license) && card.license_name ? `other (${card.license_name})` : license || undefined,
      baseModels: base.length ? base : undefined,
      params: json.safetensors?.total,
      downloads: json.downloads,
      likes: json.likes,
      updated: json.lastModified,
      gated: json.gated,
      hostedBy: hosted.length ? hosted : undefined,
      size: rowsOf(tags),
    };
  } catch {
    return { id, kind, exists: undefined, status: 'unreachable' };
  }
}

// Searching, so candidates come from Hugging Face and not from what an agent remembers. Three ways in, all checked
// against the live API on 2026-10-14: a task's most downloaded and its trending (where new models surface), names
// containing a keyword (the list API's search matches part of an id, one word at a time), and full text, which reads
// the model and dataset cards themselves, the nearest thing to a web search. Full text is the API behind the site's
// own search page and isn't documented, so its failing costs only its own hits.

export interface Query { task?: string; keywords?: string[]; phrase?: string }
export interface Hit extends Omit<Entry, 'exists' | 'status'> {
  found: string[]; // how: "most downloaded for image-to-text", "trending for image-to-text", "name has ocr", "card text"
  created?: string;
  snippet?: string; // what the card says, when full text found it
}

const PER_QUERY = 8;

/** Lists taken in turns: each one's first, then each one's second, and so on. */
export const inTurns = <T>(lists: (T[] | undefined)[]): T[] =>
  Array.from({ length: PER_QUERY }, (_, rank) => lists.flatMap((list) => list?.[rank] ?? [])).flat();

const listed = (item: any, kind: Kind, how: string): Hit => {
  const tags: string[] = Array.isArray(item.tags) ? item.tags : [];
  return {
    id: item.id, kind, found: [how],
    task: item.pipeline_tag ?? (tags.filter((tag) => tag.startsWith('task_categories:')).map((tag) => tag.slice('task_categories:'.length)).join(', ') || undefined),
    license: tagged(tags, 'license:'),
    downloads: item.downloads, likes: item.likes, created: item.createdAt, size: rowsOf(tags),
  };
};

/**
 * Everything Hugging Face turns up for a query, taken in turns: each way's first hit, then each way's second, and so
 * on. Sorting the lot by downloads would bury what only a keyword or a card found under whatever is popular for the
 * task, and those are often the closest fit.
 */
export async function search(kind: Kind, { task, keywords = [], phrase }: Query): Promise<{ hits: Hit[]; failed: string[] }> {
  const api = `https://huggingface.co/api/${kind}s?limit=${PER_QUERY}&`;
  const byTask = task && (kind === 'model' ? `pipeline_tag=${encodeURIComponent(task)}` : `filter=task_categories:${encodeURIComponent(task)}`);
  const queries: [string, string, ((json: any) => Hit[])?][] = [
    ...(byTask ? [[`${api}${byTask}&sort=downloads`, `most downloaded for ${task}`], [`${api}${byTask}&sort=trendingScore`, `trending for ${task}`]] as [string, string][] : []),
    ...keywords.map((word): [string, string] => [`${api}search=${encodeURIComponent(word)}&sort=downloads`, `name has ${word}`]),
    ...(phrase ? [[
      `https://huggingface.co/api/search/full-text?type=${kind}&limit=${PER_QUERY}&q=${encodeURIComponent(phrase)}`, 'card text',
      // No hits array is a garbled answer, so a failed search, not an empty one: an empty one is what a TRAIN verdict rests on.
      (json: any) => json.hits.filter((hit: any) => hit.type === kind && ID.test(hit.name ?? '')).map((hit: any): Hit => ({
        id: hit.name, kind, found: ['card text'], likes: hit.likes,
        snippet: (hit.formatted?.fileContent ?? []).map((part: any) => part.text).join('').replace(/\s+/g, ' ').trim().slice(0, 200) || undefined,
      })),
    ]] as [string, string, (json: any) => Hit[]][] : []),
  ];
  const answers = await Promise.all(queries.map(([url, how, read = (json: any): Hit[] =>
    json.filter((item: any) => typeof item?.id === 'string').map((item: any) => listed(item, kind, how))]) => get(url, read, headers())));
  const merged = new Map<string, Hit>();
  for (const hit of inTurns(answers)) {
    const seen = merged.get(hit.id.toLowerCase()); // the Hub's ids are case-insensitive
    if (!seen) merged.set(hit.id.toLowerCase(), { ...hit, found: [...hit.found] });
    else {
      seen.found = [...new Set([...seen.found, ...hit.found])];
      for (const [key, value] of Object.entries(hit)) if ((seen as any)[key] === undefined) (seen as any)[key] = value; // full text knows the card, the list the counts
    }
  }
  return { hits: [...merged.values()], failed: queries.filter((_, i) => !answers[i]).map(([, how]) => how) };
}
