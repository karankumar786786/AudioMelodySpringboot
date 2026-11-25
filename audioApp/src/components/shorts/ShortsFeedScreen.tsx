import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

type ViewToken = { index?: number | null; isViewable: boolean };
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { setAudioModeAsync } from "expo-audio";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import { audioPlayerService } from "@/service";
import {
  createViewTracker,
  ReportReason,
  Short,
  ShortSort,
  shortMediaUrl,
  shortsService,
} from "@/service/shortsService";
import { ShortsSource, useShortsFeed, useToggleShortLike } from "@/hooks/useShortsFeed";
import { ShortVideo } from "./ShortVideo";
import { configureAudioPriority, getImageUrl, hapticFeedback, normalizeSong } from "@/utils";

const SORTS: { key: ShortSort; label: string }[] = [
  { key: "foryou", label: "For you" },
  { key: "latest", label: "Latest" },
  { key: "popular", label: "Popular" },
];

const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: "SPAM", label: "Spam or misleading" },
  { key: "NUDITY", label: "Nudity or sexual content" },
  { key: "VIOLENCE", label: "Violence or dangerous acts" },
  { key: "HATE", label: "Hate or harassment" },
  { key: "COPYRIGHT", label: "Copyright" },
  { key: "OTHER", label: "Something else" },
];

interface Props {
  /** Defaults to the main feed. */
  songId?: string;
  /** Rendered inside the tab bar (no back button). */
  isTab?: boolean;
}

/**
 * Shorts: a full-screen vertical feed of standalone videos with their own audio. Only the
 * visible short plays; the next one is buffered. The main music player is paused while
 * this screen is focused, and Shorts never play in the background.
 */
