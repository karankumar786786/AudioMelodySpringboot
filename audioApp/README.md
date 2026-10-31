# 🎵 One Melody Mobile — Lossless Multimedia & Gapless Audio Streaming App

[![React Native](https://img.shields.io/badge/React%20Native-0.88.0-61DAFB.svg?style=flat&logo=react)](https://reactnative.dev/)
[![React](https://img.shields.io/badge/React-19.3-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2058-000020.svg?style=flat&logo=expo)](https://expo.dev/)
[![Expo Router](https://img.shields.io/badge/Expo%20Router-v4-000020.svg?style=flat)](https://docs.expo.dev/router/introduction/)
[![Expo Audio](https://img.shields.io/badge/Expo%20Audio-v58-FF5722.svg?style=flat)](https://docs.expo.dev/versions/latest/sdk/audio/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3+-black.svg?style=flat&logo=bun)](https://bun.sh/)
[![Redux Toolkit](https://img.shields.io/badge/Redux%20Toolkit-2.13-764ABC.svg?style=flat&logo=redux)](https://redux-toolkit.js.org/)
[![TanStack Query](https://img.shields.io/badge/TanStack%20Query-v5-FF4154.svg?style=flat&logo=reactquery)](https://tanstack.com/query/latest)
[![Algolia](https://img.shields.io/badge/Algolia-InstantSearch-003DFF.svg?style=flat&logo=algolia)](https://www.algolia.com/)
[![Recombee](https://img.shields.io/badge/Recombee-AI%20Recommendations-00D4B2.svg?style=flat)](https://www.recombee.com/)

**One Melody Mobile** is a high-performance, cross-platform audio and multimedia streaming client built with **React Native 0.88**, **Expo SDK 58**, and **TypeScript**. Engineered for an uncompromising audiophile experience, it pairs an OLED-optimized pitch-black monochrome aesthetic with a custom **3-Player Native Rotation Pool** for true **0ms instant handover gapless playback**, multi-bitrate HLS adaptive audio, dynamic canvas video loops, synchronized lyrics, and comprehensive native lock screen controls on iOS and Android.

---

## ⚡ Core Engineering Highlights

### 1. 3-Player Native Rotation Pool (`AudioPlayerPool`)
- **Persistent 3-Slot Architecture**: Maintains three dedicated native `AudioPlayer` instances:
  - `active`: Currently rendering audio, handling OS focus and lock screen controls (uncapped forward buffer).
  - `standby1`: Preloads track $N+1$ with capped forward buffer (10s) paused at $t=0$.
  - `standby2`: Preloads track $N+2$ with capped forward buffer (10s) paused at $t=0$.
- **Instant 0ms Handover**: When a track finishes or the user presses skip, `promoteStandby()` executes an atomic slot rotation, unmutes the standby player, and triggers playback with **zero buffering latency**.
- **Buffer & Bandwidth Governor**: Standby slots are capped to a 10-second forward buffer to conserve mobile network data and memory, while active playback enjoys system-default unconstrained buffering.

### 2. Native Background Playback & Lock Screen Controls (`expo-audio`)
- **Android Foreground Service**: Seamlessly binds to `expo.modules.audio.service.AudioControlsService` via `androidx.media3.session.MediaSessionService` with `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission.
- **Lock Screen & Notification Center**: Live metadata updates (album art, artist, track title) and interactive scrub controls (play/pause, skip next/previous, seek $\pm10\text{s}$).
- **Environment-Aware Sandboxing (`safeSetActiveForLockScreen`)**: Gracefully detects the **Expo Go** environment vs. native **Development / Standalone Builds** to prevent Android service binding errors in development while providing full foreground services in release builds.

### 3. Tri-Mode Fullscreen Player Stage
- **Canvas Mode**: Smooth 9:16 vertical looping MP4 video canvas synced to audio.
- **Artwork Mode**: High-resolution cover art with ambient color extraction, dynamic blurred gradient mesh, and subtle breathing animations.
- **Video Mode**: Dedicated modal for full-length landscape/portrait music videos with synchronized playback handover.
- **Horizontal Slide Gestures**: Swipe between Canvas, Artwork, and Video modes with system back gesture preservation.

### 4. Docked Floating MiniPlayer & Material 3 Native Tabs
- **Zero-Overlap Geometry**: Specifically tuned for Android's Material 3 `NavigationBar` (**80dp height** + system navigation insets) and iOS `UITabBar` (**49pt height** + home indicator insets), ensuring the floating MiniPlayer docks cleanly without overlapping tab items.
- **OLED Dark Monochrome Design**: Styled with pure `#000000` background, custom tab tinting, and disabled indicator pills for a refined look matching Spotify and Apple Music.

### 5. Live Wikipedia / MediaWiki Integration
- Dynamically queries Wikipedia's REST API (`/api/rest_v1/page/summary/${artist}`) on the fly to render rich "About the Artist" biographies and editorial hero portraits.
- Sends Wikimedia-compliant `User-Agent` headers in `expo-image` and `fetch()` to eliminate HTTP 403 Forbidden blocking on Android.

### 6. Edge Search & Recommendation Intelligence
- **Algolia Edge Search**: Lightning-fast, typo-tolerant search across songs, artists, and playlists.
- **Recombee AI Recommendations**: Real-time user taste profiling, dynamic radio seed generation, and algorithmic discovery feeds.

---

## 🏛️ Architecture & Folder Structure

```
audioApp/
├── src/
│   ├── app/                              # Expo Router v4 File-Based Routing
│   │   ├── (authenticated)/              # Protected Route Group (Requires JWT)
│   │   │   ├── (tabs)/                   # NativeTabs Layout & Main Screens
│   │   │   │   ├── _layout.tsx           # Material 3 NativeTabs & Floating MiniPlayer Dock
│   │   │   │   ├── home.tsx              # Dynamic Recommendation Feed & Carousels
│   │   │   │   ├── search.tsx            # Algolia InstantSearch Integration
│   │   │   │   ├── favourites.tsx        # User Liked Songs & Quick Play
│   │   │   │   ├── userplaylists.tsx     # Custom User Playlists
│   │   │   │   └── profile.tsx           # User Account & Audio Preferences
│   │   │   ├── song/[id].tsx             # Fullscreen Player (Canvas / Artwork / Video / Lyrics)
│   │   │   ├── artist/[id].tsx           # Artist Profile, Top Songs & Discography
│   │   │   ├── playlist/[id].tsx         # Curated Editorial Playlists
│   │   │   ├── userplaylist/[id].tsx     # User Playlist Manager
│   │   │   └── lyrics/[id].tsx           # Dedicated Auto-Scrolling Synced Lyrics
│   │   ├── _layout.tsx                   # Root Stack, Auth Guard & SplashScreen Controller
│   │   ├── login.tsx                     # User Authentication
│   │   ├── register.tsx                  # New Account Registration
│   │   └── verifyotp.tsx                 # Email OTP Verification
│   ├── components/                       # Reusable UI & Player Components
│   │   ├── common/                       # ErrorBoundary, Skeletons, Gradient Headers
│   │   └── player/                       # MiniPlayer, FullVideoPlayerModal, CanvasPlayer
│   ├── hooks/                            # Custom React Hooks
│   │   ├── useSongInfo.ts                # Wikipedia Biography & Photo Hook
│   │   └── useDebounce.ts                # Search Input Debouncer
│   ├── service/                          # Core Audio Engine & API Services
│   │   ├── audioPlayerPool.ts            # 3-Player Rotation & 0ms Handover Pool
│   │   ├── audioPlayerService.ts         # Playback, Queue & Lock Screen Orchestrator
│   │   ├── songInfoService.ts            # Wikipedia REST API Client
│   │   ├── homeService.ts                # Spring Boot Catalog Client
│   │   ├── artistService.ts              # Artist APIs & Follow Status
│   │   └── playlistService.ts            # Playlist CRUD Services
│   ├── storage/                          # Local Offline Storage
│   │   └── PlayerStore.ts                # AsyncStorage Last Song & Playback Position Persistence
│   ├── store/                            # Redux Toolkit State Management
│   │   ├── playerSlice.ts                # Playback State, Current Track, Sleep Timer
│   │   ├── queueSlice.ts                 # Playback Queue, History & Standby Tracking
│   │   ├── authSlice.ts                  # Access & Refresh Tokens
│   │   └── userSlice.ts                  # User Profile & Follows
│   ├── types/                            # TypeScript Domain Models & Interfaces
│   └── utils/                            # Utilities (Audio Mode, Color Palette, Queue Logger)
├── app.json                              # Expo Configuration & Native Config Plugins
├── package.json                          # Dependencies & NPM Scripts
└── tsconfig.json                         # TypeScript Compiler Configuration
```

---

## ⚙️ Environment Variables

Create a `.env` file in the `audioApp/` directory:

```env
# Spring Boot Core Engine Gateway
EXPO_PUBLIC_API_URL=https://api.one-org.me

# Algolia Edge Search
EXPO_PUBLIC_ALGOLIA_APP_ID=your_algolia_app_id
EXPO_PUBLIC_ALGOLIA_SEARCH_KEY=your_algolia_search_key
EXPO_PUBLIC_ALGOLIA_INDEX_NAME=one_melody_songs

# Recombee AI Recommendations
EXPO_PUBLIC_RECOMBEE_DATABASE_ID=your_recombee_db_id
EXPO_PUBLIC_RECOMBEE_PUBLIC_TOKEN=your_recombee_public_token
EXPO_PUBLIC_RECOMBEE_REGION=ap-se
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `20.x+`
- **Bun**: `1.3+` (recommended) or `npm` / `yarn`
- **Expo CLI**: bundled via `bunx expo`
- **Android Studio** (for Android emulator / native builds) or **Xcode** (for iOS simulator)

### 1. Install Dependencies
```bash
cd audioApp
bun install
```

### 2. Run in Development Mode (Expo Go)
```bash
bun expo start
```
- Press `a` to launch in the Android emulator.
- Press `i` to launch in the iOS simulator.
- Scan the displayed QR code with the **Expo Go** app on your physical device.

> **Note on Expo Go**: Expo Go runs in a sandboxed container without custom Android foreground services. The app automatically detects Expo Go and runs standard audio playback. For native lock screen controls and persistent background playback on Android, run a Development Build below.

---

## 📱 Native Development Builds

To run full native background services, lock screen controls, and Android `MediaSessionService`:

### Android Development Build
```bash
# 1. Prebuild native Android directory
bunx expo prebuild --clean

# 2. Build and launch on connected Android device / emulator
bunx expo run:android
```

### iOS Development Build
```bash
# 1. Prebuild native iOS directory
bunx expo prebuild --clean

# 2. Build and launch on iOS simulator / connected iPhone
bunx expo run:ios
```

---

## 📦 Production Builds (EAS Build)

To generate release-ready Android APK/AAB or iOS IPA bundles:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to your Expo account
eas login

# Build standalone Android App Bundle (AAB / APK)
eas build --platform android --profile production

# Build standalone iOS IPA
eas build --platform ios --profile production
```

---

## 📜 License
Part of the **One Melody** distributed streaming platform. Built with ❤️ by [Karan Kumar](https://github.com/karankumar786786). Distributed under the MIT License.
