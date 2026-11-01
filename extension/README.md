# Orbit browser activity tracker

The optional Chrome/Edge extension records active time and **observed send actions** on ChatGPT, Claude, Gemini, Perplexity, and Microsoft Copilot. Version 1.1.0 adds send-action counts. Tracking is **off by default** and stays local to your browser.

## Install from the website

1. Open your Orbit dashboard and choose **Settings → Download extension**.
2. Extract the downloaded ZIP into a folder you will keep on your computer.
3. Open Chrome's extension manager at `chrome://extensions` (Edge: `edge://extensions`).
4. Enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
5. Pin Orbit from the browser's extension menu, refresh any AI tabs already open, then open its popup and enable **Track AI time & sends** when you are ready.

Chrome/Edge 120 or newer is required for the 30-second alarm interval. This is an unpacked extension, not a Chrome Web Store listing.

## Update an existing installation

1. Download the latest extension ZIP from Orbit's Settings. Export a backup from the existing extension first if you want a copy of your history.
2. Extract and replace the files inside the **same extension folder** you originally loaded. Keep the folder in the same location and keep the existing extension installed.
3. Open `chrome://extensions` or `edge://extensions` and click **Reload** on Orbit. Check that its version is **1.1.1** or newer.
4. Refresh your open AI tabs so they use the updated send observer.
5. Open the popup and enable **Track AI time & sends** again. Updating from a version before 1.1.0 pauses tracking once so you can opt in to the expanded behavior; later updates keep your choice. Existing recorded time is retained.

Old time records do not acquire historical send counts: those counts remain unavailable. New counts begin when the updated observer is enabled; earlier messages and existing conversation history are not counted.

## Alternative: install from this project

Download this repository or use your local checkout, then choose the `extension` folder with **Load unpacked** in the browser's extension manager. Select the folder containing `manifest.json`, not the whole repository. Pin Orbit, refresh AI tabs, and enable **Track AI time & sends**.

## Use with the website

Open the extension popup and choose **Export for Orbit**, then import the downloaded JSON file in your Orbit dashboard's Settings. No connection to the dashboard or automatic transmission occurs. Repeat the export/import whenever you want to refresh your totals.

Exports use stable record IDs per installation, provider, and local calendar day. Orbit replaces matching IDs with newer cumulative totals rather than adding duplicates. A record is a daily provider total, not a conversation count. ChatGPT's old and new domains share one daily total. Perplexity and Copilot use Orbit's Other AI provider category while retaining their names in each record.

Exported records include `source: "extension"` and `messageCount`, which is a count when observed or `null` when unavailable in older records. `inputTokens`, `outputTokens`, and `cost` are `null`: the extension does not measure these values. Unknown does not mean zero. The dashboard prioritizes time and observed sends; manually logged tokens and estimated costs remain separate.

## What a send count means

A narrowly scoped content script watches trusted clicks, Enter presses, and form submissions on recognized send controls. It inspects control structure and attributes without reading input values, prompt text, or replies. It does not scan existing conversations or count messages loaded from history. Related events within 750 milliseconds are combined, and background event IDs prevent a repeated event from being counted again.

These are **observed submission actions**, not provider-confirmed successful messages. An attempted send that the provider rejects may still be counted. A different language, keyboard behavior, changed site layout, or unrecognized control can cause missed actions; very rapid sends can be combined. The extension does not access official token usage, billing totals, subscription credits, remaining limits, or API usage. It does not estimate those values from sends or time.

## Privacy and permissions

- `storage`: stores your opt-in choice, daily totals, and short-lived event IDs used to avoid duplicates in the current browser profile.
- `alarms`: samples active time every 30 seconds even when the popup is closed.
- `idle`: pauses accounting when the device is idle or locked.
- Host access and content scripts are limited to `chatgpt.com`, `chat.openai.com`, `claude.ai`, `gemini.google.com`, `perplexity.ai`, `www.perplexity.ai`, and `copilot.microsoft.com` over HTTPS. This identifies supported active tabs and observes their send controls.

There is **no broad tabs permission**, prompt/reply storage, tab-title collection, analytics, or network request. The content script inspects UI controls; it does not read prompt or reply contents. Incognito windows are ignored. Keep incognito access disabled in the browser's extension settings. Google Search, unrelated websites, mobile apps, and desktop AI apps are not tracked.

Everything remains local until you deliberately export it. Disable tracking whenever you like; disabling preserves history. Clear history with the popup's confirmation dialog, or uninstall the extension. Records already imported into Orbit are managed separately in the website.

## Time measurement limits

Time is recorded for the active supported tab in the focused normal browser window. Switching tabs, leaving the browser, locking the device, or being idle for 60 seconds pauses accounting. Gaps longer than 90 seconds are discarded to avoid counting long sleeps or worker delays. The worker persists its cursor after samples so ordinary service-worker suspension does not reset your totals.

Reading without any input can be undercounted after a minute. Browser/OS scheduling can delay samples. This is a personal awareness tool, not precise billable timekeeping.

Run `npm test` at the repository root for automated accounting and export checks. After installation, verify the real browser behavior on the services you use: enable tracking, spend at least 30 seconds on a supported tab, send a message, then inspect and export the popup totals. Confirm the counters before relying on a site's observer, since provider UI changes can affect detection.
