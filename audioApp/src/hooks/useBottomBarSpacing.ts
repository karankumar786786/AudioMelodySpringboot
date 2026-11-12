import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { AppState } from "@/store/hook";

const MINI_PLAYER_HEIGHT = 70;
const DEFAULT_GAP = 8;

interface UseBottomBarSpacingOptions {
  /**
   * Extra clearance between the end of content and the top of miniplayer/tabbar.
   * Defaults to 8px for a tight, elegant fit.
   */
  gap?: number;
  /**
   * If the last item or section in the scroll view already has a bottom margin (e.g. `marginBottom: 28`),
   * specify it here so it is subtracted from paddingBottom to avoid double spacing.
   */
  hasMarginBottom?: number;
}

export function useBottomBarSpacing(options?: UseBottomBarSpacingOptions) {
  const insets = useSafeAreaInsets();
  const currentSong = useSelector((state: AppState) => state.player.currentSong);

  // Exact NativeTabs height matching TabLayout in (tabs)/_layout.tsx
  const tabHeight = Platform.OS === "ios" ? 49 + insets.bottom : 80 + insets.bottom;
  const hasMiniPlayer = Boolean(currentSong);
  const miniPlayerHeight = hasMiniPlayer ? MINI_PLAYER_HEIGHT : 0;

  const gap = options?.gap ?? DEFAULT_GAP;
  const existingMargin = options?.hasMarginBottom ?? 0;

  // Exact padding needed so when scrolled to bottom:
  // (existingMargin + paddingBottom) = tabHeight + miniPlayerHeight + gap
  const bottomSpace = Math.max(
    insets.bottom,
    tabHeight + miniPlayerHeight + gap - existingMargin
  );

  return {
    bottomSpace,
    tabHeight,
    hasMiniPlayer,
    insets,
  };
}

