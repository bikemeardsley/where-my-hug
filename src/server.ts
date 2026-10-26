#!/usr/bin/env node
// Where My Hug At? as an MCP server on stdio. Three tools, called in order: the rubric the agent follows, the search
// of Hugging Face it picks models and datasets from, then the live check that writes the report the user sees. For an
// agent without MCP, the same three run from a shell: `where-my-hug rubric`, `search` and `verify`, JSON on stdin.
// For a client that speaks MCP over HTTP only, `where-my-hug --http` serves them at /mcp.
import { createServer } from 'node:http';
import { text } from 'node:stream/consumers';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { rubric } from './rubric.ts';
import { find } from './search.ts';
import { verify } from './verify.ts';

const need = z.string().min(1).describe('The ML need in plain words: what goes in, what should come out, and what it is for');
const compute = z.string().optional().describe('The hardware it has to run or train on, such as "one 24 GB GPU" or "CPU only". Size flags take the first "N GB" in it as the memory a model must fit in');
const details = {
  need,
  compute,
  license: z.string().optional().describe('What the result may be used for, such as "commercial, closed source" or "research only"'),
  stack: z.string().optional().describe('What will call the model: language, runtime, framework'),
  data: z.string().optional().describe('Training data there is or could be, such as "none" or "about 300 labeled photos"'),
};
const query = {
  task: z.string().optional().describe('The Hugging Face task tag the job falls under, as the Hub\'s filters name it, such as "image-to-text" or "automatic-speech-recognition"'),
  keywords: z.array(z.string().min(1)).max(3).optional().describe('1 to 3 single words a fitting model\'s name might hold, such as "ocr"'),
  phrase: z.string().optional().describe('The job in a few words, as a model card would put it, such as "handwritten text recognition"'),
};
const wanted = {
  parts: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), ...query })).min(1).max(6), // at most 72 searches a call
};
const slate = {
  need,
  compute,
  components: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string(),
    verdict: z.enum(['USE', 'TUNE', 'TRAIN', 'WRITE']),
    rationale: z.string(),
    search: z.object(query).optional().describe("The part's last where_my_hug_search query, unchanged; none for a WRITE part"),
    candidates: z.array(z.object({ id: z.string().min(1), kind: z.enum(['model', 'dataset']).optional() })).max(6),
  })).min(1).max(8), // at most 48 lookups a call
  recommendation: z.string().optional().describe('What to act on first: the one or two picks worth trying now and why (fit, license, use), then the ones to skip and why. Shown last, as "Start here"'),
};
const verified = async (args: z.infer<z.ZodObject<typeof slate>>) => {
  const { markdown, result } = await verify(args);
  return `${markdown}\n\n<where_my_hug_json>\n${JSON.stringify(result)}\n</where_my_hug_json>`;
};

function serve() {
  const server = new McpServer({ name: 'where-my-hug', version: '0.2.0' });
  server.registerTool('where_my_hug', {
    title: "Where my hug at?",
    description: 'Step 1 of 3, before recommending any Hugging Face model or dataset. If compute, license, stack or data is missing, returns the questions to ask the user first: call again with the answers ("unknown" is fine). Then returns the method: split the ML need into parts, search Hugging Face for each with where_my_hug_search, and decide from what it finds which parts Hugging Face covers (use a model as is, fine-tune one, train one) and which are plain code. Follow it.',
    inputSchema: details,
  }, async (args) => ({ content: [{ type: 'text', text: rubric(args) }] }));
  server.registerTool('where_my_hug_search', {
    title: "Where my hug at? (searched on Hugging Face)",
    description: "Step 2 of 3: searches Hugging Face for each part of the need: the task's most downloaded and trending models, names holding each keyword, and the text of model and dataset cards. Returns what it found, with downloads, likes, license, age and how each turned up, to pick each part's verdict and candidates from. Then call where_my_hug_verify.",
    inputSchema: wanted,
  }, async ({ parts }) => ({ content: [{ type: 'text', text: await find(parts) }] }));
  server.registerTool('where_my_hug_verify', {
    title: "Where my hug at? (checked on Hugging Face)",
    description: "Step 3 of 3: checks every picked model and dataset id live on Hugging Face, drops the ones that are not there, flags licenses, gating, staleness and low use, sizes each model against the compute (fits, a stretch that fits only quantized, or cloud, with who hosts it), marks picks the search didn't turn up as from memory, shows what it found that wasn't picked, and returns the report to show the user. If nextAction is SEARCH_FIRST or RECALL_REPLACEMENTS, do what its instructions say and call again.",
    inputSchema: slate,
  }, async (args) => ({ content: [{ type: 'text', text: await verified(args) }] }));
  return server;
}

const [command, address = '8000'] = process.argv.slice(2);
const [, host = '127.0.0.1', port] = /^(?:(.+):)?(\d+)$/.exec(address) ?? [];
if (command === 'rubric') console.log(rubric(z.object(details).parse(JSON.parse(await text(process.stdin)))));
else if (command === 'search') console.log(await find(z.object(wanted).parse(JSON.parse(await text(process.stdin))).parts));
else if (command === 'verify') console.log(await verified(z.object(slate).parse(JSON.parse(await text(process.stdin)))));
else if (command === '--http' && port) {
  // For clients that speak MCP over HTTP only, such as Open WebUI. Stateless: a fresh server for each request.
  createServer(async (req, res) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') return void res.writeHead(404).end();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    await serve().connect(transport);
    await transport.handleRequest(req, res);
  }).listen(Number(port), host, () => console.error(`Where My Hug At? at http://${host}:${port}/mcp`));
} else if (command) {
  console.error([
    'Usage: where-my-hug                          serve the MCP tools on stdio',
    '       where-my-hug --http [[host:]port]     serve them over HTTP at /mcp (default 127.0.0.1:8000)',
    '       where-my-hug rubric < details.json',
    '       where-my-hug search < parts.json',
    '       where-my-hug verify < slate.json',
  ].join('\n'));
  process.exit(2);
} else await serve().connect(new StdioServerTransport());
