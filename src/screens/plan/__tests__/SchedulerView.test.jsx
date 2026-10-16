// @vitest-environment jsdom
/**
 * SchedulerView.test.jsx - the reusable list view: day rows come from a prop,
 * its calorie figure is the SAME call the plan's day view makes (fixes the
 * list-vs-day mismatch), and it shows no nutrition facts / macros / "estimated".
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children }) => <div>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import SchedulerView from '../SchedulerView.jsx';
import { estimatePlanDayCalories, formatCalories } from '../../../api/calorieNeeds.js';

const slots = {
  breakfast: [{ id: 1, name: 'Oatmeal bowl', kind: 'recipe', numericId: 2, image: 'a.jpg' }],
  dinner: [{ id: 2, name: 'Salmon roast', kind: 'recipe', numericId: 2, image: 'b.jpg' }],
};
const expectedCal = `${formatCalories(estimatePlanDayCalories(slots).total)} cal`;

let container;
let root;
const mount = (props) => act(async () => {
  root.render(<SchedulerView onSelectItem={vi.fn()} {...props} />);
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('SchedulerView', () => {
  it('starts a lone day expanded and shows the same calorie figure as the day view', async () => {
    await mount({ days: [{ key: 'd', label: 'Meals', slots }] });
    expect(container.textContent).toContain('Oatmeal bowl');
    expect(container.textContent).toContain(expectedCal);
    expect(expectedCal).toMatch(/^[\d,]+ cal$/);
  });

  it('has no Nutrition Facts button, macros, tilde or "Estimated" badge', async () => {
    await mount({ days: [{ key: 'd', label: 'Meals', slots }] });
    expect(container.textContent).not.toMatch(/nutrition facts|estimated|protein|carbs|fat|~|kcal/i);
  });

  it('keeps a multi-day week collapsed until a day is tapped, labelled by the prop', async () => {
    await mount({ days: [{ key: 'a', label: 'Day 1', slots }, { key: 'b', label: 'Day 2', slots: {} }] });
    expect(container.textContent).toContain('Day 1');
    expect(container.textContent).toContain('Day 2');
    expect(container.textContent).not.toContain('Oatmeal bowl');
    await act(async () => { container.querySelector('button[aria-expanded]').click(); });
    expect(container.textContent).toContain('Oatmeal bowl');
  });

  it('renders the eaten check only when asked', async () => {
    const days = [{ key: 'd', label: 'Meals', slots }];
    await mount({ days });
    expect(container.querySelector('[aria-label="Mark as eaten"]')).toBeNull();
    await mount({ days, showEaten: true });
    expect(container.querySelector('[aria-label="Mark as eaten"]')).toBeTruthy();
  });

  it('hides the calorie line when nothing is countable', async () => {
    await mount({ days: [{ key: 'd', label: 'Meals', slots: { dinner: [{ id: 3, name: 'Mystery', kind: 'food' }] } }] });
    expect(container.textContent).not.toMatch(/\bcal\b/);
  });
});
