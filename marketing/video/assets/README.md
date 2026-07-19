# Video Assets

This folder is reserved for generated or cropped video assets.

The current promo page reuses the generated repository images directly:

- `../chatgpt-question-navigator-poster.png`
- `../../docs/images/usage-screenshot.png`
- `../../docs/images/usage-screenshot-en.png`

Music:

- `grand_project-wonders-of-the-earth-550792.mp3`
- The promo page starts playback at `30s` and uses the next 20 seconds for the video.

Export and validate the final 1920 x 1080 MP4 from the repository root:

```powershell
node marketing/video/render-video.cjs
```

Run metadata validation without re-rendering:

```powershell
node marketing/video/render-video.cjs --validate-only
```

Keep exported video files out of git unless they are intentionally added for a
release or documentation update.
