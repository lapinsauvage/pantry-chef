/**
 * First-run setup: language → appliances → basics → diet/avoid. Every choice is saved as it
 * is made, so "Skip" simply keeps the defaults. Meanwhile the recipe database is imported in
 * the background (the basics step shows "Preparing recipes…" until it is ready).
 * Finishing sets `onboarded`; the root layout's guard then shows the tabs.
 */
import { type ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApplianceList, BasicsEditor, DietAvoidEditor, LanguagePicker } from '@/components/kitchen';
import { PreparingRecipes } from '@/components/states';
import { AppText, Button } from '@/components/ui';
import { type Translations, useI18n } from '@/i18n';
import { settingsStore, updateSettings } from '@/state/settings';
import { radius, space, useColors } from '@/theme';

const STEPS: { title: (t: Translations) => string; hint: (t: Translations) => string; body: () => ReactNode }[] = [
  { title: (t) => t.onboarding.languageTitle, hint: (t) => t.onboarding.languageHint, body: () => <LanguagePicker /> },
  { title: (t) => t.onboarding.appliancesTitle, hint: (t) => t.onboarding.appliancesHint, body: () => <ApplianceList /> },
  {
    title: (t) => t.onboarding.basicsTitle,
    hint: (t) => t.onboarding.basicsHint,
    body: () => (
      <Suspense fallback={<PreparingRecipes inline />}>
        <BasicsEditor />
      </Suspense>
    ),
  },
  { title: (t) => t.onboarding.dietTitle, hint: (t) => t.onboarding.dietHint, body: () => <DietAvoidEditor /> },
];

/** Save the current values (defaults included) and leave onboarding. */
function finish() {
  updateSettings({ ...settingsStore.get(), onboarded: true });
}

export default function Onboarding() {
  const { t } = useI18n();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const last = step === STEPS.length - 1;

  const go = (next: number) => {
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  // Android back button goes to the previous step instead of leaving the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setStep(step - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const current = STEPS[step];
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <AppText variant="caption" muted>
          {t.onboarding.stepOf(step + 1, STEPS.length)}
        </AppText>
        {!last ? <Button variant="plain" title={t.common.skip} onPress={finish} /> : <View style={styles.skipSpacer} />}
      </View>
      <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.progressStep, { backgroundColor: i <= step ? colors.primary : colors.border }]}
          />
        ))}
      </View>

      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        style={styles.flex}>
        <AppText variant="title" accessibilityRole="header">
          {current.title(t)}
        </AppText>
        <AppText variant="body" muted>
          {current.hint(t)}
        </AppText>
        <View style={styles.body}>{current.body()}</View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + space.md, borderTopColor: colors.border, backgroundColor: colors.background },
        ]}>
        {step > 0 ? (
          <Button variant="secondary" title={t.common.back} onPress={() => go(step - 1)} style={styles.flex} />
        ) : null}
        <Button
          title={last ? t.onboarding.finish : t.common.next}
          onPress={last ? finish : () => go(step + 1)}
          style={styles.grow}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flex: 2 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.lg,
    paddingRight: space.sm,
    minHeight: 48,
  },
  skipSpacer: { height: 48 },
  progress: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.lg, paddingBottom: space.sm },
  progressStep: { flex: 1, height: 4, borderRadius: radius.pill },
  content: {
    padding: space.lg,
    gap: space.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  body: { marginTop: space.md },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
