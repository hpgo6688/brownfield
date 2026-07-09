import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { OrderNavigationProvider } from './OrderNavigationContext';
import type { OrderRoute } from './types';

const PUSH_DURATION_MS = 300;
const POP_DURATION_MS = 280;

type OrderPageStackProps = {
  renderRoute: (route: OrderRoute) => ReactNode;
};

export function OrderPageStack({ renderRoute }: OrderPageStackProps) {
  const { width } = useWindowDimensions();
  const [stack, setStack] = useState<OrderRoute[]>([{ name: 'OrderList' }]);
  const translateX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  const topIndex = stack.length - 1;
  const currentRoute = stack[topIndex] ?? { name: 'OrderList' as const };
  const underRoute = topIndex > 0 ? stack[topIndex - 1] : null;
  const isOverlay = underRoute !== null;

  const navigate = useCallback(
    (route: Exclude<OrderRoute, { name: 'OrderList' }>) => {
      if (isAnimating.current) {
        return;
      }
      isAnimating.current = true;
      translateX.setValue(width);
      setStack(prev => [...prev, route]);
      Animated.timing(translateX, {
        toValue: 0,
        duration: PUSH_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        isAnimating.current = false;
      });
    },
    [translateX, width],
  );

  const goBack = useCallback(() => {
    if (isAnimating.current || stack.length <= 1) {
      return;
    }
    isAnimating.current = true;
    Animated.timing(translateX, {
      toValue: width,
      duration: POP_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isAnimating.current = false;
        return;
      }
      setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
      translateX.setValue(0);
      isAnimating.current = false;
    });
  }, [stack.length, translateX, width]);

  const navigation = useRef({ navigate, goBack });
  navigation.current = { navigate, goBack };

  return (
    <OrderNavigationProvider value={navigation.current}>
      <View style={styles.stack}>
        {/* Invisible flex child keeps stack height in the flex tree. */}
        <View style={styles.layoutGuide} />
        {underRoute ? (
          <View style={styles.layer} pointerEvents="none">
            {renderRoute(underRoute)}
          </View>
        ) : null}
        <Animated.View
          style={[
            styles.layer,
            isOverlay ? styles.overlay : null,
            isOverlay ? { transform: [{ translateX }] } : null,
          ]}>
          {renderRoute(currentRoute)}
        </Animated.View>
      </View>
    </OrderNavigationProvider>
  );
}

const styles = StyleSheet.create({
  stack: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  layoutGuide: {
    flex: 1,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
  },
  overlay: {
    shadowColor: '#0F172A',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
});
