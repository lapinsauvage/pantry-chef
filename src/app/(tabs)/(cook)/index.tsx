/**
 * Cook tab. M1: shows that the recipe library is ready and the user's kitchen setup.
 * M2 replaces the placeholder text with the ingredient picker and ranked results.
 */
import { Suspense, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { KitchenSection } from '@/components/kitchen';
import { PreparingRecipes } from '@/components/states';
import { AppText } from '@/components/ui';
import { useRecipeDb } from '@/db/recipe-db';
import { dataInfo } from '@/db/recipes';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { space } from '@/theme';

export default function CookScreen() {
  const { t } = useI18n();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Suspense fallback={<PreparingRecipes inline />}>
        <RecipeCount />
      </Suspense>
      <AppText variant="body" muted>
        {t.cook.comingSoon}
      </AppText>
      <KitchenSection title={t.cook.kitchenTitle} />
    </ScrollView>
  );
}

function RecipeCount() {
  const db = useRecipeDb();
  const { t, lang } = useI18n();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    dataInfo(db).then((info) => setCount(Number(info.recipes) || 0));
  }, [db]);
  if (count == null) return null;
  return <AppText variant="heading">{t.cook.recipesReady(formatNumber(count, lang))}</AppText>;
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
