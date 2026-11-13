/**
 * Browse tab: search as you type (names, ingredients, keywords; English or French), or pick a
 * collection, course or cuisine (opens browse/list).
 */
import { router } from 'expo-router';
import { Suspense, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { COURSE_EMOJI } from '@/components/recipe-card';
import { RecipeResults } from '@/components/recipe-results';
import { PreparingRecipes } from '@/components/states';
import { AppText, Chip, ChipGroup, SearchField, Tile, TileGrid } from '@/components/ui';
import { useI18n } from '@/i18n';
import { COLLECTIONS, type PresetKind } from '@/lib/browse';
import { COURSES, CUISINES } from '@/lib/constants';
import { space } from '@/theme';

export default function BrowseScreen() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const text = query.trim();
  return (
    <View style={styles.flex}>
      <View style={styles.searchBar}>
        <SearchField value={query} onChangeText={setQuery} label={t.browse.search} />
      </View>
      <Suspense fallback={<PreparingRecipes />}>{text ? <RecipeResults text={text} preset={null} /> : <Discover />}</Suspense>
    </View>
  );
}

function open(kind: PresetKind, key: string) {
  router.push({ pathname: '/browse/list', params: { kind, key } });
}

function Discover() {
  const { t, lang } = useI18n();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}>
      <View style={styles.group}>
        <AppText variant="overline" muted accessibilityRole="header">
          {t.browse.collections}
        </AppText>
        <TileGrid>
          {COLLECTIONS.map((c) => (
            <Tile key={c.key} emoji={c.emoji} label={t.browse.collection[c.key]} onPress={() => open('collection', c.key)} />
          ))}
        </TileGrid>
      </View>

      <View style={styles.group}>
        <AppText variant="overline" muted accessibilityRole="header">
          {t.browse.byCourse}
        </AppText>
        <TileGrid>
          {COURSES.filter((c) => c.key !== 'other').map((c) => (
            <Tile key={c.key} emoji={COURSE_EMOJI[c.key]} label={c.label[lang]} onPress={() => open('course', c.key)} />
          ))}
        </TileGrid>
      </View>

      <View style={styles.group}>
        <AppText variant="overline" muted accessibilityRole="header">
          {t.browse.byCuisine}
        </AppText>
        <ChipGroup>
          {CUISINES.filter((c) => c.key !== 'other').map((c) => (
            <Chip key={c.key} label={c.label[lang]} onPress={() => open('cuisine', c.key)} />
          ))}
        </ChipGroup>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchBar: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs, width: '100%', maxWidth: 720, alignSelf: 'center' },
  content: { padding: space.lg, gap: space.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  group: { gap: space.sm },
});
