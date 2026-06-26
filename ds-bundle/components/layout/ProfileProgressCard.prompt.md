Shows user how far along they are in the onboarding flow.

```jsx
<ProfileProgressCard
  steps={['Conditions selected','Dietary preferences','Allergies noted','Meal schedule','Goal setting']}
  currentStep={3} totalSteps={5} onContinue={goNext}
/>
```
