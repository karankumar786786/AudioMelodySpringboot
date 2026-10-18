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

const ALGOLIA_APP_ID =
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "NQKIDY69EZ";
const ALGOLIA_SEARCH_KEY =
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ||
  "d56f43f0df08191b3eea750c0f4d3cd0";
const ALGOLIA_INDEX_NAME =
  process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "one_melody_springboot";

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

  useEffect(() => {
    const targetContainer = container || rootRef.current || "#autocomplete";
    if (!targetContainer) return;

    const searchClient = liteClient(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);

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
      getSources({ query }) {
        if (!query || !query.trim()) {
          return [];
        }

        const trimmed = query.trim();

        return [
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

    // Keyboard shortcut (Cmd+K / Ctrl+K)
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement;

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        const inputEl = document.querySelector<HTMLInputElement>(
          "#autocomplete input, .aa-Input"
        );
        inputEl?.focus();
      } else if (e.key === "/" && !e.shiftKey && !isInput) {
        e.preventDefault();
        const inputEl = document.querySelector<HTMLInputElement>(
          "#autocomplete input, .aa-Input"
        );
        inputEl?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeydown);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);
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
