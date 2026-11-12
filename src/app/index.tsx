/**
 * Placeholder home screen: proves the bundled database opens and queries work.
 * Replace with the real tabs (see docs/SPEC.md, milestone M1).
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { browse, dataInfo, type RecipeCard } from '@/db/recipes';

export default function Index() {
  const db = useSQLiteContext();
  const [info, setInfo] = useState<Record<string, string>>({});
  const [top, setTop] = useState<RecipeCard[]>([]);

  useEffect(() => {
    dataInfo(db).then(setInfo);
    browse(db, { maxMinutes: 30 }, 'popular', 10).then(setTop);
  }, [db]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Pantry Chef</Text>
      <Text>{info.recipes ?? '…'} recipes · {info.ingredients ?? '…'} ingredients</Text>
      <Text style={styles.subtitle}>Popular, ready in 30 min:</Text>
      {top.map((r) => (
        <Text key={r.id}>• {r.name} ({r.total_min} min)</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 6 },
  title: { fontSize: 28, fontWeight: '700', marginTop: 40 },
  subtitle: { marginTop: 16, fontWeight: '600' },
});
