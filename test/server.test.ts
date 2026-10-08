import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('serves both tools over stdio, as Claude Code starts it', async () => {
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/server.ts', import.meta.url))] }));
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['wheres_my_hug', 'wheres_my_hug_verify']);

    const text = (result: Awaited<ReturnType<typeof client.callTool>>) => (result.content as { text: string }[])[0].text;
    // Details that change the answer come first: only the missing ones are asked, and no method until they're in.
    const asked = text(await client.callTool({ name: 'wheres_my_hug', arguments: { need: 'sort socks by color', stack: 'Python' } }));
    assert.match(asked, /Need: sort socks by color/);
    assert.deepEqual([...asked.matchAll(/^- (\w+):/gm)].map((match) => match[1]), ['compute', 'license', 'data']);
    assert.doesNotMatch(asked, /Split the need/);
    const method = text(await client.callTool({
      name: 'wheres_my_hug', arguments: { need: 'sort socks by color', compute: 'unknown', license: 'personal', stack: 'Python', data: 'none' },
    }));
    assert.match(method, /Compute: unknown\n/);
    assert.match(method, /Split the need/);

    // A slate with nothing to look up never reaches the network.
    const verified = text(await client.callTool({
      name: 'wheres_my_hug_verify',
      arguments: { need: 'sort socks', components: [{ id: 'sort', name: 'Sort', role: 'socks -> piles', verdict: 'WRITE', rationale: 'a hue threshold', candidates: [] }] },
    }));
    assert.match(verified, /^# Where's my hug at\?/);
    assert.match(verified, /"nextAction":"DONE"/);

    const refused = await client.callTool({ name: 'wheres_my_hug_verify', arguments: { need: 'x', components: [] } });
    assert.equal(refused.isError, true);
  } finally {
    await client.close();
  }
});

test('runs the same two steps from a shell, for an agent without MCP', () => {
  const run = (command: string, input: object) =>
    execFileSync(process.execPath, [fileURLToPath(new URL('../src/server.ts', import.meta.url)), command], { input: JSON.stringify(input), encoding: 'utf8', stdio: 'pipe' });
  assert.match(run('rubric', { need: 'sort socks by color', stack: 'Python' }), /^- compute:/m);
  const report = run('verify', { need: 'sort socks', components: [{ id: 'sort', name: 'Sort', role: 'socks -> piles', verdict: 'WRITE', rationale: 'a hue threshold', candidates: [] }] });
  assert.match(report, /^# Where's my hug at\?/);
  assert.match(report, /"nextAction":"DONE"/);
  assert.throws(() => run('verify', { need: 'x', components: [] })); // the same checks as the tool
});
