Portion counter for logging food servings.

```jsx
const [qty, setQty] = useState(1);
<ServingSizeStepper name="Blueberries" calories={128} value={qty} unit="cup"
  onIncrement={() => setQty(q => q + 1)} onDecrement={() => setQty(q => Math.max(0,q-1))} />
```
