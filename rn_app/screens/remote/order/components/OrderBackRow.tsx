import { Pressable, StyleSheet, Text, View } from 'react-native';

type OrderBackRowProps = {
  title: string;
  onBack: () => void;
};

export function OrderBackRow({ title, onBack }: OrderBackRowProps) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <Text style={styles.backLabel}>← 返回</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backLabel: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
});
