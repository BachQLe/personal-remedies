Scrollable filter tabs — used to filter food lists by signal or category.

```jsx
const tabs = [
  { key:'all', label:'All foods' },
  { key:'beneficial', label:'✓ Beneficial', color:'var(--benefit-600)' },
  { key:'limit', label:'! Limit', color:'var(--caution-600)' },
  { key:'avoid', label:'✗ Avoid', color:'var(--avoid-600)' },
];
<FilterTabs tabs={tabs} value={active} onChange={setActive} />
```
