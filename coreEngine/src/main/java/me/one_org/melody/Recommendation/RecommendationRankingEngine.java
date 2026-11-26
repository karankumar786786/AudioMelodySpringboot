package me.one_org.melody.Recommendation;

import java.util.*;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import me.one_org.melody.Dto.Controllers.Api.SongDto;
import me.one_org.melody.Entity.Song;
import me.one_org.melody.Enums.StatusEnum;

/**
 * Recommendations ko rank (order) karne wala engine.
 *
 * Har candidate gaane ko seed gaane ke hisaab se points milte hain (scoreCandidate):
 *   genre (40 tak) + language (20) + Recombee rank (30 tak) + artist (15 tak) + album (10)
 *   + country (5) + popularity (10 tak) + random (3 tak) + awaaz ki similarity (15 tak)
 * Phir zyada points wale pehle, PAR ek artist / album ke max N gaane hi (diversity), taaki user ko
 * ek hi artist ke 10 gaane na milein. Jagah bache to aakhir me ye limit dheeli karte hain.
 */
@Component
@Slf4j
public class RecommendationRankingEngine {

    public static final int DEFAULT_MAX_PER_ARTIST = 2;
    public static final int DEFAULT_MAX_PER_ALBUM = 2;

    /** Ek gaana aur uske points. */
    public static record ScoredCandidate(SongDto song, double score) {}

    /**
     * Candidates ko seed gaane ke hisaab se rank karo aur variety rakho.
     *
     * @param seedSong jis gaane jaise gaane chahiye (home / user feed me null ho sakta hai)
     * @param recombeeCandidates Recombee ke suggestions (unka order bhi points deta hai)
     * @param dbCandidates database se laaye gaane
     * @param excludedIds ye gaane nahi chahiye (queue me, history me, dislike kiye)
     * @param targetCount kitne gaane lautane hain
     * @param maxPerArtist ek artist ke max kitne gaane
     * @param maxPerAlbum ek album ke max kitne gaane
     */
    public List<SongDto> rankAndDiversify(
            Song seedSong,
            List<SongDto> recombeeCandidates,
            List<Song> dbCandidates,
            Set<String> excludedIds,
            int targetCount,
            int maxPerArtist,
            int maxPerAlbum) {
        return rankAndDiversify(seedSong, null, recombeeCandidates, dbCandidates, excludedIds,
                targetCount, maxPerArtist, maxPerAlbum);
    }

