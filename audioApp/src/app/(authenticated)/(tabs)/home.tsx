import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to Melody</Text>
      <Text style={styles.subtitle}>Stream your favorite songs & artists</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Explore Dynamic Routes</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/artist/1")}
        >
          <Text style={styles.cardTitle}>Sample Artist (ID: 1)</Text>
          <Text style={styles.cardSubtitle}>Navigate to /artist/1</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/playlist/1")}
        >
          <Text style={styles.cardTitle}>Sample Playlist (ID: 1)</Text>
          <Text style={styles.cardSubtitle}>Navigate to /playlist/1</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/userplaylist/1")}
        >
          <Text style={styles.cardTitle}>Sample User Playlist (ID: 1)</Text>
          <Text style={styles.cardSubtitle}>Navigate to /userplaylist/1</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/song/1")}
        >
          <Text style={styles.cardTitle}>Sample Song (ID: 1)</Text>
          <Text style={styles.cardSubtitle}>Navigate to /song/1</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#121212",
    minHeight: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#B3B3B3",
    marginBottom: 24,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1DB954",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#1E1E1E",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#888888",
  },
});
