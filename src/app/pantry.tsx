/**
 * Ingredient picker (modal from the Cook tab): type-ahead search in English or French
 * (accent-insensitive), and popular ingredients grouped by aisle. Picks are saved to the
 * pantry immediately.
 */
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Suspense, useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PreparingRecipes } from '@/components/states';
import { AppText, Chip, ChipGroup, ChoiceRow, Section } from '@/components/ui';
import { useRecipeDb } from '@/db/recipe-db';
import { type Ingredient, popularIngredients, searchIngredients } from '@/db/recipes';
import { ingredientName, useI18n } from '@/i18n';
import { INGREDIENT_CATEGORIES } from '@/lib/constants';
import { useBasics } from '@/state/basics';
import { togglePantryIngredient, usePantry } from '@/state/pantry';
import { radius, space, TOUCH, typography, useColors } from '@/theme';

export default function PantryPicker() {
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={useHeaderHeight()} style={styles.flex}>
      <Suspense fallback={<PreparingRecipes />}>
        <Picker />
      </Suspense>
    </KeyboardAvoidingView>
  );
}

function Picker() {
  const db = useRecipeDb();
  const { t, lang } = useI18n();
  const colors = useColors();
  const pantry = usePantry();
  const basics = useBasics();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ query: string; rows: Ingredient[] } | null>(null);
  const [popular, setPopular] = useState<{ key: string; rows: Ingredient[] }[]>([]);

  useEffect(() => {
    let live = true;
    Promise.all(
      INGREDIENT_CATEGORIES.map((c) => popularIngredients(db, c.key, 16).then((rows) => ({ key: c.key, rows }))),
    ).then((groups) => live && setPopular(groups.filter((g) => g.rows.length)));
    return () => {
      live = false;
    };
  }, [db]);

  const text = query.trim();
  useEffect(() => {
    if (!text) return;
    let live = true;
    const timer = setTimeout(() => {
      searchIngredients(db, text, 30).then((rows) => live && setResults({ query: text, rows }));
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [db, text]);

  const picked = new Set(pantry.map((p) => p.id));
  const basicIds = new Set(basics.map((b) => b.id));
  const toggle = (i: Ingredient) => togglePantryIngredient({ id: i.id, name: i.name });
  const searchRows = text && results?.query === text ? results.rows : null;

  return (
    <View style={styles.flex}>
      <View style={styles.top}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.picker.search}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t.picker.search}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[styles.input, { color: colors.text }]}
          />
        </View>
        <AppText variant="caption" muted accessibilityLiveRegion="polite">
          {t.picker.selectedCount(pantry.length)}
        </AppText>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
        {searchRows ? (
          searchRows.length ? (
            <Section>
              {searchRows.map((r) => {
                const name = ingredientName(r, lang);
                const description = basicIds.has(r.id) ? t.picker.basicNote : name !== r.name ? r.name : undefined;
                return (
                  <ChoiceRow
                    key={r.id}
                    kind="checkbox"
                    label={name}
                    description={description}
                    selected={picked.has(r.id)}
                    onPress={() => toggle(r)}
                  />
                );
              })}
            </Section>
          ) : (
            <AppText variant="body" muted>
              {t.settings.noMatch}
            </AppText>
          )
        ) : (
          popular.map((g) => {
            const category = INGREDIENT_CATEGORIES.find((c) => c.key === g.key);
            return (
              <View key={g.key} style={styles.group}>
                <AppText variant="overline" muted accessibilityRole="header">
                  {category?.label[lang] ?? g.key}
                </AppText>
                <ChipGroup>
                  {g.rows.map((r) => (
                    <Chip key={r.id} label={ingredientName(r, lang)} selected={picked.has(r.id)} onPress={() => toggle(r)} />
                  ))}
                </ChipGroup>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: { flex: 1, ...typography.body, paddingVertical: space.sm },
  content: { padding: space.lg, paddingTop: space.sm, gap: space.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  group: { gap: space.sm },
});
