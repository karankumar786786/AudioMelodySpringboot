"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Check,
  Sparkles,
  Loader2,
  Users,
  X,
} from "lucide-react";
import { musicApi, Artist } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { toast } from "sonner";

interface ArtistOnboardingViewProps {
  onComplete: () => void;
  userName?: string;
}

export function ArtistOnboardingView({ onComplete, userName }: ArtistOnboardingViewProps) {
  const queryClient = useQueryClient();
  const [selectedArtists, setSelectedArtists] = useState<Artist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const [backendSearchResults, setBackendSearchResults] = useState<Artist[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Initial Onboarding Artists suggestions
  const { data: initialArtistsData, isLoading: isLoadingInitial } = useQuery({
    queryKey: ["onboarding-artists"],
    queryFn: async () => {
      const res = await musicApi.artists.getOnboardingList();
      return res?.data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const initialArtists: Artist[] = initialArtistsData || [];

  // Trigger backend search whenever debounced query changes
  useEffect(() => {
    if (!debouncedQuery) {
      setBackendSearchResults([]);
      setIsSearchingBackend(false);
      return;
    }

    let isMounted = true;
    setIsSearchingBackend(true);

    musicApi.artists
      .search(debouncedQuery)
      .then((res) => {
        if (isMounted) {
          setBackendSearchResults(res?.data || []);
        }
      })
      .catch((err) => {
        console.warn("Artist search error:", err);
      })
      .finally(() => {
        if (isMounted) {
          setIsSearchingBackend(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  // Merge and deduplicate artists matching search
  const displayedArtists = useMemo(() => {
    if (!debouncedQuery) {
      return initialArtists;
    }

    const queryLower = debouncedQuery.toLowerCase();
    const seenNames = new Set<string>();
    const merged: Artist[] = [];

    // 1. Add any matching backend search results first
    for (const artist of backendSearchResults) {
      const key = (artist.name || "").toLowerCase().trim();
      if (key && !seenNames.has(key)) {
        seenNames.add(key);
        merged.push(artist);
      }
    }

    // 2. Add matching initial artists
    for (const artist of initialArtists) {
      const key = (artist.name || "").toLowerCase().trim();
      if (
        key &&
        !seenNames.has(key) &&
        (key.includes(queryLower) || (artist.about && artist.about.toLowerCase().includes(queryLower)))
      ) {
        seenNames.add(key);
        merged.push(artist);
      }
    }

    return merged;
  }, [debouncedQuery, initialArtists, backendSearchResults]);


  // Toggle selection by artist object
  const toggleArtist = (artist: Artist) => {
    const artistKey = (artist.name || artist.id || "").toLowerCase().trim();
    const isAlreadySelected = selectedArtists.some(
      (a) => (a.name || a.id || "").toLowerCase().trim() === artistKey
    );

    if (isAlreadySelected) {
      setSelectedArtists((prev) =>
        prev.filter((a) => (a.name || a.id || "").toLowerCase().trim() !== artistKey)
      );
    } else {
      if (selectedArtists.length >= 5) {
        toast.info("You've already selected 5 artists!", {
          description: "Remove one from the slots above if you want to swap.",
        });
        return;
      }
      setSelectedArtists((prev) => [...prev, artist]);
    }
  };

  const removeArtistByIndex = (index: number) => {
    setSelectedArtists((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    if (selectedArtists.length !== 5) {
      toast.error("Please select exactly 5 artists to continue");
      return;
    }

    try {
      setIsSubmitting(true);
      const artistIdentifiers = selectedArtists.map((a) => a.id || a.name);
      await musicApi.artists.completeOnboarding(artistIdentifiers);

      queryClient.invalidateQueries({ queryKey: ["home"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["artist-follow-status"] });

      toast.success("Welcome aboard!", {
        description: "Your personalized music taste profile has been trained.",
      });

      onComplete();
    } catch (err: any) {
      toast.error("Onboarding Failed", {
        description: err?.response?.data?.message || err?.message || "Could not save selected artists. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReady = selectedArtists.length === 5;
  const progressPercent = (selectedArtists.length / 5) * 100;

  return (
    <div className="flex flex-col h-full max-h-[85vh] text-white">
      {/* ================================================================== */}
      {/* 1. HEADER SECTION                                                  */}
      {/* ================================================================== */}
      <div className="px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles size={13} className="text-primary animate-pulse" />
            Cold-Start Personalization
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
          {userName ? `Welcome, ${userName}!` : "Choose 5 artists you love"}
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-lg leading-relaxed">
          Search and pick 5 favorite artists to eliminate recommendations cold-start and generate your custom mixes.
        </p>

        {/* Progress Counter & Bar */}
        <div className="mt-4 flex items-center justify-between text-xs font-semibold">
          <span className={isReady ? "text-primary font-bold" : "text-zinc-300"}>
            {selectedArtists.length} of 5 selected
          </span>
          <span className="text-zinc-400 text-[11px]">
            {isReady
              ? "All 5 slots filled! You're ready to proceed."
              : `Pick ${5 - selectedArtists.length} more ${5 - selectedArtists.length === 1 ? "artist" : "artists"}`}
          </span>
        </div>

        <div className="w-full bg-zinc-800/80 rounded-full h-2 mt-2 overflow-hidden border border-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* ================================================================ */}
        {/* SELECTED ARTISTS SLOTS TRAY                                       */}
        {/* ================================================================ */}
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="text-[11px] font-semibold text-zinc-400 mb-2 flex items-center justify-between">
            <span>Your Selected Artists</span>
            <span className="text-zinc-500 font-normal">Tap × to remove</span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3, 4].map((index) => {
              const artist = selectedArtists[index];
              const coverUrl = artist?.coverImageKey
                ? getImageUrl(artist.coverImageKey, { width: 120, height: 120, aspectRatio: "1-1" })
                : undefined;

              return (
                <div
                  key={index}
                  className="flex flex-col items-center text-center group"
                >
                  <div
                    className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                      artist
                        ? "border-2 border-primary bg-primary/20 shadow-md shadow-primary/20"
                        : "border-2 border-dashed border-zinc-700 bg-zinc-900/60"
                    }`}
                  >
                    {artist ? (
                      <>
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={artist.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-primary font-bold text-sm">
                            {artist.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeArtistByIndex(index)}
                          title={`Remove ${artist.name}`}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer"
                        >
                          <X size={12} className="stroke-[3]" />
                        </button>
                      </>
                    ) : (
                      <span className="text-zinc-600 text-xs font-bold">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-zinc-300 truncate w-full mt-1.5 px-0.5">
                    {artist ? artist.name : `Slot ${index + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* SEARCH INPUT                                                     */}
        {/* ================================================================ */}
        <div className="relative mt-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists by name (e.g. Taylor Swift, Drake, Arijit Singh)..."
            className="w-full bg-zinc-900 border border-white/10 focus:border-primary/50 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
          />
          {isSearchingBackend ? (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Loader2 size={16} className="animate-spin text-primary" />
            </div>
          ) : searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ================================================================== */}
      {/* 2. ARTIST CARDS & RESULTS GRID                                     */}
      {/* ================================================================== */}
      <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
        {isLoadingInitial && !displayedArtists.length ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3 text-zinc-500">
            <Loader2 size={32} className="animate-spin text-primary" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Loading Artists...
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedArtists.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-400 px-4">
                <Users size={36} className="text-zinc-600 mb-2" />
                <p className="text-sm font-semibold">No artists found</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Try searching with a different name or spelling.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {displayedArtists.map((artist) => {
                  const artistKey = (artist.name || artist.id || "").toLowerCase().trim();
                  const isSelected = selectedArtists.some(
                    (a) => (a.name || a.id || "").toLowerCase().trim() === artistKey
                  );
                  const coverUrl = artist.coverImageKey
                    ? getImageUrl(artist.coverImageKey, {
                        width: 250,
                        height: 250,
                        aspectRatio: "1-1",
                      })
                    : undefined;

                  return (
                    <motion.div
                      key={artist.id || artist.name}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => toggleArtist(artist)}
                      className={`group relative flex flex-col items-center p-3 rounded-2xl cursor-pointer transition-all duration-200 select-none border text-center ${
                        isSelected
                          ? "bg-primary/10 border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                          : "bg-[#161616] hover:bg-[#202020] border-white/5 hover:border-white/20"
                      }`}
                    >
                      {/* Selected checkmark badge */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute top-2.5 right-2.5 z-20 w-6 h-6 rounded-full bg-primary text-black flex items-center justify-center shadow-md font-bold"
                          >
                            <Check size={14} className="stroke-[3]" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Circular Artwork */}
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-zinc-900 border border-white/10 shadow-md mb-2">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={artist.name}
                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-black text-zinc-400 font-bold text-xl sm:text-2xl">
                            {artist.name.charAt(0).toUpperCase() || "A"}
                          </div>
                        )}
                      </div>

                      {/* Artist Details */}
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-full group-hover:text-primary transition-colors">
                        {artist.name}
                      </h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-full">
                        {isSelected ? "Selected" : "Artist"}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* 3. STICKY FOOTER ACTIONS                                           */}
      {/* ================================================================== */}
      <div className="px-6 py-4 border-t border-white/10 bg-black/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
        <div className="text-xs text-zinc-400">
          <span className="font-semibold text-white">{selectedArtists.length}</span> / 5 artists chosen
        </div>

        <button
          onClick={handleFinish}
          disabled={!isReady || isSubmitting}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all shadow-xl cursor-pointer active:scale-95 ${
            isReady && !isSubmitting
              ? "bg-primary text-black hover:bg-primary/90 shadow-primary/20 hover:scale-105"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60"
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Training AI Profile...</span>
            </>
          ) : (
            <>
              <span>Finish & Start Listening</span>
              <Check size={16} className="stroke-[2.5]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
