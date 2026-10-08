// The first step: the method the agent follows before it names anything. Agents know the Hub well but misremember
// ids and licenses, so the agent proposes and wheres_my_hug_verify checks; this text only has to make the proposals
// good ones. Four details change the answer, so they come first: a call missing any gets questions back, not the
// method, and "unknown" is a fine answer.

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
    return `Where's my hug at? Before any searching, ${missing.length === 1 ? 'one detail changes' : 'these details change'} the answer.

Need: ${details.need}

Fill in what the conversation or the codebase already says. Ask the user for the rest, all at once (with your question tool, if you have one):
${missing.map((key) => `- ${key}: ${QUESTIONS[key]}`).join('\n')}

"Not sure yet" is a fine answer: pass "unknown", and the picks will cover the range. Then call wheres_my_hug again with all four filled in.`;
  }
  const { need, compute, license, stack, data } = details;
  return `Where's my hug at? Work out what the Hugging Face Hub already has for this need.

Need: ${need}
Compute: ${compute}
License: ${license}
Stack: ${stack}
Data: ${data}
Where a detail is "unknown", cover the range (a small pick and a big one, say) and say what each needs.

1. Split the need into its parts: 2 to 6 jobs, each with an input and an output ("photo -> the object's corners"). Name the job, not a model.

2. Give each part a verdict:
   USE    a model on the Hub does this job well enough as it is.
   TUNE   a model on the Hub comes close: fine-tune it on the data. Name the base, and a Hub dataset if one fits.
   TRAIN  nothing on the Hub comes close: it needs its own model. Name datasets that could start it.
   WRITE  not a job for a model: rules, geometry, parsing, lookups, arithmetic. Code is cheaper and exact.
   Most needs have a WRITE part somewhere. A model doing deterministic work is a cost, not a feature.

3. Name candidates. For USE and TUNE, 1 to 4 models, best fit first: at least one that runs on the compute; then, where a bigger model would clearly do better, one a little over it (it may fit quantized) and one far over it that could run in the cloud. Say in the rationale what the bigger ones would buy. For TUNE and TRAIN, datasets too (kind "dataset"). Exact Hub ids (owner/name) you are confident exist. A Space is a demo: name the model behind it. Fit the stack: a model the stack can't load means running a server, so say so. Never guess an owner: an id that isn't there is dropped, and a part left with nothing comes back to you.

4. Before ranking, check each candidate against what bites later:
   - its terms: non-commercial, research-only and custom licenses may rule it out, and a fine-tune carries its base's terms too;
   - gated access that needs approval;
   - its size against the compute: fine-tuning in full needs several times the memory that running does, QLoRA less than running;
   - its task: a model that captions images doesn't find things in them, however close the names sound.

5. Call wheres_my_hug_verify with:
   { "need": "...", "compute": "...",
     "components": [{ "id": "page-reader", "name": "Read the page", "role": "photo of a page -> its text",
                      "verdict": "TUNE", "rationale": "why this verdict, and why these candidates in this order",
                      "candidates": [{ "id": "owner/model", "kind": "model" }, { "id": "owner/data", "kind": "dataset" }] }] }
   Show the user nothing until it answers: its report is what they see, with every fact checked on the Hub.`;
}
