/**
 * Editors for the user's preferences, shared by onboarding and Settings.
 * Every change is saved immediately to user.db (src/state/*).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useRecipeDb } from '@/db/recipe-db';
import { type Ingredient, ingredientsByName, searchIngredients } from '@/db/recipes';
import { useIngredientNames } from '@/hooks/use-ingredient-names';
import { ingredientName, useI18n } from '@/i18n';
import { AVOID, BASIC_SUGGESTIONS, DEFAULT_BASICS, DIETS, EQUIPMENT, type Flag, type Lang } from '@/lib/constants';
import { hasBit, type LanguagePref, toggleBit } from '@/lib/settings';
import type { UnitSystem } from '@/lib/units';
import { addBasicIngredient, removeBasicIngredient, useBasics } from '@/state/basics';
import { updateSettings, useSettings } from '@/state/settings';
import { space, useColors } from '@/theme';

import { Icon } from './icon';
import { AppText, Chip, ChipGroup, ChoiceRow, NavRow, SearchField, Section } from './ui';

/** "Oven, Stovetop" — labels of the selected flags, or "None". */
export function selectedLabels(flags: readonly Flag[], mask: number, lang: Lang, none: string): string {
  const labels = flags.filter((f) => hasBit(mask, f.bit)).map((f) => f.label[lang]);
  return labels.length ? labels.join(', ') : none;
}

/** Summary rows (appliances, basics, diet) that open the matching settings screen. */
export function KitchenSection({ title }: { title: string }) {
  const { t, lang } = useI18n();
  const { equipment, diet, avoid } = useSettings();
  const basics = useBasics();
  const dietParts = [
    ...(diet ? [selectedLabels(DIETS, diet, lang, '')] : []),
    ...(avoid ? [t.settings.avoidSummary(selectedLabels(AVOID, avoid, lang, ''))] : []),
  ];
  return (
    <Section title={title}>
      <NavRow
        label={t.settings.appliances}
        value={selectedLabels(EQUIPMENT, equipment, lang, t.common.none)}
        onPress={() => router.push('/settings/appliances')}
      />
      <NavRow
        label={t.settings.basics}
        value={t.settings.basicsCount(basics.length)}
        onPress={() => router.push('/settings/basics')}
      />
      <NavRow
        label={t.settings.dietAndAvoid}
        value={dietParts.length ? dietParts.join(' · ') : t.common.none}
        onPress={() => router.push('/settings/diet')}
      />
    </Section>
  );
}

export function LanguagePicker() {
  const { t, systemLang } = useI18n();
  const { language } = useSettings();
  const options: { value: LanguagePref; label: string }[] = [
    { value: 'system', label: t.settings.languageSystem(t.settings.languageNames[systemLang]) },
    { value: 'en', label: t.settings.languageNames.en },
    { value: 'fr', label: t.settings.languageNames.fr },
  ];
  return (
    <Section title={t.settings.language}>
      {options.map((o) => (
        <ChoiceRow
          key={o.value}
          kind="radio"
          label={o.label}
          selected={language === o.value}
          onPress={() => updateSettings({ language: o.value })}
        />
      ))}
    </Section>
  );
}

export function UnitsPicker() {
  const { t } = useI18n();
  const { units } = useSettings();
  const options: { value: UnitSystem; label: string }[] = [
    { value: 'metric', label: t.settings.unitsMetric },
    { value: 'us', label: t.settings.unitsUs },
  ];
  return (
    <Section title={t.settings.units} hint={t.settings.unitsHint}>
      {options.map((o) => (
        <ChoiceRow
          key={o.value}
          kind="radio"
          label={o.label}
          selected={units === o.value}
          onPress={() => updateSettings({ units: o.value })}
        />
      ))}
    </Section>
  );
}

export function FlagChecklist({
  title,
  hint,
  flags,
  mask,
  onChange,
}: {
  title?: string;
  hint?: string;
  flags: readonly Flag[];
  mask: number;
  onChange: (mask: number) => void;
}) {
  const { lang } = useI18n();
  return (
    <Section title={title} hint={hint}>
      {flags.map((f) => (
        <ChoiceRow
          key={f.key}
          kind="checkbox"
          label={f.label[lang]}
          selected={hasBit(mask, f.bit)}
          onPress={() => onChange(toggleBit(mask, f.bit))}
        />
      ))}
    </Section>
  );
}

