export interface UserPlaylist {
  id: string;
  name: string;
  privacy?: "PUBLIC" | "PRIVATE" | string;
  shareToken?: string;
  totalSongs: number;
  userId?: string;
  ownerId?: string;
  ownerName?: string;
  coverImageKey?: string;
}
