import { StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from './ScreenShell';

function ListRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {value ? <Text style={styles.value}>{value}</Text> : null}
    </View>
  );
}

export default function ProfileScreen() {
  return (
    <ScreenShell>
      <View style={styles.content}>
        <View style={styles.card}>
          <ListRow label="用户名" />
          <View style={styles.divider} />
          <ListRow label="账号 ID" value="10001" />
        </View>

        <View style={styles.card}>
          <ListRow label="消息通知" />
          <View style={styles.divider} />
          <ListRow label="隐私与安全" />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontSize: 17,
  },
  value: {
    fontSize: 15,
    color: '#888',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginLeft: 16,
  },
});
