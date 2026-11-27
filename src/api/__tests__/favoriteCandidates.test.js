import { describe, it, expect } from 'vitest';
import { selectCandidates, SLOT_RULES, mpIds, mpRecipe } from '../favoriteCandidates.js';

const row = (id, numericId) => ({ id, numericId });

describe('selectCandidates', () => {
  it('drops negative and unrated, keeps neutral where allowed, sorts best first', async () => {
    const read = async () => [row(1, 4), row(2, 6), row(3, 1), row(4, null), row(5, 3)];
    const out = await selectCandidates([{ from: 'mp', ok: SLOT_RULES.breakfast[0].ok }], read, 10);
    expect(out.map((r) => r.id)).toEqual([3, 5, 1]);
  });

  it('snack rule is helpful-only', async () => {
    const snack = SLOT_RULES.snacks.find((r) => r.from === 'more');
    const out = await selectCandidates([snack], async () => [row(1, 4), row(2, 2)], 10);
    expect(out.map((r) => r.id)).toEqual([2]);
  });

  it('does not read later sources once the limit is reached', async () => {
    const reads = [];
    const rules = [{ from: 'suggest', ok: () => true }, { from: 'mp', meal: 'ld', ok: () => true }];
    await selectCandidates(rules, async (r) => (reads.push(r.from), [row(1, 1), row(2, 2)]), 2);
    expect(reads).toEqual(['suggest']);
  });

  it('dedupes by id and by recipe URL (frozen-fruit smoothie is 5023/5028/5030)', async () => {
    const ok = () => true;
    const out = await selectCandidates([{ from: 'mp', ok }], async () => [row(5028, 2), row(5030, 2), row(5023, 2), row(5028, 2)], 10);
    expect(out.map((r) => r.id)).toEqual([5028]);
  });
});

describe('MP-DB', () => {
  it('matches the workbook totals and keeps deletion candidates out', () => {
    expect(mpIds('recipes', 'ld')).toHaveLength(99);
    expect(mpIds('recipes', 'b')).toHaveLength(20);
    expect(mpRecipe(5011)).toBeUndefined();
    expect(mpRecipe(754)).toMatchObject({ url: null, kcal: 214 });
  });
});
