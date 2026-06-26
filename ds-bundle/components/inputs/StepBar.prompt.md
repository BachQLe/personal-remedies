Onboarding step progress indicator. Segments fill from left as steps complete.

```jsx
<StepBar current={1} total={3} />            // Step 1 of 3
<StepBar current={3} total={3} />            // Complete ✓
<StepBar current={2} total={6} label={false} /> // no label
```
