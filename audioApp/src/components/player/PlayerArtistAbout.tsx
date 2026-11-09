import React, { memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SongInfoResult } from "@/service/songInfoService";
import { songStyles as styles } from "@/styles";

const WIKI_IMAGE_HEADERS = {
  "User-Agent":
    "OneMelodyAudioApp/1.0 (https://onemelody.com; support@onemelody.com)",
};

interface PlayerArtistAboutProps {
  artistName: string;
  songInfo?: SongInfoResult | null;
  isLoadingInfo?: boolean;
  artistFollowData?: {
    artistId?: string;
  } | null;
  artistImgAspectRatio: number;
  onOpenArtist: () => void;
  onOpenImageModal: () => void;
}

export const PlayerArtistAbout = memo(function PlayerArtistAbout({
  artistName,
  songInfo,
  isLoadingInfo,
  artistFollowData,
  artistImgAspectRatio,
  onOpenArtist,
  onOpenImageModal,
}: PlayerArtistAboutProps) {
  return (
    <View style={styles.artistSection}>
      <View style={styles.artistCard}>
        <View style={styles.artistCardHeader}>
          <Text style={styles.artistCardHeaderTitle}>About the Artist</Text>
        </View>

        {/* Artist Hero Banner - Displays full Wikipedia artist photo */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (songInfo?.artist?.image) {
              onOpenImageModal();
            } else {
              onOpenArtist();
            }
          }}
          style={[
            styles.artistHeroWrapper,
            { aspectRatio: artistImgAspectRatio },
          ]}
          accessibilityLabel={`About ${artistName}`}
        >
          {songInfo?.artist?.image ? (
            <Image
              source={{
                uri: songInfo.artist.image,
                headers: WIKI_IMAGE_HEADERS,
              }}
              style={styles.artistHeroImage}
              contentFit="cover"
              contentPosition="top center"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.artistHeroFallback}>
              <Text style={styles.artistHeroFallbackInitial}>
                {artistName?.charAt(0)?.toUpperCase() || "A"}
              </Text>
            </View>
          )}

          {/* Dark Gradient Overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.92)"]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Bottom Info on Hero */}
          <View style={styles.artistHeroBottomBar}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.8}
              onPress={onOpenArtist}
            >
              <Text style={styles.artistHeroName} numberOfLines={1}>
                {songInfo?.artist?.name || artistName}
              </Text>
              <View style={styles.artistHeroMetaRow}>
                <Text style={styles.artistHeroRole}>Artist</Text>
                {artistFollowData?.artistId ? (
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color="rgba(255, 255, 255, 0.6)"
                    style={{ marginLeft: 2 }}
                  />
                ) : null}
              </View>
            </TouchableOpacity>

            {songInfo?.artist?.image ? (
              <View style={styles.expandPill}>
                <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Artist Biography Description */}
        <View style={styles.artistBioContainer}>
          {songInfo?.artist?.description ? (
            <>
              <Text style={styles.artistBioText} numberOfLines={4}>
                {songInfo.artist.description}
              </Text>
              {songInfo.artist.source ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => Linking.openURL(songInfo.artist!.source!)}
                  style={styles.wikiLinkRow}
                >
                  <Text style={styles.wikiLinkText}>View on Wikipedia</Text>
                  <Ionicons name="open-outline" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </>
          ) : isLoadingInfo ? (
            <View style={styles.aboutLoadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.aboutLoadingText}>Loading artist story...</Text>
            </View>
          ) : (
            <Text style={styles.artistBioText}>
              Explore more releases and trending tracks from {artistName} on
              OneMelody.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});
