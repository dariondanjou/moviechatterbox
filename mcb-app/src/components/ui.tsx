import type { PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { color, elevation, font, radius, space, type } from '@/theme/tokens';

export function GlassCard({
  children,
  live,
  style,
}: PropsWithChildren<{ live?: boolean; style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={[styles.glassCard, live && styles.glassCardLive, style]}>
      {children}
    </View>
  );
}

export function LiveBadge() {
  return (
    <View style={styles.liveBadge}>
      <View style={styles.liveDot} />
      <Text style={styles.liveBadgeText}>LIVE</Text>
    </View>
  );
}

export function TimeChip({ label }: { label: string }) {
  return (
    <View style={styles.timeChip}>
      <Text style={styles.timeChipText}>{label}</Text>
    </View>
  );
}

export function PrimaryPill({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.primaryPill,
        pressed && styles.primaryPillPressed,
        disabled && styles.disabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.primaryPillText}>{label}</Text>
    </Pressable>
  );
}

export function GhostPill({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ghostPill,
        active && styles.ghostPillActive,
        pressed && styles.glassCardLive,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.ghostPillText, active && styles.ghostPillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Placeholder blob avatar: initials on tinted glass (art comes with TMDB phase). */
export function Avatar({
  name,
  size = 44,
  speaking,
  muted,
  host,
}: {
  name: string;
  size?: number;
  speaking?: boolean;
  muted?: boolean;
  host?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderTopLeftRadius: size * 0.42,
            borderTopRightRadius: size * 0.58,
            borderBottomRightRadius: size * 0.52,
            borderBottomLeftRadius: size * 0.48,
          },
          speaking && styles.avatarSpeaking,
          muted && styles.avatarMuted,
        ]}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>
          {initials || '?'}
        </Text>
        {muted && <View style={styles.mutedDot} />}
      </View>
      {host && (
        <View style={styles.hostChip}>
          <Text style={styles.hostChipText}>HOST</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
  },
  glassCardLive: {
    borderColor: elevation.liveBorder,
    ...elevation.liveGlow,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: color.orange500,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.inkOnOrange,
  },
  liveBadgeText: {
    ...type.micro,
    color: color.inkOnOrange,
  },
  timeChip: {
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  timeChipText: {
    ...type.micro,
    color: color.textSecondary,
  },
  primaryPill: {
    backgroundColor: color.orange500,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    shadowColor: color.orange500,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryPillPressed: {
    backgroundColor: color.orange600,
  },
  primaryPillText: {
    fontFamily: font.bold,
    fontSize: 15,
    color: color.inkOnOrange,
  },
  ghostPill: {
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  ghostPillActive: {
    borderColor: color.orange500,
    backgroundColor: 'rgba(245,135,31,0.12)',
  },
  ghostPillText: {
    ...type.label,
    color: color.textPrimary,
  },
  ghostPillTextActive: {
    color: color.orange300,
  },
  disabled: {
    opacity: 0.4,
  },
  avatar: {
    backgroundColor: 'rgba(245,135,31,0.18)',
    borderColor: color.glassBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpeaking: {
    borderColor: color.orange500,
    borderWidth: 2,
    shadowColor: color.orange500,
    shadowOpacity: 0.55,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarMuted: {
    opacity: 0.75,
  },
  avatarText: {
    fontFamily: font.bold,
    color: color.orange100,
  },
  mutedDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: color.recording,
    borderWidth: 2,
    borderColor: color.bgScreen,
  },
  hostChip: {
    marginTop: -7,
    backgroundColor: color.orange500,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  hostChipText: {
    fontFamily: font.bold,
    fontSize: 8,
    letterSpacing: 1,
    color: color.inkOnOrange,
  },
});
