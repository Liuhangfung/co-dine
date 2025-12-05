# yt-dlp Setup Guide

This guide explains how to install and configure `yt-dlp` for real video transcript extraction.

## What is yt-dlp?

`yt-dlp` is a command-line program to download videos and subtitles from YouTube and many other video platforms. It's used by this application to extract **real video transcripts** (actual spoken words) from videos.

## Installation

### Option 1: Using pip (Recommended)

```bash
pip install yt-dlp
```

### Option 2: Using Homebrew (macOS)

```bash
brew install yt-dlp
```

### Option 3: Download Executable

Download the standalone executable from:
- https://github.com/yt-dlp/yt-dlp/releases

### Option 4: Using npm (via @distube/ytdl-core)

If you prefer a Node.js package, you can use:
```bash
npm install @distube/ytdl-core
```

However, the current implementation uses the command-line `yt-dlp` tool directly.

## Verify Installation

After installation, verify that `yt-dlp` is available:

```bash
yt-dlp --version
```

You should see a version number (e.g., `2024.1.1`).

## How It Works in This Application

### Complete Flow:

1. **Video URL Detection**: When scraping a video URL (YouTube, Bilibili, Xiaohongshu, etc.), the system detects it's a video platform.

2. **Try Subtitle Download** (Primary Method):
   - Uses `yt-dlp` to download subtitle files (.srt or .vtt format) from the video
   - Parses subtitle files to extract actual spoken words
   - ✅ **Fastest method** - uses existing subtitles

3. **Fallback to Audio Transcription** (If no subtitles):
   - Downloads audio from video using `yt-dlp`
   - Uploads audio to storage (S3)
   - Transcribes audio using Whisper API
   - ✅ **Works even without subtitles** - gets real spoken words

4. **Fallback to Page Extraction** (If both fail):
   - Extracts video descriptions, tags, comments from the page
   - ⚠️ **Limited** - only gets written descriptions, not spoken words

5. **AI Analysis**: The transcript (or description) is combined with page content and sent to AI for recipe extraction.

### Priority Order:
```
1. Subtitle files (fastest, most accurate)
   ↓ (if no subtitles)
2. Audio transcription (slower, but gets real transcript)
   ↓ (if transcription fails)
3. Page extraction (fastest fallback, but limited)
```

## Supported Platforms

`yt-dlp` supports many platforms including:
- ✅ YouTube
- ✅ Bilibili
- ✅ Xiaohongshu (if subtitles available)
- ✅ Many other video platforms

## Troubleshooting

### Error: "yt-dlp command not found"

**Solution**: Install yt-dlp using one of the methods above.

### Error: "No subtitle files found"

**Possible reasons**:
- The video doesn't have subtitles/captions available
- Subtitles are not available in the requested language
- The platform doesn't support subtitle extraction

**Solution**: The system will automatically:
1. Try audio transcription (downloads audio and transcribes with Whisper)
2. If that fails, fallback to page extraction (descriptions, tags, comments)

**Note**: Audio transcription requires:
- `yt-dlp` installed (for audio download)
- Whisper API configured (BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY)
- Storage configured (for temporary audio upload)

### Error: "Permission denied"

**Solution**: Make sure `yt-dlp` is executable:
```bash
chmod +x $(which yt-dlp)
```

### Windows-specific Issues

On Windows, you may need to:
1. Add Python to your PATH
2. Use `python -m pip install yt-dlp`
3. Or download the Windows executable from the releases page

## Configuration

The system automatically:
- Prioritizes Chinese subtitles (zh, zh-Hans, zh-Hant)
- Falls back to English if Chinese not available
- Uses auto-generated subtitles if manual subtitles don't exist
- Converts all subtitles to .srt format for easier parsing

## Benefits

✅ **Real Transcripts**: Gets actual spoken words from videos, not just descriptions
✅ **Better AI Analysis**: More accurate recipe extraction from video content
✅ **Multi-language Support**: Supports multiple languages automatically
✅ **Fallback Mechanism**: If yt-dlp fails, falls back to page extraction

## Notes

- `yt-dlp` is a Python-based tool, so Python must be installed
- The tool downloads subtitles only (not the video itself) for faster processing
- Temporary subtitle files are automatically cleaned up after extraction

