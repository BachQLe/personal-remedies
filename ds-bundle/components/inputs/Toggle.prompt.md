Binary toggle for filters and settings.

```jsx
const [on, setOn] = useState(true);
<Toggle checked={on} onChange={setOn} label="Show only beneficial" description="Filter to recommended foods" />
```
