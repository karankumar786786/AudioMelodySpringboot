import React, { useEffect, useRef, useState, memo, useCallback } from "react";
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
  ScrollView,
  AppState,
  AppStateStatus,
} from "react-native";

export interface MarqueeTextProps {
  children?: React.ReactNode;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Scrolling speed in pixels per second (default: 34) */
  speed?: number;
  /** Delay in milliseconds before scrolling starts (default: 1400) */
  delay?: number;
  /** Gap in pixels between repeated text instances in loop (default: 40) */
  gap?: number;
  /** When true, disables marquee animation and behaves like standard text */
  disabled?: boolean;
}

export const MarqueeText = memo(function MarqueeText({
  children,
  style,
  containerStyle,
  speed = 34,
  delay = 1400,
  gap = 40,
  disabled = false,
}: MarqueeTextProps) {
  const text = typeof children === "string" ? children : children ? String(children) : "";

  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;

  // Reset measurements when text string changes
  useEffect(() => {
    setTextWidth(0);
    translateX.setValue(0);
  }, [text, translateX]);

  const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) {
      setContainerWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    }
  }, []);

  const handleTextLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w > 0) {
      setTextWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));
    }
  }, []);

  const shouldScroll = !disabled && containerWidth > 0 && textWidth > containerWidth + 4;

  useEffect(() => {
    if (!shouldScroll) {
      translateX.setValue(0);
      return;
    }

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let anim: Animated.CompositeAnimation | null = null;

    const scrollDistance = textWidth + gap;
    const duration = (scrollDistance / Math.max(10, speed)) * 1000;

    const runCycle = () => {
      if (!isMounted) return;
      translateX.setValue(0);

      timer = setTimeout(() => {
        if (!isMounted) return;

        anim = Animated.timing(translateX, {
          toValue: -scrollDistance,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        });

        anim.start(({ finished }) => {
          if (!isMounted) return;
          if (finished) {
            // Instantly snap to 0 (visually seamless as duplicate text has reached x=0)
            translateX.setValue(0);
            // Brief pause before scrolling again
            timer = setTimeout(() => {
              if (isMounted) runCycle();
            }, 1000);
          }
        });
      }, delay);
    };

    runCycle();

    // Re-trigger animation when app returns from background / lockscreen
    const appStateSub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active" && isMounted && shouldScroll) {
        if (timer) clearTimeout(timer);
        if (anim) anim.stop();
        runCycle();
      }
    });

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (anim) anim.stop();
      appStateSub.remove();
      translateX.setValue(0);
    };
  }, [shouldScroll, textWidth, containerWidth, gap, speed, delay, text, translateX]);

  if (!text) {
    return <View style={[styles.container, containerStyle]} />;
  }

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={handleContainerLayout}
    >
      {shouldScroll ? (
        <Animated.View
          style={[
            styles.scrollRow,
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
      ) : (
        <Text style={style} numberOfLines={1}>
          {text}
        </Text>
      )}

      {/* Invisible measurement layer: unconstrained horizontal ScrollView guarantees full single-line text measurement */}
      <View
        style={styles.measureContainer}
        pointerEvents="none"
        aria-hidden={true}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          bounces={false}
        >
          <Text
            onLayout={handleTextLayout}
            style={[style, styles.measureText]}
          >
            {text}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignSelf: "stretch",
    width: "100%",
    maxWidth: "100%",
  },
  scrollRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  noShrink: {
    flexShrink: 0,
  },
  measureContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0,
    zIndex: -1,
  },
  measureText: {
    flexShrink: 0,
  },
});
