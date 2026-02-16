#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { TranscriptFetcher } from "./transcript-fetcher.js";
import { validateUrl } from "./url-detector.js";

// Get package.json path for version info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// When running from dist/, package.json is in ../package.json
const packageJson = JSON.parse(
  await readFile(join(__dirname, "../package.json"), "utf-8"),
);
const VERSION = packageJson.version;

/**
 * MCP Server for Generic Video Transcript Retrieval
 * Provides tools for fetching transcripts from multiple video platforms
 */
class TranscriptMCPServer {
  private server: Server;
  private fetcher: TranscriptFetcher;

  constructor() {
    this.server = new Server(
      {
        name: "transcript-mcp-server",
        version: VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Initialize transcript fetcher
    this.fetcher = new TranscriptFetcher({
      debug: process.env.DEBUG === "1",
    });

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get-transcript",
          description:
            "Retrieve the transcript of a video from supported platforms (YouTube, Bilibili, Vimeo, etc.). Accepts various URL formats and returns the full transcript with timestamps.",
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: {
              url: {
                type: "string",
                description:
                  "Video URL from any supported platform (e.g., YouTube, Bilibili, Vimeo). Examples: https://www.youtube.com/watch?v=VIDEO_ID, https://www.bilibili.com/video/BVxxxxx, https://vimeo.com/123456789",
              },
              lang: {
                type: "string",
                description:
                  "Language code for transcript (e.g., 'en', 'es', 'fr', 'zh'). Default: video's default language",
              },
              include_timestamps: {
                type: "boolean",
                description:
                  "Include timestamps in the transcript output. Default: true",
              },
            },
            required: ["url"],
            additionalProperties: false,
          },
        },
        {
          name: "list-transcript-languages",
          description:
            "List all available transcript languages for a video from any supported platform.",
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            properties: {
              url: {
                type: "string",
                description:
                  "Video URL from any supported platform (YouTube, Bilibili, Vimeo, etc.)",
              },
            },
            required: ["url"],
            additionalProperties: false,
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (!args) {
          throw new Error("Missing arguments");
        }

        switch (name) {
          case "get-transcript":
            return await this.handleGetTranscript(
              args as {
                url: string;
                lang?: string;
                include_timestamps?: boolean;
              },
            );
          case "list-transcript-languages":
            return await this.handleListLanguages(args as { url: string });
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Format transcript with or without timestamps
   */
  private formatTranscript(
    snippets: Array<{ text: string; start: number; duration: number }>,
    includeTimestamps: boolean = true,
  ): string {
    if (includeTimestamps) {
      return snippets
        .map((entry) => {
          const timestamp = this.formatTime(entry.start);
          return `[${timestamp}] ${entry.text}`;
        })
        .join("\n");
    } else {
      return snippets.map((entry) => entry.text).join(" ");
    }
  }

  /**
   * Format seconds to MM:SS or HH:MM:SS
   */
  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  private async handleGetTranscript(args: {
    url: string;
    lang?: string;
    include_timestamps?: boolean;
  }): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    const { url, lang, include_timestamps = true } = args;

    // Validate URL
    validateUrl(url);

    // Fetch transcript
    const result = await this.fetcher.fetchTranscript(url, {
      language: lang,
    });

    if (!result.snippets || result.snippets.length === 0) {
      throw new Error("No transcript available for this video.");
    }

    const formattedTranscript = this.formatTranscript(
      result.snippets,
      include_timestamps,
    );

    const resultText = [
      `Video Transcript`,
      `URL: ${result.url}`,
      result.languageCode
        ? `Language: ${result.languageCode}${result.isGenerated ? " (auto-generated)" : ""}`
        : "",
      `\n${formattedTranscript}`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
    };
  }

  private async handleListLanguages(args: { url: string }): Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }> {
    const { url } = args;

    // Validate URL
    validateUrl(url);

    try {
      const languages = await this.fetcher.listLanguages(url);

      if (languages.length === 0) {
        throw new Error("No transcripts are available for this video.");
      }

      // Format the output
      const languageList = languages
        .map((lang) => {
          const autoGenLabel = lang.isAutoGenerated ? " (auto-generated)" : "";
          return `  - ${lang.code}: ${lang.name}${autoGenLabel}`;
        })
        .join("\n");

      const result = [
        `Video URL: ${url}`,
        `\nAvailable transcript languages (${languages.length}):`,
        languageList,
        `\nTo get a transcript in a specific language, use the get-transcript tool with the 'lang' parameter.`,
        languages.length > 0
          ? `Example: lang='${languages[0].code}' for ${languages[0].name}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Could not fetch transcript information: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`Transcript MCP Server v${VERSION} running on stdio`);
  }
}

// Start the server
const server = new TranscriptMCPServer();
server.start().catch(console.error);
