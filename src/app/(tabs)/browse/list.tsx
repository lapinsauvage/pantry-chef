/** Recipes of one collection, course or cuisine (pushed from the Browse tab). */
import { Stack, useLocalSearchParams } from 'expo-router';
import { Suspense, useMemo } from 'react';

import { RecipeResults } from '@/components/recipe-results';
import { Message, PreparingRecipes } from '@/components/states';
import { useI18n } from '@/i18n';
import { COLLECTIONS, presetFor } from '@/lib/browse';
import { COURSES, CUISINES } from '@/lib/constants';

export default function BrowseList() {
  const { kind, key } = useLocalSearchParams<{ kind: string; key: string }>();
  const { t, lang } = useI18n();
  const preset = useMemo(() => presetFor(kind, key), [kind, key]);

  const collection = kind === 'collection' ? COLLECTIONS.find((c) => c.key === key) : undefined;
  const title = collection
    ? t.browse.collection[collection.key]
    : ((kind === 'course' ? COURSES : CUISINES).find((c) => c.key === key)?.label[lang] ?? t.browse.title);

  return (
    <>
      <Stack.Screen options={{ title }} />
      {preset ? (
        <Suspense fallback={<PreparingRecipes />}>
          <RecipeResults text="" preset={preset} />
        </Suspense>
      ) : (
        <Message icon="info" body={t.browse.noResultsTitle} />
      )}
    </>
  );
}
