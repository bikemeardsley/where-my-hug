// The first step: the method the agent follows before anything is named. What an agent remembers of Hugging Face is
// as old as its training and misses the long tail, so it doesn't pick from memory: it splits the need into parts,
// where_my_hug_search finds what Hugging Face has for each, the agent judges those results, and where_my_hug_verify
// checks the picks. Four details change the answer, so they come first: a call missing any gets questions back, not
// the method, and "unknown" is a fine answer.

export interface Details { need: string; compute?: string; license?: string; stack?: string; data?: string }

const QUESTIONS = {
  compute: 'Where will it run, and train if it needs training? This decides model size, and whether fine-tuning is possible at all. ("one 24 GB GPU", "CPU only", "a phone", "rented GPUs")',
  license: 'What may the result be used for? This decides which licenses are allowed. ("commercial, closed source", "open source", "personal or research")',
  stack: 'What will call the model? This decides which weight formats work. ("a Python service", "Node", "the browser", "a mobile app")',
  data: 'What training data is there, or could be collected? This decides whether fine-tuning or training is realistic. ("none", "about 300 labeled photos", "can collect more")',
};

export function rubric(details: Details): string {
  const missing = (Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[]).filter((key) => !details[key]?.trim());
  if (missing.length) {
    return `Where my hug at? Before any searching, ${missing.length === 1 ? 'one detail changes' : 'these details change'} the answer.

Need: ${details.need}

Fill in what the conversation or the codebase already says. Ask the user for the rest, all at once (with your question tool, if you have one):
${missing.map((key) => `- ${key}: ${QUESTIONS[key]}`).join('\n')}

"Not sure yet" is a fine answer: pass "unknown", and the picks will cover the range. Then call where_my_hug again with all four filled in.`;
  }
  const { need, compute, license, stack, data } = details;
  return `Where my hug at? Work out what Hugging Face already has for this need.

Need: ${need}
Compute: ${compute}
License: ${license}
Stack: ${stack}
Data: ${data}
Where a detail is "unknown", cover the range (a small pick and a big one, say) and say what each needs.

1. Split the need into its parts: 2 to 6 jobs, each with an input and an output ("photo -> the object's corners"). Name the job, not a model.

2. Mark the parts that aren't a job for a model WRITE: rules, geometry, parsing, lookups, arithmetic. Code is cheaper and exact.
   Most needs have a WRITE part somewhere. A model doing deterministic work is a cost, not a feature. Every other part gets searched.

3. Search before naming anything: call where_my_hug_search with, for each part that isn't WRITE,
   { "id": "page-reader", "name": "Read the page",
     "task": "image-to-text",              (the Hugging Face task tag the job falls under, as the Hub's filters name it)
     "keywords": ["ocr", "handwritten"],   (1 to 3 single words a fitting model's name might hold)
     "phrase": "handwritten text recognition" }   (the job in a few words, as a model card would put it)
   It searches the task's most downloaded and trending models, names holding each keyword, and the text of model and
   dataset cards. If a part comes back thin, search again with other words; a job can sit under more than one task tag.

4. From what the search found, give each part its verdict:
   USE    a model the search found does this job well enough as it is.
   TUNE   one comes close: fine-tune it on the data. Pick the base, and a dataset from the search if one fits.
   TRAIN  none of what the search found does the job, and its results have to show it. Pick datasets that could start it.
   Then pick candidates from the results, by what they say (task, card, use, recency), not by what you remember. For USE and TUNE,
   1 to 4 models, best fit first: at least one that runs on the compute; then, where a bigger model would clearly do better, one a
   little over it (it may fit quantized) and one far over it that could run in the cloud. Say in the rationale what the bigger ones
   would buy. For TUNE and TRAIN, datasets too (kind "dataset"). A Space is a demo: pick the model behind it. Fit the stack: a model
   the stack can't load means running a server, so say so. A model you know that the search didn't turn up may be added, but it
   goes after the search's picks and the report marks it as from memory.

5. Before ranking, check each candidate against what bites later:
   - its terms: non-commercial, research-only and custom licenses may rule it out, and a fine-tune carries its base's terms too;
   - gated access that needs approval;
   - its size against the compute: fine-tuning in full needs several times the memory that running does, QLoRA less than running;
   - its task: a model that captions images doesn't find things in them, however close the names sound.

6. Call where_my_hug_verify with:
   { "need": "...", "compute": "...",
     "components": [{ "id": "page-reader", "name": "Read the page", "role": "photo of a page -> its text",
                      "verdict": "TUNE", "rationale": "why this verdict, and why these candidates in this order",
                      "search": { "task": "image-to-text", "keywords": ["ocr", "handwritten"], "phrase": "handwritten text recognition" },
                      "candidates": [{ "id": "owner/model", "kind": "model" }, { "id": "owner/data", "kind": "dataset" }] }] }
   Pass each part's last search unchanged; a WRITE part has none. Show the user nothing until it answers: its report is what they
   see, with every fact checked on Hugging Face.`;
}
