/**
 * Cooking mode: one step per page (swipe or Previous/Next), large text, screen kept awake,
 * timers detected in the step ("bake 25 minutes") — tap to start; they keep running while you
 * move between steps and vibrate when done. Ingredients (scaled to the chosen servings) in a sheet.
 * Background notifications are a later improvement (see docs/SPEC.md).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { Suspense, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Message, PreparingRecipes } from '@/components/states';
import { AppText, Button, Chip, ChipGroup } from '@/components/ui';
import { useRecipeDb } from '@/db/recipe-db';
import { getRecipe, type RecipeDetail } from '@/db/recipes';
import { useI18n } from '@/i18n';
import { formatDuration } from '@/lib/format';
import { detectTimers, formatCountdown } from '@/lib/timers';
import { formatIngredient, metricizeText, scaleFactor } from '@/lib/units';
import { useSettings } from '@/state/settings';
import { radius, space, typography, useColors } from '@/theme';

export default function CookingScreen() {
  const { id, servings } = useLocalSearchParams<{ id: string; servings?: string }>();
  useKeepAwake(); // the screen stays on while cooking mode is open
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Suspense fallback={<PreparingRecipes />}>
        <CookingLoader id={Number(id)} servings={Number(servings) || null} />
      </Suspense>
    </SafeAreaView>
  );
}

function CookingLoader({ id, servings }: { id: number; servings: number | null }) {
  const db = useRecipeDb();
  const { t } = useI18n();
  const [recipe, setRecipe] = useState<RecipeDetail | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    getRecipe(db, id).then((r) => live && setRecipe(r));
    return () => {
      live = false;
    };
  }, [db, id]);
  if (recipe === undefined) return <ActivityIndicator style={styles.loading} />;
  if (!recipe || !recipe.steps.length) return <Message icon="info" body={t.recipe.notFound} />;
  return <Cooking recipe={recipe} servings={servings ?? recipe.servings ?? 1} />;
}

interface RunningTimer {
  key: string;
  label: string;
  endsAt: number;
}

/** Countdown timers; a timer is done once `endsAt` has passed, and vibrates once when it gets there. */
function useTimers(timeUp: (label: string) => string) {
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const rung = useRef(new Set<string>());
  const running = timers.some((x) => x.endsAt > now);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [running]);

  useEffect(() => {
    const due = timers.filter((x) => x.endsAt <= now && !rung.current.has(x.key));
    if (!due.length) return;
    due.forEach((x) => {
      rung.current.add(x.key);
      AccessibilityInfo.announceForAccessibility(timeUp(x.label));
    });
    Vibration.vibrate([0, 600, 300, 600, 300, 600]);
  }, [timers, now, timeUp]);

  return {
    timers: timers.map((x) => ({ ...x, done: x.endsAt <= now, left: (x.endsAt - now) / 1000 })),
    start: (key: string, label: string, seconds: number) => {
      const at = Date.now();
      setNow(at);
      setTimers((list) =>
        list.some((x) => x.key === key && x.endsAt > at) ? list : [...list.filter((x) => x.key !== key), { key, label, endsAt: at + seconds * 1000 }],
      );
      rung.current.delete(key);
    },
    remove: (key: string) => {
      rung.current.delete(key);
      setTimers((list) => list.filter((x) => x.key !== key));
    },
  };
}

