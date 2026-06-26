/**
 * @startingPoint section="Navigation" subtitle="5-tab mobile nav bar with active indicator" viewport="430x72"
 * Mobile bottom navigation. Active tab: forest-700 icon + label + underline pip.
 */
export interface BottomTab { key: string; label: string; icon: 'home'|'search'|'grid'|'insights'|'profile'; }
export interface BottomTabBarProps {
  tabs: BottomTab[];
  activeKey?: string;
  onChange?: (key: string) => void;
}
export declare function BottomTabBar(props: BottomTabBarProps): JSX.Element;
