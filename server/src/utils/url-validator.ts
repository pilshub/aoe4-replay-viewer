/**
 * Validates that a URL points to a valid aoe4world replay or is a direct .rec file URL.
 */
export function validateReplayUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Allow aoe4world.com replay URLs
    if (parsed.hostname === 'aoe4world.com' || parsed.hostname === 'www.aoe4world.com') {
      return { valid: true };
    }

    // Allow direct .rec file URLs from any host
    if (parsed.pathname.endsWith('.rec')) {
      return { valid: true };
    }

    // Allow any https URL (the parser will validate further)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return { valid: true };
    }

    return { valid: false, error: 'URL must be an aoe4world.com replay URL or a direct .rec file link' };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
