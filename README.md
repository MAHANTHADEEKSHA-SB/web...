# Orbit

A personal dashboard for understanding how you use AI. Log sessions across Claude, ChatGPT, Gemini, and other tools; explore time, tokens, and estimated costs; and keep a portable backup of your history.

Orbit is a static website. It runs without a backend, paid subscription, database, or API key, and can be hosted for free.

## Run locally

Install Node.js 22.12 or newer, then run these commands from this repository:

```sh
npm ci
npm run dev
```

Open the address printed by Vite. To validate and preview the production build:

```sh
npm test
npm run build
npm run preview
```

The generated website is in `dist/`. The relative asset base lets it work on a GitHub Pages repository path as well as a custom domain.

## Track your usage

- For automatic time estimates, open **Settings → Browser extension → Download extension** in Orbit, extract the ZIP, and follow the [Chrome/Edge installation guide](extension/README.md). Tracking is off until you enable it. It records active AI website time locally and never reads prompts or conversations. Export from its popup, then import the file into Orbit to refresh your dashboard.
- Log a session with an AI provider, a description, and the time you spent. Token counts and cost are optional.
- Filter your activity and explore the dashboard to see how your habits change.
- Try the demo to explore the interface with sample activity. Demo activity is separate from your own history.
- Export your history regularly and import the backup when moving to another browser or device.

Cost estimates use illustrative provider rates. Enter a known cost per session to override the estimate. They are not a billing statement from an AI provider. Chat subscriptions and API usage are billed differently, and this website does not read your provider account or invoices.

## Host for free with GitHub Pages

The included GitHub Actions workflow builds and publishes `dist/` when changes are pushed to `main`. You can also run it manually from the repository's **Actions** tab.

1. Push this project to your GitHub repository. GitHub Pages is available for public repositories on GitHub Free.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push a commit to `main`, or open **Actions → Deploy Orbit to GitHub Pages → Run workflow**.
5. Wait for the workflow to finish. The deployment step and **Settings → Pages** will display your site's published address.

No secrets or API keys are required. If your default branch has a different name, update the branch under `push` in `.github/workflows/deploy.yml`.

## Alternative: Cloudflare Pages

Create a Cloudflare Pages project and connect this repository. Choose **None** as the framework preset, use `npm run build` as the build command, and `dist` as the output directory. Use Node.js 22.12 or newer for the build. Cloudflare provides the public address after deployment.

You can also upload the contents of a local `dist/` build to any static hosting service.

## Your data

Your personal usage history is stored in this browser's local storage for this site's address. It is not sent to a server by Orbit and is not shared between devices. Clearing site data or using a different browser, hostname, or port gives you a different history. Private browsing may discard your history when the window closes.

Export a backup before clearing browser data or changing your hosting address. Treat exports as personal data: they contain your session descriptions and usage details. Hosting providers may retain normal website access logs under their own policies.
