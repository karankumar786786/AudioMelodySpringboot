import { Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { songStyles as styles } from "@/styles";

/** Full-screen spinner while the song is being fetched. */
export function SongScreenLoading() {
  return (
    <SafeAreaView style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={styles.loadingText}>Loading track...</Text>
    </SafeAreaView>
  );
}

/** Full-screen "Song Not Found" state with a back button. */
export function SongScreenError({ error, onBack }: { error: unknown; onBack: () => void }) {
  return (
    <SafeAreaView style={styles.centerContainer}>
      <Ionicons name="alert-circle-outline" size={48} color="#FFFFFF" />
      <Text style={styles.errorTitle}>Song Not Found</Text>
      <Text style={styles.errorText}>
        {error instanceof Error ? error.message : "Unable to load song details"}
      </Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
