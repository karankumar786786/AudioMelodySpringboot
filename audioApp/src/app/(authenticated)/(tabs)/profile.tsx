import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, AppState, clearAuthToken } from "@/store";

export default function ProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const authToken = useSelector((state: AppState) => state.auth);
  const device = useSelector((state: AppState) => state.device);


  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Profile</Text>
      <Text style={styles.info}>Device ID: {device.deviceId || "Not loaded"}</Text>
      <Text style={styles.info} numberOfLines={1}>
        Token: {authToken.accessToken ? `${authToken.accessToken.substring(0, 20)}...` : "None"}
      </Text>

      <TouchableOpacity style={styles.logoutButton} >
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  info: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 8,
    textAlign: "center",
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: "#E91E63",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