function Cooking({ recipe, servings }: { recipe: RecipeDetail; servings: number }) {
  const { t, lang } = useI18n();
  const colors = useColors();
  const { units } = useSettings();
  const { width } = useWindowDimensions();
  const pager = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const timers = useTimers(t.cooking.timeUp);

  const steps = recipe.steps.map((s) => metricizeText(s, units, lang));
  const last = index === steps.length - 1;
  const go = (i: number) => {
    const next = Math.max(0, Math.min(steps.length - 1, i));
    pager.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.cooking.close}
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Icon name="close" size={24} color={colors.text} />
        </Pressable>
        <AppText variant="label" style={styles.counter} accessibilityLiveRegion="polite">
          {t.cooking.stepOf(index + 1, steps.length)}
        </AppText>
        <Button variant="plain" title={t.cooking.ingredients} onPress={() => setShowIngredients(true)} />
      </View>
      <View style={[styles.progress, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${((index + 1) / steps.length) * 100}%` }]} />
      </View>

      {timers.timers.length ? (
        <View style={styles.timers}>
          {timers.timers.map((x) => {
            return (
              <Pressable
                key={x.key}
                accessibilityRole="button"
                accessibilityLabel={x.done ? `${t.cooking.timeUp(x.label)}. ${t.cooking.dismiss}` : t.cooking.cancelTimer(x.label)}
                onPress={() => timers.remove(x.key)}
                style={[
                  styles.timer,
                  x.done ? { backgroundColor: colors.primary } : { backgroundColor: colors.primarySoft },
                ]}>
                <Icon name="clock" size={16} color={x.done ? colors.onPrimary : colors.onPrimarySoft} />
                <AppText variant="label" color={x.done ? colors.onPrimary : colors.onPrimarySoft}>
                  {x.done ? t.cooking.timeUp(x.label) : formatCountdown(x.left)}
                </AppText>
                <Icon name="close" size={14} color={x.done ? colors.onPrimary : colors.onPrimarySoft} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <FlatList
        ref={pager}
        data={steps}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <ScrollView style={{ width }} contentContainerStyle={styles.page}>
            <Text style={[styles.stepText, { color: colors.text }]} accessibilityRole="text">
              {item}
            </Text>
            <ChipGroup>
              {detectTimers(item).map((d) => {
                const label = formatDuration(d.seconds, lang);
                return (
                  <Chip
                    key={d.seconds}
                    label={`⏱ ${label}`}
                    accessibilityLabel={t.cooking.startTimer(label)}
                    onPress={() => timers.start(`${i}:${d.seconds}`, label, d.seconds)}
                  />
                );
              })}
            </ChipGroup>
          </ScrollView>
        )}
      />

      <View style={[styles.bottom, { borderTopColor: colors.border }]}>
        <Button variant="secondary" title={t.cooking.previous} onPress={() => go(index - 1)} disabled={index === 0} style={styles.flex} />
        <Button title={last ? t.cooking.done : t.cooking.next} onPress={() => (last ? router.back() : go(index + 1))} style={styles.flex} />
      </View>

      <IngredientsSheet recipe={recipe} servings={servings} visible={showIngredients} onClose={() => setShowIngredients(false)} />
    </View>
  );
}

function IngredientsSheet({
  recipe,
  servings,
  visible,
  onClose,
}: {
  recipe: RecipeDetail;
  servings: number;
  visible: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const colors = useColors();
  const { units } = useSettings();
  const factor = recipe.servings ? scaleFactor(recipe.servings, servings) : servings;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.sheetHeader}>
          <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
            {`${t.cooking.ingredients} · ${recipe.servings ? t.recipe.servings(servings) : t.recipe.batch(servings)}`}
          </AppText>
          <Button variant="plain" title={t.cooking.closeIngredients} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.sheetList}>
          {recipe.ingredients.map((line, i) => {
            const f = formatIngredient(line, { factor, system: units, lang, ingredient: line.canonical });
            return (
              <Text key={i} style={[styles.sheetLine, { color: colors.text }]}>
                {f.quantity ? <Text style={styles.bold}>{`${f.quantity} `}</Text> : null}
                {f.text}
                {f.note ? <Text style={{ color: colors.textMuted }}>{`, ${f.note}`}</Text> : null}
              </Text>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: space.xxl },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, minHeight: 52 },
  counter: { flex: 1, textAlign: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  progress: { height: 3, marginHorizontal: space.lg, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: 3 },
  timers: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  page: { padding: space.xl, gap: space.xl, maxWidth: 720, alignSelf: 'center', width: '100%' },
  stepText: { fontSize: 26, lineHeight: 38 },
  bottom: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  sheetList: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  sheetLine: { ...typography.body, fontSize: 18, lineHeight: 26 },
  bold: { fontWeight: '600' },
});
