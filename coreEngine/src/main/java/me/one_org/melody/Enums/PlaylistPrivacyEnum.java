package me.one_org.melody.Enums;

/**
 * User ki playlist kaun dekh sakta hai.
 * - PUBLIC        : sab log dekh sakte hain
 * - PRIVATE       : sirf owner dekh sakta hai
 * - SHARE_BY_LINK : jiske paas share link (token) hai wahi dekh sakta hai
 */
public enum PlaylistPrivacyEnum {
    PUBLIC,
    PRIVATE,
    SHARE_BY_LINK
}
