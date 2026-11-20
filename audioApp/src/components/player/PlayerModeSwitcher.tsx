import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { songStyles as styles } from "@/styles";
import type { StageMode } from "@/hooks/player/usePlayerStageModes";

export interface PlayerModeSwitcherProps {
  modes: Array<{ key: StageMode; label: string }>;
  activeMode: StageMode;
  onSelect: (mode: StageMode) => void;
}

/** Canvas / Artwork / Video pill. Hidden when only one mode is available. */
export function PlayerModeSwitcher({ modes, activeMode, onSelect }: PlayerModeSwitcherProps) {
  if (modes.length <= 1) return null;
  return (
    <View style={styles.modeSwitcherContainer}>
      <View style={styles.modeSwitcherPill}>
        {modes.map((m) => {
          const isActive = activeMode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[styles.modeOptionBtn, isActive && styles.modeOptionBtnActive]}
              onPress={() => onSelect(m.key)}
              activeOpacity={0.8}
            >
              <View style={styles.modeOptionContent}>
                {m.key === "video" ? (
                  <Ionicons
                    name="play"
                    size={10}
                    color={isActive ? "#000000" : "rgba(255, 255, 255, 0.75)"}
                    style={{ marginRight: 4 }}
                  />
                ) : null}
                <Text style={[styles.modeOptionText, isActive && styles.modeOptionTextActive]}>
                  {m.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
