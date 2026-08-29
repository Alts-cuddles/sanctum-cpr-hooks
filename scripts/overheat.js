// ============================================
// Sanctum - Overheat Toggle
// ============================================

console.log("%cSanctum Overheat | Loading", "color: #ff9500; font-weight: bold");

(() => {
  if (globalThis.sanctumOverheatRegistered) return;
  globalThis.sanctumOverheatRegistered = true;

  const STATUS_ID = "y4y0rvsz17aj0r4g";

  async function sanctumHandleOverheat(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    if (!game.user.isGM) {
      ui.notifications.error("Only the GM can toggle On Fire.");
      return;
    }

    const button = $(ev.currentTarget);
    const targetId = button.attr("data-target-id") || button.data("target-id");
    const targetName = button.attr("data-target-name") || button.data("target-name") || "Unknown";

    if (!targetId) {
      ui.notifications.error("No target ID found on the button.");
      return;
    }

    const target = canvas.tokens.get(targetId);
    if (!target?.actor) {
      ui.notifications.error(`Could not find token: ${targetName}`);
      return;
    }

    const actor = target.actor;
    const alreadyOnFire = actor.effects.some(e =>
      !e.disabled && (e.statuses?.has(STATUS_ID) || e.name === "On Fire (Strong)")
    );

    try {
      if (alreadyOnFire) {
        await actor.toggleStatusEffect(STATUS_ID, { active: false });
        ui.notifications.info(`${target.name} is no longer On Fire`);
        button.css({ opacity: "1", color: "#ff9500" }).html(`<i class="fas fa-fire"></i>`);
      } else {
        await actor.toggleStatusEffect(STATUS_ID, { active: true });
        ui.notifications.info(`${target.name} is now On Fire (Strong)`);
        button.css({ opacity: "0.7", color: "#39ff14" }).html(`<i class="fas fa-check"></i>`);
      }
    } catch (err) {
      console.error("[Overheat] Toggle failed:", err);
      ui.notifications.error("Failed to toggle On Fire.");
    }
  }

  function sanctumBindOverheat(html) {
    const $html = html ? $(html) : $(document);
    $html.find(".custom-apply-onfire")
      .off("click.sanctumOverheat")
      .on("click.sanctumOverheat", sanctumHandleOverheat);
  }

  Hooks.on("renderChatMessage", (message, html) => sanctumBindOverheat(html));
  Hooks.on("renderChatLog", () => sanctumBindOverheat(null));

  const start = () => {
    sanctumBindOverheat(null);
    console.log("%cSanctum Overheat | Ready", "color: #ff9500; font-weight: bold");
  };

  if (game.ready) start();
  else Hooks.once("ready", start);
})();