    /**
     * Upar wala hi, bas saath me {@code seedAudio} (awaaz) se similarity ke points bhi (seedAudio null ho sakta hai).
     */
    public List<SongDto> rankAndDiversify(
            Song seedSong,
            AudioProfile seedAudio,
            List<SongDto> recombeeCandidates,
            List<Song> dbCandidates,
            Set<String> excludedIds,
            int targetCount,
            int maxPerArtist,
            int maxPerAlbum) {

        Set<String> excludes = new HashSet<>();
        if (excludedIds != null) {
            for (String ex : excludedIds) {
                if (ex != null && !ex.isBlank()) excludes.add(ex.trim());
            }
        }
        if (seedSong != null && seedSong.getId() != null) {
            excludes.add(seedSong.getId().trim());
        }

        // Recombee ke har gaane ki position yaad rakho (0 = Recombee ka sabse pehla suggestion)
        Map<String, Integer> recombeeRankMap = new HashMap<>();
        Map<String, SongDto> candidatePool = new LinkedHashMap<>();

        if (recombeeCandidates != null) {
            for (int i = 0; i < recombeeCandidates.size(); i++) {
                SongDto dto = recombeeCandidates.get(i);
                if (dto != null && dto.id() != null && !excludes.contains(dto.id())) {
                    if (dto.status() == null || dto.status() == StatusEnum.ACTIVE) {
                        recombeeRankMap.put(dto.id(), i);
                        candidatePool.put(dto.id(), dto);
                    }
                }
            }
        }

        if (dbCandidates != null) {
            for (Song s : dbCandidates) {
                if (s != null && s.getId() != null && !excludes.contains(s.getId())) {
                    if (s.getStatus() == null || s.getStatus() == StatusEnum.ACTIVE) {
                        candidatePool.putIfAbsent(s.getId(), SongDto.fromEntity(s));
                    }
                }
            }
        }

        if (candidatePool.isEmpty()) {
            return List.of();
        }

        // 1. Har candidate ko points do
        List<ScoredCandidate> scoredList = new ArrayList<>(candidatePool.size());
        for (SongDto candidate : candidatePool.values()) {
            double score = scoreCandidate(candidate, seedSong, seedAudio, recombeeRankMap.get(candidate.id()));
            scoredList.add(new ScoredCandidate(candidate, score));
        }

        // Zyada points wale pehle
        scoredList.sort((a, b) -> Double.compare(b.score(), a.score()));

        // 2. Variety: ek artist / album ke limit se zyada gaane mat lo
        List<SongDto> selected = new ArrayList<>(Math.min(targetCount, scoredList.size()));
        List<ScoredCandidate> deferredDueToQuotas = new ArrayList<>();

        Map<String, Integer> artistCount = new HashMap<>();
        Map<String, Integer> albumCount = new HashMap<>();

        for (ScoredCandidate item : scoredList) {
            if (selected.size() >= targetCount) {
                break;
            }

            SongDto song = item.song();
            Set<String> songArtists = parseArtistSet(song.artistName());
            String primaryArtist = getPrimaryArtistKey(song.artistName());
            String albumKey = getNormalizedKey(song.album());

            int currentAlbumCount = (albumKey != null) ? albumCount.getOrDefault(albumKey, 0) : 0;
            boolean albumLimitReached = (albumKey != null) && (currentAlbumCount >= maxPerAlbum);

            // "A, B" jaise gaane me dono artists ki limit check karo
            boolean artistLimitReached = false;
            for (String artistKey : songArtists) {
                if (artistCount.getOrDefault(artistKey, 0) >= maxPerArtist) {
                    artistLimitReached = true;
                    break;
                }
            }
            if (songArtists.isEmpty() && artistCount.getOrDefault(primaryArtist, 0) >= maxPerArtist) {
                artistLimitReached = true;
            }

            if (artistLimitReached || albumLimitReached) {
                deferredDueToQuotas.add(item);
                continue;
            }

            selected.add(song);
            for (String artistKey : songArtists) {
                artistCount.put(artistKey, artistCount.getOrDefault(artistKey, 0) + 1);
            }
            if (songArtists.isEmpty()) {
                artistCount.put(primaryArtist, artistCount.getOrDefault(primaryArtist, 0) + 1);
            }
            if (albumKey != null) {
                albumCount.put(albumKey, currentAlbumCount + 1);
            }
        }

        // 3. Limits ki wajah se list poori nahi hui to bache hue gaane bina limit ke jod do
        if (selected.size() < targetCount && !deferredDueToQuotas.isEmpty()) {
            for (ScoredCandidate item : deferredDueToQuotas) {
                if (selected.size() >= targetCount) break;
                selected.add(item.song());
            }
        }

        log.debug("RecommendationRankingEngine selected {} diverse songs (target {}) from pool of {}",
                selected.size(), targetCount, candidatePool.size());

        return selected;
    }

    /** Shortcut overload (kam parameters, baaki defaults). */
    public List<SongDto> rankAndDiversify(
            Song seedSong,
            List<SongDto> recombeeCandidates,
            List<Song> dbCandidates,
            Set<String> excludedIds,
            int targetCount) {
        return rankAndDiversify(
                seedSong,
                recombeeCandidates,
                dbCandidates,
                excludedIds,
                targetCount,
                DEFAULT_MAX_PER_ARTIST,
                DEFAULT_MAX_PER_ALBUM
        );
    }

    /** Shortcut overload (kam parameters, baaki defaults). */
    public List<SongDto> rankAndDiversify(
            Song seedSong,
            AudioProfile seedAudio,
            List<SongDto> recombeeCandidates,
            List<Song> dbCandidates,
            Set<String> excludedIds,
            int targetCount) {
        return rankAndDiversify(seedSong, seedAudio, recombeeCandidates, dbCandidates, excludedIds,
                targetCount, DEFAULT_MAX_PER_ARTIST, DEFAULT_MAX_PER_ALBUM);
    }

