/**
 * Cook tab — "What can I cook?": the ingredients you picked (persisted pantry), time,
 * missing allowed, course and filter overrides → findByPantry, ranked by fewest missing,
 * then most of your ingredients used, then popularity. Queries are debounced (300 ms) and
 * paged (40 per page, infinite scroll); stale responses are dropped by query key.
 */
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { type RecipeResult, RecipeRow } from '@/components/recipe-card';
import { PreparingRecipes } from '@/components/states';
import { AppText, Button, Chip, ChipGroup } from '@/components/ui';
import { useRecipeDb } from '@/db/recipe-db';
import { findByPantry, ingredientsByIds, recipeIngredientIds, type RecipeCard, stapleIds } from '@/db/recipes';
import { useIngredientNames } from '@/hooks/use-ingredient-names';
import { ingredientName, useI18n } from '@/i18n';
import { type Lang, TIME_PRESETS } from '@/lib/constants';
import { COURSE_GROUPS, cookFilters, hasOverrides, MISSING_CHOICES, missingIds, queryKey } from '@/lib/cook';
import { formatMinutes } from '@/lib/format';
import { useBasics } from '@/state/basics';
import { clearCookOverrides, updateCookOptions, useCookOptions } from '@/state/cook';
import { clearPantryIngredients, removePantryIngredient, usePantry } from '@/state/pantry';
import { useSettings } from '@/state/settings';
import { space, useColors } from '@/theme';

const PAGE = 40;

/** Attach the names of each result's missing ingredients ("Missing 1: soy sauce"). */
async function withMissingNames(
  db: SQLiteDatabase,
  rows: RecipeCard[],
  owned: ReadonlySet<number>,
  lang: Lang,
): Promise<RecipeResult[]> {
  const needs = rows.filter((r) => (r.missing ?? 0) > 0);
  if (!needs.length) return rows;
  const [staples, lineIds] = await Promise.all([stapleIds(db), recipeIngredientIds(db, needs.map((r) => r.id))]);
  const missing = new Map(needs.map((r) => [r.id, missingIds(lineIds.get(r.id) ?? [], owned, staples)]));
  const ids = [...new Set([...missing.values()].flat())];
  const names = new Map((await ingredientsByIds(db, ids)).map((i) => [i.id, ingredientName(i, lang)]));
  return rows.map((r) => {
    const m = missing.get(r.id);
    return m ? { ...r, missingNames: m.map((id) => names.get(id)).filter((n): n is string => !!n) } : r;
  });
}

interface Results {
  key: string;
  rows: RecipeResult[];
  done: boolean;
  error: boolean;
  loadingMore: boolean;
}

export default function CookScreen() {
  return (
    <Suspense fallback={<PreparingRecipes />}>
      <CookContent />
    </Suspense>
  );
}

