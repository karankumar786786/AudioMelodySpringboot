import { api } from "./baseApi";

export interface GenrePreferences {
  genres: string[];
}

/**
 * P6: Cold-start genre onboarding preference service.
 * Calls the backend to save/fetch the user's genre preferences.
 */
export const genrePreferenceService = {
  /** Save selected genres after onboarding. */
  async saveGenres(genres: string[]): Promise<void> {
    await api.post("/preferences/genres", { genres });
  },

  /** Fetch current genre preferences. */
  async getGenres(): Promise<GenrePreferences> {
    const res = await api.get<GenrePreferences>("/preferences/genres");
    return res.data;
  },
};

