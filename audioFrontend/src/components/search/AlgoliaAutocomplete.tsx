"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { autocomplete } from "@algolia/autocomplete-js";
import { liteClient } from "algoliasearch/lite";
import "@algolia/autocomplete-theme-classic";
import "./autocomplete.css";

import { musicApi, type Song } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import {
  formatFollowerCount,
  formatStreamCount,
  mapToPlayerSong,
} from "@/lib/player-utils";
import { previewPlayer } from "@/lib/preview-player";
import { playerActions } from "@/store/player.store";
import { toast } from "sonner";

interface AlgoliaAutocompleteProps {
  container?: string | HTMLElement;
  placeholder?: string;
  onSongSelected?: (song: Song) => void;
  onArtistSelected?: (artistId: string) => void;
  onPlaylistSelected?: (playlistId: string, isUserPlaylist?: boolean) => void;
  className?: string;
}

interface WordSuggestion {
  label: string;
  type: "word" | "song" | "artist";
  matchedPrefix?: string;
}

const ALGOLIA_APP_ID =
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "NQKIDY69EZ";
const ALGOLIA_SEARCH_KEY =
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ||
  "d56f43f0df08191b3eea750c0f4d3cd0";
const ALGOLIA_INDEX_NAME =
  process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "one_melody_springboot";

/**
 * Extracts word-level and title-level completions from Algolia highlights and records.
 */
function extractWordSuggestions(query: string, hits: any[]): WordSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: WordSuggestion[] = [];
  const seen = new Set<string>();

  // 1. Extract exact matching word from Algolia's _highlightResult
  for (const hit of hits) {
    const highlights = [
      hit._highlightResult?.title?.value,
      hit._highlightResult?.name?.value,
      hit._highlightResult?.artistName?.value,
    ].filter(Boolean);

    for (const hl of highlights) {
      // Find <em>matched</em>rest_of_word
      const regex = /<em>([^<]+)<\/em>([\w'-]*)/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(hl)) !== null) {
        const fullWord = (m[1] + (m[2] || "")).trim();
        const lowerWord = fullWord.toLowerCase();
        if (lowerWord.length >= q.length && !seen.has(lowerWord)) {
          seen.add(lowerWord);
          results.push({
            label: fullWord,
            type: "word",
            matchedPrefix: m[1],
          });
        }
      }
    }
    if (results.length >= 2) break;
  }

  // 2. Add top matching song / artist titles
  for (const hit of hits) {
    const title = (hit.title || hit.name || "").trim();
    if (!title) continue;
    const lowerTitle = title.toLowerCase();
    if (!seen.has(lowerTitle)) {
      seen.add(lowerTitle);
      results.push({
        label: title,
        type: hit.type === "artist" ? "artist" : "song",
      });
    }
    if (results.length >= 4) break;
  }

  return results.slice(0, 4);
}

