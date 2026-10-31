import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonc } from '../src/jsonc.mjs';
test('JSONC preserves URL, comment-like strings, escapes and comma-like strings', () => {
  const value={url:'https://example.com/a//b',note:'/* no comment */ , } , ]',quote:'"\\"'};
  assert.deepEqual(parseJsonc(JSON.stringify(value)),value);
});
test('JSONC reads formatted Wrangler files with comments and trailing commas', () => {
  assert.deepEqual(parseJsonc('{// intro\n"assets": {"run_worker_first":["/api/*",], /* note */},\n"vars":{"DEMO_MODE":"false",},}'),{assets:{run_worker_first:['/api/*']},vars:{DEMO_MODE:'false'}});
});
test('JSONC rejects malformed input instead of executing configuration', () => {
  for(const value of ['{unquoted:1}','{"x":true,,}','/* missing end','{"x":undefined}','(()=>({}))()'])assert.throws(()=>parseJsonc(value),SyntaxError);
});
