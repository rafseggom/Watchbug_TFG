export type IncidentMetadata = {
  url: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  timestamp: string;
  language: string;
};

/**
 * Collect environment metadata using standard browser APIs.
 * No external dependencies.
 */
export function collectMetadata(): IncidentMetadata {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const screenWidth = typeof window !== 'undefined' && window.screen ? window.screen.width : 0;
  const screenHeight = typeof window !== 'undefined' && window.screen ? window.screen.height : 0;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
  const timestamp = new Date().toISOString();
  const language =
    typeof navigator !== 'undefined' ? (navigator.language ?? 'en') : 'en';

  return {
    url,
    userAgent,
    screenWidth,
    screenHeight,
    viewportWidth,
    viewportHeight,
    timestamp,
    language,
  };
}
