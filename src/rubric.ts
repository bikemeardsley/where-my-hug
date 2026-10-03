// The first step: the method the agent follows before it names anything. Agents know the Hub well but misremember
// ids and licenses, so the agent proposes and wheres_my_hug_verify checks; this text only has to make the proposals
// good ones: split the need, decide what each part takes, and name exact ids with the traps in mind.

export function rubric({ need, stack, license, compute }: { need: string; stack?: string; license?: string; compute?: string }): string {
  return `Where's my hug at? Work out what the Hugging Face Hub already has for this need.

Need: ${need}
Stack: ${stack ?? 'not given'}
License: ${license ?? "not given, so say what each pick's terms allow"}
Compute: ${compute ?? 'not given, so prefer models that run on one consumer GPU'}

1. Split the need into its parts: 2 to 6 jobs, each with an input and an output ("photo -> the object's corners"). Name the job, not a model.

2. Give each part a verdict:
   USE    a model on the Hub does this job well enough as it is.
   TUNE   a model on the Hub comes close: fine-tune it. Name the base, and a dataset if one fits.
   TRAIN  nothing on the Hub comes close: it needs its own model. Name datasets that could start it.
   WRITE  not a job for a model: rules, geometry, parsing, lookups, arithmetic. Code is cheaper and exact.
   Most needs have a WRITE part somewhere. A model doing deterministic work is a cost, not a feature.

3. Name candidates: for USE and TUNE, 1 to 3 models, best fit first; for TUNE and TRAIN, datasets too (kind "dataset"). Exact Hub ids (owner/name) you are confident exist. The smallest model that does the job beats the biggest. A Space is a demo: name the model behind it. Fit the stack: a model the stack can't load means running a server, so say so. Never guess an owner: an id that isn't there is dropped, and a part left with nothing comes back to you.

4. Before ranking, check each candidate against what bites later:
   - its terms: non-commercial, research-only and custom licenses may rule it out, and a fine-tune carries its base's terms too;
   - gated access that needs approval;
   - its size against the compute: fine-tuning needs several times the memory that running does;
   - its task: a model that captions images doesn't find things in them, however close the names sound.

5. Call wheres_my_hug_verify with:
   { "need": "...", "compute": "...",
     "components": [{ "id": "page-reader", "name": "Read the page", "role": "photo of a page -> its text",
                      "verdict": "TUNE", "rationale": "why this verdict, and why these candidates in this order",
                      "candidates": [{ "id": "owner/model", "kind": "model" }, { "id": "owner/data", "kind": "dataset" }] }] }
   Show the user nothing until it answers: its report is what they see, with every fact checked on the Hub.`;
}
