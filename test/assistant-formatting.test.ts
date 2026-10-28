import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantMessage } from '../packages/ui/src/components/AssistantMessage';

test('assistant renders ordered steps, bullets, paragraphs and safe links', () => {
  const html = renderToStaticMarkup(createElement(AssistantMessage, {
    text: '## Join a class\n\n1. Open **Classes**.\n2. Select Join.\n\nNotes:\n- Use your invited account.\n- Check https://example.com/help\n\n<script>alert(1)</script>',
  }));
  assert.match(html, /<ol[^>]*start="1"/);
  assert.match(html, /<ul/);
  assert.match(html, /<strong>Classes<\/strong>/);
  assert.match(html, /href="https:\/\/example.com\/help"/);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('assistant keeps code literal and rejects unsafe Markdown targets', () => {
  const html = renderToStaticMarkup(createElement(AssistantMessage, {
    text: '```js\n- literal\nitems[1]\n```\n\n[bad](javascript:alert)\n[credentials](https://user:password@example.com)',
  }));
  assert.match(html, /<pre/);
  assert.ok(html.includes('items[1]'));
  assert.ok(!html.includes('<ul'));
  assert.ok(!html.includes('href='));
});
