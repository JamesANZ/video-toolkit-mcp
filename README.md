# Generic Video Transcript MCP Server

A Model Context Protocol (MCP) server that retrieves transcripts from multiple video platforms (YouTube, Bilibili, Vimeo, etc.) using yt-dlp. This server allows you to easily extract video transcripts for analysis, summarization, or content creation.

## Features

- **Multi-Platform Support**: Works with YouTube, Bilibili, Vimeo, and any platform supported by yt-dlp
- **Get Video Transcripts**: Extract full transcripts from any video with available captions
- **Multiple URL Formats**: Support for various URL formats from different platforms
- **Timestamp Support**: Include or exclude timestamps in transcript output
- **Language Selection**: Request transcripts in specific languages when available
- **Language Listing**: Check available transcript languages for any video
- **Error Handling**: Graceful handling of videos without transcripts or invalid URLs

## Prerequisites

- **Node.js** >= 16.0.0
- **yt-dlp** must be installed and available in your PATH

### Installing yt-dlp

Install yt-dlp using one of the following methods:

**Using pip:**

```bash
pip install yt-dlp
```

**Using Homebrew (macOS):**

```bash
brew install yt-dlp
```

**Using pipx:**

```bash
pipx install yt-dlp
```

**Or download from:** https://github.com/yt-dlp/yt-dlp

Verify installation:

```bash
yt-dlp --version
```

## Installation

### Option 1: Install from Source

1. Clone this repository:

```bash
git clone <repository-url>
cd transcript-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

### Option 2: Global Installation (after publishing)

```bash
npm install -g transcript-mcp
```

## Configuration

### For Claude Desktop / Claude Code

Add the MCP server to your configuration file:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "transcript-mcp": {
      "command": "node",
      "args": ["/path/to/transcript-mcp/dist/index.js"]
    }
  }
}
```

**Claude Code** (`~/.claude.json`):

```json
{
  "mcpServers": {
    "transcript-mcp": {
      "command": "node",
      "args": ["/path/to/transcript-mcp/dist/index.js"]
    }
  }
}
```

If installed globally:

```json
{
  "mcpServers": {
    "transcript-mcp": {
      "command": "transcript-mcp"
    }
  }
}
```

## Usage

Once configured, restart Claude Desktop/Claude Code. The following tools will be available:

### 1. get-transcript

Retrieve the transcript of a video from any supported platform.

**Parameters:**

- `url` (required): Video URL from any supported platform
- `lang` (optional): Language code for transcript (e.g., 'en', 'es', 'fr', 'zh'). Default: video's default language
- `include_timestamps` (optional): Include timestamps in output. Default: true

**Supported Platforms:**

- YouTube: `https://www.youtube.com/watch?v=VIDEO_ID`, `https://youtu.be/VIDEO_ID`
- Bilibili: `https://www.bilibili.com/video/BVxxxxx`, `https://b23.tv/xxxxx`
- Vimeo: `https://vimeo.com/123456789`
- Any platform supported by yt-dlp

**Examples:**

```
Get the transcript from https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

```
Get the transcript without timestamps from https://www.bilibili.com/video/BV1xx411c7mu
```

```
Get the Chinese transcript from this video: https://www.bilibili.com/video/BV1xx411c7mu lang=zh
```

### 2. list-transcript-languages

List all available transcript languages for a video.

**Parameters:**

- `url` (required): Video URL from any supported platform

**Example:**

```
What transcript languages are available for https://www.youtube.com/watch?v=dQw4w9WgXcQ?
```

## Example Workflows

### Summarize a Video

```
Get the transcript from https://www.youtube.com/watch?v=VIDEO_ID and summarize the key points
```

### Extract Quotes

```
Get the transcript without timestamps from https://www.youtube.com/watch?v=VIDEO_ID and extract 3 key quotes
```

### Multi-Language Support

```
What languages are available for https://www.bilibili.com/video/BVxxxxx?
Get the English transcript if available, otherwise get the default language
```

### Content Creation

```
Get the transcript from this tutorial video and extract all code examples mentioned
```

## Platform Support

This MCP server supports any video platform that yt-dlp supports, including:

- **YouTube** - Full support
- **Bilibili** - Full support
- **Vimeo** - Full support
- **Many others** - Any platform supported by yt-dlp

For a complete list of supported platforms, see: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md

## Technical Details

- Built with TypeScript and the [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- Uses yt-dlp as a subprocess for transcript extraction
- Supports SRT, VTT, and JSON subtitle formats
- Runs as a local Node.js process communicating via stdio
- Zero external dependencies for transcript parsing (uses native Node.js APIs)

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Running in Development Mode

```bash
npm run dev
```

### Project Structure

```
transcript-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── transcript-fetcher.ts # Core transcript fetching using yt-dlp
│   ├── url-detector.ts       # Platform detection from URLs
│   ├── parser.ts             # Transcript parsing (SRT, VTT, JSON)
│   └── errors.ts             # Custom error classes
├── test/
│   └── transcript.test.ts    # Unit tests
├── dist/                     # Compiled JavaScript (after build)
└── package.json
```

## Troubleshooting

### "yt-dlp is not installed" Error

Make sure yt-dlp is installed and available in your PATH:

```bash
yt-dlp --version
```

If it's not found, install it using one of the methods in the Prerequisites section.

### "No transcript available" Errors

- Not all videos have transcripts/subtitles
- Some videos only have auto-generated captions in certain languages
- Private or restricted videos cannot be accessed
- Try checking if the video has captions enabled on the platform

### "Platform not supported" Errors

- The server uses yt-dlp which supports many platforms
- If a platform isn't working, check if yt-dlp supports it: `yt-dlp --list-extractors`
- Some platforms may require login or have region restrictions

### Language Not Found

- Use the `list-transcript-languages` tool to check available languages
- Common language codes: 'en', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'ru', 'zh', etc.
- Not all videos have transcripts in all languages

### Invalid URL Errors

- Ensure you're using a valid video URL format
- Make sure the video exists and is publicly accessible
- Some platforms have specific URL formats (check platform documentation)

## Limitations

- Requires yt-dlp to be installed separately
- Transcript availability depends on the video platform and video settings
- Some platforms may rate-limit requests
- Very long transcripts may exceed MCP token limits (use `include_timestamps: false` for long videos)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Acknowledgments

- Built on top of [yt-dlp](https://github.com/yt-dlp/yt-dlp) for multi-platform video support
- Inspired by the [youtube-transcript-mcp](https://github.com/hancengiz/youtube-transcript-mcp) project
