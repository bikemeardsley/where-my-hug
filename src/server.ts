#!/usr/bin/env node
// Where's My Hug? as an MCP server on stdio. Two tools, called in order: the rubric the agent follows to propose
// models and datasets, then the check against the live Hub that writes the report the user sees.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { rubric } from './rubric.ts';
import { verify } from './verify.ts';

const server = new McpServer({ name: 'wheres-my-hug', version: '0.1.0' });
const need = z.string().min(1).describe('The ML need in plain words: what goes in, what should come out, and what it is for');
const compute = z.string().optional().describe('The hardware it has to run or train on, such as "one 24 GB GPU" or "CPU only"');

server.registerTool('wheres_my_hug', {
  title: "Where's my hug at?",
  description: 'Step 1 of 2, before recommending any Hugging Face model or dataset: returns the method for splitting an ML need into parts and deciding which parts the Hub covers (use a model as is, fine-tune one, train one) and which are plain code. Follow it, then call wheres_my_hug_verify.',
  inputSchema: {
    need,
    stack: z.string().optional().describe('Where it will run: language, runtime, framework'),
    license: z.string().optional().describe('What the result may be used for, such as "commercial, closed source" or "research only"'),
    compute,
  },
}, async (args) => ({ content: [{ type: 'text', text: rubric(args) }] }));

server.registerTool('wheres_my_hug_verify', {
  title: "Where's my hug at? (checked on the Hub)",
  description: 'Step 2 of 2: checks every model and dataset id against the live Hugging Face Hub, drops the ones that are not there, flags licenses, gating, size, staleness and low use, and returns the report to show the user. If nextAction is RECALL_REPLACEMENTS, propose new ids for the parts it names and call again.',
  inputSchema: {
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
  },
}, async (args) => {
  const { markdown, result } = await verify(args);
  return { content: [{ type: 'text', text: `${markdown}\n\n<wheres_my_hug_json>\n${JSON.stringify(result)}\n</wheres_my_hug_json>` }] };
});

await server.connect(new StdioServerTransport());
