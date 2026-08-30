# RG Grover Tasks App

This package is adapted from Dave's working Grover Tasks PWA and points to Rebecca's canonical RG Sheets.

## Canonical Sheets

- RG Tasks: `1KuLL5rWDSQK-sXHN0ZeXjHJj6RprFsL03lC-NyeK-dY`
- RG Taxonomy: `1Na-tbzEToQTu1TJDdanMwe3cNxZ6paZfRJ5BZYA4gcw`
- RG Program Board: `1ufHUB77R-K8z1s6O51kD-a2cgFv4zOAQVmxfcc4Xuak`

## Files

- `index.html`
- `app.js`
- `manifest.json`
- `service-worker.js`
- `icon.jpg`
- `icon-192.png`
- `icon-512.png`

The icon files are not included in this zip. Add Rebecca's preferred Grover image before publishing.

## One required configuration step

In `app.js`, replace:

`REPLACE_WITH_RG_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com`

with Rebecca's Google OAuth 2.0 **Web application** client ID.

Do not blindly reuse Dave's client ID. A GitHub Pages app runs from a different JavaScript origin, so either:
1. create a new OAuth client for Rebecca (cleaner), or
2. deliberately add Rebecca's GitHub Pages origin to an existing OAuth client you control.

The Google account Becky signs in with must have edit access to all three RG Sheets.

## GitHub deployment

1. Becky creates/logs into GitHub.
2. Create a repository, e.g. `grover-tasks`.
3. Upload these files plus the three icon images to the repository root.
4. In **Settings → Pages**, publish from the main branch/root.
5. Copy the resulting GitHub Pages URL.
6. In Google Cloud Console, create/configure an OAuth Web client:
   - Authorized JavaScript origin: `https://<becky-github-username>.github.io`
   - If Google requests a redirect URI for the web client, use the exact Pages app URL where appropriate.
7. Put the resulting client ID into `app.js`, commit, and reload.
8. Open the Pages URL and tap **Connect to Google**.
9. Test:
   - load Tasks
   - toggle Today
   - complete/reopen a task
   - add a Quick Note by long-press
   - open Board
   - refresh and verify persistence

## Migration note

The current RG Tasks were migrated from Rebecca's July 29 Claude state. Treat them as a baseline to reconcile, not proof that all 38 tasks remain open today.
