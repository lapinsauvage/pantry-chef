/**
 * Small themed building blocks. Rows grow with the text size (no fixed heights) and keep
 * touch targets ≥ 48 dp; every pressable has an accessibility role and label.
 */
import { Children, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableStateCallbackType,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';

import { radius, space, TOUCH, typography, useColors } from '@/theme';

import { Icon, type IconName } from './icon';

export function AppText({
  variant = 'body',
  muted,
  color,
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography; muted?: boolean; color?: string }) {
  const colors = useColors();
  return <Text style={[typography[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style]} {...props} />;
}

const pressedStyle = ({ pressed }: PressableStateCallbackType) =>
  Platform.OS === 'ios' && pressed ? { opacity: 0.6 } : null;

type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const bg = { primary: colors.primary, secondary: colors.surfaceAlt, plain: 'transparent', danger: 'transparent' }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.text, plain: colors.primary, danger: colors.danger }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={(state) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === 'danger' && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.danger },
        pressedStyle(state),
        style,
      ]}>
      {busy ? <ActivityIndicator color={fg} /> : <AppText variant="label" color={fg} style={styles.center}>{title}</AppText>}
    </Pressable>
  );
}

/** A titled group of rows on a card, with hairlines between rows. */
export function Section({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  const colors = useColors();
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      {title ? (
        <AppText variant="overline" muted style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
            {row}
          </View>
        ))}
      </View>
      {hint ? (
        <AppText variant="caption" muted style={styles.sectionHint}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Radio or checkbox row. */
export function ChoiceRow({
  label,
  description,
  selected,
  onPress,
  kind,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  kind: 'radio' | 'checkbox';
}) {
  const colors = useColors();
  const indicator =
    kind === 'radio' ? (
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.textMuted }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
      </View>
    ) : (
      <View
        style={[
          styles.checkbox,
          selected
            ? { backgroundColor: colors.primary, borderColor: colors.primary }
            : { borderColor: colors.textMuted },
        ]}>
        {selected ? <Icon name="check" size={16} color={colors.onPrimary} /> : null}
      </View>
    );
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={(state) => [styles.row, pressedStyle(state)]}>
      {indicator}
      <View style={styles.rowText}>
        <AppText variant="body">{label}</AppText>
        {description ? (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Row that opens another screen, showing the current value. */
export function NavRow({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={(state) => [styles.row, pressedStyle(state)]}>
      <View style={styles.rowText}>
        <AppText variant="body">{label}</AppText>
        {value ? (
          <AppText variant="caption" muted numberOfLines={2}>
            {value}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevronRight" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="body" style={styles.rowText}>
        {label}
      </AppText>
      <AppText variant="body" muted style={styles.infoValue}>
        {value}
      </AppText>
    </View>
  );
}

/** Pill button; `icon` shows add/remove affordance. */
export function Chip({
  label,
  onPress,
  selected,
  icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  icon?: IconName;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const fg = selected ? colors.onPrimarySoft : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected != null ? { selected } : undefined}
      onPress={onPress}
      hitSlop={4}
      style={(state) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        pressedStyle(state),
      ]}>
      <AppText variant="label" color={fg} style={styles.chipLabel}>
        {label}
      </AppText>
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
    </Pressable>
  );
}

/** Non-interactive label pill (appliances, diet, chips on the recipe screen). */
export function Tag({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.tag, { backgroundColor: colors.surfaceAlt }]}>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

/** − value + with large touch targets; the value is announced when it changes. */
export function Stepper({
  label,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  canDecrement = true,
}: {
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
  canDecrement?: boolean;
}) {
  const colors = useColors();
  const button = (icon: IconName, a11y: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.stepperButton,
        { backgroundColor: colors.primarySoft, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}>
      <Icon name={icon} size={20} color={colors.onPrimarySoft} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {button('minus', decrementLabel, onDecrement, !canDecrement)}
      <AppText variant="label" style={styles.stepperLabel} accessibilityLiveRegion="polite">
        {label}
      </AppText>
      {button('add', incrementLabel, onIncrement)}
    </View>
  );
}

/** Search input with icon and clear button (iOS); `label` is also the placeholder. */
export function SearchField({
  value,
  onChangeText,
  label,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={[styles.searchInput, { color: colors.text }]}
      />
      {value && Platform.OS !== 'ios' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="✕" onPress={() => onChangeText('')} hitSlop={10}>
          <Icon name="close" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Square-ish tile for the Browse grid (emoji + label). */
export function Tile({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: colors.border }}
      style={(state) => [styles.tile, { backgroundColor: colors.surface }, pressedStyle(state)]}>
      <Text style={styles.tileEmoji} allowFontScaling={false} importantForAccessibility="no">
        {emoji}
      </Text>
      <AppText variant="label" style={styles.flexShrink}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.tileGrid}>{children}</View>;
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chipGroup}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  center: { textAlign: 'center' },
  section: { gap: space.sm },
  sectionTitle: { marginHorizontal: space.lg },
  sectionHint: { marginHorizontal: space.lg },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  row: {
    minHeight: TOUCH + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: 2 },
  infoValue: { flexShrink: 1, textAlign: 'right' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: { flexShrink: 1 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, ...typography.body, paddingVertical: space.sm },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tileEmoji: { fontSize: 24 },
  flexShrink: { flexShrink: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepperButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepperLabel: { minWidth: 110, textAlign: 'center' },
});
