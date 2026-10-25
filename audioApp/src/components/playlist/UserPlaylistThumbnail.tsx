import React from "react";
import { View, Image, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { playlistService } from "@/service";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";

export interface UserPlaylistThumbnailProps {
  playlist: {
    id: string;
    coverImageKey?: string;
    name?: string;
  };
  /** Pre-loaded songs if already available (e.g., from the playlist details page) */
  songs?: Song[];
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders a square user playlist thumbnail that mirrors the cover-art logic
 * used on audioFrontend (left sidebar and playlist page):
 *   1. Custom cover (coverImageKey)        -> full cover image
 *   2. 4 or more songs, no custom cover    -> 2x2 mosaic from first 4 song arts
 *   3. 1-3 songs, no custom cover          -> first song's art
 *   4. Empty playlist, no custom cover     -> musical notes icon placeholder
 */
export function UserPlaylistThumbnail({
  playlist,
  songs: initialSongs,
  size = 50,
  borderRadius = 8,
  style,
}: UserPlaylistThumbnailProps) {
  // Only fetch songs when there is no custom cover and no songs passed in
  const needsSongs =
    !playlist.coverImageKey && (!initialSongs || initialSongs.length === 0);

  const { data: songsResponse } = useQuery({
    queryKey: ["user-playlist-songs-thumb", playlist.id],
    queryFn: () => playlistService.getUserPlaylistSongs(playlist.id, 0, 4),
    enabled: needsSongs,
    staleTime: 5 * 60 * 1000,
  });

  const songs: Song[] =
    initialSongs && initialSongs.length > 0
      ? initialSongs
      : songsResponse?.content || [];

  const targetDimension = Math.max(Math.round(size * 2), 120);
  const mosaicDimension = Math.max(Math.round(size), 80);

  const coverUrl = getImageUrl(playlist.coverImageKey, {
    width: targetDimension,
    height: targetDimension,
    quality: 90,
    aspectRatio: "1-1",
  });

  const mosaicImages = songs.slice(0, 4).map((s) =>
    getImageUrl(s.imageKey, {
      width: mosaicDimension,
      height: mosaicDimension,
      quality: 85,
      aspectRatio: "1-1",
    })
  );

  const showMosaic = !coverUrl && songs.length >= 4;
  const showSingle = !coverUrl && songs.length > 0 && songs.length < 4;
  const singleImg =
    showSingle && songs[0]
      ? getImageUrl(songs[0].imageKey, {
          width: targetDimension,
          height: targetDimension,
          quality: 90,
          aspectRatio: "1-1",
        })
      : null;

  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius,
    },
    style,
  ];

  // 1. Custom Cover Image
  if (coverUrl) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.imageFull}
          resizeMode="cover"
        />
      </View>
    );
  }

  // 2. 2x2 Mosaic (4 or more songs)
  if (showMosaic) {
    const renderCell = (imgUrl: string | undefined, idx: number) => (
      <View key={idx} style={styles.mosaicCell}>
        {imgUrl ? (
          <Image
            source={{ uri: imgUrl }}
            style={styles.imageFull}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mosaicCellFallback}>
            <Ionicons
              name="musical-notes"
              size={Math.max(size * 0.16, 10)}
              color="#666666"
            />
          </View>
        )}
      </View>
    );

    return (
      <View style={containerStyle}>
        <View style={styles.mosaicGrid}>
          <View style={styles.mosaicRow}>
            {renderCell(mosaicImages[0], 0)}
            {renderCell(mosaicImages[1], 1)}
          </View>
          <View style={styles.mosaicRow}>
            {renderCell(mosaicImages[2], 2)}
            {renderCell(mosaicImages[3], 3)}
          </View>
        </View>
      </View>
    );
  }

  // 3. Single Song Art (1 to 3 songs)
  if (showSingle && singleImg) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: singleImg }}
          style={styles.imageFull}
          resizeMode="cover"
        />
      </View>
    );
  }

  // 4. Fallback Placeholder
  return (
    <View style={[containerStyle, styles.emptyFallback]}>
      <Ionicons
        name="musical-notes"
        size={Math.max(size * 0.38, 16)}
        color="#777777"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  imageFull: {
    width: "100%",
    height: "100%",
  },
  mosaicGrid: {
    width: "100%",
    height: "100%",
    flexDirection: "column",
  },
  mosaicRow: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
  },
  mosaicCell: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#18181A",
  },
  mosaicCellFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#202024",
  },
  emptyFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E22",
  },
});
