export interface UserPlaylist {
  id: string;
  name: string;
  privacy?: "PUBLIC" | "PRIVATE" | "SHARE_BY_LINK" | string;
  shareToken?: string;
  totalSongs: number;
  userId?: string;
  ownerId?: string;
  ownerName?: string;
  coverImageKey?: string;
}
