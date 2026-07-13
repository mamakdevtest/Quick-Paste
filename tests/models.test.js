import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, normalizeSnippet, normalizeSnippets, validateSnippet } from '../src/app/models.js';
import { applyTransform, fuzzyFilter, processConditionalTemplates, resolveLinkedSnippets } from '../src/features.js';

test('normalizeSnippet preserves legacy data and creates a stable id', () => {
  const input = { title: ' Test ', content: 'value', tags: ['a', 'a', ' '], created_at: 12 };
  const first = normalizeSnippet(input, 0);
  const second = normalizeSnippet(input, 0);
  assert.equal(first.id, second.id);
  assert.equal(first.title, 'Test');
  assert.deepEqual(first.tags, ['a']);
});

test('normalizeSnippets resolves duplicate ids', () => {
  const items = normalizeSnippets([
    { id: 'same', title: 'A', content: '1' },
    { id: 'same', title: 'B', content: '2' },
  ]);
  assert.equal(new Set(items.map((item) => item.id)).size, 2);
});

test('snippet validation rejects missing and oversized values', () => {
  assert.deepEqual(validateSnippet(normalizeSnippet({})).slice(0, 2), ['Title is required.', 'Content is required.']);
  assert.ok(validateSnippet(normalizeSnippet({ title: 'x', content: 'a'.repeat(1_000_001) })).includes('Content is too large.'));
});

test('settings normalization clamps invalid values', () => {
  const settings = normalizeSettings({ opacity: 10, hotkey: '' });
  assert.equal(settings.opacity, 1);
  assert.equal(settings.hotkey, 'Alt+Q');
});

test('pure feature helpers keep expected behavior', () => {
  assert.equal(applyTransform('uppercase', 'hello'), 'HELLO');
  assert.equal(resolveLinkedSnippets('[[Greeting]]', [{ title: 'Greeting', content: 'Hello' }]), 'Hello');
  assert.equal(processConditionalTemplates('{{if lang=tr}}Evet{{else}}No{{/if}}', { lang: 'tr' }), 'Evet');
  const result = fuzzyFilter([{ s: { title: 'Clipboard', content: '', tags: [] }, i: 0 }], 'clip');
  assert.equal(result.length, 1);
});
