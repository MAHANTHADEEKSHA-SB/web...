const $ = (selector) => document.querySelector(selector);
const toggle = $("#enabled");
let busy = false;
async function send(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok)
    throw new Error(
      response?.error ??
        "Tracker unavailable. Reload the extension and try again.",
    );
  return response;
}
function render(state) {
  toggle.checked = state.enabled;
  toggle.disabled = false;
  $("#export").disabled = false;
  $("#status").textContent = state.enabled
    ? "On · active AI tabs only"
    : "Off · turn on when you’re ready";
  const totalMinutes = state.totalMilliseconds / 60000;
  $("#total").replaceChildren(
    document.createTextNode(
      totalMinutes < 1 && totalMinutes > 0
        ? "<1"
        : Math.round(totalMinutes).toString(),
    ),
  );
  const unit = document.createElement("span");
  unit.textContent = " min";
  $("#total").append(unit);
  $("#sites").replaceChildren();
  for (const row of state.rows.sort(
    (a, b) => b.milliseconds - a.milliseconds,
  )) {
    const item = document.createElement("span");
    item.className = "site";
    item.textContent = `${row.site.name} · ${Math.max(1, Math.round(row.milliseconds / 60000))}m`;
    $("#sites").append(item);
  }
}
async function action(callback) {
  if (busy) return;
  busy = true;
  try {
    await callback();
  } catch (error) {
    $("#notice").textContent = error.message;
  } finally {
    busy = false;
  }
}
toggle.addEventListener("change", () =>
  action(async () => {
    const requested = toggle.checked;
    toggle.disabled = true;
    try {
      render(await send("enabled", { enabled: requested }));
      $("#notice").textContent = requested
        ? "Tracking is on. You can pause at any time."
        : "Tracking paused. Your history is kept.";
    } catch (error) {
      toggle.checked = !requested;
      toggle.disabled = false;
      throw error;
    }
  }),
);
$("#export").addEventListener("click", () =>
  action(async () => {
    const { data } = await send("export");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `orbit-browser-time-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $("#notice").textContent =
      "Exported. Import this file in Orbit → Settings.";
  }),
);
$("#clear").addEventListener("click", () =>
  action(async () => {
    if (
      !confirm(
        "Delete all time recorded by this extension? Export a backup first. Data already imported into Orbit is not affected.",
      )
    )
      return;
    render(await send("clear"));
    $("#notice").textContent = "Tracker history cleared.";
  }),
);
action(async () => render(await send("status")));
setInterval(() => {
  if (!busy) action(async () => render(await send("status")));
}, 5000);
