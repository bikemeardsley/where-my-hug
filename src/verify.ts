// The second step: every candidate the agent named is looked up on the Hub. One that isn't there is dropped; the
// rest are flagged for what would bite later (gated access, terms you can't ship under, years without an update,
// almost no use) and sized against the compute. What runs on it heads each part; bigger models follow, a stretch
// or cloud only, as what might do better if it can be made to work. The verdicts and the order are the agent's,
// since fit comes first; the facts are the Hub's.
import { lookUp, type Entry, type Kind } from './hub.ts';

export type Verdict = 'USE' | 'TUNE' | 'TRAIN' | 'WRITE';
export interface Candidate { id: string; kind?: Kind }
export interface Component { id: string; name: string; role: string; verdict: Verdict; rationale: string; candidates: Candidate[] }
/** Against the compute: runs on it, fits only quantized (a stretch), or needs more hardware or a host (cloud). */
type Tier = 'fits' | 'stretch' | 'cloud';
type Checked = Entry & { flags: string[]; tier?: Tier };
interface Part extends Component {
  model?: Checked; // the first model that runs on the compute (or the first, when the compute or the size isn't known)
  dataset?: Checked;
  bigger: Checked[]; // models over the compute, in the agent's order
  alternates: Checked[];
  dropped: string[];
  missing: Kind[]; // what it needs new candidates for
}

const STALE_DAYS = 730;
const LITTLE_USED = 100; // downloads in the last 30 days
const BYTES_PER_PARAM = 2.4; // half precision plus a fifth for activations and cache: enough to run it; fine-tuning needs more again
const QUANTIZED_BYTES_PER_PARAM = 0.6; // 4 bits, plus the same fifth
const FULL_TUNE_BYTES_PER_PARAM = 16; // weights and gradients in half precision, Adam's state and a master copy in full
const QLORA_BYTES_PER_PARAM = 1; // 4-bit weights, small adapters, room for activations
const NON_COMMERCIAL = /(^|[-_ ])nc([-_ ]|$)|non-?commercial|research|amlr|deepfloyd/;
const OWN_TERMS = /\bother\b|llama|gemma|rail|grok|community|(^|-)nd(-|$)/; // custom, use-restricted or no-derivatives

export async function verify({ need, components, compute }: { need: string; components: Component[]; compute?: string }) {
  const budget = Number(/(\d+(?:\.\d+)?)\s*gb/i.exec(compute ?? '')?.[1]) * 1e9 || undefined; // bytes, from "one 24 GB GPU"
  const tierOf = ({ kind, params }: Entry): Tier | undefined =>
    !budget || !params || kind === 'dataset' ? undefined
      : params * BYTES_PER_PARAM <= budget ? 'fits' : params * QUANTIZED_BYTES_PER_PARAM <= budget ? 'stretch' : 'cloud';
  const parts: Part[] = await Promise.all(components.map(async (component) => {
    // An agent can name a dataset as a model or the other way round: then the Hub has it under the other kind.
    const entries = await Promise.all(component.candidates.map(async ({ id, kind = 'model' }) => {
      const entry = await lookUp(kind, id);
      if (entry.exists !== false) return entry;
      const other = await lookUp(kind === 'model' ? 'dataset' : 'model', id);
      if (other.exists === undefined) return { ...entry, exists: undefined, status: other.status }; // not ruled out: unchecked, not dropped
      return other.exists ? other : entry;
    }));
    const found: Checked[] = entries.filter((entry) => entry.exists !== false).map((entry) => ({ ...entry, flags: flagsOf(entry), tier: tierOf(entry) }));
    const models = found.filter((entry) => entry.kind === 'model');
    const bigger = models.filter((entry) => entry.tier === 'stretch' || entry.tier === 'cloud');
    const model = models.find((entry) => !bigger.includes(entry));
    const dataset = found.find((entry) => entry.kind === 'dataset');
    // Back to the agent: everything named of a kind is gone, or the part needs a model and named none. A model
    // too big for the compute isn't gone: it's an option, if the hardware can be found.
    const missing = (['model', 'dataset'] as const).filter((kind) => !found.some((entry) => entry.kind === kind) &&
      (entries.some((entry) => entry.kind === kind) || (kind === 'model' && (component.verdict === 'USE' || component.verdict === 'TUNE'))));
    return {
      ...component, model, dataset, bigger,
      alternates: found.filter((entry) => entry !== model && entry !== dataset && !bigger.includes(entry)),
      dropped: entries.filter((entry) => entry.exists === false).map((entry) => entry.id),
      missing,
    };
  }));
  const recall = parts.filter((part) => part.missing.length).map((part) => `${part.id} (a ${part.missing.join(' and a ')})`);
  const result = {
    need,
    components: parts,
    nextAction: recall.length ? 'RECALL_REPLACEMENTS' : 'DONE',
    instructions: recall.length
      ? `These parts need new candidates: ${recall.join(', ')}. Propose ids for exactly those (not the dropped ones again), then call wheres_my_hug_verify again with the whole slate.`
      : "Show the user the markdown report as it is. Its facts came from the Hub just now; don't restate them from memory.",
  };
  return { markdown: report(need, parts, compute), result };
}

