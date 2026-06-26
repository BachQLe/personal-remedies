Search/filter input. Used on condition selection and food browser screens.

```jsx
const [q, setQ] = useState('');
<SearchInput value={q} onChange={setQ} onClear={() => setQ('')} />
```

Focus state: forest-600 border + lime focus ring. Clear button appears when value is non-empty.
