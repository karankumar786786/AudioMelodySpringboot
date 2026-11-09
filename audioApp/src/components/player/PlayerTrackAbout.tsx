import React, { memo } from "react";
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Song, PlayerSong } from "@/types";
import { SongInfoResult } from "@/service/songInfoService";
import { songStyles as styles } from "@/styles";

interface PlayerTrackAboutProps {
  song: Song | PlayerSong;
  songInfo?: SongInfoResult | null;
  isLoadingInfo?: boolean;
  onOpenAlbum?: () => void;
}

export const PlayerTrackAbout = memo(function PlayerTrackAbout({
  song,
  songInfo,
  isLoadingInfo,
  onOpenAlbum,
}: PlayerTrackAboutProps) {
  const totalStreams = (song as any)?.totalStreams;

  return (
    <View style={styles.aboutSection}>
      <View style={styles.aboutCard}>
        {/* Header: Title and Streams Badge */}
        <View style={styles.aboutHeader}>
          <View style={styles.aboutTitleRow}>
            <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.aboutCardTitle}>About the Track</Text>
          </View>

          {totalStreams !== undefined && totalStreams !== null ? (
            <View style={styles.streamsBadge}>
              <Ionicons name="play" size={10} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.streamsBadgeText}>
                {Number(totalStreams).toLocaleString()} plays
              </Text>
            </View>
          ) : null}
        </View>

        {/* Track Name & Artist */}
        <View style={styles.aboutIdentityContainer}>
          <Text style={styles.aboutSongTitle} numberOfLines={2}>
            {song.title}
          </Text>
          <Text style={styles.aboutArtistName} numberOfLines={1}>
            {song.artistName}
          </Text>

          {/* Optional Album / Genre / Language Pills */}
          {(song.album || song.genre || (song as any).language) ? (
            <View style={styles.aboutPillsRow}>
              {song.album ? (
                <TouchableOpacity
                  style={styles.aboutPill}
                  activeOpacity={0.7}
                  onPress={onOpenAlbum}
                >
                  <Ionicons name="disc-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.aboutPillText} numberOfLines={1}>
                    {song.album}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {song.genre ? (
                <View style={styles.aboutPill}>
                  <Ionicons name="musical-notes-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.aboutPillText} numberOfLines={1}>
                    {song.genre}
                  </Text>
                </View>
              ) : null}

              {(song as any).language ? (
                <View style={styles.aboutPill}>
                  <Ionicons name="globe-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.aboutPillText}>
                    {String((song as any).language).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Wikipedia Story / Description */}
        <View style={styles.aboutBioContainer}>
          {songInfo?.song?.description ? (
            <>
              <Text style={styles.aboutBioText}>
                {songInfo.song.description}
              </Text>
              {songInfo.song.source ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => Linking.openURL(songInfo.song!.source!)}
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
              <Text style={styles.aboutLoadingText}>Loading track story...</Text>
            </View>
          ) : (
            <Text style={styles.aboutBioText}>
              {song.title} is a {song.genre || "featured"} release by {song.artistName}
              {song.album ? ` from the album "${song.album}"` : ""}.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
});
