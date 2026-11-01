import { useState } from 'react';
import { RECOMMENDATIONS_PAGE_SIZE } from '../../api/config.js';
import SecondaryButton from './SecondaryButton.jsx';

/**
 * Renders a long list a page at a time, so nothing is cut off silently: "Show
 * more" reveals the next page. Key it on whatever selects the list when that
 * can change in place, so the count resets.
 *
 * @param {Object} props
 * @param {Array} props.items
 * @param {(item: any) => import('react').ReactNode} props.renderItem
 */
export default function ShowMoreList({ items, renderItem }) {
  const [count, setCount] = useState(RECOMMENDATIONS_PAGE_SIZE);
  const remaining = items.length - count;
  return (
    <>
      {items.slice(0, count).map(renderItem)}
      {remaining > 0 && (
        <SecondaryButton onClick={() => setCount((n) => n + RECOMMENDATIONS_PAGE_SIZE)}>
          Show more ({remaining})
        </SecondaryButton>
      )}
    </>
  );
}
