import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDuration, replayUrl, type Replay } from '@/lib/replays';
import { color, font, radius, space, type } from '@/theme/tokens';

/**
 * Audio replay playback (FR-2.1.4). Replays are ad inventory + clip-export
 * source later (FR-6.1); v1 is listen-only.
 */
export function ReplayPlayer({ replay }: { replay: Replay }) {
  const player = useAudioPlayer(
    replay.storage_path ? replayUrl(replay.storage_path) : null,
  );
  const status = useAudioPlayerStatus(player);

  const playing = status.playing;
  const duration = status.duration || replay.duration_seconds || 0;
  const progress = duration > 0 ? Math.min(status.currentTime / duration, 1) : 0;

  return (
    <View style={styles.card}>
      <Pressable
        style={[styles.playBtn, playing && styles.playBtnActive]}
        onPress={() => (playing ? player.pause() : player.play())}
      >
        <Text style={styles.playIcon}>{playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <View style={styles.body}>
        <Text style={styles.label}>REPLAY</Text>
        <View style={styles.track}>
          <View style={[styles.trackFill, { flex: progress }]} />
          <View style={{ flex: 1 - progress }} />
        </View>
        <Text style={styles.time}>
          {formatDuration(Math.floor(status.currentTime))}
          {duration ? ` / ${formatDuration(Math.floor(duration))}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.orange500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: color.orange600,
  },
  playIcon: {
    fontFamily: font.bold,
    fontSize: 16,
    color: color.inkOnOrange,
  },
  body: {
    flex: 1,
    gap: space.xs,
  },
  label: {
    ...type.micro,
    color: color.textTertiary,
    letterSpacing: 1,
  },
  track: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    backgroundColor: color.glassBorder,
    overflow: 'hidden',
  },
  trackFill: {
    backgroundColor: color.orange500,
  },
  time: {
    ...type.micro,
    color: color.textSecondary,
  },
});
