// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ShowMoreList from '../ShowMoreList.jsx';

let container;
let root;
const items = (n) => Array.from({ length: n }, (_, i) => i);
const renderItem = (i) => <p key={i}>row</p>;
const rows = () => container.querySelectorAll('p').length;
const button = () => container.querySelector('button');

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

describe('ShowMoreList', () => {
  it('shows 20 rows and says how many more there are', () => {
    act(() => root.render(<ShowMoreList items={items(86)} renderItem={renderItem} />));
    expect(rows()).toBe(20);
    expect(button().textContent).toBe('Show more (66)');
  });

  it('reveals every row eventually, then hides the button', () => {
    act(() => root.render(<ShowMoreList items={items(30)} renderItem={renderItem} />));
    act(() => button().click());
    expect(rows()).toBe(30);
    expect(button()).toBeNull();
  });

  it('has no button when everything already fits', () => {
    act(() => root.render(<ShowMoreList items={items(20)} renderItem={renderItem} />));
    expect(rows()).toBe(20);
    expect(button()).toBeNull();
  });
});