export function ShortsFeedScreen({ songId, isTab = false }: Props) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const [sort, setSort] = useState<ShortSort>("foryou");
  const source: ShortsSource = songId ? { kind: "song", songId } : { kind: "feed", sort };
  const feed = useShortsFeed(source);
  const toggleLike = useToggleShortLike();
  const shorts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [progress, setProgress] = useState(0);
  const [heartFor, setHeartFor] = useState<string | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const views = useRef(createViewTracker()).current;

  // Item height: full screen, minus the tab bar when shown inside tabs.
  const itemHeight = windowHeight;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      setAppActive(s === "active");
      if (s !== "active") void views.flush();
    });
    return () => sub.remove();
  }, [views]);

  // Main player off while Shorts is open; foreground-only audio. Restored on leave.
  useEffect(() => {
    if (isFocused) {
      audioPlayerService.pause();
      setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        interruptionModeAndroid: "doNotMix",
        shouldPlayInBackground: false,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      }).catch(() => {});
    } else {
      void views.flush();
      configureAudioPriority(true)
        .catch(() => {})
        .finally(() => {
          if (audioPlayerService.currentSong) audioPlayerService.refreshLockScreen(true);
        });
    }
  }, [isFocused, views]);

  useEffect(() => {
    const t = setInterval(() => void views.flush(), 10_000);
    return () => {
      clearInterval(t);
      void views.flush();
    };
  }, [views]);

  // Reset to the top when the sort changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [sort]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index != null) {
      setActiveIndex(first.index);
      setPaused(false);
      setProgress(0);
    }
  }).current;

  const like = useCallback(
    (short: Short, forceLike = false) => {
      if (forceLike && short.liked) return;
      hapticFeedback.light();
      toggleLike.mutate({ short });
    },
    [toggleLike],
  );

  const onTap = useCallback(
    (short: Short) => {
      const now = Date.now();
      if (now - lastTap.current < 280) {
        // Double tap: like (never unlike) and show the heart.
        if (tapTimer.current) clearTimeout(tapTimer.current);
        lastTap.current = 0;
        like(short, true);
        setHeartFor(short.id);
        setTimeout(() => setHeartFor(null), 700);
        return;
      }
      lastTap.current = now;
      tapTimer.current = setTimeout(() => setPaused((p) => !p), 280);
    },
    [like],
  );

  const share = useCallback(async (short: Short) => {
    hapticFeedback.light();
    const songPart = short.song ? ` · ${short.song.title} by ${short.song.artistName}` : "";
    try {
      await Share.share({ message: `${short.caption || "Watch this short on One Melody"}${songPart}` });
    } catch {}
  }, []);

  const report = useCallback((short: Short) => {
    Alert.alert("Report this short", "Why are you reporting it?", [
      ...REPORT_REASONS.map((r) => ({
        text: r.label,
        onPress: async () => {
          try {
            await shortsService.report(short.id, r.key);
            Alert.alert("Thanks for telling us", "We'll review this short.");
          } catch {
            Alert.alert("Couldn't send the report", "Please try again.");
          }
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }, []);

  const playSong = useCallback(
    (short: Short) => {
      if (!short.song) return;
      hapticFeedback.medium();
      setPaused(true);
      const song = normalizeSong(short.song, "api");
      dispatch(playWithSimilarSongs(song, [song]));
      router.push(`/song/${short.song.id}` as any);
    },
    [dispatch, router],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Short; index: number }) => {
      const active = index === activeIndex && isFocused && appActive;
      return (
        <View style={{ height: itemHeight, width, backgroundColor: "#000" }}>
          {item.thumbnailKey ? (
            <Image source={{ uri: shortMediaUrl(item.thumbnailKey) }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <ShortVideo
            short={item}
            active={active}
            preload={index === activeIndex + 1}
            paused={paused}
            onProgress={active ? (pos, dur) => setProgress(dur > 0 ? pos / dur : 0) : undefined}
            onWatched={(ms) => views.record(item.id, ms)}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onTap(item)} accessibilityLabel="Play or pause; double tap to like" />

          {active && paused ? (
            <View pointerEvents="none" style={styles.centerIcon}>
              <Ionicons name="play" size={64} color="rgba(255,255,255,0.85)" />
            </View>
          ) : null}
          {heartFor === item.id ? (
            <View pointerEvents="none" style={styles.centerIcon}>
              <Ionicons name="heart" size={110} color="#ff3b5c" />
            </View>
          ) : null}

          <LinearGradient
            pointerEvents="none"
            colors={["transparent", "rgba(0,0,0,0.75)"]}
            style={[styles.bottomShade, { height: 260 + insets.bottom }]}
          />

          {/* Right rail */}
          <View style={[styles.rail, { bottom: 120 + insets.bottom }]}>
            <TouchableOpacity onPress={() => like(item)} style={styles.railButton} accessibilityRole="button" accessibilityLabel={item.liked ? "Unlike" : "Like"}>
              <Ionicons name={item.liked ? "heart" : "heart-outline"} size={32} color={item.liked ? "#ff3b5c" : "#fff"} />
              <Text style={styles.railText}>{item.likesCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => share(item)} style={styles.railButton} accessibilityRole="button" accessibilityLabel="Share">
              <Ionicons name="paper-plane-outline" size={28} color="#fff" />
              <Text style={styles.railText}>Share</Text>
            </TouchableOpacity>
            {!item.mine ? (
              <TouchableOpacity onPress={() => report(item)} style={styles.railButton} accessibilityRole="button" accessibilityLabel="Report">
                <Ionicons name="flag-outline" size={26} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Caption, owner and linked song */}
          <View style={[styles.meta, { bottom: 28 + insets.bottom }]}>
            <Text style={styles.owner}>
              {item.owner.type === "ADMIN" ? "One Melody" : `@${item.owner.userName || "listener"}`}
            </Text>
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={3}>
                {item.caption}
              </Text>
            ) : null}
            {item.song ? (
              <TouchableOpacity onPress={() => playSong(item)} style={styles.songChip} accessibilityRole="button" accessibilityLabel={`Play ${item.song.title}`}>
                {item.song.imageKey ? (
                  <Image source={{ uri: getImageUrl(item.song.imageKey, { width: 80, height: 80 }) }} style={styles.songArt} />
                ) : (
                  <Ionicons name="musical-note" size={16} color="#fff" />
                )}
                <Text style={styles.songText} numberOfLines={1}>
                  {item.song.title} · {item.song.artistName}
                </Text>
                <Ionicons name="play-circle" size={20} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>

          {active ? (
            <View style={[styles.progressTrack, { bottom: insets.bottom + 4 }]}>
              <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
            </View>
          ) : null}
        </View>
      );
    },
    [activeIndex, isFocused, appActive, itemHeight, width, paused, insets.bottom, heartFor, progress, onTap, like, share, report, playSong, views],
  );

  return (
    <View style={styles.root}>
      {feed.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : shorts.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="videocam-outline" size={48} color="#888" />
          <Text style={styles.emptyTitle}>{feed.isError ? "Couldn't load shorts" : "No shorts yet"}</Text>
          <Text style={styles.emptyText}>
            {feed.isError ? "Check your connection and try again." : "Be the first: post a short video."}
          </Text>
          <TouchableOpacity
            onPress={() => (feed.isError ? feed.refetch() : router.push("/(authenticated)/shorts-upload" as any))}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{feed.isError ? "Retry" : "Post a short"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={shorts}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={itemHeight}
          getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          windowSize={3}
          maxToRenderPerBatch={2}
          initialNumToRender={2}
          removeClippedSubviews
          onEndReachedThreshold={2}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => feed.refetch()}
        />
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 6 }]}>
        {!isTab ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close shorts">
            <Ionicons name="chevron-down" size={26} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} />
        )}
        {songId ? (
          <Text style={styles.topTitle}>Shorts with this song</Text>
        ) : (
          <View style={styles.sorts}>
            {SORTS.map((s) => (
              <TouchableOpacity key={s.key} onPress={() => setSort(s.key)} accessibilityRole="tab" accessibilityState={{ selected: sort === s.key }}>
                <Text style={[styles.sortText, sort === s.key && styles.sortActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity onPress={() => router.push("/(authenticated)/shorts-upload" as any)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Post a short">
          <Ionicons name="add-circle-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptyText: { color: "#aaa", fontSize: 14, textAlign: "center" },
  primary: { marginTop: 12, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  primaryText: { color: "#000", fontWeight: "700" },
  topBar: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  sorts: { flexDirection: "row", gap: 18 },
  sortText: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" },
  sortActive: { color: "#fff", fontWeight: "800" },
  centerIcon: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  bottomShade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  rail: { position: "absolute", right: 10, alignItems: "center", gap: 22 },
  railButton: { alignItems: "center", gap: 2 },
  railText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  meta: { position: "absolute", left: 14, right: 80, gap: 6 },
  owner: { color: "#fff", fontWeight: "800", fontSize: 15 },
  caption: { color: "#eee", fontSize: 14, lineHeight: 19 },
  songChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  songArt: { width: 20, height: 20, borderRadius: 4 },
  songText: { color: "#fff", fontSize: 13, fontWeight: "600", flexShrink: 1 },
  progressTrack: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  progressFill: { height: 2, backgroundColor: "#fff" },
});