/** What would bite later, in the Hub's own facts. */
function flagsOf(entry: Entry): string[] {
  const flags: string[] = [];
  const license = entry.license?.toLowerCase();
  if (entry.exists === undefined) flags.push('UNCHECKED');
  if (entry.gated) flags.push('GATED');
  if (entry.exists && (!license || license === 'unknown')) flags.push('NO_LICENSE');
  else if (license && NON_COMMERCIAL.test(license)) flags.push('NON_COMMERCIAL');
  if (license && OWN_TERMS.test(license)) flags.push('OWN_TERMS'); // with NON_COMMERCIAL too: cc-by-nc-nd is both
  if (entry.updated && Date.now() - Date.parse(entry.updated) > STALE_DAYS * 864e5) flags.push('STALE');
  if (entry.downloads !== undefined && entry.downloads < LITTLE_USED) flags.push('LITTLE_USED');
  return flags;
}

const FLAG_WORDS: Record<string, string> = {
  UNCHECKED: "the Hub didn't answer, so it's unchecked",
  GATED: 'gated: accept its terms on the Hub before downloading',
  NO_LICENSE: 'no license on its card: find its terms before relying on it',
  NON_COMMERCIAL: 'non-commercial or research-only terms',
  OWN_TERMS: 'its own terms (custom, use-restricted or no-derivatives): read them',
  STALE: 'not updated in two years',
  LITTLE_USED: 'almost nobody downloads it',
};

const url = ({ id, kind }: Entry) => `https://huggingface.co/${kind === 'dataset' ? 'datasets/' : ''}${id}`;
const count = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const gb = (params: number, bytes: number) => `~${((params * bytes) / 1e9).toFixed(1)} GB`;
const brief = ({ flags }: Checked) => (flags.length ? ` (${flags.map((flag) => flag.toLowerCase().replace('_', ' ')).join(', ')})` : '');
const age = (iso: string) => {
  const days = Math.round((Date.now() - Date.parse(iso)) / 864e5);
  return days < 1 ? 'today' : days < 60 ? `${days} days ago` : days < 730 ? `${Math.round(days / 30)} months ago` : `${Math.round(days / 365)} years ago`;
};

/** A pick in full: its link, then the Hub's facts about it, then what to watch. */
function pick(label: string, entry: Checked, tune = false): string[] {
  const facts = [
    entry.task, entry.library, entry.license && `license ${entry.license}`,
    entry.params && `${count(entry.params)} parameters (${gb(entry.params, BYTES_PER_PARAM)} to run${tune
      ? `; to fine-tune, ${gb(entry.params, QLORA_BYTES_PER_PARAM)} with QLoRA, ${gb(entry.params, FULL_TUNE_BYTES_PER_PARAM)} in full` : ''})`,
    entry.downloads !== undefined && `${count(entry.downloads)} downloads a month`,
    entry.likes !== undefined && `${count(entry.likes)} likes`,
    entry.updated && `updated ${age(entry.updated)}`,
    entry.baseModels && `built on ${entry.baseModels.join(', ')}`,
  ].filter(Boolean).join('  ·  ');
  return [
    `**${label}: [${entry.id}](${url(entry)})**`, facts,
    ...(entry.flags.length ? ['', `Watch out: ${entry.flags.map((flag) => FLAG_WORDS[flag]).join('; ')}.`] : []),
    '',
  ];
}

