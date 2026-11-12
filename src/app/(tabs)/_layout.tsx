import { NativeTabs } from 'expo-router/native-tabs';

import { useI18n } from '@/i18n';
import { useColors } from '@/theme';

/** Bottom tabs (platform-native). Each tab holds its own stack with a header (see TabStack). */
export default function TabsLayout() {
  const { t } = useI18n();
  const colors = useColors();
  return (
    <NativeTabs
      tintColor={colors.primary}
      backgroundColor={colors.surface}
      indicatorColor={colors.primarySoft}
      rippleColor={colors.primarySoft}>
      <NativeTabs.Trigger name="(cook)">
        <NativeTabs.Trigger.Icon sf={{ default: 'frying.pan', selected: 'frying.pan.fill' }} md="skillet" />
        <NativeTabs.Trigger.Label>{t.tabs.cook}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="browse">
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
        <NativeTabs.Trigger.Label>{t.tabs.browse}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="favorites">
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="favorite" />
        <NativeTabs.Trigger.Label>{t.tabs.favorites}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="shopping">
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} md="shopping_cart" />
        <NativeTabs.Trigger.Label>{t.tabs.shopping}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
