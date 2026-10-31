# Orbit browser time tracker

An optional Chrome/Edge extension that estimates active time on ChatGPT, Claude, Gemini, Perplexity, and Microsoft Copilot. Tracking is **off by default** and stays local to your browser.

## Install from the website

1. Open your Orbit dashboard and choose **Settings → Browser extension → Download extension**.
2. Extract the downloaded ZIP into a folder you will keep on your computer.
3. Open Chrome's extension manager at `chrome://extensions` (Edge: `edge://extensions`).
4. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
5. Pin Orbit from the browser's extension menu, open its popup, and enable **Track my AI time** when you are ready.

## Alternative: install from this project

1. Download this repository as a ZIP and extract it, or use your local checkout.
2. Open Chrome's extension manager at `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode**, choose **Load unpacked**, and select this `extension` folder. Select the folder containing `manifest.json`, not the whole repository.
4. Pin Orbit from the browser's extension menu, open its popup, and enable **Track my AI time** when you are ready.

Chrome/Edge 120 or newer is required for the 30-second alarm interval. This is an unpacked extension, not a Chrome Web Store listing. After updating its files, click **Reload** in the extension manager.

## Use with the website

Open the extension popup and choose **Export for Orbit**, then import the downloaded JSON file in your Orbit dashboard's Settings. No connection to the dashboard or automatic transmission occurs. Repeat the export/import whenever you want to refresh your totals.

Exports use stable record IDs per installation, provider, and local calendar day. The dashboard should replace matching IDs with the newer cumulative totals rather than adding duplicates. A record is a daily provider total, not a conversation count. ChatGPT's old and new domains share one daily total. Perplexity and Copilot use Orbit's Other AI provider category while retaining their names in each record.

## Privacy and permissions

- `storage`: stores your opt-in choice and daily time totals in the current browser profile.
- `alarms`: samples active time every 30 seconds even when the popup is closed.
- `idle`: pauses accounting when the device is idle or locked.
- Host access only for `chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`, `perplexity.ai`, `www.perplexity.ai`, and `copilot.microsoft.com` over HTTPS: identifies the supported active tab's URL. Only the recognized provider name is retained.

There is **no broad tabs permission**, content script, prompt reading, page-content reading, title collection, analytics, or network request. The browser's permission warning describes host access broadly; the actual source only uses that access to identify supported URLs. Incognito windows are ignored. Keep incognito access disabled in the browser's extension settings.

Everything remains local until you deliberately export it. Disable tracking whenever you like; disabling preserves history. Clear history with the popup's confirmation dialog, or uninstall the extension. Records already imported into Orbit are managed separately in the website.

## Measurement limits

Time is estimated for the active supported tab in the focused normal browser window. Switching tabs, leaving the browser, locking the device, or being idle for 60 seconds pauses accounting. Gaps longer than 90 seconds are discarded to avoid counting long sleeps or worker delays. The worker persists its cursor after samples so ordinary service-worker suspension does not reset your totals.

Reading without any input can be undercounted after a minute. Browser/OS scheduling can delay samples. This is a personal awareness tool, not precise billable timekeeping. It does not measure prompts, token usage, subscription fees, API usage, or costs; those export fields are zero.

Run `npm test` at the repository root for automated time-accounting and export-compatibility checks. A final browser check is simple: enable tracking, use a supported tab for at least 30 seconds, switch away, then inspect/export the popup total.
