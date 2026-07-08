import { StyleSheet, Text, View } from 'react-native';
import { RemoteScreenShell } from '../remote/RemoteScreenShell';

const PROMOS = [
  { title: '夏日满减', desc: '满 199 减 30', tag: '进行中' },
  { title: '新客礼包', desc: '首单立减 20 元', tag: '限时' },
  { title: '会员日', desc: '积分双倍 · 包邮', tag: '预告' },
];

export default function PromoScreen() {
  return (
    <RemoteScreenShell>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.badge}>OTA · 远程 Bundle</Text>
          <Text style={styles.title}>活动</Text>
          <Text style={styles.subtitle}>
            ota_promo bundle · 来自 bundle-server 的 split bundle，与 Metro dev 隔离
          </Text>
        </View>

        <View style={styles.card}>
          {PROMOS.map((promo, index) => (
            <View key={promo.title}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View>
                  <Text style={styles.promoTitle}>{promo.title}</Text>
                  <Text style={styles.promoDesc}>{promo.desc}</Text>
                </View>
                <Text style={styles.promoTag}>{promo.tag}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </RemoteScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  hero: {
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    marginBottom: 16,
  },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  promoDesc: {
    fontSize: 14,
    color: '#64748B',
  },
  promoTag: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginLeft: 16,
  },
});
