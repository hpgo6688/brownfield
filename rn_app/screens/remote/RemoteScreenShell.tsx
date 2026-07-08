import type { ReactNode } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { OtaModeToggle } from '../../src/features/OtaModeToggle';

type RemoteScreenShellProps = {
  children: ReactNode;
};

export function RemoteScreenShell({ children }: RemoteScreenShellProps) {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={[styles.content, __DEV__ && styles.contentWithToggle]}>
          <OtaModeToggle />
          {children}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentWithToggle: {
    paddingTop: 40,
  },
});
