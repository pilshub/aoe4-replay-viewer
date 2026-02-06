import { PLAYER_COLORS } from '../../types/replay.types';

/**
 * Get the hex color for a player by their color index.
 */
export function getPlayerColor(colorIndex: number): number {
  return PLAYER_COLORS[colorIndex] ?? 0x9ca3af;
}

/**
 * Lighten a hex color by a factor (0-1).
 */
export function lightenColor(hex: number, factor: number): number {
  const r = Math.min(255, ((hex >> 16) & 0xff) + 255 * factor);
  const g = Math.min(255, ((hex >> 8) & 0xff) + 255 * factor);
  const b = Math.min(255, (hex & 0xff) + 255 * factor);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

/**
 * Convert hex number to CSS color string.
 */
export function hexToCSS(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
