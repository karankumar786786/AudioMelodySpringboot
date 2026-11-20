import { usePanGesture } from "react-native-gesture-handler";
import type { StageMode, ViewMode } from "./usePlayerStageModes";

/**
 * Song screen gestures: horizontal swipe on the stage switches Canvas/Artwork/Video,
 * and a downward swipe on the top bar dismisses the player.
 */
export function usePlayerScreenGestures(params: {
  availableModes: Array<{ key: StageMode; label: string }>;
  effectiveViewMode: ViewMode;
  onNextMode: () => void;
  onPrevMode: () => void;
  onDismiss: () => void;
}) {
  const { availableModes, effectiveViewMode, onNextMode, onPrevMode, onDismiss } = params;

  const stagePanGesture = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-20, 20],
    onDeactivate: (e) => {
      const { translationX, translationY, velocityX } = e;
      if (
        Math.abs(translationX) > 35 &&
        Math.abs(translationX) > Math.abs(translationY) * 1.05
      ) {
        if (translationX < -35 || velocityX < -250) {
          onNextMode();
        } else if (translationX > 35 || velocityX > 250) {
          const modeIdx = availableModes.findIndex((m) => m.key === effectiveViewMode);
          if (modeIdx > 0 && effectiveViewMode !== "canvas") {
            onPrevMode();
          }
        }
      }
    },
  });

  const topBarGesture = usePanGesture({
    runOnJS: true,
    activeOffsetY: [0, 15],
    onDeactivate: (e) => {
      if (e.translationY > 35) {
        onDismiss();
      }
    },
  });

  return { stagePanGesture, topBarGesture };
}
