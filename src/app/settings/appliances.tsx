import { ScrollView, StyleSheet } from 'react-native';

import { ApplianceList } from '@/components/kitchen';
import { AppText } from '@/components/ui';
import { useI18n } from '@/i18n';
import { space } from '@/theme';

export default function AppliancesScreen() {
  const { t } = useI18n();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <AppText variant="body" muted>
        {t.settings.appliancesHint}
      </AppText>
      <ApplianceList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
