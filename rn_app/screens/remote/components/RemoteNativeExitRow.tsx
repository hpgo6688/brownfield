import { Pressable, StyleSheet, Text, View } from 'react-native';
import { popToNative } from '../../../src/features/nativeShell';

type RemoteNativeExitRowProps = {
  label?: string;
};

/** Root Remote screens: exit entire RN feature back to native shell menu. */
export function RemoteNativeExitRow({
  label = '← 菜单',
}: RemoteNativeExitRowProps) {
  return (
    <View style={styles.container}>
      <Pressable onPress={popToNative} hitSlop={8} style={styles.button}>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  button: {
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
  },
});
