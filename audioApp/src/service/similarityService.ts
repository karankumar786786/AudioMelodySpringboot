import { Song } from "@/types";
import { PlayerSong } from "@/types/player";
import { getAlgoliaClient } from "./algoliaClient";
import { normalizeSong } from "@/utils/normalizeSong";
import { api } from "./baseApi";

interface FindSimilarOptions {
  count?: number;
  excludeIds?: string[];
  contextPool?: Song[];
  dislikedSongIds?: string[];
  targetUserId?: string;
}

export const similarityService = {
  /**
   * Computes a multi-factor similarity score between a candidate song and a seed song.
   * Evaluates:
   * 1. Genre alignment (exact match +35, partial overlap +20)
   * 2. Artist alignment (primary artist match +30, collaborator match +18)
   * 3. Album / Movie Soundtrack alignment (same album +25)
   * 4. Tempo / BPM proximity (<=5 bpm +20, <=12 bpm +14, <=25 bpm +8, <=40 bpm +3)
   * 5. Energy proximity (<=0.12 diff +8, <=0.25 diff +4)
   * 6. Danceability proximity (<=0.12 diff +7, <=0.25 diff +3)
   * 7. Valence / mood proximity (<=0.15 diff +6, <=0.30 diff +3)
   * 8. Acousticness proximity (<=0.15 diff +5)
   * 9. Language consistency (+10)
   */
  scoreSimilarity(candidate: Song, seed: Song | PlayerSong): number {
    if (!candidate || !seed || candidate.id === seed.id) return -1;

    let score = 0;

    const seedGenre = (seed.genre || "").trim().toLowerCase();
    const candGenre = (candidate.genre || "").trim().toLowerCase();

    const seedArtist = (seed.artistName || "").toLowerCase();
    const candArtist = (candidate.artistName || "").toLowerCase();

    const seedAlbum = (seed.album || "").trim().toLowerCase();
    const candAlbum = (candidate.album || "").trim().toLowerCase();

    // 1. Genre alignment (up to 40 pts)
    if (seedGenre && candGenre) {
      if (seedGenre === candGenre) {
        score += 40;
      } else if (seedGenre.includes(candGenre) || candGenre.includes(seedGenre)) {
        score += 25;
      }
    }

    // 2. Artist alignment (controlled: up to 12 pts, so artist does not dominate musical vibe)
    if (seedArtist && candArtist) {
      const seedParts = seedArtist
        .split(/[,&]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);
      const candParts = candArtist
        .split(/[,&]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);

      const primarySeed = seedParts[0];
      const primaryCand = candParts[0];

      if (
        primarySeed &&
        primaryCand &&
        (primarySeed === primaryCand || candArtist.includes(primarySeed))
      ) {
        score += 12; // Controlled primary artist match
      } else {
        // Collaborator match
        const hasCollaboratorOverlap = seedParts.some((sp) =>
          candParts.some(
            (cp) =>
              cp === sp ||
              candArtist.includes(sp) ||
              seedArtist.includes(cp)
          )
        );
        if (hasCollaboratorOverlap) {
          score += 6;
        }
      }
    }

    // 3. Album / Movie Soundtrack (up to 8 pts)
    if (seedAlbum && candAlbum && seedAlbum === candAlbum) {
      score += 8;
    }

    // 4. Tempo / BPM similarity (up to 20 pts)
    const seedBpm = typeof seed.tempo === "number" ? seed.tempo : 0;
    const candBpm = typeof candidate.tempo === "number" ? candidate.tempo : 0;
    if (seedBpm > 0 && candBpm > 0) {
      const bpmDiff = Math.abs(seedBpm - candBpm);
      if (bpmDiff <= 5) score += 20;
      else if (bpmDiff <= 12) score += 14;
      else if (bpmDiff <= 25) score += 8;
      else if (bpmDiff <= 40) score += 3;
    }

    // 5. Energy vibe proximity (up to 10 pts)
    const seedEnergy = typeof seed.energy === "number" ? seed.energy : 0;
    const candEnergy = typeof candidate.energy === "number" ? candidate.energy : 0;
    if (seedEnergy > 0 && candEnergy > 0) {
      const energyDiff = Math.abs(seedEnergy - candEnergy);
      if (energyDiff <= 0.12) score += 10;
      else if (energyDiff <= 0.25) score += 5;
    }

    // 6. Danceability vibe proximity (up to 8 pts)
    const seedDance = typeof seed.danceability === "number" ? seed.danceability : 0;
    const candDance = typeof candidate.danceability === "number" ? candidate.danceability : 0;
    if (seedDance > 0 && candDance > 0) {
      const danceDiff = Math.abs(seedDance - candDance);
      if (danceDiff <= 0.12) score += 8;
      else if (danceDiff <= 0.25) score += 4;
    }

    // 7. Valence (mood / emotion) proximity (up to 7 pts)
    const seedValence = typeof seed.valence === "number" ? seed.valence : 0;
    const candValence = typeof candidate.valence === "number" ? candidate.valence : 0;
    if (seedValence > 0 && candValence > 0) {
      const valenceDiff = Math.abs(seedValence - candValence);
      if (valenceDiff <= 0.15) score += 7;
      else if (valenceDiff <= 0.3) score += 3;
    }

    // 8. Acousticness proximity (up to 5 pts)
    const seedAcoustic = typeof seed.acousticness === "number" ? seed.acousticness : 0;
    const candAcoustic = typeof candidate.acousticness === "number" ? candidate.acousticness : 0;
    if (seedAcoustic > 0 && candAcoustic > 0) {
      const acousticDiff = Math.abs(seedAcoustic - candAcoustic);
      if (acousticDiff <= 0.15) score += 5;
    }

    // 9. Language match (up to 15 pts)
    if (
      seed.language &&
      candidate.language &&
      seed.language.trim().toLowerCase() === candidate.language.trim().toLowerCase()
    ) {
      score += 15;
    }

    return score;
  },

  /**
   * Fetches similar songs using Algolia based on genre, artist, album, and tempo range.
   * Multi-query fallback with removeWordsIfNoResults ensures non-empty, highly-aligned candidates.
   */
  async fetchAlgoliaCandidates(
    seed: Song | PlayerSong,
    limit = 30
  ): Promise<Song[]> {
    if (!seed?.id) return [];

    try {
      const { client, indexName } = getAlgoliaClient();
      const seen = new Set<string>([seed.id]);
      const results: Song[] = [];

      const artists = (seed.artistName || "")
        .split(/[,&]/)
        .map((a) => a.trim())
        .filter((a) => a.length > 2);
      const primaryArtist = artists[0] || "";

      // 1. Target queries prioritizing genre and musical vibe
      const queries: string[] = [];

      // Query A: Genre alone (discovers tracks by all artists in the same genre)
      if (seed.genre) {
        queries.push(seed.genre);
      }
      // Query B: Genre + primary artist
      if (seed.genre && primaryArtist) {
        queries.push(`${seed.genre} ${primaryArtist}`);
      }
      // Query C: Primary artist alone (single query, capped)
      if (primaryArtist) {
        queries.push(primaryArtist);
      }
      // Query D: Album
      if (seed.album) {
        queries.push(seed.album);
      }

      for (const q of queries) {
        if (results.length >= limit) break;
        try {
          const res = await client.searchSingleIndex({
            indexName,
            searchParams: {
              query: q,
              filters: `type:song AND NOT objectID:${seed.id}`,
              removeWordsIfNoResults: "allOptional",
              hitsPerPage: Math.min(15, limit),
            },
          });

          for (const h of (res.hits || []) as any[]) {
            const id = String(h.objectID || h.id || "");
            if (id && !seen.has(id)) {
              seen.add(id);
              results.push(normalizeSong(h, "algolia"));
              if (results.length >= limit) break;
            }
          }
        } catch (err) {
          console.warn("[SimilarityService] Algolia query failed for:", q, err);
        }
      }

      // Query F: Tempo / BPM range query if tempo is available
      const bpm = typeof seed.tempo === "number" ? seed.tempo : 0;
      if (bpm > 40 && results.length < limit) {
        try {
          const minBpm = Math.max(40, Math.round(bpm - 15));
          const maxBpm = Math.round(bpm + 15);
          const res = await client.searchSingleIndex({
            indexName,
            searchParams: {
              filters: `type:song AND NOT objectID:${seed.id} AND tempo >= ${minBpm} AND tempo <= ${maxBpm}`,
              hitsPerPage: 15,
            },
          });
          for (const h of (res.hits || []) as any[]) {
            const id = String(h.objectID || h.id || "");
            if (id && !seen.has(id)) {
              seen.add(id);
              results.push(normalizeSong(h, "algolia"));
              if (results.length >= limit) break;
            }
          }
        } catch (err) {
          console.warn("[SimilarityService] Algolia tempo query failed:", err);
        }
      }

      // Catalog fallback if fewer than 10 candidates
      if (results.length < 10) {
        try {
          const res = await client.searchSingleIndex({
            indexName,
            searchParams: {
              query: "",
              filters: `type:song AND NOT objectID:${seed.id}`,
              hitsPerPage: limit,
            },
          });
          for (const h of (res.hits || []) as any[]) {
            const id = String(h.objectID || h.id || "");
            if (id && !seen.has(id)) {
              seen.add(id);
              results.push(normalizeSong(h, "algolia"));
              if (results.length >= limit) break;
            }
          }
        } catch {}
      }

      return results;
    } catch (err) {
      console.warn("[SimilarityService] Algolia candidates search error:", err);
      return [];
    }
  },

  /**
   * Fetches collaborative-filtering recommendations from Spring Boot backend.
   */
  async fetchBackendCandidates(seedId: string, limit = 15): Promise<Song[]> {
    if (!seedId) return [];
    try {
      const response = await api.get<Song[]>(
        `/recommendations/similar/${encodeURIComponent(seedId)}?count=${limit}`
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((s) => normalizeSong(s, "api"));
      }
    } catch (err) {
      console.warn(`[SimilarityService] Backend /recommendations/similar failed for ${seedId}:`, err);
    }
    return [];
  },

  /**
   * Fetches radio stream recommendations from Spring Boot backend.
   */
  async fetchBackendRadioCandidates(
    seedId: string,
    excludeIds: string[] = [],
    limit = 12
  ): Promise<Song[]> {
    if (!seedId) return [];
    try {
      const excParam =
        excludeIds.length > 0
          ? `&excludeIds=${encodeURIComponent(excludeIds.join(","))}`
          : "";
      const response = await api.get<Song[]>(
        `/recommendations/radio?seedSongId=${encodeURIComponent(seedId)}${excParam}&count=${limit}`
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((s) => normalizeSong(s, "api"));
      }
    } catch (err) {
      console.warn(`[SimilarityService] Backend /recommendations/radio failed for ${seedId}:`, err);
    }
    return [];
  },

  /**
   * Primary entry point: finds genuinely similar songs for a clicked song.
   * Merges Recombee AI recommendations, Algolia search, and contextual pool,
   * then sorts all candidates using the multi-factor scoring model.
   */
  async findSimilarSongs(
    seedSong: Song | PlayerSong,
    options: FindSimilarOptions = {}
  ): Promise<Song[]> {
    if (!seedSong?.id) return [];

    const count = options.count ?? 15;
    const excludeSet = new Set<string>([
      seedSong.id,
      ...(options.excludeIds || []),
      ...(options.dislikedSongIds || []),
    ]);

    // Hydrate seed song if missing crucial similarity metadata
    let hydratedSeed: Song | PlayerSong = seedSong;
    if (
      hydratedSeed.id &&
      (hydratedSeed.tempo == null || !hydratedSeed.genre || !hydratedSeed.album)
    ) {
      try {
        const { client, indexName } = getAlgoliaClient();
        const hit = (await client.getObject({
          indexName,
          objectID: hydratedSeed.id,
        })) as any;
        if (hit) {
          hydratedSeed = {
            ...hydratedSeed,
            ...normalizeSong(hit, "algolia"),
          };
        }
      } catch {}
    }

    // 1. Concurrently fetch candidates from Algolia, Backend Recombee, and Backend Radio
    const [algoliaResults, backendResults, radioResults] = await Promise.allSettled([
      this.fetchAlgoliaCandidates(hydratedSeed, count * 2),
      this.fetchBackendCandidates(hydratedSeed.id, count),
      options.excludeIds && options.excludeIds.length > 0
        ? this.fetchBackendRadioCandidates(hydratedSeed.id, options.excludeIds, count)
        : Promise.resolve([]),
    ]);

    const algoliaCandidates =
      algoliaResults.status === "fulfilled" ? algoliaResults.value : [];
    const backendCandidates =
      backendResults.status === "fulfilled" ? backendResults.value : [];
    const radioCandidates =
      radioResults.status === "fulfilled" ? radioResults.value : [];

    // 2. Gather candidates from all sources (backend, algolia, radio, and context pool)
    const seenCandidateIds = new Set<string>();
    const candidates: Song[] = [];

    const addCandidate = (s: Song | null | undefined) => {
      if (!s || !s.id || !s.title || s.title.trim().length === 0) return;
      if (excludeSet.has(s.id) || seenCandidateIds.has(s.id)) return;
      seenCandidateIds.add(s.id);
      candidates.push(s);
    };

    // Priority 1: Backend Recombee AI recommendations
    backendCandidates.forEach(addCandidate);
    radioCandidates.forEach(addCandidate);

    // Priority 2: Algolia genre/artist/album/tempo search
    algoliaCandidates.forEach(addCandidate);

    // Priority 3: Optional contextual pool (e.g. tracks from the current feed / album / explore list)
    if (options.contextPool && options.contextPool.length > 0) {
      options.contextPool.forEach(addCandidate);
    }

    // 3. Fallback to trending catalog songs if total pool is low
    if (candidates.length < 5) {
      try {
        const { homeService } = await import("./homeService");
        const trending = await homeService.getTrendingSongs(count);
        (trending || []).forEach(addCandidate);
      } catch {}
    }

    // 4. Rank candidates using multi-factor similarity scorer with tie-breaker
    const scored = candidates.map((c) => {
      const baseScore = this.scoreSimilarity(c, hydratedSeed);
      // Small deterministic tie-breaker based on ID hash to avoid deterministic repetition
      let hash = 0;
      const combined = c.id + hydratedSeed.id;
      for (let i = 0; i < combined.length; i++) {
        hash = (hash << 5) - hash + combined.charCodeAt(i);
        hash |= 0;
      }
      const jitter = ((Math.abs(hash) % 100) / 100) * 0.5;
      return {
        song: c,
        score: baseScore + jitter,
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // 5. Select with strict artist and album diversity caps (max 2 songs per artist, max 2 per album)
    const MAX_PER_ARTIST = 2;
    const MAX_PER_ALBUM = 2;

    const artistCounts = new Map<string, number>();
    const albumCounts = new Map<string, number>();
    const diverse: Song[] = [];
    const deferred: Song[] = [];

    for (const item of scored) {
      if (diverse.length >= count) break;
      const song = item.song;
      const primaryArtist =
        song.artistName?.split(/[,/&]|ft\./i)[0]?.trim().toLowerCase() || "unknown";
      const albumKey = song.album?.trim().toLowerCase();

      const artistHits = artistCounts.get(primaryArtist) || 0;
      const albumHits = albumKey ? albumCounts.get(albumKey) || 0 : 0;

      if (artistHits >= MAX_PER_ARTIST || (albumKey && albumHits >= MAX_PER_ALBUM)) {
        deferred.push(song);
        continue;
      }

      diverse.push(song);
      artistCounts.set(primaryArtist, artistHits + 1);
      if (albumKey) albumCounts.set(albumKey, albumHits + 1);
    }

    // Relax diversity constraints if total matches were too few to fulfill count
    if (diverse.length < count && deferred.length > 0) {
      for (const song of deferred) {
        if (diverse.length >= count) break;
        diverse.push(song);
      }
    }

    return diverse.slice(0, count);
  },
};
