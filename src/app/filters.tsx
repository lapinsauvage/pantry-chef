/**
 * Filter sheet shared by the Cook tab (default) and Browse (`?scope=browse`).
 * Cook: appliances, diet, avoid for this search. Browse adds time, difficulty, cuisine and
 * "with photo only". Appliances/diet/avoid start from Settings and override them.
 */
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FlagChecklist } from '@/components/kitchen';
import { AppText, Button, Chip, ChipGroup, ChoiceRow, Section } from '@/components/ui';
import { useI18n } from '@/i18n';
import { activeFilterCount } from '@/lib/browse';
import { AVOID, CUISINES, DIETS, EQUIPMENT, TIME_PRESETS } from '@/lib/constants';
import { hasOverrides } from '@/lib/cook';
import { formatMinutes } from '@/lib/format';
import { clearBrowseFilters, updateBrowseOptions, useBrowseOptions } from '@/state/browse';
import { clearCookOverrides, updateCookOptions, useCookOptions } from '@/state/cook';
import { useSettings } from '@/state/settings';
import { space } from '@/theme';

export default function FiltersScreen() {
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {scope === 'browse' ? <BrowseFilters /> : <CookFilters />}
    </ScrollView>
  );
}

function CookFilters() {
  const { t } = useI18n();
  const opts = useCookOptions();
  const settings = useSettings();
  return (
    <>
      <AppText variant="body" muted>
        {t.filters.hint}
      </AppText>
      <KitchenFilters
        equipment={opts.equipment ?? settings.equipment}
        diet={opts.diet ?? settings.diet}
        avoid={opts.avoid ?? settings.avoid}
        onChange={updateCookOptions}
      />
      {hasOverrides(opts, settings) ? <Button variant="secondary" title={t.filters.reset} onPress={clearCookOverrides} /> : null}
    </>
  );
}

function BrowseFilters() {
  const { t, lang } = useI18n();
  const opts = useBrowseOptions();
  const settings = useSettings();
  const toggleCuisine = (key: string) =>
    updateBrowseOptions({
      cuisines: opts.cuisines.includes(key) ? opts.cuisines.filter((c) => c !== key) : [...opts.cuisines, key],
    });
  const difficulties = [
    { value: null, label: t.filters.anyDifficulty },
    { value: 1, label: t.filters.easyOnly },
    { value: 2, label: t.filters.easyOrMedium },
  ] as const;
  return (
    <>
      <AppText variant="body" muted>
        {t.filters.browseHint}
      </AppText>

      <Group title={t.filters.time}>
        {TIME_PRESETS.map((m) => (
          <Chip
            key={m ?? 'any'}
            label={m == null ? t.cook.anyTime : formatMinutes(m, lang)}
            selected={opts.maxMinutes === m}
            onPress={() => updateBrowseOptions({ maxMinutes: m })}
          />
        ))}
      </Group>

      <Group title={t.filters.difficulty}>
        {difficulties.map((d) => (
          <Chip
            key={d.value ?? 'any'}
            label={d.label}
            selected={opts.maxDifficulty === d.value}
            onPress={() => updateBrowseOptions({ maxDifficulty: d.value })}
          />
        ))}
      </Group>

      <Group title={t.filters.cuisine} hint={t.filters.cuisineHint}>
        {CUISINES.filter((c) => c.key !== 'other').map((c) => (
          <Chip key={c.key} label={c.label[lang]} selected={opts.cuisines.includes(c.key)} onPress={() => toggleCuisine(c.key)} />
        ))}
      </Group>

      <Section>
        <ChoiceRow
          kind="checkbox"
          label={t.filters.photoOnly}
          selected={opts.withImageOnly}
          onPress={() => updateBrowseOptions({ withImageOnly: !opts.withImageOnly })}
        />
      </Section>

      <KitchenFilters
        equipment={opts.equipment ?? settings.equipment}
        diet={opts.diet ?? settings.diet}
        avoid={opts.avoid ?? settings.avoid}
        onChange={updateBrowseOptions}
      />

      {activeFilterCount(opts, settings) > 0 ? (
        <Button variant="secondary" title={t.filters.clear} onPress={clearBrowseFilters} />
      ) : null}
    </>
  );
}

function KitchenFilters({
  equipment,
  diet,
  avoid,
  onChange,
}: {
  equipment: number;
  diet: number;
  avoid: number;
  onChange: (patch: { equipment?: number; diet?: number; avoid?: number }) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <FlagChecklist title={t.settings.appliances} flags={EQUIPMENT} mask={equipment} onChange={(m) => onChange({ equipment: m })} />
      <FlagChecklist title={t.settings.diet} hint={t.settings.dietHint} flags={DIETS} mask={diet} onChange={(m) => onChange({ diet: m })} />
      <FlagChecklist title={t.settings.avoid} hint={t.settings.avoidHint} flags={AVOID} mask={avoid} onChange={(m) => onChange({ avoid: m })} />
    </>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <AppText variant="overline" muted accessibilityRole="header">
        {title}
      </AppText>
      <ChipGroup>{children}</ChipGroup>
      {hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  group: { gap: space.sm },
});
