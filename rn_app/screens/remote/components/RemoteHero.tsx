import { StyleSheet, Text, View } from 'react-native';

type RemoteHeroProps = {
  badge: string;
  badgeColor: string;
  heroBackground: string;
  title: string;
  subtitle: string;
  /** When false, title is omitted (shown in React Navigation header instead). Default true. */
  showTitle?: boolean;
};

export function RemoteHero({
  badge,
  badgeColor,
  heroBackground,
  title,
  subtitle,
  showTitle = true,
}: RemoteHeroProps) {
  return (
    <View style={[styles.hero, { backgroundColor: heroBackground }]}>
      <Text style={[styles.badge, { color: badgeColor }]}>{badge}</Text>
      {showTitle ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
    marginBottom: 16,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
