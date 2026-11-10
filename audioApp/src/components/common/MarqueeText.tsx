import React, { useEffect, useRef, useState, memo } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  StyleProp,
  TextStyle,
  ViewStyle,
  LayoutChangeEvent,
} from "react-native";

export interface MarqueeTextProps {
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Scrolling speed in pixels per second (default: 32) */
  speed?: number;
  /** Delay in milliseconds before scrolling starts (default: 2000) */
  delay?: number;
  /** Gap in pixels between repeated text instances in loop (default: 36) */
  gap?: number;
  /** When true, disables marquee animation and behaves like standard text */
  disabled?: boolean;
}

export const MarqueeText = memo(function MarqueeText({
  children,
  style,
  containerStyle,
  speed = 32,
  delay = 2000,
  gap = 36,
  disabled = false,
}: MarqueeTextProps) {
  const text = typeof children === "string" ? children : String(children || "");

  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;

  const shouldScroll = !disabled && containerWidth > 0 && textWidth > containerWidth + 2;

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== containerWidth) {
      setContainerWidth(w);
    }
  };

  const handleTextLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== textWidth) {
      setTextWidth(w);
    }
  };

  useEffect(() => {
    if (!shouldScroll) {
      translateX.setValue(0);
      return;
    }

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let animation: Animated.CompositeAnimation | null = null;

    const scrollDistance = textWidth + gap;
    const duration = Math.max(1500, (scrollDistance / Math.max(1, speed)) * 1000);

    const startAnimation = () => {
      if (!isMounted) return;
      translateX.setValue(0);

      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        animation = Animated.timing(translateX, {
          toValue: -scrollDistance,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        });

        animation.start(({ finished }) => {
          if (finished && isMounted) {
            startAnimation();
          }
        });
      }, delay);
    };

    startAnimation();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (animation) animation.stop();
      translateX.setValue(0);
    };
  }, [shouldScroll, textWidth, containerWidth, gap, speed, delay, text]);

  if (!shouldScroll) {
    return (
      <View
        style={[styles.container, containerStyle]}
        onLayout={handleContainerLayout}
      >
        <Text style={style} numberOfLines={1}>
          {text}
        </Text>
        {/* Hidden measurement layer */}
        <View style={styles.hiddenMeasure} pointerEvents="none">
          <Text
            onLayout={handleTextLayout}
            numberOfLines={1}
            style={[style, styles.measureText]}
          >
            {text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={handleContainerLayout}
    >
      <Animated.View
        style={[
          styles.row,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <Text style={[style, styles.noShrink]} numberOfLines={1}>
          {text}
        </Text>
        <View style={{ width: gap }} />
        <Text style={[style, styles.noShrink]} numberOfLines={1}>
          {text}
        </Text>
      </Animated.View>

      {/* Hidden measurement layer to keep track of dynamic changes */}
      <View style={styles.hiddenMeasure} pointerEvents="none">
        <Text
          onLayout={handleTextLayout}
          numberOfLines={1}
          style={[style, styles.measureText]}
        >
          {text}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  noShrink: {
    flexShrink: 0,
  },
  hiddenMeasure: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0,
    flexDirection: "row",
  },
  measureText: {
    flexShrink: 0,
  },
});

