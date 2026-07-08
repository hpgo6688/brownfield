import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { DynamicScreenShell } from './DynamicScreenShell';

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

export default function DynamicSettingsScreen() {
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [analytics, setAnalytics] = useState(false);

  return (
    <DynamicScreenShell>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Bundle</Text>
        <View style={styles.card}>
          <ToggleRow
            label="自动检查更新"
            value={autoUpdate}
            onValueChange={setAutoUpdate}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="匿名统计"
            value={analytics}
            onValueChange={setAnalytics}
          />
        </View>

        <Text style={styles.sectionTitle}>信息</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>加载模式</Text>
            <Text style={styles.value}>Manifest</Text>
          </View>
        </View>
      </View>
    </DynamicScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 16,
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
  label: {
    fontSize: 16,
  },
  value: {
    fontSize: 15,
    color: '#64748B',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginLeft: 16,
  },
});
