/**
 * Cross-platform icons: SF Symbols on iOS, Material Symbols on Android/web (expo-symbols).
 * Add new icons to ICONS so both platforms always have a glyph.
 */
import { type AndroidSymbol, type SFSymbol, SymbolView } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

const ICONS = {
  settings: { ios: 'gearshape', android: 'settings' },
  check: { ios: 'checkmark', android: 'check' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  close: { ios: 'xmark', android: 'close' },
  add: { ios: 'plus', android: 'add' },
  search: { ios: 'magnifyingglass', android: 'search' },
  cook: { ios: 'frying.pan', android: 'skillet' },
  browse: { ios: 'book', android: 'menu_book' },
  favorite: { ios: 'heart', android: 'favorite' },
  cart: { ios: 'cart', android: 'shopping_cart' },
  info: { ios: 'info.circle', android: 'info' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  const { ios, android } = ICONS[name];
  return <SymbolView name={{ ios, android, web: android }} size={size} tintColor={color} style={style} />;
}
