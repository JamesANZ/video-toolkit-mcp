/**
 * Custom error classes for Video Transcript API
 */

/**
 * Base exception for all transcript errors
 */
export class TranscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptError";
  }
}

/**
 * Raised when transcripts are disabled or not available for a video
 */
export class TranscriptNotFoundError extends TranscriptError {
  constructor(url: string, reason?: string) {
    const reasonText = reason ? `\n\nReason: ${reason}` : "";
    super(
      `No transcript available for video: ${url}${reasonText}\n\n` +
        `This means the video does not have subtitles/captions available.`,
    );
    this.name = "TranscriptNotFoundError";
    this.url = url;
  }
  url: string;
}

/**
 * Raised when the video platform is not supported
 */
export class PlatformNotSupportedError extends TranscriptError {
  constructor(url: string, platform?: string) {
    const platformText = platform ? ` (${platform})` : "";
    super(
      `Platform not supported: ${url}${platformText}\n\n` +
        `This video platform is not currently supported by the transcript MCP server.`,
    );
    this.name = "PlatformNotSupportedError";
    this.url = url;
    this.platform = platform;
  }
  url: string;
  platform?: string;
}

/**
 * Raised when the video URL is invalid
 */
export class InvalidUrlError extends TranscriptError {
  constructor(url: string) {
    super(
      `Invalid video URL: ${url}\n\n` +
        `Please provide a valid video URL from a supported platform.`,
    );
    this.name = "InvalidUrlError";
    this.url = url;
  }
  url: string;
}

/**
 * Raised when yt-dlp is not installed or not found
 */
export class YtDlpNotFoundError extends TranscriptError {
  constructor() {
    super(
      `yt-dlp is not installed or not found in PATH.\n\n` +
        `Please install yt-dlp to use this MCP server:\n` +
        `  pip install yt-dlp\n` +
        `  or\n` +
        `  brew install yt-dlp\n` +
        `  or download from: https://github.com/yt-dlp/yt-dlp`,
    );
    this.name = "YtDlpNotFoundError";
  }
}

/**
 * Raised when yt-dlp command fails
 */
export class YtDlpError extends TranscriptError {
  constructor(url: string, errorMessage: string, exitCode?: number) {
    const exitCodeText =
      exitCode !== undefined ? ` (exit code: ${exitCode})` : "";
    super(
      `yt-dlp failed for video: ${url}${exitCodeText}\n\n` +
        `Error: ${errorMessage}`,
    );
    this.name = "YtDlpError";
    this.url = url;
    this.exitCode = exitCode;
  }
  url: string;
  exitCode?: number;
}

/**
 * Raised when transcript parsing fails
 */
export class TranscriptParseError extends TranscriptError {
  constructor(url: string, format: string, originalError: Error) {
    super(
      `Failed to parse transcript (${format}) for video: ${url}\n\n` +
        `Error: ${originalError.message}`,
    );
    this.name = "TranscriptParseError";
    this.url = url;
    this.format = format;
    this.originalError = originalError;
  }
  url: string;
  format: string;
  originalError: Error;
}

/**
 * Raised when the video is unavailable
 */
export class VideoUnavailableError extends TranscriptError {
  constructor(url: string, reason?: string) {
    const reasonText = reason ? `\n\nReason: ${reason}` : "";
    super(
      `Video is unavailable: ${url}${reasonText}\n\n` +
        `This could mean the video has been deleted, is private, or is otherwise inaccessible.`,
    );
    this.name = "VideoUnavailableError";
    this.url = url;
  }
  url: string;
}

/**
 * Raised when no transcript is found for the requested language
 */
export class LanguageNotFoundError extends TranscriptError {
  constructor(
    url: string,
    requestedLanguage: string,
    availableLanguages: string[],
  ) {
    super(
      `No transcript found for language '${requestedLanguage}' in video: ${url}\n\n` +
        `Requested language: ${requestedLanguage}\n` +
        `Available languages: ${availableLanguages.length > 0 ? availableLanguages.join(", ") : "None"}`,
    );
    this.name = "LanguageNotFoundError";
    this.url = url;
    this.requestedLanguage = requestedLanguage;
    this.availableLanguages = availableLanguages;
  }
  url: string;
  requestedLanguage: string;
  availableLanguages: string[];
}
