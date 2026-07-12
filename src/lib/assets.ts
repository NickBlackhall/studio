/**
 * Avatar paths are persisted in players.avatar, so rows written before the WebP
 * migration still carry ".png" plus a legacy "?v=3" cache-buster. Normalizing
 * here at render time keeps those rows rendering correctly without a backfill.
 */
function toWebp(assetPath: string): string {
  return assetPath.split('?')[0].replace(/\.(png|jpe?g)$/i, '.webp');
}

export function avatarSrc(avatar: string): string {
  return toWebp(avatar);
}

/** The celebratory variant sits alongside each avatar as `<name>-winner.webp`. */
export function winnerAvatarSrc(avatar: string): string {
  return toWebp(avatar).replace(/\.webp$/, '-winner.webp');
}
