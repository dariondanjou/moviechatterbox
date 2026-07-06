import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { color, elevation, font, radius, space, type } from '@/theme/tokens';

export type SheetOption = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

/**
 * Bottom action sheet (moderation menus, FR-5.1). Alert.alert can't do
 * option lists on web, so this is a token-styled Modal that works on all
 * three platforms.
 */
export function ActionSheet({
  visible,
  title,
  subtitle,
  options,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SheetOption[];
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {options.map((o) => (
            <Pressable
              key={o.label}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                onClose();
                o.onPress();
              }}
            >
              <Text style={[styles.rowText, o.destructive && styles.rowTextDestructive]}>
                {o.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: elevation.sheetTint,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    gap: 2,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 16,
    color: color.textPrimary,
  },
  subtitle: {
    ...type.label,
    color: color.textTertiary,
    marginBottom: space.sm,
  },
  row: {
    paddingVertical: space.md,
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: color.glass,
  },
  rowText: {
    ...type.body,
    color: color.textPrimary,
  },
  rowTextDestructive: {
    color: color.recordingText,
  },
  cancelText: {
    ...type.body,
    color: color.textTertiary,
  },
});
