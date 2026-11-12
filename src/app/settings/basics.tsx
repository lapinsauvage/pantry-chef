import { useHeaderHeight } from 'expo-router/react-navigation';
import { Suspense } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';

import { BasicsEditor } from '@/components/kitchen';
import { PreparingRecipes } from '@/components/states';
import { AppText } from '@/components/ui';
import { useI18n } from '@/i18n';
import { space } from '@/theme';

export default function BasicsScreen() {
  const { t } = useI18n();
  return (
    // Android is edge-to-edge: the window doesn't resize for the keyboard, so pad for it.
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={useHeaderHeight()} style={styles.flex}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <AppText variant="body" muted>
          {t.settings.basicsHint}
        </AppText>
        <Suspense fallback={<PreparingRecipes inline />}>
          <BasicsEditor />
        </Suspense>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
