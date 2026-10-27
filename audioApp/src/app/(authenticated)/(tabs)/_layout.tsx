
import { View, StyleSheet, Platform } from "react-native";
import { NativeTabs } from "expo-router/native-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MiniPlayer } from "@/components";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabHeight = Platform.OS === "ios" ? 49 + insets.bottom : 56 + insets.bottom;

  return (
    <View style={styles.container}>
      <NativeTabs
        blurEffect="systemChromeMaterialDark"
        tintColor="#FFFFFF"
        iconColor={{
          default: "#8E8E93",
          selected: "#FFFFFF",
        }}
        labelStyle={{
          default: {
            color: "#8E8E93",
            fontSize: 11,
            fontWeight: "600",
          },
          selected: {
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: "600",
          },
        }}
      >
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Icon
            sf={{ default: "house", selected: "house.fill" }}
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="home" />}
          />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="search">
          <NativeTabs.Trigger.Icon
            sf="magnifyingglass"
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="search" />}
          />
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="favourites">
          <NativeTabs.Trigger.Icon
            sf={{ default: "heart", selected: "heart.fill" }}
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="heart" />}
          />
          <NativeTabs.Trigger.Label>Favourites</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="userplaylists">
          <NativeTabs.Trigger.Icon
            sf="music.note.list"
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="musical-notes" />}
          />
          <NativeTabs.Trigger.Label>Playlists</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon
            sf={{ default: "person", selected: "person.fill" }}
            src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="person" />}
          />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>

      {/* Floating persistent MiniPlayer docked above the tab bar */}
      <View
        pointerEvents="box-none"
        style={[styles.miniPlayerWrapper, { bottom: tabHeight }]}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  miniPlayerWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 999,
  },
});

