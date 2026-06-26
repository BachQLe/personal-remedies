App-wide bottom navigation. Active state: forest-700 color + underline pip.

```jsx
const tabs = [
  {key:'home', label:'Home', icon:'home'},
  {key:'search', label:'Search', icon:'search'},
  {key:'foods', label:'My Foods', icon:'grid'},
  {key:'insights', label:'Insights', icon:'insights'},
  {key:'profile', label:'Profile', icon:'profile'},
];
<BottomTabBar tabs={tabs} activeKey={currentTab} onChange={setCurrentTab}/>
```
