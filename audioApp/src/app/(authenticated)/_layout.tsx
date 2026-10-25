import { Stack } from "expo-router";

export default function AuthenticatedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: "#121212" },
        headerTintColor: "#FFFFFF",
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        headerBackTitle: "",
        headerTitleStyle: {
          fontWeight: "700",
          color: "#FFFFFF",
        },
      }}
    >
      {/* Bottom Tabs */}
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
          title: "",
          headerBackTitle: "",
        }}
      />

      {/* Dynamic Detail Screens (pushed on top of tabs) */}
      <Stack.Screen
        name="artist/[id]"
        options={{
          headerShown: false,
          title: "Artist",
        }}
      />
      <Stack.Screen
        name="playlist/[id]"
        options={{
          headerShown: false,
          title: "Playlist",
        }}
      />
      <Stack.Screen
        name="userplaylist/[id]"
        options={{
          headerShown: false,
          title: "My Playlist",
        }}
      />
      <Stack.Screen
        name="song/[id]"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
    </Stack>
  );
}