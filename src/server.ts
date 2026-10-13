#!/usr/bin/env node
// Where's My Hug? as an MCP server on stdio. Two tools, called in order: the rubric the agent follows to propose
// models and datasets, then the live check on Hugging Face that writes the report the user sees. For an agent
// without MCP, the same two run from a shell: `wheres-my-hug rubric` and `wheres-my-hug verify`, JSON on stdin.
// For a client that speaks MCP over HTTP only, `wheres-my-hug --http` serves them at /mcp.
import { createServer } from 'node:http';
import { text } from 'node:stream/consumers';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { rubric } from './rubric.ts';
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
const slate = {
  need,
  compute,
  components: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string(),
    verdict: z.enum(['USE', 'TUNE', 'TRAIN', 'WRITE']),
    rationale: z.string(),
    candidates: z.array(z.object({ id: z.string().min(1), kind: z.enum(['model', 'dataset']).optional() })).max(6),
  })).min(1).max(8), // at most 48 lookups a call
};
const verified = async (args: z.infer<z.ZodObject<typeof slate>>) => {
  const { markdown, result } = await verify(args);
  return `${markdown}\n\n<wheres_my_hug_json>\n${JSON.stringify(result)}\n</wheres_my_hug_json>`;
};

function serve() {
  const server = new McpServer({ name: 'wheres-my-hug', version: '0.1.0' });
  server.registerTool('wheres_my_hug', {
    title: "Where's my hug at?",
    description: 'Step 1 of 2, before recommending any Hugging Face model or dataset. If compute, license, stack or data is missing, returns the questions to ask the user first: call again with the answers ("unknown" is fine). Then returns the method for splitting an ML need into parts and deciding which parts Hugging Face covers (use a model as is, fine-tune one, train one) and which are plain code. Follow it, then call wheres_my_hug_verify.',
    inputSchema: details,
  }, async (args) => ({ content: [{ type: 'text', text: rubric(args) }] }));
  server.registerTool('wheres_my_hug_verify', {
    title: "Where's my hug at? (checked on Hugging Face)",
    description: 'Step 2 of 2: checks every model and dataset id live on Hugging Face, drops the ones that are not there, flags licenses, gating, staleness and low use, sizes each model against the compute (fits, a stretch that fits only quantized, or cloud, with who hosts it), and returns the report to show the user. If nextAction is RECALL_REPLACEMENTS, propose new ids for the parts it names and call again.',
    inputSchema: slate,
  }, async (args) => ({ content: [{ type: 'text', text: await verified(args) }] }));
  return server;
}

const [command, address = '8000'] = process.argv.slice(2);
const [, host = '127.0.0.1', port] = /^(?:(.+):)?(\d+)$/.exec(address) ?? [];
if (command === 'rubric') console.log(rubric(z.object(details).parse(JSON.parse(await text(process.stdin)))));
else if (command === 'verify') console.log(await verified(z.object(slate).parse(JSON.parse(await text(process.stdin)))));
else if (command === '--http' && port) {
  // For clients that speak MCP over HTTP only, such as Open WebUI. Stateless: a fresh server for each request.
  createServer(async (req, res) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') return void res.writeHead(404).end();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    await serve().connect(transport);
    await transport.handleRequest(req, res);
  }).listen(Number(port), host, () => console.error(`Where's My Hug? at http://${host}:${port}/mcp`));
} else if (command) {
  console.error([
    'Usage: wheres-my-hug                          serve the MCP tools on stdio',
    '       wheres-my-hug --http [[host:]port]     serve them over HTTP at /mcp (default 127.0.0.1:8000)',
    '       wheres-my-hug rubric < details.json',
    '       wheres-my-hug verify < slate.json',
  ].join('\n'));
  process.exit(2);
} else await serve().connect(new StdioServerTransport());
