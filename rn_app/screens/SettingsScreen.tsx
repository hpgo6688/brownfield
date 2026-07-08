import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { ScreenShell } from './ScreenShell';

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  return (
    <ScreenShell>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>通用</Text>
        <View style={styles.card}>
          <ToggleRow
            label="推送通知"
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
          <View style={styles.divider} />
          <ToggleRow
            label="深色模式"
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
          />
        </View>

        <Text style={styles.sectionTitle}>关于</Text>
        <View style={styles.card}>
          <InfoRow label="版本" value="1.0.0" />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
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
    fontSize: 17,
    color: '#888',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginLeft: 16,
  },
});
