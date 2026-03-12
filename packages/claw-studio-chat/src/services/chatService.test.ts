import assert from 'node:assert/strict';
import { buildContextualMessage, buildSystemInstruction } from './chatService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const skill = {
  id: 'skill-1',
  name: 'Code Review',
  description: 'Reviews code changes for regressions.',
  readme: '',
  author: 'OpenClaw',
  version: '1.0.0',
  icon: 'CR',
  category: 'Engineering',
  downloads: 10,
  rating: 5,
  size: '1 MB',
};

const agent = {
  id: 'agent-1',
  name: 'Code Master',
  description: 'Writes and reviews code.',
  avatar: 'CM',
  systemPrompt: 'You are a senior software engineer.',
  creator: 'OpenClaw',
};

await runTest('buildSystemInstruction falls back to the default assistant prompt', () => {
  const instruction = buildSystemInstruction();

  assert.match(instruction, /Claw Studio AI assistant/);
});

await runTest('buildSystemInstruction merges agent and skill context for v3 chat behavior', () => {
  const instruction = buildSystemInstruction(skill, agent);

  assert.match(instruction, /senior software engineer/i);
  assert.match(instruction, /Code Review/);
  assert.match(instruction, /Engineering/);
});

await runTest('buildContextualMessage keeps generic chat unchanged and prefixes context when needed', () => {
  assert.equal(buildContextualMessage('hello there'), 'hello there');

  const contextualMessage = buildContextualMessage('hello there', skill, agent);

  assert.match(contextualMessage, /^\[Role:/);
  assert.match(contextualMessage, /Code Review/);
  assert.match(contextualMessage, /User: hello there/);
});
