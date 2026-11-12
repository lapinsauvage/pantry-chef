import { Stack } from 'expo-router';
import { deleteDatabaseAsync, SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { RECIPE_DB_NAME } from '@/db/data-version';
import { getSetting, setSetting, SETTINGS } from '@/db/user';

/** Remove the previous recipe database copy after an app update shipped a new one. */
async function cleanupOldRecipeDb() {
  const previous = getSetting(SETTINGS.recipeDbName);
  if (previous && previous !== RECIPE_DB_NAME) {
    await deleteDatabaseAsync(previous).catch(() => {});
  }
  setSetting(SETTINGS.recipeDbName, RECIPE_DB_NAME);
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider
        databaseName={RECIPE_DB_NAME}
        assetSource={{ assetId: require('../../assets/db/recipes.db') }}
        onInit={cleanupOldRecipeDb}
        useSuspense>
        <Stack />
      </SQLiteProvider>
    </Suspense>
  );
}
