import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useVideoPlayer, VideoView } from "expo-video";
import { useQueryClient } from "@tanstack/react-query";
import { searchService } from "@/service";
import { putFile, shortsService } from "@/service/shortsService";
import { PickedVideo, runUpload, UploadState, validatePick } from "@/service/shortUploadMachine";
import { Song } from "@/types";

const GUIDELINES_KEY = "shorts_guidelines_accepted_v1";

/** Post a short: pick or record a vertical video, add a caption and an optional song, upload. */
export default function ShortUploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [video, setVideo] = useState<PickedVideo | null>(null);
  const [caption, setCaption] = useState("");
  const [songQuery, setSongQuery] = useState("");
  const [songResults, setSongResults] = useState<Song[]>([]);
  const [song, setSong] = useState<Song | null>(null);
  const [state, setState] = useState<UploadState>({ step: "idle" });
  const cancelRef = useRef<(() => void) | null>(null);
  const busy = state.step === "checking" || state.step === "uploading" || state.step === "finalizing";

  const preview = useVideoPlayer(video ? { uri: video.uri } : null, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  // One-time content guidelines before the first post.
  useEffect(() => {
    AsyncStorage.getItem(GUIDELINES_KEY).then((v) => {
      if (v) return;
      Alert.alert(
        "Before you post",
        "Only post videos you made or have the right to share. No nudity, hate, violence or spam. Shorts that break these rules are removed and can get your account banned from posting.",
        [
          { text: "Not now", style: "cancel", onPress: () => router.back() },
          { text: "I agree", onPress: () => AsyncStorage.setItem(GUIDELINES_KEY, "1").catch(() => {}) },
        ],
      );
    });
  }, [router]);

  // Song search (debounced).
  useEffect(() => {
    const q = songQuery.trim();
    if (q.length < 2) {
      setSongResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchService
        .search(q)
        .then((r) => setSongResults((r.songs || []).slice(0, 6)))
        .catch(() => setSongResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [songQuery]);

  const pick = useCallback(async (fromCamera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["videos"],
      allowsEditing: true,
      videoMaxDuration: 60,
      quality: 1,
    };
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera access needed", "Allow camera access in Settings to record a short.");
        return;
      }
    }
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const picked: PickedVideo = {
      uri: a.uri,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      durationMs: a.duration,
      width: a.width,
      height: a.height,
      fileName: a.fileName,
    };
    const problem = validatePick(picked);
    if (problem) {
      Alert.alert("Can't use this video", problem);
      return;
    }
    setVideo(picked);
    setState({ step: "idle" });
  }, []);

  const upload = useCallback(async () => {
    if (!video) return;
    const final = await runUpload(
      video,
      { caption, songId: song?.id ?? null },
      {
        startUpload: shortsService.startUpload,
        putFile: (url, file, onProgress) => {
          const job = putFile(url, file, onProgress);
          cancelRef.current = job.cancel;
          return job.promise;
        },
        completeUpload: shortsService.completeUpload,
      },
      setState,
    );
    cancelRef.current = null;
    if (final.step === "done") {
      qc.invalidateQueries({ queryKey: ["shorts"] });
      Alert.alert("Uploaded", "Your short is processing and will appear in a minute or two.", [
        { text: "My shorts", onPress: () => router.replace("/(authenticated)/my-shorts" as any) },
        { text: "Done", onPress: () => router.back() },
      ]);
    }
  }, [video, caption, song, qc, router]);

  const portrait = video ? (video.height ?? 1) >= (video.width ?? 0) : true;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (busy) cancelRef.current?.();
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>New short</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {video ? (
          <View style={styles.previewBox}>
            <VideoView player={preview} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
            {!busy ? (
              <TouchableOpacity style={styles.change} onPress={() => setVideo(null)}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.pickRow}>
            <TouchableOpacity style={styles.pickButton} onPress={() => pick(false)} accessibilityRole="button">
              <Ionicons name="images-outline" size={28} color="#fff" />
              <Text style={styles.pickText}>Choose a video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pickButton} onPress={() => pick(true)} accessibilityRole="button">
              <Ionicons name="videocam-outline" size={28} color="#fff" />
              <Text style={styles.pickText}>Record</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.hint}>
          Vertical videos work best (9:16). Up to 60 seconds and 100 MB.
          {!portrait ? " This video is landscape and will be cropped." : ""}
        </Text>

        <Text style={styles.label}>Caption</Text>
        <TextInput
          value={caption}
          onChangeText={(t) => setCaption(t.slice(0, 300))}
          placeholder="Say something about your short"
          placeholderTextColor="#777"
          multiline
          editable={!busy}
          style={styles.input}
        />
        <Text style={styles.counter}>{caption.length}/300</Text>

        <Text style={styles.label}>Song (optional)</Text>
        {song ? (
          <View style={styles.songRow}>
            <Ionicons name="musical-note" size={16} color="#fff" />
            <Text style={styles.songText} numberOfLines={1}>
              {song.title} · {song.artistName}
            </Text>
            {!busy ? (
              <TouchableOpacity onPress={() => setSong(null)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            <TextInput
              value={songQuery}
              onChangeText={setSongQuery}
              placeholder="Search a song to link"
              placeholderTextColor="#777"
              editable={!busy}
              style={styles.input}
            />
            {songResults.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.result}
                onPress={() => {
                  setSong(s);
                  setSongQuery("");
                  setSongResults([]);
                }}
              >
                <Text style={styles.songText} numberOfLines={1}>
                  {s.title} · <Text style={{ color: "#999" }}>{s.artistName}</Text>
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {state.step === "error" ? <Text style={styles.error}>{state.message}</Text> : null}
        {state.step === "uploading" ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(state.progress * 100)}%` }]} />
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.post, (!video || busy) && styles.postDisabled]}
          disabled={!video || busy}
          onPress={upload}
          accessibilityRole="button"
          accessibilityLabel="Post short"
        >
          {busy ? <ActivityIndicator color="#000" /> : null}
          <Text style={styles.postText}>
            {state.step === "uploading"
              ? `Uploading ${Math.round(state.progress * 100)}%`
              : state.step === "finalizing"
                ? "Finishing…"
                : state.step === "error"
                  ? "Try again"
                  : "Post"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0d" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  title: { color: "#fff", fontSize: 17, fontWeight: "700" },
  body: { padding: 16, gap: 8 },
  previewBox: { alignSelf: "center", width: 180, aspectRatio: 9 / 16, borderRadius: 16, overflow: "hidden", backgroundColor: "#111" },
  change: { position: "absolute", bottom: 8, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  changeText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  pickRow: { flexDirection: "row", gap: 12 },
  pickButton: { flex: 1, height: 140, borderRadius: 16, borderWidth: 1, borderColor: "#2a2a2e", backgroundColor: "#151518", alignItems: "center", justifyContent: "center", gap: 8 },
  pickText: { color: "#fff", fontWeight: "600" },
  hint: { color: "#888", fontSize: 12, marginTop: 4 },
  label: { color: "#bbb", fontSize: 13, fontWeight: "600", marginTop: 16 },
  input: { color: "#fff", backgroundColor: "#151518", borderRadius: 12, borderWidth: 1, borderColor: "#2a2a2e", padding: 12, minHeight: 44 },
  counter: { color: "#666", fontSize: 11, alignSelf: "flex-end" },
  songRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#151518", borderRadius: 12, padding: 12 },
  songText: { color: "#fff", flex: 1 },
  remove: { color: "#aaa", fontWeight: "600" },
  result: { paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#2a2a2e" },
  error: { color: "#ff8a80", marginTop: 12 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: "#2a2a2e", marginTop: 16, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: "#fff" },
  post: { flexDirection: "row", gap: 8, marginTop: 24, height: 50, borderRadius: 999, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  postDisabled: { opacity: 0.4 },
  postText: { color: "#000", fontWeight: "800", fontSize: 16 },
});