    /**
     * Ek "nakli" seed gaana banata hai jisme sirf genres hain (DB me kabhi save nahi hota).
     * Naye user (cold start) ke liye: onboarding me genres chune par history nahi hai - to candidates ko
     * sirf popularity nahi, un genres se milan ke hisaab se points milte hain.
     */
    /** Kya ye {@link #genreSeed(List)} se bana nakli seed hai? (id nahi, sirf genres) */
    public static boolean isGenreSeed(Song seed) {
        return seed != null && seed.getId() == null && seed.getTitle() == null && seed.getGenre() != null;
    }

    public static Song genreSeed(List<String> genres) {
        if (genres == null || genres.isEmpty()) return null;
        String joined = String.join(",", genres);
        if (joined.isBlank()) return null;
        Song seed = new Song();
        seed.setGenre(joined);
        return seed;
    }

    /** "Pop, Rock" -> {pop, rock} (lowercase, saaf). */
    public static Set<String> parseGenreSet(String genreStr) {
        if (genreStr == null || genreStr.isBlank()) {
            return Collections.emptySet();
        }
        Set<String> set = new LinkedHashSet<>();
        for (String part : genreStr.split(",")) {
            String trimmed = part.trim().toLowerCase();
            if (!trimmed.isEmpty()) {
                set.add(trimmed);
            }
        }
        return set;
    }

    /** "A ft. B & C" -> {a, b, c}. */
    public static Set<String> parseArtistSet(String artistName) {
        if (artistName == null || artistName.isBlank()) {
            return Collections.emptySet();
        }
        Set<String> set = new LinkedHashSet<>();
        String[] parts = artistName.split("[,/&]|\\b(?:ft|feat)(?:\\.|\\b)");
        for (String part : parts) {
            String trimmed = part.trim().toLowerCase().replaceAll("^[.\\s]+|[.\\s]+$", "");
            if (!trimmed.isEmpty()) {
                set.add(trimmed);
            }
        }
        return set;
    }

    /**
     * Ek candidate ke kul points (class doc me poora hisaab). Genre, mood aur language ko
     * same artist hone se zyada importance milti hai.
     */
    /** Bina awaaz ke seed wala shortcut. */
    public double scoreCandidate(SongDto candidate, Song seedSong, Integer recombeeRank) {
        return scoreCandidate(candidate, seedSong, null, recombeeRank);
    }