/** A model over the compute in a line: how far over, and where it could run. */
function upgrade(entry: Checked): string {
  const size = entry.tier === 'stretch'
    ? `a stretch: ${gb(entry.params!, BYTES_PER_PARAM)} to run, ${gb(entry.params!, QUANTIZED_BYTES_PER_PARAM)} quantized to 4 bits`
    : `cloud: ${gb(entry.params!, BYTES_PER_PARAM)} to run`;
  const where = entry.hostedBy ? `hosted by ${entry.hostedBy.join(', ')}` : entry.tier === 'cloud' ? 'on rented GPUs (no host on the Hub serves it)' : undefined;
  return `- [${entry.id}](${url(entry)}): ${[size, where].filter(Boolean).join(', ')}${brief(entry)}`;
}

function report(need: string, parts: Part[], compute?: string): string {
  const named = parts.reduce((sum, part) => sum + part.candidates.length, 0);
  const dropped = parts.reduce((sum, part) => sum + part.dropped.length, 0);
  const unchecked = parts.flatMap((part) => [part.model, part.dataset, ...part.bigger, ...part.alternates]).filter((entry) => entry?.flags.includes('UNCHECKED')).length;
  const tally = (['USE', 'TUNE', 'TRAIN', 'WRITE'] as const)
    .map((verdict) => [parts.filter((part) => part.verdict === verdict).length, { USE: 'to use as is', TUNE: 'to fine-tune', TRAIN: 'to train', WRITE: 'to write' }[verdict]] as const)
    .filter(([n]) => n).map(([n, words]) => `${n} ${words}`);
  const lines = [
    "# Where's my hug at?", '',
    `**${need}**`, '',
    `${parts.length} ${parts.length === 1 ? 'part' : 'parts'}: ${tally.join(', ')}.`, '',
    `_Checked on the Hugging Face Hub just now: ${named} named, ${dropped} not there and dropped${unchecked ? `, ${unchecked} the Hub didn't answer for` : ''}._`,
  ];
  for (const part of parts) {
    lines.push('', '---', '', `## ${part.verdict}  ·  ${part.name}`, '', `_${part.role}_`, '');
    if (part.model) lines.push(...pick('Model', part.model, part.verdict === 'TUNE'));
    else if (part.bigger.length) lines.push(`**Nothing named runs on ${compute}: the options below need more.**`, '');
    if (part.dataset) lines.push(...pick('Data', part.dataset));
    if (part.missing.length) lines.push(`**No ${part.missing.join(' or ')} on the Hub for this yet: it needs new candidates.**`, '');
    else if (part.verdict === 'WRITE' && !part.model) lines.push('**No model: write this one.**', '');
    else if (part.verdict === 'TRAIN' && !part.dataset) lines.push('**No dataset on the Hub for this: collect the data.**', '');
    lines.push(part.rationale);
    if (part.bigger.length) lines.push('', `If you can make it work, bigger than ${compute}:`, ...part.bigger.map(upgrade));
    if (part.alternates.length) lines.push('', `Also: ${part.alternates.map((entry) => `[${entry.id}](${url(entry)})${brief(entry)}`).join('  ·  ')}`);
    if (part.dropped.length) lines.push('', `Dropped, not on the Hub (or private): ${part.dropped.join(', ')}`);
  }
  const width = Math.max(...parts.map((part) => part.name.length));
  lines.push('', '---', '', '## At a glance', '', '```', ...parts.map((part, i) => {
    const model = part.model?.id ?? (part.bigger[0] && `${part.bigger[0].id} (${part.bigger[0].tier})`);
    const what = [model, part.dataset?.id].filter(Boolean).join(' + ');
    return `${i + 1}. ${part.name.padEnd(width)}  ${part.verdict.padEnd(5)}  ${what || (part.verdict === 'WRITE' ? 'your code' : part.verdict === 'TRAIN' ? 'your data' : '(nothing left)')}`;
  }), '```');
  return lines.join('\n');
}
