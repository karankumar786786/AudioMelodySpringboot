import { useState, useCallback } from "react";
import { View, ScrollView, Dimensions, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { GestureDetector } from "react-native-gesture-handler";
import { store } from "@/store/hook";
import { audioPlayerService } from "@/service/audioPlayerService";
import {
  QueueModal,
  FullVideoPlayerModal,
  PlayerSettingsModal,
  AddToPlaylistModal,
  DEFAULT_AUDIO_QUALITIES,
  PlayerTopBar,
  PlayerMetaRow,
  PlayerScrubber,
  PlayerControlsRow,
  PlayerLyricsPreviewCard,
  PlayerTrackAbout,
  PlayerArtistAbout,
} from "@/components";
import { PlayerBackdrop } from "@/components/player/PlayerBackdrop";
import { PlayerModeSwitcher } from "@/components/player/PlayerModeSwitcher";
import { PlayerArtworkStage } from "@/components/player/PlayerArtworkStage";
import { ArtistImageModal } from "@/components/player/ArtistImageModal";
import { SongScreenError, SongScreenLoading } from "@/components/player/SongScreenStatus";
import { useSongScreenData } from "@/hooks/player/useSongScreenData";
import { usePlayerStageModes } from "@/hooks/player/usePlayerStageModes";
import { useVideoQueueNavigation } from "@/hooks/player/useVideoQueueNavigation";
import { usePlayerScreenGestures } from "@/hooks/player/usePlayerScreenGestures";
import {
  useArtworkPlayingScale,
  useSongActions,
  useTransportActions,
} from "@/hooks/player/useSongActions";
import { configureAudioPriority } from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { songStyles as styles } from "@/styles";

export default function SongDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const safeAreaHeight = Math.max(560, (windowHeight || Dimensions.get("window").height) - insets.top);

  // Modal states
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [isArtistImageModalOpen, setIsArtistImageModalOpen] = useState(false);

  const data = useSongScreenData(id);
  const {
    currentSong,
    isPlaying,
    isLoading,
    duration,
    bufferedTime,
    repeatMode,
    isShuffle,
    queue,
    currentIndex,
    upcomingCount,
    fetchedSong,
    isFetching,
    isError,
    error,
    activeSong,
    targetSongId,
    isLiked,
    isDisliked,
    isSongInAnyPlaylist,
    songInfo,
    isSongInfoLoading,
    artistImgAspectRatio,
    posterUrl,
    dominantTheme,
    artistFollowData,
  } = data;

  const artworkPlayingScaleAnim = useArtworkPlayingScale(isPlaying);
  const stage = usePlayerStageModes(activeSong, mode);
  const transport = useTransportActions();
  const { heartScaleAnim, handleToggleLike, handleDislikeSong, handleShareSong } =
    useSongActions({ activeSong, fetchedSong, targetSongId, isLiked });

  const closeVideoToArtwork = () => {
    stage.setIsVideoModalOpen(false);
    stage.setViewMode("artwork");
  };

  const { handleVideoTrackEnd, handleVideoNextTrack, handleVideoPrevTrack } =
    useVideoQueueNavigation({ activeSong, queue, currentIndex, repeatMode, closeVideoToArtwork });

  const handleOpenArtist = () => {
    if (artistFollowData?.artistId) {
      router.push({
        pathname: "/(authenticated)/artist/[id]",
        params: {
          id: artistFollowData.artistId,
          name: activeSong?.artistName,
        },
      });
    }
  };

  const handleOpenAlbum = () => {
    if (activeSong?.album) {
      router.push(`/album/${encodeURIComponent(activeSong.album)}` as any);
    }
  };

  // Screen focus hook: ensure lock screen controls and audio priority remain solid
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(async () => {
        await configureAudioPriority();
        audioPlayerService.refreshLockScreen();
      }, 80);
      return () => {
        clearTimeout(timer);
      };
    }, [currentSong?.id])
  );

  const handleDismissPlayer = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(authenticated)/(tabs)/home");
    }
  };

  const handleVideoModalClose = (finalTimestamp: number) => {
    closeVideoToArtwork();
    router.setParams({ mode: "" });
    if (typeof finalTimestamp === "number" && finalTimestamp >= 0) {
      audioPlayerService.seek(finalTimestamp);
      audioPlayerService.resume();
    }
  };

  const { stagePanGesture, topBarGesture } = usePlayerScreenGestures({
    availableModes: stage.availableModes,
    effectiveViewMode: stage.effectiveViewMode,
    onNextMode: stage.handleNextMode,
    onPrevMode: stage.handlePrevMode,
    onDismiss: handleDismissPlayer,
  });

  if (isFetching && !activeSong) {
    return <SongScreenLoading />;
  }

  if (isError || !activeSong) {
    return <SongScreenError error={error} onBack={() => router.back()} />;
  }

  const effectiveDuration = duration > 0 ? duration : (activeSong.duration || 0);
  const { isVideoModalOpen, effectiveVideoUrl, effectiveViewMode } = stage;

  return (
    <View style={styles.root}>
      {/* 1 & 2. Ambient blurred backdrop, dominant-colour gradient and canvas video */}
      <PlayerBackdrop
        posterUrl={posterUrl}
        gradientColors={dominantTheme.gradientColors}
        canvas={
          stage.hasCanvas && activeSong.videoKey && effectiveViewMode === "canvas"
            ? {
                videoUrl: (activeSong as any)?.canvasVideoUrl,
                videoKey: activeSong.videoKey,
                isPlaying: isPlaying && !isVideoModalOpen,
              }
            : null
        }
      />

      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, styles.containerTransparent]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={true}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(36, insets.bottom + 24) },
          ]}
        >
          {/* Main Full-Screen Player: exactly 100% viewport height */}
          <View
            style={[
              styles.playerScreenSection,
              {
                minHeight: safeAreaHeight,
                paddingBottom: Math.max(28, insets.bottom + 12),
              },
            ]}
          >
            {/* Top Navigation Bar with Down-Swipe Gesture */}
            <PlayerTopBar
              album={activeSong.album}
              genre={activeSong.genre}
              upcomingCount={upcomingCount}
              gesture={topBarGesture}
              onDismiss={handleDismissPlayer}
              onOpenAlbum={handleOpenAlbum}
              onOpenSettings={() => {
                hapticFeedback.light();
                setIsSettingsOpen(true);
              }}
              onOpenQueue={() => {
                hapticFeedback.light();
                setIsQueueOpen(true);
              }}
            />

            {/* Center Stage: Canvas / Artwork with Slide Gestures between Modes */}
            <GestureDetector gesture={stagePanGesture}>
              <View style={styles.centerStage}>
                <PlayerModeSwitcher
                  modes={stage.availableModes}
                  activeMode={effectiveViewMode}
                  onSelect={stage.handleSelectMode}
                />
                <PlayerArtworkStage
                  visible={effectiveViewMode === "artwork"}
                  posterUrl={posterUrl}
                  scale={artworkPlayingScaleAnim}
                />
              </View>
            </GestureDetector>

            {/* Song Metadata & Primary Actions (Add to Playlist, Like) */}
            <PlayerMetaRow
              title={activeSong.title}
              artistName={activeSong.artistName}
              isLiked={isLiked}
              isSongInAnyPlaylist={isSongInAnyPlaylist}
              heartScaleAnim={heartScaleAnim}
              onOpenArtist={handleOpenArtist}
              onOpenAddToPlaylist={() => {
                hapticFeedback.light();
                setIsAddToPlaylistOpen(true);
              }}
              onToggleLike={handleToggleLike}
            />

            {/* Interactive Timeline / Scrubber (Isolated component, 0 re-renders on parent) */}
            <PlayerScrubber
              duration={effectiveDuration}
              bufferedTime={bufferedTime}
              onSeek={(targetSeconds) => audioPlayerService.seek(targetSeconds)}
            />

            {/* Main Playback Controls (Shuffle, Previous, Play/Pause, Next, Repeat) */}
            <PlayerControlsRow
              isPlaying={isPlaying}
              isLoading={isLoading}
              repeatMode={repeatMode}
              isShuffle={isShuffle}
              onTogglePlay={transport.handleTogglePlay}
              onNextTrack={transport.handleNextTrack}
              onPrevTrack={transport.handlePrevTrack}
              onToggleShuffle={transport.handleToggleShuffle}
              onToggleRepeat={transport.handleToggleRepeat}
            />
          </View>

          {/* Synchronized Lyrics Preview Card (Spotify-Style, isolated re-renders) */}
          <PlayerLyricsPreviewCard
            song={activeSong}
            dominantColor={dominantTheme?.dominantColor}
            onOpenFullLyrics={() => {
              hapticFeedback.light();
              if (activeSong?.id) {
                router.push({
                  pathname: "/(authenticated)/lyrics/[id]",
                  params: { id: activeSong.id },
                });
              }
            }}
          />

          {/* About the Track Section (Plays count, album/genre pills, story) */}
          <PlayerTrackAbout
            song={activeSong}
            songInfo={songInfo}
            isLoadingInfo={isSongInfoLoading}
            onOpenAlbum={handleOpenAlbum}
          />

          {/* About the Artist Section (Hero banner, Wikipedia bio, expand image) */}
          <PlayerArtistAbout
            artistName={activeSong.artistName}
            songInfo={songInfo}
            isLoadingInfo={isSongInfoLoading}
            artistFollowData={artistFollowData}
            artistImgAspectRatio={artistImgAspectRatio}
            onOpenArtist={handleOpenArtist}
            onOpenImageModal={() => setIsArtistImageModalOpen(true)}
          />
        </ScrollView>

        {/* Queue Modal */}
        <QueueModal
          visible={isQueueOpen}
          onClose={() => setIsQueueOpen(false)}
        />

        {/* Playback Settings & Secondary Options Modal (Quality, Speed, Timer, Share, Dislike) */}
        <PlayerSettingsModal
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          mode="audio"
          audioQualities={DEFAULT_AUDIO_QUALITIES}
          isDisliked={Boolean(isDisliked)}
          onDislike={handleDislikeSong}
          onShare={handleShareSong}
          onSpeedChange={(rate) => audioPlayerService.setPlaybackRate(rate)}
          onAudioQualityChange={(quality) => audioPlayerService.setAudioQuality(quality)}
        />

        {/* Full Video Modal */}
        {isVideoModalOpen && effectiveVideoUrl ? (
          <FullVideoPlayerModal
            visible={isVideoModalOpen}
            videoStreamUrl={effectiveVideoUrl}
            initialTime={store.getState().player.currentTime || 0}
            title={activeSong?.title || ""}
            artistName={activeSong?.artistName || ""}
            artworkUrl={posterUrl}
            onClose={handleVideoModalClose}
            onTrackEnd={handleVideoTrackEnd}
            onNextTrack={handleVideoNextTrack}
            onPrevTrack={handleVideoPrevTrack}
          />
        ) : null}

        {/* Full Artist Image Modal: View uncropped, full-resolution Wikipedia image */}
        <ArtistImageModal
          visible={isArtistImageModalOpen}
          onClose={() => setIsArtistImageModalOpen(false)}
          artistName={songInfo?.artist?.name || activeSong.artistName}
          imageUrl={songInfo?.artist?.image}
        />

        {/* Add To Playlist Modal */}
        <AddToPlaylistModal
          visible={isAddToPlaylistOpen}
          onClose={() => setIsAddToPlaylistOpen(false)}
          song={activeSong || { id: targetSongId || id, title: "Song" }}
        />
      </SafeAreaView>
    </View>
  );
}
