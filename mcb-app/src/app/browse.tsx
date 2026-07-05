import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listTrendingTitles,
  posterUrl,
  searchTitles,
  type Title,
} from '@/lib/titles';
import { color, font, radius, space, type } from '@/theme/tokens';

export default function Browse() {
  const [query, setQuery] = useState('');
  const [titles, setTitles] = useState<Title[]>([]);
  const { width } = useWindowDimensions();
  const columns = Math.max(3, Math.min(6, Math.floor(width / 130)));

  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    const load = q ? () => searchTitles(q) : () => listTrendingTitles();
    const t = setTimeout(() => {
      load()
        .then((r) => !cancelled && setTitles(r))
        .catch(() => {});
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>browse</Text>
        <Pressable onPress={() => router.push('/lobby')}>
          <Text style={styles.headerLink}>the lobby</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.search}
        placeholder="Search films & shows…"
        placeholderTextColor={color.textTertiary}
        value={query}
        onChangeText={setQuery}
      />
      <FlatList
        key={columns}
        data={titles}
        numColumns={columns}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cell}
            onPress={() => router.push(`/title/${item.id}`)}
          >
            <Image
              source={{ uri: posterUrl(item.poster_path) ?? undefined }}
              style={styles.poster}
              contentFit="cover"
              transition={150}
            />
            <Text style={styles.cellTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cellMeta}>
              {item.year ?? ''}{item.media_type === 'tv' ? ' · TV' : ''}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query ? 'No matches — try another title.' : 'Loading…'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bgScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  title: {
    ...type.displayHeader,
    color: color.textPrimary,
  },
  headerLink: {
    ...type.label,
    color: color.orange500,
  },
  search: {
    ...type.body,
    color: color.textPrimary,
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginHorizontal: space.xl,
    marginBottom: space.md,
  },
  grid: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
  },
  gridRow: {
    gap: space.md,
  },
  cell: {
    flex: 1,
    maxWidth: 160,
    marginBottom: space.lg,
  },
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  cellTitle: {
    ...type.label,
    color: color.textPrimary,
    marginTop: space.xs,
  },
  cellMeta: {
    fontFamily: font.regular,
    fontSize: 12,
    color: color.textTertiary,
  },
  empty: {
    ...type.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: space.huge,
  },
});
