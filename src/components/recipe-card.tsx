/** Recipe list row (Cook results now; Browse/Favourites later) and the photo placeholder. */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RecipeCard } from '@/db/recipes';
import { useI18n } from '@/i18n';
import { DIFFICULTY, imageUrl } from '@/lib/constants';
import { formatMinutes, formatNumber } from '@/lib/format';
import { recipeTitle } from '@/lib/recipe-text';
import { useSettings } from '@/state/settings';
import { radius, space, useColors } from '@/theme';

import { Icon } from './icon';
import { AppText } from './ui';

export const COURSE_EMOJI: Record<string, string> = {
  main: '🍲', side: '🥔', soup: '🥣', salad: '🥗', breakfast: '🍳', dessert: '🍰',
  baking: '🥖', snack: '🥨', sauce: '🫙', drink: '🍹', other: '🍴',
};

/** Shown when a recipe has no photo (or it fails to load). */
export function CoursePlaceholder({ course, size }: { course: string; size: number }) {
  const colors = useColors();
  return (
    <View
      style={[styles.placeholder, { backgroundColor: colors.surfaceAlt, width: '100%', height: '100%' }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text style={{ fontSize: size }} allowFontScaling={false}>
        {COURSE_EMOJI[course] ?? COURSE_EMOJI.other}
      </Text>
    </View>
  );
}

/** Recipe photo with disk cache and a course placeholder. */
export function RecipePhoto({
  image,
  course,
  emojiSize,
  variant = 'full',
}: {
  image: string | null;
  course: string;
  emojiSize: number;
  variant?: 'full' | 'thumb';
}) {
  const [failed, setFailed] = useState(false);
  const uri = imageUrl(image, variant);
  if (!uri || failed) return <CoursePlaceholder course={course} size={emojiSize} />;
  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
      recyclingKey={uri}
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

export interface RecipeResult extends RecipeCard {
  /** Names of the missing ingredients, in the UI language (Cook results only). */
  missingNames?: string[];
}

function RecipeRowInner({ recipe }: { recipe: RecipeResult }) {
  const { t, lang } = useI18n();
  const { units } = useSettings();
  const colors = useColors();
  const title = recipeTitle(recipe, lang, units);
  const meta = [
    formatMinutes(recipe.total_min, lang),
    recipe.rating != null ? `★ ${formatNumber(recipe.rating, lang, 1)}` : null,
    DIFFICULTY[recipe.difficulty]?.[lang],
  ].filter(Boolean);

  let badge: { text: string; color: string; ready: boolean } | null = null;
  if (recipe.missing != null) {
    const names = recipe.missingNames ?? [];
    badge =
      recipe.missing === 0
        ? { text: t.cook.ready, color: colors.success, ready: true }
        : {
            text: t.cook.missing(recipe.missing, names.length > 2 ? `${names.slice(0, 2).join(', ')}…` : names.join(', ')),
            color: colors.textMuted,
            ready: false,
          };
  }
  const uses = recipe.hits ? t.cook.uses(recipe.hits) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, meta.join(', '), badge?.text, uses].filter(Boolean).join('. ')}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface },
        Platform.OS === 'ios' && pressed && { opacity: 0.7 },
      ]}>
      <View style={styles.thumb}>
        <RecipePhoto image={recipe.image} course={recipe.course} emojiSize={36} variant="thumb" />
      </View>
      <View style={styles.body}>
        <AppText variant="label" numberOfLines={2}>
          {title}
        </AppText>
        <View style={styles.meta}>
          <Icon name="clock" size={14} color={colors.textMuted} />
          <AppText variant="caption" muted numberOfLines={1} style={styles.flex}>
            {meta.join(' · ')}
          </AppText>
        </View>
        {badge ? (
          <View style={styles.meta}>
            {badge.ready ? <Icon name="checkCircle" size={14} color={badge.color} /> : null}
            <AppText variant="caption" color={badge.color} numberOfLines={2} style={[styles.flex, badge.ready && styles.bold]}>
              {badge.text}
            </AppText>
          </View>
        ) : null}
        {uses ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {uses}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

export const RecipeRow = memo(RecipeRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  thumb: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3, paddingVertical: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flex: { flex: 1 },
  bold: { fontWeight: '600' },
});