function CookContent() {
  const db = useRecipeDb();
  const { lang } = useI18n();
  const settings = useSettings();
  const opts = useCookOptions();
  const pantry = usePantry();
  const basics = useBasics();

  const selected = useMemo(() => pantry.map((p) => p.id), [pantry]);
  const basicIds = useMemo(() => basics.map((b) => b.id), [basics]);
  const filters = useMemo(() => cookFilters(opts, settings), [opts, settings]);
  const key = queryKey(selected, basicIds, opts, filters);
  const [results, setResults] = useState<Results | null>(null);

  const fetchPage = useCallback(
    async (offset: number) => {
      const rows = await findByPantry(db, {
        selected,
        basics: basicIds,
        maxMissing: opts.maxMissing,
        filters,
        limit: PAGE,
        offset,
      });
      return withMissingNames(db, rows, new Set([...selected, ...basicIds]), lang);
    },
    [db, selected, basicIds, opts.maxMissing, filters, lang],
  );

  // Debounced first page whenever the query changes.
  useEffect(() => {
    if (!selected.length) return;
    let live = true;
    const timer = setTimeout(() => {
      fetchPage(0).then(
        (rows) => live && setResults({ key, rows, done: rows.length < PAGE, error: false, loadingMore: false }),
        () => live && setResults({ key, rows: [], done: true, error: true, loadingMore: false }),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [fetchPage, key, selected.length]);

  const current = results?.key === key ? results : null;
  const loadMore = () => {
    if (!current || current.done || current.loadingMore || current.error) return;
    setResults({ ...current, loadingMore: true });
    const update = (patch: (r: Results) => Results) => setResults((r) => (r && r.key === key ? patch(r) : r));
    fetchPage(current.rows.length).then(
      (rows) =>
        update((r) => {
          const seen = new Set(r.rows.map((x) => x.id));
          return { ...r, rows: [...r.rows, ...rows.filter((x) => !seen.has(x.id))], done: rows.length < PAGE, loadingMore: false };
        }),
      () => update((r) => ({ ...r, done: true, loadingMore: false })),
    );
  };

  const hasPantry = selected.length > 0;
  const loading = hasPantry && !current;
  return (
    <FlatList
      data={hasPantry ? (results?.rows ?? []) : []}
      keyExtractor={(r) => String(r.id)}
      renderItem={({ item }) => <RecipeRow recipe={item} />}
      ItemSeparatorComponent={Gap}
      ListHeaderComponent={<CookControls loading={loading} />}
      ListEmptyComponent={
        !hasPantry ? <EmptyPantry /> : loading ? undefined : current?.error ? <LoadError /> : <NoResults />
      }
      ListFooterComponent={current?.loadingMore ? <ActivityIndicator style={styles.footer} /> : undefined}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      initialNumToRender={8}
      windowSize={9}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
    />
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function CookControls({ loading }: { loading: boolean }) {
  const { t, lang } = useI18n();
  const colors = useColors();
  const pantry = usePantry();
  const opts = useCookOptions();
  const settings = useSettings();
  const changed = hasOverrides(opts, settings);
  const nameOf = useIngredientNames(pantry);
  return (
    <View style={styles.controls}>
      <View style={styles.group}>
        <View style={styles.titleRow}>
          <AppText variant="overline" muted accessibilityRole="header" style={styles.flex}>
            {t.cook.yourIngredients}
          </AppText>
          {pantry.length ? <Button variant="plain" title={t.cook.clear} onPress={clearPantryIngredients} /> : null}
        </View>
        <ChipGroup>
          {pantry.map((p) => (
            <Chip
              key={p.id}
              label={nameOf(p)}
              icon="close"
              accessibilityLabel={t.settings.removeIngredient(nameOf(p))}
              onPress={() => removePantryIngredient(p.id)}
            />
          ))}
          <Chip label={t.cook.addIngredients} icon="add" selected onPress={() => router.push('/pantry')} />
        </ChipGroup>
      </View>

      <ControlRow label={t.cook.time}>
        {TIME_PRESETS.map((m) => (
          <Chip
            key={m ?? 'any'}
            label={m == null ? t.cook.anyTime : formatMinutes(m, lang)}
            selected={opts.maxMinutes === m}
            onPress={() => updateCookOptions({ maxMinutes: m })}
          />
        ))}
      </ControlRow>

      <ControlRow label={t.cook.missingAllowed} hint={t.cook.missingChoice(opts.maxMissing)}>
        {MISSING_CHOICES.map((n) => (
          <Chip
            key={n}
            label={String(n)}
            accessibilityLabel={t.cook.missingChoice(n)}
            selected={opts.maxMissing === n}
            onPress={() => updateCookOptions({ maxMissing: n })}
          />
        ))}
      </ControlRow>

      <ControlRow>
        {COURSE_GROUPS.map((g) => (
          <Chip
            key={g.key}
            label={t.cook.courses[g.key]}
            selected={opts.courseGroup === g.key}
            onPress={() => updateCookOptions({ courseGroup: g.key })}
          />
        ))}
        <Chip
          label={t.cook.filters}
          icon="filter"
          selected={changed}
          accessibilityLabel={changed ? t.cook.filtersChanged : t.cook.filters}
          onPress={() => router.push('/filters')}
        />
      </ControlRow>

      {loading ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" muted>
            {t.cook.searching}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function ControlRow({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      {label ? (
        <AppText variant="overline" muted accessibilityRole="header">
          {label}
        </AppText>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hscroll}>
        {children}
      </ScrollView>
      {hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

function EmptyPantry() {
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <AppText variant="heading" style={styles.center}>
        {t.cook.emptyTitle}
      </AppText>
      <AppText variant="body" muted style={styles.center}>
        {t.cook.emptyBody}
      </AppText>
      <Button title={t.cook.addIngredients} onPress={() => router.push('/pantry')} />
    </View>
  );
}

function NoResults() {
  const { t } = useI18n();
  const opts = useCookOptions();
  const settings = useSettings();
  const timeIndex = TIME_PRESETS.indexOf(opts.maxMinutes as (typeof TIME_PRESETS)[number]);
  return (
    <View style={styles.empty}>
      <AppText variant="heading" style={styles.center}>
        {t.cook.noResultsTitle}
      </AppText>
      <AppText variant="body" muted style={styles.center}>
        {t.cook.noResultsBody}
      </AppText>
      {opts.maxMissing < 3 ? (
        <Button
          variant="secondary"
          title={t.cook.allowMoreMissing}
          onPress={() => updateCookOptions({ maxMissing: opts.maxMissing + 1 })}
        />
      ) : null}
      {opts.maxMinutes != null ? (
        <Button
          variant="secondary"
          title={t.cook.allowMoreTime}
          onPress={() => updateCookOptions({ maxMinutes: TIME_PRESETS[timeIndex + 1] ?? null })}
        />
      ) : null}
      <Button variant="secondary" title={t.cook.addBasics} onPress={() => router.push('/settings/basics')} />
      {hasOverrides(opts, settings) ? <Button variant="secondary" title={t.cook.useMySettings} onPress={clearCookOverrides} /> : null}
    </View>
  );
}

function LoadError() {
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <AppText variant="body" muted style={styles.center}>
        {t.cook.loadError}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  controls: { gap: space.lg, marginBottom: space.lg },
  group: { gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  flex: { flex: 1 },
  hscroll: { gap: space.sm, paddingRight: space.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gap: { height: space.sm },
  footer: { marginVertical: space.lg },
  empty: { alignItems: 'stretch', gap: space.md, paddingVertical: space.xl },
  center: { textAlign: 'center' },
});
