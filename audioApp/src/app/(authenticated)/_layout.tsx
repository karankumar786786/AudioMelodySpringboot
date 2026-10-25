import { Stack } from "expo-router";

export default function AuthenticatedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: "#121212" },
        headerTintColor: "#FFFFFF",
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: "700",
          color: "#FFFFFF",
        },
      }}
    >
      {/* Bottom Tabs */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Dynamic Detail Screens (pushed on top of tabs) */}
      <Stack.Screen
        name="artist/[id]"
        options={{
          headerShown: true,
          title: "Artist",
        }}
      />
      <Stack.Screen
        name="playlist/[id]"
        options={{
          headerShown: true,
          title: "Playlist",
        }}
      />
      <Stack.Screen
        name="userplaylist/[id]"
        options={{
          headerShown: true,
          title: "My Playlist",
        }}
      />
      <Stack.Screen
        name="song/[id]"
        options={{
          headerShown: true,
          title: "Now Playing",
        }}
      />
    </Stack>
  );
}