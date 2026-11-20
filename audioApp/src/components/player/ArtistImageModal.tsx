import { View, Text, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { songStyles as styles } from "@/styles";

const WIKI_IMAGE_HEADERS = {
  "User-Agent":
    "OneMelodyAudioApp/1.0 (https://onemelody.com; support@onemelody.com)",
};

export interface ArtistImageModalProps {
  visible: boolean;
  onClose: () => void;
  artistName: string;
  imageUrl?: string | null;
}

/** Full-screen, uncropped Wikipedia photo of the artist. */
export function ArtistImageModal({ visible, onClose, artistName, imageUrl }: ArtistImageModalProps) {
  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.fullImageModalRoot}>
        <View style={styles.fullImageModalHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fullImageModalTitle} numberOfLines={1}>
              {artistName}
            </Text>
            <Text style={styles.fullImageModalSubtitle}>Wikipedia Photo</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.fullImageModalCloseBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.fullImageModalContent}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl, headers: WIKI_IMAGE_HEADERS }}
              style={styles.fullImageModalImage}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
