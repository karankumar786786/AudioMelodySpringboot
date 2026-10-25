import { NativeTabs } from "expo-router/native-tabs";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <NativeTabs
      blurEffect="systemChromeMaterialDark"
      tintColor="#208AEF"
      iconColor={{
        default: "#8E8E93",
        selected: "#208AEF",
      }}
      labelStyle={{
        default: {
          color: "#8E8E93",
          fontSize: 11,
          fontWeight: "600",
        },
        selected: {
          color: "#208AEF",
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
  );
}

