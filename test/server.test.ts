import assert from 'node:assert/strict';
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
    assert.match(text(await client.callTool({ name: 'wheres_my_hug', arguments: { need: 'sort socks by color' } })), /Need: sort socks by color/);

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
