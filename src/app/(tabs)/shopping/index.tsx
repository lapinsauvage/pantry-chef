/**
 * Shopping list: items from "add missing" (linked to their recipe) and typed items, grouped by
 * aisle, tick off, clear ticked, share as plain text.
 */
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Suspense, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, SectionList, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PreparingRecipes } from '@/components/states';
import { AppText, Button } from '@/components/ui';
import { useRecipeDb } from '@/db/recipe-db';
import { ingredientsByIds, matchIngredient, recipeCardsByIds } from '@/db/recipes';
import { useI18n } from '@/i18n';
import { INGREDIENT_CATEGORIES } from '@/lib/constants';
import { recipeTitle } from '@/lib/recipe-text';
import { groupShopping, type ShoppingItem, shoppingText } from '@/lib/shopping';
import {
  addToShoppingList,
  clearCheckedItems,
  deleteShoppingItem,
  toggleShoppingItem,
  useShoppingItems,
} from '@/state/shopping';
import { useSettings } from '@/state/settings';
import { radius, space, TOUCH, typography, useColors } from '@/theme';

export default function ShoppingScreen() {
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={useHeaderHeight()} style={styles.flex}>
      <Suspense fallback={<PreparingRecipes />}>
        <Shopping />
      </Suspense>
    </KeyboardAvoidingView>
  );
}

/** Aisle of each linked ingredient and name of each linked recipe (looked up in recipes.db). */
function useItemDetails(items: readonly ShoppingItem[]) {
  const db = useRecipeDb();
  const { lang } = useI18n();
  const { units } = useSettings();
  const [details, setDetails] = useState<{ categories: Map<number, string>; recipes: Map<number, string> }>({
    categories: new Map(),
    recipes: new Map(),
  });
  useEffect(() => {
    let live = true;
    const ingredientIds = [...new Set(items.map((i) => i.ingredient_id).filter((x): x is number => x != null))];
    const recipeIds = [...new Set(items.map((i) => i.recipe_id).filter((x): x is number => x != null))];
    Promise.all([ingredientsByIds(db, ingredientIds), recipeCardsByIds(db, recipeIds)]).then(([ings, recipes]) => {
      if (live) {
        setDetails({
          categories: new Map(ings.map((i) => [i.id, i.category])),
          recipes: new Map(recipes.map((r) => [r.id, recipeTitle(r, lang, units)])),
        });
      }
    });
    return () => {
      live = false;
    };
  }, [db, items, lang, units]);
  return details;
}

function Shopping() {
  const db = useRecipeDb();
  const { t, lang } = useI18n();
  const colors = useColors();
  const items = useShoppingItems();
  const details = useItemDetails(items);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const groups = groupShopping(items, (i) => (i.ingredient_id != null ? details.categories.get(i.ingredient_id) : undefined));
  const label = (category: string) => INGREDIENT_CATEGORIES.find((c) => c.key === category)?.label[lang] ?? category;
  const toBuy = items.filter((i) => !i.checked).length;
  const anyChecked = items.some((i) => i.checked);

  const add = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    const match = await matchIngredient(db, value);
    const added = addToShoppingList([{ text: value, ingredientId: match?.id ?? null }]);
    setNote(added ? null : t.shopping.alreadyListed(value));
  };

  const share = () =>
    Share.share({ title: t.shopping.shareTitle, message: shoppingText(groups, t.shopping.shareTitle, label) }).catch(() => {});

  return (
    <SectionList
      sections={groups.map((g) => ({ key: g.category, title: label(g.category), data: g.items }))}
      keyExtractor={(i) => String(i.id)}
      renderSectionHeader={({ section }) => (
        <AppText variant="overline" muted accessibilityRole="header" style={[styles.sectionTitle, { backgroundColor: colors.background }]}>
          {section.title}
        </AppText>
      )}
      renderItem={({ item, index, section }) => (
        <ShoppingRow
          item={item}
          recipe={item.recipe_id != null ? details.recipes.get(item.recipe_id) : undefined}
          first={index === 0}
          last={index === section.data.length - 1}
        />
      )}
      stickySectionHeadersEnabled={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.addRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={add}
              placeholder={t.shopping.addPlaceholder}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t.shopping.addPlaceholder}
              returnKeyType="done"
              submitBehavior="submit"
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            <Button title={t.shopping.add} onPress={add} disabled={!text.trim()} />
          </View>
          {note ? (
            <AppText variant="caption" muted accessibilityLiveRegion="polite">
              {note}
            </AppText>
          ) : null}
          {items.length ? (
            <View style={styles.toolbar}>
              <AppText variant="body" muted style={styles.flex}>
                {t.shopping.toBuy(toBuy)}
              </AppText>
              {anyChecked ? <Button variant="plain" title={t.shopping.clearChecked} onPress={clearCheckedItems} /> : null}
              {toBuy ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.shopping.share}
                  onPress={share}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                  <Icon name="share" size={22} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <AppText variant="body" muted style={styles.empty}>
          {t.shopping.empty}
        </AppText>
      }
    />
  );
}

function ShoppingRow({ item, recipe, first, last }: { item: ShoppingItem; recipe?: string; first: boolean; last: boolean }) {
  const { t } = useI18n();
  const colors = useColors();
  const checked = !!item.checked;
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface },
        first && styles.rowFirst,
        last && styles.rowLast,
        !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={recipe ? `${item.text}, ${t.shopping.forRecipe(recipe)}` : item.text}
        onPress={() => toggleShoppingItem(item)}
        style={({ pressed }) => [styles.rowMain, Platform.OS === 'ios' && pressed && styles.pressed]}>
        <View
          style={[
            styles.checkbox,
            checked ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.textMuted },
          ]}>
          {checked ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
        </View>
        <View style={styles.flex}>
          <Text style={[typography.body, { color: colors.text }, checked && styles.checked]}>{item.text}</Text>
          {recipe ? (
            <AppText variant="caption" muted numberOfLines={1}>
              {t.shopping.forRecipe(recipe)}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.shopping.remove(item.text)}
        onPress={() => deleteShoppingItem(item.id)}
        hitSlop={8}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <Icon name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { gap: space.sm, marginBottom: space.sm },
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    ...typography.body,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH },
  sectionTitle: { paddingTop: space.lg, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: space.sm },
  rowFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  rowLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: TOUCH + 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checked: { textDecorationLine: 'line-through', opacity: 0.5 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  empty: { marginTop: space.xl, textAlign: 'center' },
});
