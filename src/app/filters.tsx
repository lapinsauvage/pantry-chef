/** Cook tab filter sheet: appliances, diet and avoid for this search, starting from Settings. */
import { ScrollView, StyleSheet } from 'react-native';

import { FlagChecklist } from '@/components/kitchen';
import { AppText, Button } from '@/components/ui';
import { useI18n } from '@/i18n';
import { AVOID, DIETS, EQUIPMENT } from '@/lib/constants';
import { hasOverrides } from '@/lib/cook';
import { clearCookOverrides, updateCookOptions, useCookOptions } from '@/state/cook';
import { useSettings } from '@/state/settings';
import { space } from '@/theme';

export default function FiltersScreen() {
  const { t } = useI18n();
  const opts = useCookOptions();
  const settings = useSettings();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <AppText variant="body" muted>
        {t.filters.hint}
      </AppText>
      <FlagChecklist
        title={t.settings.appliances}
        flags={EQUIPMENT}
        mask={opts.equipment ?? settings.equipment}
        onChange={(m) => updateCookOptions({ equipment: m })}
      />
      <FlagChecklist
        title={t.settings.diet}
        hint={t.settings.dietHint}
        flags={DIETS}
        mask={opts.diet ?? settings.diet}
        onChange={(m) => updateCookOptions({ diet: m })}
      />
      <FlagChecklist
        title={t.settings.avoid}
        hint={t.settings.avoidHint}
        flags={AVOID}
        mask={opts.avoid ?? settings.avoid}
        onChange={(m) => updateCookOptions({ avoid: m })}
      />
      {hasOverrides(opts, settings) ? <Button variant="secondary" title={t.filters.reset} onPress={clearCookOverrides} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
