/**
 * Video downloader using yt-dlp
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { join, basename } from "path";
import { stat, readdir } from "fs/promises";
import { Config, ensureStorageDir } from "./config.js";

const execFileAsync = promisify(execFile);

export interface DownloadOptions {
  url: string;
  outputDir?: string;
  filename?: string;
  format?: string;
  quality?: string;
}

export interface DownloadResult {
  filePath: string;
  title: string;
  duration: number;
  fileSize: number;
  format: string;
}

export interface VideoInfo {
  title: string;
  duration: number;
  formats: string[];
  thumbnail?: string;
  description?: string;
}

export interface DownloadedFile {
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
}

export class VideoDownloader {
  private config: Config;
  private debug: boolean;

  constructor(config: Config) {
    this.config = config;
    this.debug = config.debug;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.error("[video-downloader]", ...args);
    }
  }

  /**
   * Get video information without downloading
   */
  async getVideoInfo(url: string): Promise<VideoInfo> {
    const args = ["--dump-json", "--no-download", url];
    this.log(`Getting video info: ${this.config.ytDlpPath} ${args.join(" ")}`);

    try {
      const { stdout } = await execFileAsync(this.config.ytDlpPath, args, {
        maxBuffer: 50 * 1024 * 1024,
      });

      const info = JSON.parse(stdout);
      return {
        title: info.title || "Unknown",
        duration: info.duration || 0,
        formats: (info.formats || []).map(
          (f: { format_id: string; ext: string; resolution?: string }) =>
            `${f.format_id} (${f.ext}${f.resolution ? `, ${f.resolution}` : ""})`,
        ),
        thumbnail: info.thumbnail,
        description: info.description,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get video info: ${errorMessage}`);
    }
  }

  /**
   * Download a video to the specified location
   */
  async downloadVideo(options: DownloadOptions): Promise<DownloadResult> {
    const {
      url,
      outputDir,
      filename,
      format = "mp4",
      quality = "best",
    } = options;

    const targetDir = outputDir || this.config.storageDir;
    await ensureStorageDir({ ...this.config, storageDir: targetDir });

    // Get video info first to determine filename
    const videoInfo = await this.getVideoInfo(url);
    const safeTitle = this.sanitizeFilename(videoInfo.title);
    const outputFilename = filename || `${safeTitle}.${format}`;
    const outputPath = join(targetDir, outputFilename);

    // Build yt-dlp command arguments (using execFile to avoid shell escaping issues)
    const formatSelector = this.getFormatSelector(quality, format);

    const args = [`-f`, formatSelector, `-o`, outputPath, `--no-playlist`];

    // Add ffmpeg path if specified
    if (this.config.ffmpegPath !== "ffmpeg") {
      args.push(`--ffmpeg-location`, this.config.ffmpegPath);
    }

    args.push(url);

    this.log(`Downloading video: ${this.config.ytDlpPath} ${args.join(" ")}`);

    try {
      const { stdout, stderr } = await execFileAsync(
        this.config.ytDlpPath,
        args,
        {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 30 * 60 * 1000, // 30 minute timeout
        },
      );

      this.log("yt-dlp stdout:", stdout);
      if (stderr) {
        this.log("yt-dlp stderr:", stderr);
      }

      // Find the actual output file (yt-dlp may have added format codes to filename)
      const actualFile = await this.findDownloadedFile(
        targetDir,
        safeTitle,
        format,
      );

      if (!actualFile) {
        throw new Error("Download completed but output file not found");
      }

      const fileStat = await stat(actualFile);

      return {
        filePath: actualFile,
        title: videoInfo.title,
        duration: videoInfo.duration,
        fileSize: fileStat.size,
        format,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes("Video unavailable") ||
        errorMessage.includes("Private video")
      ) {
        throw new Error(`Video is unavailable or private: ${url}`);
      }

      if (
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("timeout")
      ) {
        throw new Error(`Download timed out for: ${url}`);
      }

      throw new Error(`Failed to download video: ${errorMessage}`);
    }
  }

  /**
   * List downloaded files in a directory
   */
  async listDownloads(directory?: string): Promise<DownloadedFile[]> {
    const targetDir = directory || this.config.storageDir;

    try {
      const files = await readdir(targetDir);
      const downloads: DownloadedFile[] = [];

      const videoExtensions = [".mp4", ".webm", ".mkv", ".avi", ".mov", ".flv"];

      for (const file of files) {
        const ext = file.substring(file.lastIndexOf(".")).toLowerCase();
        if (videoExtensions.includes(ext)) {
          const filePath = join(targetDir, file);
          const fileStat = await stat(filePath);

          downloads.push({
            filename: file,
            path: filePath,
            size: fileStat.size,
            createdAt: fileStat.birthtime,
          });
        }
      }

      // Sort by creation date, newest first
      downloads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return downloads;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Find the actual downloaded file (yt-dlp may modify the filename)
   */
  private async findDownloadedFile(
    dir: string,
    baseName: string,
    format: string,
  ): Promise<string | null> {
    const files = await readdir(dir);

    // First, try exact match
    const exactMatch = files.find((f) => f === `${baseName}.${format}`);
    if (exactMatch) {
      return join(dir, exactMatch);
    }

    // Look for files that start with the base name and have the right extension
    const candidates = files.filter(
      (f) =>
        f.startsWith(baseName) && f.endsWith(`.${format}`) && !f.includes(".f"),
    );

    if (candidates.length > 0) {
      // Return the most recently modified one
      return join(dir, candidates[0]);
    }

    // If no merged file, look for any file with the format extension
    const anyMatch = files.filter(
      (f) => f.startsWith(baseName) && f.endsWith(`.${format}`),
    );

    if (anyMatch.length > 0) {
      return join(dir, anyMatch[0]);
    }

    return null;
  }

  /**
   * Get yt-dlp format selector based on quality preference
   * Uses formats that don't require ffmpeg merging when possible
   */
  private getFormatSelector(quality: string, format: string): string {
    // Use "best" with fallbacks that prefer pre-merged formats (no ffmpeg needed)
    const formatMap: Record<string, string> = {
      best: "best[ext=mp4]/best",
      "1080p": "best[height<=1080][ext=mp4]/best[height<=1080]",
      "720p": "best[height<=720][ext=mp4]/best[height<=720]",
      "480p": "best[height<=480][ext=mp4]/best[height<=480]",
      "360p": "best[height<=360][ext=mp4]/best[height<=360]",
      audio: "bestaudio[ext=m4a]/bestaudio",
    };

    return formatMap[quality] || formatMap["best"];
  }

  /**
   * Sanitize filename to be filesystem-safe
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 200);
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Format duration for display
   */
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }
}