export function ApplianceList({ title }: { title?: string }) {
  const { equipment } = useSettings();
  return <FlagChecklist title={title} flags={EQUIPMENT} mask={equipment} onChange={(m) => updateSettings({ equipment: m })} />;
}

export function DietAvoidEditor() {
  const { t } = useI18n();
  const colors = useColors();
  const { diet, avoid } = useSettings();
  return (
    <View style={styles.stack}>
      <FlagChecklist
        title={t.settings.diet}
        hint={t.settings.dietHint}
        flags={DIETS}
        mask={diet}
        onChange={(m) => updateSettings({ diet: m })}
      />
      <FlagChecklist
        title={t.settings.avoid}
        hint={t.settings.avoidHint}
        flags={AVOID}
        mask={avoid}
        onChange={(m) => updateSettings({ avoid: m })}
      />
      <View style={styles.note}>
        <Icon name="info" size={18} color={colors.textMuted} />
        <AppText variant="caption" muted style={styles.flex}>
          {t.settings.dietDisclaimer}
        </AppText>
      </View>
    </View>
  );
}

const SUGGESTED_BASICS = [...DEFAULT_BASICS, ...BASIC_SUGGESTIONS];

/** Basics as removable chips, ingredient search (EN/FR, accent-insensitive) and suggestions. Needs <Suspense>. */
export function BasicsEditor() {
  const db = useRecipeDb();
  const { t, lang } = useI18n();
  const basics = useBasics();
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ query: string; rows: Ingredient[] } | null>(null);

  useEffect(() => {
    ingredientsByName(db, SUGGESTED_BASICS).then(setSuggestions);
  }, [db]);

  const text = query.trim();
  useEffect(() => {
    if (!text) return;
    let live = true;
    const timer = setTimeout(() => {
      searchIngredients(db, text, 20).then((rows) => {
        if (live) setResults({ query: text, rows });
      });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [db, text]);

  const owned = new Set(basics.map((b) => b.id));
  const nameOf = useIngredientNames(basics);
  const sortedBasics = [...basics].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const searchRows = text && results?.query === text ? results.rows.filter((r) => !owned.has(r.id)) : null;
  const add = (i: Ingredient) => addBasicIngredient({ id: i.id, name: i.name });

  return (
    <View style={styles.stack}>
      <View style={styles.group}>
        <AppText variant="overline" muted accessibilityRole="header">
          {t.settings.yourBasics}
        </AppText>
        {sortedBasics.length ? (
          <ChipGroup>
            {sortedBasics.map((b) => (
              <Chip
                key={b.id}
                label={nameOf(b)}
                icon="close"
                selected
                accessibilityLabel={t.settings.removeIngredient(nameOf(b))}
                onPress={() => removeBasicIngredient(b.id)}
              />
            ))}
          </ChipGroup>
        ) : (
          <AppText variant="body" muted>
            {t.settings.noBasics}
          </AppText>
        )}
      </View>

      <View style={styles.group}>
        <SearchField value={query} onChangeText={setQuery} label={t.settings.searchIngredient} />
        {searchRows ? (
          searchRows.length ? (
            <ChipGroup>
              {searchRows.map((r) => (
                <Chip
                  key={r.id}
                  label={ingredientName(r, lang)}
                  icon="add"
                  accessibilityLabel={t.settings.addIngredient(ingredientName(r, lang))}
                  onPress={() => add(r)}
                />
              ))}
            </ChipGroup>
          ) : (
            <AppText variant="body" muted>
              {t.settings.noMatch}
            </AppText>
          )
        ) : null}
      </View>

      {suggestions.some((s) => !owned.has(s.id)) ? (
        <View style={styles.group}>
          <AppText variant="overline" muted accessibilityRole="header">
            {t.settings.suggestions}
          </AppText>
          <ChipGroup>
            {suggestions
              .filter((s) => !owned.has(s.id))
              .map((s) => (
                <Chip
                  key={s.id}
                  label={ingredientName(s, lang)}
                  icon="add"
                  accessibilityLabel={t.settings.addIngredient(ingredientName(s, lang))}
                  onPress={() => add(s)}
                />
              ))}
          </ChipGroup>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  group: { gap: space.md },
  flex: { flex: 1 },
  note: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
});
