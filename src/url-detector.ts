/**
 * URL detection and platform identification
 */

import { InvalidUrlError, PlatformNotSupportedError } from "./errors.js";

export type Platform = "youtube" | "bilibili" | "vimeo" | "unknown";

export interface VideoInfo {
  platform: Platform;
  url: string;
  videoId?: string;
}

/**
 * Detects the video platform from a URL
 */
export function detectPlatform(url: string): Platform {
  const normalizedUrl = url.trim();

  // YouTube patterns
  if (
    /(?:youtube\.com|youtu\.be|m\.youtube\.com)/.test(normalizedUrl) ||
    /^[a-zA-Z0-9_-]{11}$/.test(normalizedUrl) // Direct YouTube video ID
  ) {
    return "youtube";
  }

  // Bilibili patterns
  if (/bilibili\.com/.test(normalizedUrl) || /b23\.tv/.test(normalizedUrl)) {
    return "bilibili";
  }

  // Vimeo patterns
  if (/vimeo\.com/.test(normalizedUrl)) {
    return "vimeo";
  }

  // Check if it's a valid URL format
  try {
    new URL(normalizedUrl);
    return "unknown"; // Valid URL but unknown platform
  } catch {
    throw new InvalidUrlError(url);
  }
}

/**
 * Extracts video information from a URL
 */
export function extractVideoInfo(url: string): VideoInfo {
  const normalizedUrl = url.trim();
  const platform = detectPlatform(normalizedUrl);

  let videoId: string | undefined;

  switch (platform) {
    case "youtube":
      videoId = extractYouTubeVideoId(normalizedUrl);
      break;
    case "bilibili":
      videoId = extractBilibiliVideoId(normalizedUrl);
      break;
    case "vimeo":
      videoId = extractVimeoVideoId(normalizedUrl);
      break;
    case "unknown":
      // For unknown platforms, we'll still try to use yt-dlp
      // which might support it
      break;
  }

  return {
    platform,
    url: normalizedUrl,
    videoId,
  };
}

/**
 * Extracts YouTube video ID from various URL formats
 */
function extractYouTubeVideoId(input: string): string {
  // Direct video ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/watch\?.*v=([^&\?\/]+)/,
    /youtube\.com\/v\/([^&\?\/]+)/,
    /m\.youtube\.com\/watch\?v=([^&\?\/]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new InvalidUrlError(input);
}

/**
 * Extracts Bilibili video ID (BV or AV) from URL
 */
function extractBilibiliVideoId(url: string): string | undefined {
  // BV format: https://www.bilibili.com/video/BVxxxxx
  const bvMatch = url.match(/\/video\/(BV[a-zA-Z0-9]+)/);
  if (bvMatch) {
    return bvMatch[1];
  }

  // AV format: https://www.bilibili.com/video/avxxxxx
  const avMatch = url.match(/\/video\/av(\d+)/);
  if (avMatch) {
    return `av${avMatch[1]}`;
  }

  // Short link: https://b23.tv/xxxxx (yt-dlp can handle this)
  if (url.includes("b23.tv")) {
    return undefined; // Let yt-dlp handle short links
  }

  return undefined;
}

/**
 * Extracts Vimeo video ID from URL
 */
function extractVimeoVideoId(url: string): string | undefined {
  // https://vimeo.com/123456789
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (match) {
    return match[1];
  }

  // https://vimeo.com/channels/xxxxx/123456789
  const channelMatch = url.match(/vimeo\.com\/channels\/[^\/]+\/(\d+)/);
  if (channelMatch) {
    return channelMatch[1];
  }

  return undefined;
}

/**
 * Validates that a URL is supported
 */
export function validateUrl(url: string): void {
  try {
    const info = extractVideoInfo(url);
    if (info.platform === "unknown") {
      // Unknown platform, but we'll let yt-dlp try to handle it
      // yt-dlp supports many platforms we don't explicitly list
      return;
    }
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      throw error;
    }
    throw new InvalidUrlError(url);
  }
}
