# Voice Translator (한국어 ↔ English)

A tiny web app: tap the mic to start recording, speak Korean or English for as long as you like, tap again to stop, and hear the translation spoken back. Pure HTML/CSS/JavaScript, no server, no API key.

## How it works
- **Speech-to-text / text-to-speech:** the browser's built-in Web Speech API (Chrome, Edge, Safari; Firefox can only type).
- **Translation:** free MyMemory API, with an unofficial Google endpoint as fallback. Max 500 characters per request.

## Run locally
Mic access requires `localhost` or HTTPS, so serve it rather than double-clicking the file:

```
python -m http.server 8000
```

Then open http://localhost:8000 in Chrome or Edge.

## Deploy (free public link)
1. Push this folder to a public GitHub repo.
2. Repo → Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
3. Share `https://<your-username>.github.io/<repo-name>/`.

Alternative with no account setup: drag the folder onto https://app.netlify.com/drop.
