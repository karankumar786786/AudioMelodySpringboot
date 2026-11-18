import { View, Animated } from "react-native";
import { Image } from "expo-image";
import { songStyles as styles } from "@/styles";

export interface PlayerArtworkStageProps {
  visible: boolean;
  posterUrl?: string;
  scale: Animated.Value;
}

/** Centred 1:1 artwork that shrinks slightly while paused. Keeps its box when hidden. */
export function PlayerArtworkStage({ visible, posterUrl, scale }: PlayerArtworkStageProps) {
  return (
    <View style={styles.artworkStageBox} pointerEvents={visible ? "auto" : "none"}>
      {visible ? (
        <View style={styles.artworkShadowContainer}>
          <Animated.View style={[styles.artworkWrapper, { transform: [{ scale }] }]}>
            <Image
              source={{ uri: posterUrl }}
              style={styles.artworkImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory"
            />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}
