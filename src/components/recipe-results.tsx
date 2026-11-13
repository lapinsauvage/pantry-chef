/**
 * Browse results: search text and/or a preset (collection, course, cuisine) combined with the
 * Browse filter sheet and Settings, sorted, 40 per page with infinite scroll.
 */
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { useRecipeDb } from '@/db/recipe-db';
import { browse, search, type SortOrder } from '@/db/recipes';
import { usePagedQuery } from '@/hooks/use-paged-query';
import { useI18n } from '@/i18n';
import { activeFilterCount, browseFilters, effectiveSort, type Preset, sortChoices } from '@/lib/browse';
import { clearBrowseFilters, updateBrowseOptions, useBrowseOptions } from '@/state/browse';
import { useSettings } from '@/state/settings';
import { space, useColors } from '@/theme';

import { RecipeRow } from './recipe-card';
import { AppText, Button, Chip } from './ui';

const PAGE = 40;

export function RecipeResults({ text, preset }: { text: string; preset: Preset | null }) {
  const db = useRecipeDb();
  const settings = useSettings();
  const opts = useBrowseOptions();
  const filters = useMemo(() => browseFilters(preset, opts, settings), [preset, opts, settings]);
  const sort = effectiveSort(opts.sort, !!text);
  const key = JSON.stringify([text, sort, filters]);
  const fetchPage = useCallback(
    (offset: number) =>
      text ? search(db, text, filters, sort, PAGE, offset) : browse(db, filters, sort as SortOrder, PAGE, offset),
    [db, text, filters, sort],
  );
  // Typing is debounced; tapping a sort or opening a category loads right away.
  const list = usePagedQuery(key, fetchPage, { pageSize: PAGE, debounceMs: text ? 250 : 0 });

  return (
    <FlatList
      data={list.rows}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <RecipeRow recipe={item} />}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={<ResultsHeader hasText={!!text} loading={list.loading} />}
      ListEmptyComponent={list.error ? <LoadError /> : list.empty ? <NoResults /> : undefined}
      ListFooterComponent={list.loadingMore ? <ActivityIndicator style={styles.footer} /> : undefined}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.6}
      initialNumToRender={8}
      windowSize={9}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.list}
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function ResultsHeader({ hasText, loading }: { hasText: boolean; loading: boolean }) {
  const { t } = useI18n();
  const colors = useColors();
  const opts = useBrowseOptions();
  const settings = useSettings();
  const count = activeFilterCount(opts, settings);
  const sort = effectiveSort(opts.sort, hasText);
  return (
    <View style={styles.header}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hscroll}
        accessibilityLabel={t.browse.sortBy}>
        <Chip
          label={t.browse.filters(count)}
          icon="filter"
          selected={count > 0}
          onPress={() => router.push({ pathname: '/filters', params: { scope: 'browse' } })}
        />
        {sortChoices(hasText).map((s) => (
          <Chip key={s} label={t.browse.sort[s]} selected={sort === s} onPress={() => updateBrowseOptions({ sort: s })} />
        ))}
      </ScrollView>
      {loading ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" muted>
            {t.browse.searching}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function NoResults() {
  const { t } = useI18n();
  const opts = useBrowseOptions();
  const settings = useSettings();
  return (
    <View style={styles.empty}>
      <AppText variant="heading" style={styles.center}>
        {t.browse.noResultsTitle}
      </AppText>
      <AppText variant="body" muted style={styles.center}>
        {t.browse.noResultsBody}
      </AppText>
      {activeFilterCount(opts, settings) > 0 ? (
        <Button variant="secondary" title={t.browse.clearFilters} onPress={clearBrowseFilters} />
      ) : null}
    </View>
  );
}

function LoadError() {
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <AppText variant="body" muted style={styles.center}>
        {t.browse.loadError}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { gap: space.sm, marginBottom: space.md },
  hscroll: { gap: space.sm, paddingRight: space.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gap: { height: space.sm },
  footer: { marginVertical: space.lg },
  empty: { gap: space.md, paddingVertical: space.xl },
  center: { textAlign: 'center' },
});
