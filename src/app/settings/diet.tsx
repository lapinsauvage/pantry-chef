import { ScrollView, StyleSheet } from 'react-native';

import { DietAvoidEditor } from '@/components/kitchen';
import { space } from '@/theme';

export default function DietScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <DietAvoidEditor />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
});
