import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { useImportProgress } from '@/db/recipe-db';
import { useI18n } from '@/i18n';
import { radius, space, useColors } from '@/theme';

import { Icon, type IconName } from './icon';
import { AppText, Button } from './ui';

/** Suspense fallback while the recipe database is imported (first launch only). */
export function PreparingRecipes({ inline }: { inline?: boolean }) {
  const { t } = useI18n();
  const colors = useColors();
  const progress = useImportProgress();
  const percent = progress != null ? Math.round(progress * 100) : null;
  if (inline) {
    return (
      <View style={styles.inline} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primary} />
        <AppText variant="body" muted style={styles.flex}>
          {percent != null ? `${t.common.preparingTitle} ${t.common.percent(percent)}` : t.common.preparingTitle}
        </AppText>
      </View>
    );
  }
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText variant="heading" style={styles.text}>
        {t.common.preparingTitle}
      </AppText>
      {percent != null ? (
        <View
          style={[styles.bar, { backgroundColor: colors.border }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: percent }}>
          <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${percent}%` }]} />
        </View>
      ) : null}
      <AppText variant="body" muted style={styles.text}>
        {t.common.preparingBody}
      </AppText>
    </View>
  );
}

/** Icon + message, for empty states and screens arriving in a later milestone. */
export function Message({ icon, title, body }: { icon: IconName; title?: string; body: string }) {
  const colors = useColors();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.message}>
      <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={32} color={colors.onPrimarySoft} />
      </View>
      {title ? (
        <AppText variant="heading" style={styles.text}>
          {title}
        </AppText>
      ) : null}
      <AppText variant="body" muted style={styles.text}>
        {body}
      </AppText>
    </ScrollView>
  );
}

export function ErrorMessage({ onRetry, body }: { onRetry: () => void; body?: string }) {
  const { t } = useI18n();
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <AppText variant="heading" style={styles.text} accessibilityRole="header">
        {t.common.errorTitle}
      </AppText>
      <AppText variant="body" muted style={styles.text}>
        {body ?? t.common.errorBody}
      </AppText>
      <Button title={t.common.retry} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  flex: { flex: 1 },
  text: { textAlign: 'center', maxWidth: 480 },
  message: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  bar: { width: '70%', maxWidth: 320, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: 6 },
});

/** Route-level error screen (export as `ErrorBoundary` from a route file). */
export function ScreenError({ retry }: { retry: () => void }) {
  const { t } = useI18n();
  return <ErrorMessage onRetry={retry} body={t.common.errorScreen} />;
}
