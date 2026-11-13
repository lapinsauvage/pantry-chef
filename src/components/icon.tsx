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
  heart: { ios: 'heart', android: 'favorite' },
  heartFill: { ios: 'heart.fill', android: 'favorite' },
  clock: { ios: 'clock', android: 'schedule' },
  star: { ios: 'star.fill', android: 'star' },
  filter: { ios: 'line.3.horizontal.decrease.circle', android: 'tune' },
  minus: { ios: 'minus', android: 'remove' },
  circle: { ios: 'circle', android: 'radio_button_unchecked' },
  checkCircle: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  external: { ios: 'safari', android: 'open_in_new' },
  cartAdd: { ios: 'cart.badge.plus', android: 'add_shopping_cart' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  translate: { ios: 'character.bubble', android: 'translate' },
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
