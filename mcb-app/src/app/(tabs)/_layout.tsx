import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, elevation, font, radius, space, type } from '@/theme/tokens';

// Bottom tab bar per design board 1b: Lobby · Browse · center orange + FAB ·
// Activity · Profile. Text labels stand in until the 1.8px-stroke icon set
// exists as an asset — flagged, not improvised off-system.
const TABS = [
  { name: 'lobby', label: 'lobby' },
  { name: 'browse', label: 'browse' },
  { name: 'activity', label: 'activity' },
  { name: 'profile', label: 'profile' },
] as const;

// Minimal shape of the react-navigation tab-bar props we use — expo-router
// vendors bottom-tabs, so importing the standalone package's types clashes.
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;

  const slot = (tab: (typeof TABS)[number]) => {
    const active = current === tab.name;
    return (
      <Pressable
        key={tab.name}
        style={styles.slot}
        onPress={() => navigation.navigate(tab.name)}
      >
        <Text style={[styles.label, active && styles.labelActive]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {slot(TABS[0])}
      {slot(TABS[1])}
      <View style={styles.fabSlot}>
        <Pressable style={styles.fab} onPress={() => router.push('/start')}>
          <Text style={styles.fabPlus}>+</Text>
        </Pressable>
      </View>
      {slot(TABS[2])}
      {slot(TABS[3])}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.bgScreen },
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="lobby" />
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="profile" />
      {/* Detail pages live inside the tab navigator so the bottom bar is
          always available; they get no tab slot of their own. */}
      <Tabs.Screen name="title/[id]" />
      <Tabs.Screen name="person/[id]" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: elevation.sheetTint,
    borderTopWidth: 1,
    borderTopColor: color.glassBorder,
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  label: {
    ...type.label,
    color: color.textTertiary,
  },
  labelActive: {
    fontFamily: font.bold,
    color: color.orange500,
  },
  fabSlot: {
    width: 76,
    alignItems: 'center',
  },
  fab: {
    marginTop: -30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.orange500,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: color.bgScreen,
    shadowColor: color.orange500,
    shadowOpacity: 0.5,
    shadowRadius: radius.md,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabPlus: {
    fontFamily: font.bold,
    fontSize: 28,
    lineHeight: 32,
    color: color.inkOnOrange,
  },
});
