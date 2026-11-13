/** Favourites tab: saved recipes (♥) and the last 50 viewed. */
import { Suspense, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { RecipeRow } from '@/components/recipe-card';
import { PreparingRecipes } from '@/components/states';
import { AppText, Button, Chip } from '@/components/ui';
import { useRecipeDb } from '@/db/recipe-db';
import { recipeCardsByIds } from '@/db/recipes';
import { usePagedQuery } from '@/hooks/use-paged-query';
import { useI18n } from '@/i18n';
import { clearRecipeHistory, useFavoriteIds, useHistoryIds } from '@/state/favorites';
import { space } from '@/theme';

const PAGE = 40;

export default function FavoritesScreen() {
  return (
    <Suspense fallback={<PreparingRecipes />}>
      <Favorites />
    </Suspense>
  );
}

function Favorites() {
  const db = useRecipeDb();
  const { t } = useI18n();
  const [view, setView] = useState<'saved' | 'recent'>('saved');
  const favorites = useFavoriteIds();
  const history = useHistoryIds();
  const ids = view === 'saved' ? favorites : history;
  const fetchPage = useCallback((offset: number) => recipeCardsByIds(db, ids.slice(offset, offset + PAGE)), [db, ids]);
  const list = usePagedQuery(`${view}:${ids.join(',')}`, fetchPage, { pageSize: PAGE, debounceMs: 0 });

  return (
    <FlatList
      data={ids.length ? list.rows : []}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <RecipeRow recipe={item} />}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.tabs}>
            <Chip label={t.favorites.saved} selected={view === 'saved'} onPress={() => setView('saved')} />
            <Chip label={t.favorites.recent} selected={view === 'recent'} onPress={() => setView('recent')} />
          </View>
          {view === 'recent' && history.length ? (
            <Button variant="plain" title={t.favorites.clearHistory} onPress={clearRecipeHistory} style={styles.clear} />
          ) : null}
        </View>
      }
      ListEmptyComponent={
        ids.length ? (
          <ActivityIndicator style={styles.empty} />
        ) : (
          <AppText variant="body" muted style={styles.empty}>
            {view === 'saved' ? t.favorites.emptySaved : t.favorites.emptyRecent}
          </AppText>
        )
      }
      ListFooterComponent={list.loadingMore ? <ActivityIndicator style={styles.footer} /> : undefined}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.6}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.list}
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { gap: space.sm, marginBottom: space.md },
  tabs: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  clear: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  gap: { height: space.sm },
  footer: { marginVertical: space.lg },
  empty: { marginTop: space.xl, textAlign: 'center' },
});