    public double scoreCandidate(SongDto candidate, Song seedSong, AudioProfile seedAudio, Integer recombeeRank) {
        double score = 0.0;

        // Seed gaana nahi hai (jaise user feed) - sirf Recombee rank aur popularity se points
        if (seedSong == null) {
            if (recombeeRank != null) {
                score += Math.max(10.0, 50.0 - (recombeeRank * 2.0));
            }
            score += computeStreamBoost(candidate.totalStreams());
            // Sirf awaaz wala seed (mood radio): gaana kaisa sunai deta hai yahi sabse important hai,
            // isliye awaaz ke points double (30 tak) taaki popularity (10 tak) se zyada rahein,
            // aur thoda random, taaki same mood pe har baar bilkul same queue na aaye.
            if (seedAudio != null && seedAudio.hasAny()) {
                score += AUDIO_ONLY_SEED_MULTIPLIER * scoreAudioFeatures(candidate, seedAudio);
                score += java.util.concurrent.ThreadLocalRandom.current().nextDouble(0.0, 3.0);
            }
            return score;
        }

        Set<String> seedGenres = parseGenreSet(seedSong.getGenre());
        Set<String> candGenres = parseGenreSet(candidate.genre());

        String seedLang = getNormalizedKey(seedSong.getLanguage());
        String candLang = getNormalizedKey(candidate.language());

        String seedAlbum = getNormalizedKey(seedSong.getAlbum());
        String candAlbum = getNormalizedKey(candidate.album());

        String seedCountry = getNormalizedKey(seedSong.getCountry());
        String candCountry = getNormalizedKey(candidate.country());

        // 1. Genre (sabse zyada, 40 tak)
        // - Saare genres same: 40
        // - Kuch genres same: 25 + 15 * Jaccard (Jaccard = common / kul alag genres, 0..1)
        // - Koi same nahi par ek doosre ke andar ("dance-pop" me "pop"): 20
        // Nakli genre seed me user ne kai genres chune hain - unme se KOI bhi mile to poore 40,
        // warna zyada genres chunne wale user ka nuksaan hota.
        boolean genreSeed = isGenreSeed(seedSong);
        if (!seedGenres.isEmpty() && !candGenres.isEmpty()) {
            if (seedGenres.equals(candGenres)
                    || (genreSeed && !Collections.disjoint(seedGenres, candGenres))) {
                score += 40.0;
            } else {
                Set<String> intersection = new HashSet<>(seedGenres);
                intersection.retainAll(candGenres);

                if (!intersection.isEmpty()) {
                    // Kuch genres common: 25 + (15 * Jaccard)
                    double jaccard = (double) intersection.size() / (seedGenres.size() + candGenres.size() - intersection.size());
                    score += 25.0 + (15.0 * jaccard);
                } else {
                    // Common nahi, par ek doosre ke andar hai ("dance-pop" me "pop", "bollywood romantic" me "romantic")
                    boolean subgenreMatch = false;
                    for (String sg : seedGenres) {
                        for (String cg : candGenres) {
                            if (sg.contains(cg) || cg.contains(sg)) {
                                subgenreMatch = true;
                                break;
                            }
                        }
                        if (subgenreMatch) break;
                    }
                    if (subgenreMatch) {
                        score += 20.0;
                    }
                }
            }
        }

        // 2. Same language: 20
        if (seedLang != null && candLang != null && seedLang.equals(candLang)) {
            score += 20.0;
        }

        // 3. Recombee ka order (30 tak): pehla = 30, 2-3 = 25, 4-7 = 20, baaki = 15.
        // Nakli genre seed pe aadha: naye user ka koi data nahi, to Recombee bas popular gaane deta hai -
        // ye user ke khud chune genres se zyada important nahi hone chahiye.
        if (recombeeRank != null) {
            double recombeeScore;
            if (recombeeRank == 0) recombeeScore = 30.0;
            else if (recombeeRank <= 2) recombeeScore = 25.0;
            else if (recombeeRank <= 6) recombeeScore = 20.0;
            else recombeeScore = 15.0;
            score += genreSeed ? recombeeScore / 2 : recombeeScore;
        }

        // 4. Artist (15 tak) - "A, B" / "A ft. B" jaise kai artists sambhalta hai.
        // Jaan-boojh ke kam rakha hai, taaki same artist genre + language + Recombee pe bhaari na pade.
        Set<String> seedArtists = parseArtistSet(seedSong.getArtistName());
        Set<String> candArtists = parseArtistSet(candidate.artistName());

        if (!seedArtists.isEmpty() && !candArtists.isEmpty()) {
            String seedPrimary = getPrimaryArtistKey(seedSong.getArtistName());
            String candPrimary = getPrimaryArtistKey(candidate.artistName());

            if (seedArtists.equals(candArtists)) {
                score += 15.0; // saare artists same
            } else if (seedPrimary.equals(candPrimary)) {
                score += 15.0; // main (pehla) artist same
            } else {
                Set<String> sharedArtists = new HashSet<>(seedArtists);
                sharedArtists.retainAll(candArtists);
                if (!sharedArtists.isEmpty()) {
                    score += 10.0; // koi ek saath wala / featured artist same
                } else {
                    boolean submatch = false;
                    for (String sa : seedArtists) {
                        for (String ca : candArtists) {
                            if (sa.contains(ca) || ca.contains(sa)) {
                                submatch = true;
                                break;
                            }
                        }
                        if (submatch) break;
                    }
                    if (submatch) {
                        score += 5.0;
                    }
                }
            }
        }

        // 5. Same album: 10
        if (seedAlbum != null && candAlbum != null && seedAlbum.equals(candAlbum)) {
            score += 10.0;
        }

        // 6. Same country: 5
        if (seedCountry != null && candCountry != null && seedCountry.equals(candCountry)) {
            score += 5.0;
        }

        // 7. Popularity (streams se, 10 tak)
        score += computeStreamBoost(candidate.totalStreams());

        // 8. Random 0-3 points ("jitter"): same seed pe har baar thodi alag queue bane
        double jitter = java.util.concurrent.ThreadLocalRandom.current().nextDouble(0.0, 3.0);
        score += jitter;

        // 9. Awaaz ki similarity: tempo, energy, valence, danceability (15 tak)
        score += scoreAudioFeatures(candidate, seedAudio);

        return score;
    }

