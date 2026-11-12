import Constants from 'expo-constants';
import { Suspense, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { KitchenSection, LanguagePicker, UnitsPicker } from '@/components/kitchen';
import { PreparingRecipes } from '@/components/states';
import { AppText, Button, InfoRow, Section } from '@/components/ui';
import { RECIPE_DB_VERSION } from '@/db/data-version';
import { useRecipeDb } from '@/db/recipe-db';
import { dataInfo } from '@/db/recipes';
import { useI18n } from '@/i18n';
import { formatDate, formatNumber } from '@/lib/format';
import { resetAppData } from '@/state/reset';
import { space } from '@/theme';

export default function SettingsScreen() {
  const { t } = useI18n();
  const [resetting, setResetting] = useState(false);

  const confirmReset = () =>
    Alert.alert(t.settings.resetTitle, t.settings.resetBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.resetConfirm,
        style: 'destructive',
        onPress: () => {
          setResetting(true);
          resetAppData().finally(() => setResetting(false));
        },
      },
    ]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <LanguagePicker />
      <UnitsPicker />
      <KitchenSection title={t.settings.kitchen} />
      <Suspense
        fallback={
          <Section title={t.settings.data}>
            <View style={styles.padded}>
              <PreparingRecipes inline />
            </View>
          </Section>
        }>
        <DataSection />
      </Suspense>
      <Section title={t.settings.about}>
        <InfoRow label={t.settings.appVersion} value={Constants.expoConfig?.version ?? '—'} />
        <View style={styles.padded}>
          <AppText variant="body" muted>
            {t.settings.attribution}
          </AppText>
        </View>
      </Section>
      <Button variant="danger" title={t.settings.reset} onPress={confirmReset} busy={resetting} />
    </ScrollView>
  );
}

function DataSection() {
  const db = useRecipeDb();
  const { t, lang } = useI18n();
  const [info, setInfo] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    dataInfo(db).then(setInfo);
  }, [db]);
  const count = (key: string) => (info?.[key] ? formatNumber(Number(info[key]), lang) : '—');
  return (
    <Section title={t.settings.data}>
      <InfoRow label={t.settings.dataRecipes} value={count('recipes')} />
      <InfoRow label={t.settings.dataIngredients} value={count('ingredients')} />
      <InfoRow label={t.settings.dataVersion} value={`${RECIPE_DB_VERSION} · v${info?.schema_version ?? '—'}`} />
      <InfoRow label={t.settings.dataBuilt} value={formatDate(info?.built_at)} />
    </Section>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  padded: { paddingHorizontal: space.lg, paddingVertical: space.md },
});
