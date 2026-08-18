console.log("Sanctum Aimed Cap | Loading...");

if (window._aimedCapHookId) {
  Hooks.off("renderCPRRollDialog", window._aimedCapHookId);
  delete window._aimedCapHookId;
}

if (!window._aimedCapProcessed) window._aimedCapProcessed = new WeakMap();

function getSelectedFireMode(itemId) {
  if (!itemId) return null;
  const checkboxes = document.querySelectorAll(`a.fire-checkbox[data-item-id="${itemId}"]`);
  for (const a of checkboxes) {
    const icon = a.querySelector("i");
    if (icon && icon.classList.contains("fa-circle-dot")) {
      return a.dataset.fireMode; // "aimed" | "autofire" | "suppressive"
    }
  }
  return null;
}

window._aimedCapHookId = Hooks.on("renderCPRRollDialog", (app, html) => {
  if (window._aimedCapProcessed.has(app)) return;
  window._aimedCapProcessed.set(app, true);

  try {
    const { item } = app;
    if (!item || item.type !== "weapon") return;

    const title = (html.closest(".app")?.find(".window-title").text() || "").toLowerCase();
    const bodyText = html.text().toLowerCase();

    const isDamageDialog =
      title.includes("damage") ||
      title.includes("rolling damage") ||
      bodyText.includes("rolling damage") ||
      bodyText.includes("damage:");

    if (isDamageDialog) return;

    const selectedMode = getSelectedFireMode(item.id);
    if (selectedMode !== "aimed") return;

    const modInput = html.find("input[name='additionalMods']");
    if (!modInput.length) return;

    // Wait for other hooks (ammo, etc.) to finish first
    setTimeout(() => {
      const totalEl = html.find(".total-mod-value").first();
      if (!totalEl.length) return;

      let currentTotal = parseInt(totalEl.text().replace(/[^-\d]/g, ""), 10);
      if (isNaN(currentTotal)) return;

      console.log("%c[Aimed Cap] Total Mods =", "color: #ff9800", currentTotal);

      if (currentTotal <= -2) {
        console.log("%c[Aimed Cap] Already ≤ –2, no change", "color: #7dffa0");
        return;
      }

      const currentAdditional = parseInt(modInput.val(), 10) || 0;
      const difference = currentTotal - (-2);
      const corrected = currentAdditional - difference;

      modInput.val(corrected);
      const el = modInput[0];
      ["focus", "input", "change", "blur"].forEach((evt) => {
        el.dispatchEvent(new Event(evt, { bubbles: true }));
      });
      modInput.trigger("focus").trigger("input").trigger("change").trigger("blur");

      html.find("p.sanctum-aimed-cap-msg").remove();
      modInput.closest(".form-group").after(
        `<p class="sanctum-aimed-cap-msg" style="color:#ff9800;font-weight:bold;margin:6px 0;">
          Aimed: Total Mods capped at –2 (adjusted by ${difference})
        </p>`
      );

      console.log(
        `%c[Aimed Cap] additionalMods ${currentAdditional} → ${corrected} (Total Mods → –2)`,
        "color: #7dffa0"
      );
    }, 200);
  } catch (err) {
    console.error("[Sanctum Aimed Cap] ERROR:", err);
  }
});

console.log("Sanctum Aimed Cap | Ready");