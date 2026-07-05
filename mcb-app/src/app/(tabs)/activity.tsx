import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, space, type } from '@/theme/tokens';

/**
 * Activity feed placeholder — fills in with follows and the
 * "someone you follow is speaking now" live signal (§9.2).
 */
export default function Activity() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>activity</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.empty}>
          Your activity feed lands with follows — you'll see friends' ratings,
          lists, and live Chatterboxes here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bgScreen,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  title: {
    ...type.displayHeader,
    color: color.textPrimary,
  },
  body: {
    paddingHorizontal: space.xl,
  },
  empty: {
    ...type.body,
    color: color.textSecondary,
  },
});
