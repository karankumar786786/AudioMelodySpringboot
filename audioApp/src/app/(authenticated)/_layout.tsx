import { Stack } from "expo-router";

export default function AuthenticatedLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Bottom Tabs */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Dynamic Detail Screens (pushed on top of tabs) */}
      <Stack.Screen
        name="artist/[id]"
        options={{
          headerShown: true,
          title: "Artist",
          headerStyle: { backgroundColor: "#121212" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="playlist/[id]"
        options={{
          headerShown: true,
          title: "Playlist",
          headerStyle: { backgroundColor: "#121212" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="userplaylist/[id]"
        options={{
          headerShown: true,
          title: "My Playlist",
          headerStyle: { backgroundColor: "#121212" },
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="song/[id]"
        options={{
          headerShown: true,
          title: "Now Playing",
          headerStyle: { backgroundColor: "#121212" },
          headerTintColor: "#FFFFFF",
        }}
      />
    </Stack>
  );
}