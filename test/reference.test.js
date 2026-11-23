// Accuracy on the full reference photos. These photos are NOT committed (ref-images/ is gitignored),
// so this test is skipped unless they exist locally.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const have = fs.existsSync(new URL('../ref-images/raw/floor-a.jpg', import.meta.url));

test('reader accuracy on reference photos (local only)', { skip: !have && 'ref-images/ not present' }, async () => {
  const { evaluate } = await import('../tools/eval.mjs');
  const { tally } = evaluate();
  const total = tally.right + tally.wrong + tally.unsure + tally.none;
  // Baseline 2026-11-23: 82 right, 1 wrong, 12 unsure of 95 (guide jittered by up to ±5%).
  assert.ok(tally.right / total >= 0.82, `right ${tally.right}/${total}`);
  assert.ok(tally.wrong <= 2, `confident wrong reads: ${tally.wrong}`);
});
