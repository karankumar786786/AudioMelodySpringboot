package me.one_org.melody.Enums;

/**
 * Artist ko follow karne ka event kis type ka hai.
 * FOLLOW = user ne artist ko follow kiya, UNFOLLOW = follow hata diya.
 * Ye value artist_follow_events table me save hoti hai.
 */
public enum FollowEvent {
    FOLLOW,
    UNFOLLOW
}
