(() => {
  // Observe send controls only. Never read values, innerText, prompts, or replies.
  const selectors = {
    "chatgpt.com": [
      'button[data-testid="send-button"]',
      "#composer-submit-button",
    ],
    "chat.openai.com": [
      'button[data-testid="send-button"]',
      "#composer-submit-button",
    ],
    "claude.ai": [
      'button[aria-label="Send message"]',
      'button[data-testid="send-button"]',
    ],
    "gemini.google.com": [
      "button.send-button",
      'button[aria-label="Send message"]',
    ],
    "perplexity.ai": [
      'button[data-testid="submit-button"]',
      'button[aria-label="Submit"]',
    ],
    "www.perplexity.ai": [
      'button[data-testid="submit-button"]',
      'button[aria-label="Submit"]',
    ],
    "copilot.microsoft.com": [
      'button[data-testid="submit-button"]',
      'button[aria-label="Submit message"]',
    ],
  };
  const supported = Object.hasOwn(selectors, location.hostname)
    ? selectors[location.hostname]
    : null;
  if (!supported || window.top !== window) return;
  const KEY = "orbit-private-tracker-v1";
  let enabled = false;
  let lastSend = -Infinity;
  chrome.storage.local
    .get(KEY)
    .then((data) => {
      enabled = data[KEY]?.enabled === true;
    })
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY])
      enabled = changes[KEY].newValue?.enabled === true;
  });
  function usable(button) {
    if (
      !button ||
      button.disabled ||
      button.getAttribute("aria-disabled") === "true" ||
      button.getClientRects().length === 0
    )
      return false;
    const state = [
      button.getAttribute("aria-label"),
      button.getAttribute("data-testid"),
      button.className,
    ]
      .join(" ")
      .toLowerCase();
    if (/stop|cancel|interrupt/.test(state)) return false;
    const style = getComputedStyle(button);
    return style.visibility !== "hidden" && style.display !== "none";
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "observer-status")
      return false;
    const recognized = supported.some((selector) =>
      document.querySelector(selector),
    );
    chrome.storage.local.get(KEY).then(
      (data) =>
        respond({ available: data[KEY]?.enabled === true && recognized }),
      () => respond({ available: false }),
    );
    return true;
  });
  function observe(event) {
    if (!enabled || !event.isTrusted || document.visibilityState !== "visible")
      return;
    let button;
    if (event.type === "click")
      button = event.target.closest(supported.join(","));
    if (event.type === "keydown") {
      if (
        event.key !== "Enter" ||
        event.shiftKey ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.isComposing ||
        event.repeat
      )
        return;
      if (
        !event.target.closest(
          'textarea, #prompt-textarea, [contenteditable="true"][role="textbox"], .ProseMirror[contenteditable="true"], rich-textarea [contenteditable="true"]',
        )
      )
        return;
      const scope = event.target.closest("form") || document;
      button = scope.querySelector(supported.join(","));
    }
    if (event.type === "submit")
      button = event.target.querySelector(supported.join(","));
    if (!usable(button)) return;
    const now = performance.now();
    // One action can emit keydown/click plus submit; count it once.
    if (now - lastSend < 750) return;
    lastSend = now;
    chrome.runtime
      .sendMessage({ type: "observed-send", eventId: crypto.randomUUID() })
      .catch(() => {});
  }
  for (const type of ["click", "keydown", "submit"])
    document.addEventListener(type, observe, true);
})();
