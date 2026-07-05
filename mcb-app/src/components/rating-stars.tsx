import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, space } from '@/theme/tokens';

/**
 * Half-star rating control (0.5–5, §9.2). Each star has two tap zones;
 * half fill is an orange star clipped to 50% over a dim one.
 */
export function RatingStars({
  value,
  size = 28,
  onRate,
}: {
  value: number | null;
  size?: number;
  onRate?: (rating: number | null) => void;
}) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.row}>
      {stars.map((i) => {
        const fill = value == null ? 0 : value >= i ? 1 : value >= i - 0.5 ? 0.5 : 0;
        return (
          <View key={i} style={{ width: size, height: size * 1.15 }}>
            <Text style={[styles.star, { fontSize: size, color: color.textTertiary }]}>
              ★
            </Text>
            {fill > 0 && (
              <View
                style={[
                  styles.clip,
                  { width: fill === 1 ? size : size / 2, height: size * 1.15 },
                ]}
              >
                <Text style={[styles.star, { fontSize: size, color: color.orange500 }]}>
                  ★
                </Text>
              </View>
            )}
            {onRate && (
              <>
                <Pressable
                  style={[styles.half, { width: size / 2, height: size * 1.15 }]}
                  onPress={() => onRate(value === i - 0.5 ? null : i - 0.5)}
                />
                <Pressable
                  style={[
                    styles.half,
                    { left: size / 2, width: size / 2, height: size * 1.15 },
                  ]}
                  onPress={() => onRate(value === i ? null : i)}
                />
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.xs,
  },
  star: {
    position: 'absolute',
    lineHeight: undefined,
  },
  clip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  half: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
