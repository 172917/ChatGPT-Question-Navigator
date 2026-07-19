# Video Assets

The 37-second product film reads its two source recordings from explicit local paths. Raw recordings are never copied into this repository.

Render both deliverables from the repository root:

```powershell
node marketing/video/render-video.cjs `
  --source-chat "C:\path\to\chat-recording.mp4" `
  --source-nav "C:\path\to\navigation-recording.mp4" `
  --profile all
```

Profiles:

- `master`: 1920 × 1080, 60 fps, 12 Mbps target video bitrate.
- `github`: 1920 × 1080, 30 fps, 4 Mbps target video bitrate, maximum 25 MB.

Validate existing exports without rendering:

```powershell
node marketing/video/render-video.cjs --validate-only --profile all
```

The soundtrack uses `grand_project-wonders-of-the-earth-550792.mp3`, supplied by the project owner. The renderer decodes it locally, applies controlled gain plus fade-in/fade-out, and records it into both output profiles.
