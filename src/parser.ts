/**
 * Transcript parsing for various subtitle formats
 */

import { TranscriptParseError } from "./errors.js";

export interface TranscriptSnippet {
  text: string;
  start: number; // in seconds
  duration: number; // in seconds
}

export type TranscriptFormat = "srt" | "vtt" | "json" | "unknown";

/**
 * Parses transcript data from various formats
 */
export class TranscriptParser {
  /**
   * Detects the format of transcript data
   */
  detectFormat(content: string): TranscriptFormat {
    const trimmed = content.trim();

    // JSON format (yt-dlp sometimes outputs JSON)
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // Not valid JSON
      }
    }

    // VTT format
    if (trimmed.includes("WEBVTT") || /^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      return "vtt";
    }

    // SRT format (most common)
    if (
      /^\d+\s*\n\d{2}:\d{2}:\d{2}/.test(trimmed) ||
      /^\d+\s*\n\d{1,2}:\d{2}:\d{2}/.test(trimmed)
    ) {
      return "srt";
    }

    return "unknown";
  }

  /**
   * Parses transcript content into structured snippets
   */
  parse(content: string, url: string): TranscriptSnippet[] {
    const format = this.detectFormat(content);

    try {
      switch (format) {
        case "srt":
          return this.parseSrt(content);
        case "vtt":
          return this.parseVtt(content);
        case "json":
          return this.parseJson(content);
        default:
          // Try SRT as fallback (most common format)
          try {
            return this.parseSrt(content);
          } catch {
            throw new TranscriptParseError(
              url,
              format,
              new Error(`Unknown transcript format or unable to parse`),
            );
          }
      }
    } catch (error) {
      if (error instanceof TranscriptParseError) {
        throw error;
      }
      throw new TranscriptParseError(
        url,
        format,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Parses SRT (SubRip) format
   */
  private parseSrt(content: string): TranscriptSnippet[] {
    const snippets: TranscriptSnippet[] = [];
    const blocks = content.split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split("\n");
      if (lines.length < 3) continue;

      // Skip sequence number (first line)
      const timeLine = lines[1];
      const textLines = lines.slice(2);

      // Parse timestamp: "00:00:00,000 --> 00:00:05,000" or "0:00:00,000 --> 0:00:05,000"
      const timeMatch = timeLine.match(
        /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/,
      );
      if (!timeMatch) continue;

      const startHours = parseInt(timeMatch[1], 10);
      const startMinutes = parseInt(timeMatch[2], 10);
      const startSeconds = parseInt(timeMatch[3], 10);
      const startMs = parseInt(timeMatch[4], 10);
      const start =
        startHours * 3600 + startMinutes * 60 + startSeconds + startMs / 1000;

      const endHours = parseInt(timeMatch[5], 10);
      const endMinutes = parseInt(timeMatch[6], 10);
      const endSeconds = parseInt(timeMatch[7], 10);
      const endMs = parseInt(timeMatch[8], 10);
      const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMs / 1000;

      const duration = end - start;
      const text = textLines.join(" ").trim();

      if (text) {
        snippets.push({
          text: this.cleanText(text),
          start,
          duration,
        });
      }
    }

    return snippets;
  }

  /**
   * Parses VTT (WebVTT) format
   */
  private parseVtt(content: string): TranscriptSnippet[] {
    const snippets: TranscriptSnippet[] = [];
    const lines = content.split("\n");
    let i = 0;

    // Skip WEBVTT header and any metadata
    while (i < lines.length && !lines[i].includes("-->")) {
      i++;
    }

    while (i < lines.length) {
      // Find timestamp line
      const timeLine = lines[i];
      const timeMatch = timeLine.match(
        /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/,
      );

      if (!timeMatch) {
        i++;
        continue;
      }

      const startHours = parseInt(timeMatch[1], 10);
      const startMinutes = parseInt(timeMatch[2], 10);
      const startSeconds = parseInt(timeMatch[3], 10);
      const startMs = parseInt(timeMatch[4], 10);
      const start =
        startHours * 3600 + startMinutes * 60 + startSeconds + startMs / 1000;

      const endHours = parseInt(timeMatch[5], 10);
      const endMinutes = parseInt(timeMatch[6], 10);
      const endSeconds = parseInt(timeMatch[7], 10);
      const endMs = parseInt(timeMatch[8], 10);
      const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMs / 1000;

      const duration = end - start;

      // Collect text lines until empty line or next timestamp
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() && !lines[i].includes("-->")) {
        textLines.push(lines[i]);
        i++;
      }

      const text = textLines.join(" ").trim();
      if (text) {
        snippets.push({
          text: this.cleanText(text),
          start,
          duration,
        });
      }
    }

    return snippets;
  }

  /**
   * Parses JSON format (yt-dlp sometimes outputs JSON for some platforms)
   */
  private parseJson(content: string): TranscriptSnippet[] {
    const data = JSON.parse(content);
    const snippets: TranscriptSnippet[] = [];

    // Handle different JSON structures
    if (Array.isArray(data)) {
      // Array of transcript entries
      for (const entry of data) {
        if (
          entry.text &&
          (entry.start !== undefined || entry.from !== undefined)
        ) {
          const start = entry.start ?? entry.from ?? 0;
          const end = entry.end ?? entry.to ?? start;
          const duration = end - start;

          snippets.push({
            text: this.cleanText(entry.text),
            start,
            duration,
          });
        }
      }
    } else if (data.body && Array.isArray(data.body)) {
      // Bilibili-style JSON with body array
      for (const entry of data.body) {
        if (entry.content && entry.from !== undefined) {
          const start = entry.from;
          const end = entry.to ?? start;
          const duration = end - start;

          snippets.push({
            text: this.cleanText(entry.content),
            start,
            duration,
          });
        }
      }
    } else if (data.events && Array.isArray(data.events)) {
      // Some platforms use events array
      for (const event of data.events) {
        if (event.segs && Array.isArray(event.segs)) {
          const start = event.tStartMs / 1000;
          let duration = 0;
          const textParts: string[] = [];

          for (const seg of event.segs) {
            if (seg.utf8) {
              textParts.push(seg.utf8);
            }
            if (seg.durationMs) {
              duration += seg.durationMs / 1000;
            }
          }

          if (textParts.length > 0) {
            snippets.push({
              text: this.cleanText(textParts.join("")),
              start,
              duration: duration || 1, // Default to 1 second if no duration
            });
          }
        }
      }
    }

    return snippets;
  }

  /**
   * Cleans text by removing HTML tags and normalizing whitespace
   */
  private cleanText(text: string): string {
    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, "");

    // Decode HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (match, dec) =>
        String.fromCharCode(parseInt(dec, 10)),
      );

    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }
}
