import { StyleSheet, Text, View } from 'react-native';

export type PromoItem = {
  title: string;
  desc: string;
  tag: string;
};

const PROMOS: PromoItem[] = [
  { title: '夏日满减', desc: '满 199 减 30', tag: '进行中' },
  { title: '新客礼包', desc: '首单立减 20 元', tag: '限时' },
  { title: '会员日', desc: '积分双倍 · 包邮', tag: '预告' },
];

type PromoListProps = {
  tagColor?: string;
};

export function PromoList({ tagColor = '#16A34A' }: PromoListProps) {
  return (
    <>
      {PROMOS.map((promo, index) => (
        <View key={promo.title}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.row}>
            <View>
              <Text style={styles.promoTitle}>{promo.title}</Text>
              <Text style={styles.promoDesc}>{promo.desc}</Text>
            </View>
            <Text style={[styles.promoTag, { color: tagColor }]}>{promo.tag}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
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
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginLeft: 16,
  },
});
