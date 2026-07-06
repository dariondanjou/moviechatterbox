import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAudioRoom } from '@/providers/audio-room-provider';
import { color, elevation, font, radius, space, type } from '@/theme/tokens';

/**
 * Persistent mini-bar while in a Chatterbox but browsing elsewhere
 * (prototype phase 8). Tap the title to return; mute/leave inline.
 */
export function FloatingAudioBar() {
  const { box, muted, canSpeak, audioState, toggleMute, leaveRoom } = useAudioRoom();
  const pathname = usePathname();

  if (!box || pathname.startsWith(`/chatterbox/`)) {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.liveDot} />
        <Pressable
          style={styles.titleWrap}
          onPress={() => router.push(`/chatterbox/${box.id}`)}
        >
          <Text style={styles.title} numberOfLines={1}>
            {box.title}
          </Text>
          <Text style={styles.meta}>
            {audioState === 'connected'
              ? canSpeak
                ? muted
                  ? 'on stage · muted'
                  : 'on stage · live'
                : 'listening'
              : audioState === 'connecting'
                ? 'connecting…'
                : 'audio off — tap to return'}
          </Text>
        </Pressable>
        {canSpeak && (
          <Pressable style={styles.action} onPress={toggleMute}>
            <Text style={styles.actionText}>{muted ? '🎙 off' : '🎙 on'}</Text>
          </Pressable>
        )}
        <Pressable style={styles.action} onPress={leaveRoom}>
          <Text style={styles.actionText}>✌️</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: 76, // clears the tab bar
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: elevation.sheetTint,
    borderColor: elevation.liveBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    maxWidth: 560,
    width: '100%',
    ...elevation.liveGlow,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.live,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 14,
    color: color.textPrimary,
  },
  meta: {
    ...type.micro,
    color: color.textTertiary,
  },
  action: {
    paddingHorizontal: space.xs,
  },
  actionText: {
    ...type.label,
    color: color.textPrimary,
  },
});
