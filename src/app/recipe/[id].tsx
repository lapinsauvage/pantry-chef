/**
 * Recipe screen: photo, rating, times, appliances/diet, servings scaling, ingredients in the
 * chosen units (✓ = you have it, tap to tick off), what's missing → shopping list, steps with
 * °C/cm, nutrition estimate, favourite, and the Food.com attribution link (always shown).
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { RecipePhoto } from '@/components/recipe-card';
import { Message, PreparingRecipes } from '@/components/states';
import { AppText, Button, ChipGroup, Stepper, Tag } from '@/components/ui';
import { useRecipeDb } from '@/db/recipe-db';
import { getRecipe, type RecipeDetail, stapleIds } from '@/db/recipes';
import { addShoppingItems, recordView } from '@/db/user';
import { ingredientName, useI18n } from '@/i18n';
import { CHIPS, DIETS, DIFFICULTY, EQUIPMENT, sourceUrl } from '@/lib/constants';
import { clampServings, lineStatus, missingIds } from '@/lib/cook';
import { formatMinutes, formatNumber } from '@/lib/format';
import { hasBit } from '@/lib/settings';
import { formatIngredient, metricizeText, scaleFactor } from '@/lib/units';
import { useBasics } from '@/state/basics';
import { toggleFavorite, useIsFavorite } from '@/state/favorites';
import { usePantry } from '@/state/pantry';
import { useSettings } from '@/state/settings';
import { radius, space, typography, useColors } from '@/theme';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = Number(id);
  return (
    <>
      <Stack.Screen options={{ headerRight: () => <FavoriteButton id={recipeId} /> }} />
      <Suspense fallback={<PreparingRecipes />}>
        <RecipeLoader id={recipeId} />
      </Suspense>
    </>
  );
}

function FavoriteButton({ id }: { id: number }) {
  const { t } = useI18n();
  const colors = useColors();
  const favorite = useIsFavorite(id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={favorite ? t.recipe.unfavorite : t.recipe.favorite}
      accessibilityState={{ selected: favorite }}
      onPress={() => toggleFavorite(id)}
      hitSlop={10}
      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}>
      <Icon name={favorite ? 'heartFill' : 'heart'} size={24} color={favorite ? colors.primary : colors.textMuted} />
    </Pressable>
  );
}

function RecipeLoader({ id }: { id: number }) {
  const db = useRecipeDb();
  const { t } = useI18n();
  const [state, setState] = useState<{ id: number; recipe: RecipeDetail | null; staples: ReadonlySet<number> } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([getRecipe(db, id), stapleIds(db)]).then(([recipe, staples]) => {
      if (!live) return;
      setState({ id, recipe, staples });
      if (recipe) recordView(id);
    });
    return () => {
      live = false;
    };
  }, [db, id]);
  if (!state || state.id !== id) return <ActivityIndicator style={styles.loading} />;
  if (!state.recipe) return <Message icon="info" body={t.recipe.notFound} />;
  return <RecipeBody key={id} recipe={state.recipe} staples={state.staples} />;
}

function RecipeBody({ recipe, staples }: { recipe: RecipeDetail; staples: ReadonlySet<number> }) {
  const { t, lang } = useI18n();
  const colors = useColors();
  const { units } = useSettings();
  const pantry = usePantry();
  const basics = useBasics();
  const [servings, setServings] = useState(recipe.servings ?? 1);
  const [ticked, setTicked] = useState<ReadonlySet<number>>(new Set());
  const [added, setAdded] = useState<number | null>(null);

  const owned = new Set([...pantry.map((p) => p.id), ...basics.map((b) => b.id)]);
  const factor = recipe.servings ? scaleFactor(recipe.servings, servings) : servings;
  const missing = missingIds(
    recipe.ingredients.map((l) => l.ingredientId),
    owned,
    staples,
  ).map((id) => {
    const line = recipe.ingredients.find((l) => l.ingredientId === id)!;
    return { id, name: line.canonical ?? line.text, name_fr: line.canonical_fr };
  });
  const missingNames = missing.map((m) => ingredientName(m, lang));

  const toggleTick = (i: number) =>
    setTicked((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const addMissing = () =>
    setAdded(addShoppingItems(missing.map((m, i) => ({ text: missingNames[i], ingredientId: m.id, recipeId: recipe.id }))));

  const rating =
    recipe.rating != null
      ? {
          stars: formatNumber(recipe.rating, lang, 1),
          reviews: formatNumber(recipe.reviews ?? 0, lang),
        }
      : null;
  const appliances = EQUIPMENT.filter((e) => hasBit(recipe.equipment, e.bit));
  const diets = DIETS.filter((d) => hasBit(recipe.diet, d.bit));
  const chips = recipe.chips.filter((c) => CHIPS[c]);
  const nutrition = [
    { label: t.recipe.kcal, value: recipe.kcal, unit: '' },
    { label: t.recipe.protein, value: recipe.protein, unit: ' g' },
    { label: t.recipe.carbs, value: recipe.carbs, unit: ' g' },
    { label: t.recipe.fat, value: recipe.fat, unit: ' g' },
  ].filter((n) => n.value != null);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
      <View style={[styles.hero, { backgroundColor: colors.surfaceAlt }]}>
        <RecipePhoto image={recipe.image} course={recipe.course} emojiSize={72} />
      </View>

      <View style={styles.content}>
        <View style={styles.block}>
          <AppText variant="title" accessibilityRole="header">
            {recipe.name}
          </AppText>
          <View style={styles.inline} accessible accessibilityLabel={rating ? t.recipe.rating(rating.stars, rating.reviews) : undefined}>
            {rating ? (
              <>
                <Icon name="star" size={16} color={colors.primary} />
                <AppText variant="body">{rating.stars}</AppText>
                <AppText variant="body" muted>
                  {`· ${t.recipe.reviews(rating.reviews)}`}
                </AppText>
              </>
            ) : null}
            {DIFFICULTY[recipe.difficulty] ? (
              <AppText variant="body" muted>
                {`${rating ? '· ' : ''}${DIFFICULTY[recipe.difficulty][lang]}`}
              </AppText>
            ) : null}
          </View>
          {recipe.description ? (
            <AppText variant="body" muted>
              {recipe.description}
            </AppText>
          ) : null}
        </View>

        <View style={styles.tiles}>
          {[
            { label: t.recipe.total, min: recipe.total_min },
            { label: t.recipe.prep, min: recipe.prep_min },
            { label: t.recipe.cook, min: recipe.cook_min },
          ].map((x) => (
            <View
              key={x.label}
              style={[styles.tile, { backgroundColor: colors.surface }]}
              accessible
              accessibilityLabel={`${x.label}: ${formatMinutes(x.min, lang)}`}>
              <AppText variant="caption" muted>
                {x.label}
              </AppText>
              <AppText variant="label">{formatMinutes(x.min, lang)}</AppText>
            </View>
          ))}
        </View>

        {appliances.length || diets.length || chips.length ? (
          <View style={styles.block}>
            {appliances.length ? (
              <View style={styles.tagRow}>
                <AppText variant="caption" muted>
                  {t.recipe.needs}
                </AppText>
                <ChipGroup>
                  {appliances.map((a) => (
                    <Tag key={a.key} label={a.label[lang]} />
                  ))}
                </ChipGroup>
              </View>
            ) : null}
            {diets.length || chips.length ? (
              <ChipGroup>
                {diets.map((d) => (
                  <Tag key={d.key} label={d.label[lang]} />
                ))}
                {chips.map((c) => (
                  <Tag key={c} label={CHIPS[c][lang]} />
                ))}
              </ChipGroup>
            ) : null}
            {diets.length ? (
              <AppText variant="caption" muted>
                {t.recipe.dietEstimated}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <View style={styles.block}>
          <AppText variant="heading" accessibilityRole="header">
            {t.recipe.ingredients}
          </AppText>
          <View style={styles.servings}>
            <Stepper
              label={recipe.servings ? t.recipe.servings(servings) : t.recipe.batch(servings)}
              onDecrement={() => setServings((s) => clampServings(s - 1))}
              onIncrement={() => setServings((s) => clampServings(s + 1))}
              canDecrement={servings > 1}
              decrementLabel={t.recipe.fewer}
              incrementLabel={t.recipe.more}
            />
            {recipe.yield ? (
              <AppText variant="caption" muted>
                {recipe.yield}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" muted>
            {t.recipe.tapToCheck}
          </AppText>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {recipe.ingredients.map((line, i) => {
              const f = formatIngredient(line, { factor, system: units, lang, ingredient: line.canonical });
              const status = lineStatus(line.ingredientId, owned, staples);
              const done = ticked.has(i);
              const statusLabel = status === 'owned' ? t.recipe.have : status === 'missing' ? t.recipe.missingItem : '';
              const textStyle = [typography.body, { color: colors.text }, done && styles.done];
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={[f.quantity, f.text, f.note, statusLabel].filter(Boolean).join(', ')}
                  onPress={() => toggleTick(i)}
                  android_ripple={{ color: colors.border }}
                  style={[styles.line, i > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={styles.lineIcon}>
                    {status === 'owned' ? (
                      <Icon name="checkCircle" size={20} color={colors.success} />
                    ) : status === 'missing' ? (
                      <Icon name="circle" size={20} color={colors.textMuted} />
                    ) : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={textStyle}>
                      {f.quantity ? <Text style={styles.bold}>{`${f.quantity} `}</Text> : null}
                      {f.text}
                      {f.note ? <Text style={{ color: colors.textMuted }}>{`, ${f.note}`}</Text> : null}
                    </Text>
                    {lang === 'fr' && line.canonical_fr ? (
                      <AppText variant="caption" muted>
                        {line.canonical_fr}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          {missing.length ? (
            <View style={styles.block}>
              <AppText variant="body">{t.cook.missing(missing.length, missingNames.join(', '))}</AppText>
              <Button variant="secondary" title={t.recipe.addMissing} onPress={addMissing} />
              {added != null ? (
                <AppText variant="caption" muted accessibilityLiveRegion="polite">
                  {t.recipe.added(added)}
                </AppText>
              ) : null}
            </View>
          ) : (
            <View style={styles.inline}>
              <Icon name="checkCircle" size={18} color={colors.success} />
              <AppText variant="body">{t.recipe.haveEverything}</AppText>
            </View>
          )}
        </View>

        <View style={styles.block}>
          <AppText variant="heading" accessibilityRole="header">
            {t.recipe.steps}
          </AppText>
          {recipe.steps.map((step, i) => (
            <View key={i} style={styles.step} accessible accessibilityLabel={`${t.recipe.step(i + 1)}. ${metricizeText(step, units, lang)}`}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primarySoft }]}>
                <AppText variant="label" color={colors.onPrimarySoft}>
                  {String(i + 1)}
                </AppText>
              </View>
              <AppText variant="body" style={styles.flex}>
                {metricizeText(step, units, lang)}
              </AppText>
            </View>
          ))}
        </View>

        {nutrition.length ? (
          <View style={styles.block}>
            <View style={styles.inline}>
              <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
                {t.recipe.nutrition}
              </AppText>
              <AppText variant="caption" muted>
                {t.recipe.estimate}
              </AppText>
            </View>
            <View style={styles.tiles}>
              {nutrition.map((n) => (
                <View key={n.label} style={[styles.tile, { backgroundColor: colors.surface }]}>
                  <AppText variant="label">{`${formatNumber(n.value!, lang)}${n.unit}`}</AppText>
                  <AppText variant="caption" muted>
                    {n.label}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.source, { borderTopColor: colors.border }]}>
          <AppText variant="caption" muted>
            {t.recipe.source}
          </AppText>
          <Pressable
            accessibilityRole="link"
            onPress={() => WebBrowser.openBrowserAsync(sourceUrl(recipe.slug, recipe.id))}
            hitSlop={8}
            style={({ pressed }) => [styles.inline, styles.link, pressed && { opacity: 0.6 }]}>
            <AppText variant="label" color={colors.primary}>
              {t.recipe.openSource}
            </AppText>
            <Icon name="external" size={16} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: space.xxl },
  scroll: { paddingBottom: space.xxl },
  hero: { width: '100%', maxWidth: 720, alignSelf: 'center', aspectRatio: 4 / 3, overflow: 'hidden' },
  content: { padding: space.lg, gap: space.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  block: { gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexWrap: 'wrap' },
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  tile: { flexGrow: 1, flexBasis: 90, padding: space.md, borderRadius: radius.md, gap: 2 },
  tagRow: { gap: space.xs },
  servings: { gap: space.xs, alignItems: 'flex-start' },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  line: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.md, minHeight: 48 },
  lineIcon: { width: 20, paddingTop: 1 },
  done: { textDecorationLine: 'line-through', opacity: 0.5 },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  source: { gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.lg },
  link: { minHeight: 44 },
});
