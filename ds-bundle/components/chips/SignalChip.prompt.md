The most important chip in the system — communicates food safety at a glance.

```jsx
<SignalChip signal="beneficial" />          // full: "✓ Beneficial"
<SignalChip signal="avoid" compact />       // icon only: "✗"
<SignalChip signal="limit" size="sm" />
```

Always use the semantic signal prop — never hardcode colors. Compact mode for space-constrained card headers.