export function AlgoliaAutocomplete({
  container,
  placeholder = "Search for songs, artists, albums or playlists...",
  onSongSelected,
  onArtistSelected,
  onPlaylistSelected,
  className = "",
}: AlgoliaAutocompleteProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const activeCompletionRef = useRef<string>("");

  useEffect(() => {
    const targetContainer = container || rootRef.current || "#autocomplete";
    if (!targetContainer) return;

    const searchClient = liteClient(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);

    // Helpers to manage ghost text on the input element
    const getDomElements = () => {
      const containerEl =
        typeof targetContainer === "string"
          ? document.querySelector<HTMLElement>(targetContainer)
          : (targetContainer as HTMLElement);
      if (!containerEl)
        return { inputEl: null, wrapperEl: null, ghostEl: null, containerEl: null };

      const inputEl = containerEl.querySelector<HTMLInputElement>(".aa-Input");
      const wrapperEl = containerEl.querySelector<HTMLDivElement>(".aa-InputWrapper");
      let ghostEl = wrapperEl?.querySelector<HTMLDivElement>(".aa-InputGhost") || null;

      if (wrapperEl && !ghostEl) {
        ghostEl = document.createElement("div");
        ghostEl.className = "aa-InputGhost";
        ghostEl.setAttribute("aria-hidden", "true");
        if (inputEl) {
          wrapperEl.insertBefore(ghostEl, inputEl);
        } else {
          wrapperEl.appendChild(ghostEl);
        }
      }

      return { inputEl, wrapperEl, ghostEl, containerEl };
    };

    let searchApi: any = null;

    const updateGhostText = (typedQuery: string, bestPrediction: string) => {
      const { ghostEl } = getDomElements();
      if (!ghostEl) return;

      const trimmedTyped = typedQuery.trim();
      if (!trimmedTyped || !bestPrediction) {
        ghostEl.innerHTML = "";
        activeCompletionRef.current = "";
        return;
      }

      activeCompletionRef.current = bestPrediction;

      // Check if prediction starts with the typed query
      if (bestPrediction.toLowerCase().startsWith(trimmedTyped.toLowerCase())) {
        const remaining = bestPrediction.slice(trimmedTyped.length);
        if (remaining) {
          ghostEl.innerHTML = `<span class="aa-InputGhost-typed">${trimmedTyped}</span><span class="aa-InputGhost-completion">${remaining}</span><span class="aa-InputGhost-hint">Tab ⇥</span>`;
          return;
        }
      } else {
        // Typo match (e.g. 'dewa' -> 'Deewana')
        ghostEl.innerHTML = `<span class="aa-InputGhost-typed">${trimmedTyped}</span><span class="aa-InputGhost-completion"> (${bestPrediction})</span><span class="aa-InputGhost-hint">Tab ⇥</span>`;
        return;
      }

      ghostEl.innerHTML = "";
      activeCompletionRef.current = "";
    };

    const applyCompletion = (completionText: string) => {
      const clean = completionText.trim();
      if (!clean) return;

      const { inputEl } = getDomElements();
      if (!inputEl) return;

      // 1. Force value directly onto the DOM input element
      inputEl.value = clean;
      inputEl.focus();
      inputEl.setSelectionRange(clean.length, clean.length);

      // 2. Clear current ghost hint
      updateGhostText("", "");

      // 3. Dispatch native DOM input event so Algolia autocomplete syncs internal store
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));

      // 4. Update Algolia state, ensure panel open, and trigger search
      if (searchApi) {
        searchApi.setQuery(clean);
        searchApi.setIsOpen(true);
        searchApi.refresh();
      }

      // 5. Keep input firmly focused across next event loops / microtasks
      requestAnimationFrame(() => {
        inputEl.focus();
        inputEl.setSelectionRange(clean.length, clean.length);
      });
      setTimeout(() => {
        inputEl.focus();
        inputEl.setSelectionRange(clean.length, clean.length);
        if (searchApi) {
          searchApi.setIsOpen(true);
          searchApi.refresh();
        }
      }, 30);
    };

    const handlePlaySong = async (item: any) => {
      previewPlayer.stopPreview(true);
      let songToPlay: Song = {
        id: item.objectID,
        title: item.title,
        artistName: item.artistName || item.artist || "Unknown Artist",
        album: item.album || null,
        genre: item.genre || null,
        language: item.language || "",
        lrclibId: item.lrclibId || "",
        imageKey: item.imageKey || "",
        songKey: item.songKey || "",
        duration: Number(item.duration || 0),
        status: "ACTIVE",
        totalStreams: Number(item.totalStreams || 0),
        createdAt: "",
      };

      if (!songToPlay.songKey && songToPlay.id) {
        try {
          const res = await musicApi.songs.getById(songToPlay.id);
          if (res?.data) {
            songToPlay = { ...songToPlay, ...res.data };
          }
        } catch (err) {
          console.warn("Failed to load full song audio details:", err);
        }
      }

      if (onSongSelected) {
        onSongSelected(songToPlay);
      } else {
        playerActions.playWithRadio(mapToPlayerSong(songToPlay));
        toast.success("Playing Song Radio", {
          description: `Starting infinite radio for "${songToPlay.title}"...`,
        });
        playerActions.stageSearchPlay(songToPlay.id);
      }
    };

    const handleArtistClick = (artistId: string) => {
      if (onArtistSelected) {
        onArtistSelected(artistId);
      } else {
        router.push(`/artists/${artistId}`);
      }
    };

    const handlePlaylistClick = (playlistId: string, isUserPlaylist: boolean) => {
      if (onPlaylistSelected) {
        onPlaylistSelected(playlistId, isUserPlaylist);
      } else {
        router.push(
          isUserPlaylist ? `/my-playlists/${playlistId}` : `/playlists/${playlistId}`
        );
      }
    };

    const search = autocomplete<any>({
      container: targetContainer,
      placeholder,
      openOnFocus: false,
      autoFocus: false,
      onSubmit({ state }: any) {
        const { inputEl } = getDomElements();
        inputEl?.focus();
        if (searchApi) {
          searchApi.setIsOpen(true);
          searchApi.refresh();
        }
      },
      onStateChange({ state }) {
        if (!state.query || !state.query.trim()) {
          updateGhostText("", "");
        }
      },
      getSources({ query }) {
        if (!query || !query.trim()) {
          updateGhostText("", "");
          return [];
        }

        const trimmed = query.trim();

        return [
          // 0. Word & Query Completions (Predictive typing)
          {
            sourceId: "suggestions",
            getItemInputValue({ item }: any) {
              return item.label;
            },
            getItems() {
              return searchClient
                .search([
                  {
                    indexName: ALGOLIA_INDEX_NAME,
                    params: {
                      query: trimmed,
                      hitsPerPage: 8,
                    },
                  },
                ])
                .then(({ results }: any) => {
                  const hits = results[0]?.hits || [];
                  const suggestions = extractWordSuggestions(trimmed, hits);
                  if (suggestions.length > 0) {
                    updateGhostText(trimmed, suggestions[0].label);
                  } else {
                    updateGhostText("", "");
                  }
                  return suggestions;
                });
            },
            getItemUrl() {
              return undefined;
            },
            templates: {
              header({ html }: any) {
                return html`<div class="aa-SourceHeaderTitle">Word & Query Completions</div>`;
              },
              item({ item, html }: any) {
                const badgeText = item.type === "word" ? "Word" : item.type;
                return html`
                  <div class="aa-suggestion-item" data-suggestion="${item.label}">
                    <div class="aa-suggestion-left">
                      <svg class="aa-suggestion-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <span class="aa-suggestion-query">${item.label}</span>
                    </div>
                    <div class="aa-suggestion-action" title="Complete into search input (Tab)">
                      <span class="aa-suggestion-type">${badgeText}</span>
                      <svg class="aa-suggestion-arrow" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="7" y1="17" x2="17" y2="7"></line>
                        <polyline points="7 7 17 7 17 17"></polyline>
                      </svg>
                    </div>
                  </div>
                `;
              },
            },
            onSelect({ item }: any) {
              applyCompletion(item.label);
            },
          },

          // 1. Songs Source
          {
            sourceId: "songs",
            getItems() {
              return searchClient
                .search([
                  {
                    indexName: ALGOLIA_INDEX_NAME,
                    params: {
                      query: trimmed,
                      hitsPerPage: 5,
                      facetFilters: ["type:song"],
                    },
                  },
                ])
                .then(({ results }: any) => results[0]?.hits || []);
            },
            getItemUrl() {
              return undefined;
            },
            templates: {
              header({ html }: any) {
                return html`<div class="aa-SourceHeaderTitle">Songs</div>`;
              },
              item({ item, html }: any) {
                const imgUrl = item.imageKey
                  ? getImageUrl(item.imageKey, { width: 80, height: 80, quality: 80 })
                  : "/images/album-placeholder.png";

                const meta = [
                  item.artistName || item.artist,
                  item.album,
                  item.totalStreams
                    ? formatStreamCount(Number(item.totalStreams), true)
                    : null,
                ]
                  .filter(Boolean)
                  .join(" • ");

                return html`
                  <div class="aa-music-item group">
                    <div class="aa-music-thumb">
                      <img src="${imgUrl}" alt="${item.title}" class="aa-music-img" />
                      <div class="aa-music-play-overlay">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </div>
                    </div>
                    <div class="aa-music-info">
                      <div class="aa-music-title">${item.title}</div>
                      <div class="aa-music-subtitle">${meta}</div>
                    </div>
                    <span class="aa-music-badge">Song</span>
                  </div>
                `;
              },
              noResults({ html }: any) {
                return html`<div class="aa-NoResults">No songs found for "${trimmed}"</div>`;
              },
            },
            onSelect({ item }: any) {
              handlePlaySong(item);
            },
          },

          // 2. Artists Source
          {
            sourceId: "artists",
            getItems() {
              return searchClient
                .search([
                  {
                    indexName: ALGOLIA_INDEX_NAME,
                    params: {
                      query: trimmed,
                      hitsPerPage: 3,
                      facetFilters: ["type:artist"],
                    },
                  },
                ])
                .then(({ results }: any) => results[0]?.hits || []);
            },
            getItemUrl({ item }: any) {
              return `/artists/${item.objectID}`;
            },
            templates: {
              header({ html }: any) {
                return html`<div class="aa-SourceHeaderTitle">Artists</div>`;
              },
              item({ item, html }: any) {
                const imgUrl = item.coverImageKey
                  ? getImageUrl(item.coverImageKey, { width: 80, height: 80, quality: 80 })
                  : "/images/artist-placeholder.png";

                const followers =
                  typeof item.followersCount === "number"
                    ? formatFollowerCount(item.followersCount)
                    : "Artist";

                return html`
                  <div class="aa-music-item group">
                    <div class="aa-music-thumb aa-artist-thumb">
                      <img src="${imgUrl}" alt="${item.name}" class="aa-music-img" />
                    </div>
                    <div class="aa-music-info">
                      <div class="aa-music-title">${item.name}</div>
                      <div class="aa-music-subtitle">${followers}</div>
                    </div>
                    <span class="aa-music-badge">Artist</span>
                  </div>
                `;
              },
            },
            onSelect({ item }: any) {
              handleArtistClick(item.objectID);
            },
          },

          // 3. Playlists Source
          {
            sourceId: "playlists",
            getItems() {
              return searchClient
                .search([
                  {
                    indexName: ALGOLIA_INDEX_NAME,
                    params: {
                      query: trimmed,
                      hitsPerPage: 3,
                      facetFilters: [["type:playlist", "type:userPlaylist"]],
                    },
                  },
                ])
                .then(({ results }: any) => results[0]?.hits || []);
            },
            getItemUrl({ item }: any) {
              return item.type === "userPlaylist"
                ? `/my-playlists/${item.objectID}`
                : `/playlists/${item.objectID}`;
            },
            templates: {
              header({ html }: any) {
                return html`<div class="aa-SourceHeaderTitle">Playlists</div>`;
              },
              item({ item, html }: any) {
                const imgUrl = item.coverImageKey
                  ? getImageUrl(item.coverImageKey, { width: 80, height: 80, quality: 80 })
                  : "/images/playlist-placeholder.png";

                const badge =
                  item.type === "userPlaylist" ? "User Playlist" : "Playlist";
                const totalSongs =
                  typeof item.totalSongs === "number"
                    ? `${item.totalSongs} tracks`
                    : badge;

                return html`
                  <div class="aa-music-item group">
                    <div class="aa-music-thumb">
                      <img src="${imgUrl}" alt="${item.name}" class="aa-music-img" />
                    </div>
                    <div class="aa-music-info">
                      <div class="aa-music-title">${item.name}</div>
                      <div class="aa-music-subtitle">${totalSongs}</div>
                    </div>
                    <span class="aa-music-badge">${badge}</span>
                  </div>
                `;
              },
            },
            onSelect({ item }: any) {
              handlePlaylistClick(item.objectID, item.type === "userPlaylist");
            },
          },
        ];
      },
    });

    searchApi = search;

    // Delegated click handler on suggestion items to complete and search without blur
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const suggestionItem = target.closest<HTMLElement>(".aa-suggestion-item");
      if (suggestionItem) {
        const text =
          suggestionItem.getAttribute("data-suggestion") ||
          suggestionItem.querySelector(".aa-suggestion-query")?.textContent?.trim();
        if (text) {
          e.preventDefault();
          e.stopPropagation();
          applyCompletion(text);
        }
      }
    };

    const containerEl =
      typeof targetContainer === "string"
        ? document.querySelector<HTMLElement>(targetContainer)
        : (targetContainer as HTMLElement);

    containerEl?.addEventListener("click", handleContainerClick);

    // Keyboard handlers: Tab / ArrowRight auto-completion, Cmd+K / Ctrl+K focus
    // CRITICAL: Must use CAPTURE phase so we intercept Tab BEFORE Algolia dispatches 'blur'
    // and before the browser moves focus away from the input!
    const handleKeydownCapture = (e: KeyboardEvent) => {
      const { inputEl, containerEl: activeContainer } = getDomElements();
      if (!inputEl) return;

      const isInputFocused =
        document.activeElement === inputEl ||
        inputEl.contains(document.activeElement as Node);

      // Tab completion: complete into search bar, stay focused, immediately search
      if (e.key === "Tab" && isInputFocused) {
        const candidate =
          activeCompletionRef.current ||
          activeContainer?.querySelector<HTMLElement>(".aa-suggestion-query")?.textContent?.trim() ||
          activeContainer?.querySelector<HTMLElement>(".aa-music-title")?.textContent?.trim() ||
          inputEl.value.trim();

        if (candidate) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          applyCompletion(candidate);
          return;
        }
      }

      // ArrowRight completion: complete if cursor is at the end of input
      if (
        e.key === "ArrowRight" &&
        isInputFocused &&
        inputEl.selectionStart === inputEl.value.length
      ) {
        const candidate =
          activeCompletionRef.current ||
          activeContainer?.querySelector<HTMLElement>(".aa-suggestion-query")?.textContent?.trim();

        if (
          candidate &&
          candidate.toLowerCase() !== inputEl.value.trim().toLowerCase()
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          applyCompletion(candidate);
          return;
        }
      }

      // Cmd+K or Ctrl+K or / shortcut
      const activeEl = document.activeElement;
      const isAnyInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement;

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputEl.focus();
      } else if (e.key === "/" && !e.shiftKey && !isAnyInput) {
        e.preventDefault();
        inputEl.focus();
      }
    };

    window.addEventListener("keydown", handleKeydownCapture, true);

    return () => {
      window.removeEventListener("keydown", handleKeydownCapture, true);
      containerEl?.removeEventListener("click", handleContainerClick);
      search.destroy();
    };
  }, [
    container,
    placeholder,
    onSongSelected,
    onArtistSelected,
    onPlaylistSelected,
    router,
  ]);

  return (
    <div
      id="autocomplete"
      ref={rootRef}
      className={`w-full relative ${className}`}
    />
  );
}