    static final double TEMPO_WEIGHT = 3.0;
    static final double FEATURE_WEIGHT = 4.0;
    /** Itne BPM ka fark ho to tempo ke 0 points. */
    static final double TEMPO_TOLERANCE = 40.0;
    /** Itna fark (0..1 scale pe) ho to us feature ke 0 points. */
    static final double FEATURE_TOLERANCE = 0.4;
    /** Candidate ka feature pata na ho to aadhe points (na fayda, na nuksaan). */
    static final double UNKNOWN_CREDIT = 0.5;
    /** Sirf awaaz wala seed ho (mood radio) to awaaz ke points kitne guna. */
    static final double AUDIO_ONLY_SEED_MULTIPLIER = 2.0;

    /** Streams se popularity points (log curve, max 10). */
    private double computeStreamBoost(Long streams) {
        if (streams == null || streams <= 0) return 0.0;
        // log10 wala smooth curve: 10 -> 1.6, 100 -> 3.2, 1k -> 4.8, 10k -> 6.4, 1M -> 9.6, max 10.
        // Seedhe jumps (99 = 2 pts, 100 = 5 pts) nahi hote.
        double logStreams = Math.log10(streams + 1);
        return Math.min(10.0, logStreams * 1.6);
    }

    /**
     * Candidate seed jaisa kitna sunai deta hai (max 15 points):
     * tempo 3 tak; energy, valence, danceability 4-4 tak.
     * Har feature: bilkul same = poore points, fark tolerance jitna ya zyada = 0, beech me seedhi line.
     * Seed ka feature na ho to skip. Candidate ka na ho (analyse nahi hua) to aadhe points -
     * taaki sirf "data hone" ki wajah se koi gaana upar na aaye.
     */
    double scoreAudioFeatures(SongDto candidate, AudioProfile seed) {
        if (candidate == null || seed == null || !seed.hasAny()) return 0.0;
        return featureScore(seed.tempo(), candidate.tempo(), TEMPO_TOLERANCE, TEMPO_WEIGHT)
                + featureScore(seed.energy(), candidate.energy(), FEATURE_TOLERANCE, FEATURE_WEIGHT)
                + featureScore(seed.valence(), candidate.valence(), FEATURE_TOLERANCE, FEATURE_WEIGHT)
                + featureScore(seed.danceability(), candidate.danceability(), FEATURE_TOLERANCE, FEATURE_WEIGHT);
    }

    /** Ek feature ke points: weight * (1 - fark/tolerance), 0 se kam nahi; candidate ka value na ho to aadha weight. */
    private static double featureScore(Double seedValue, Double candValue, double tolerance, double weight) {
        if (seedValue == null) return 0.0;
        if (candValue == null) return weight * UNKNOWN_CREDIT;
        double similarity = Math.max(0.0, 1.0 - Math.abs(seedValue - candValue) / tolerance);
        return weight * similarity;
    }

    /** Main (pehle) artist ka saaf naam - diversity limit isi pe lagti hai. */
    public static String getPrimaryArtistKey(String artistName) {
        if (artistName == null || artistName.isBlank()) return "unknown";
        String cleaned = artistName.trim().toLowerCase();
        // Comma, slash, &, ya "ft." / "feat." pe tod ke pehla (main) artist lo
        String[] parts = cleaned.split("[,/&]|\\b(?:ft|feat)(?:\\.|\\b)");
        if (parts.length > 0 && !parts[0].isBlank()) {
            return parts[0].replaceAll("^[.\\s]+|[.\\s]+$", "").trim();
        }
        return cleaned;
    }

    /** Lowercase + trim (null safe). */
    private static String getNormalizedKey(String str) {
        if (str == null || str.isBlank()) return null;
        return str.trim().toLowerCase();
    }
}

