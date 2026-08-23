// ============================================
// Sanctum - Overheat Toggle (On Fire Strong)
// Force-registers on ready + renderChatMessage
// ============================================

console.log("%cSanctum Overheat Toggle | Loading", "color: #ff9500; font-weight: bold");

(() => {
  const STATUS_ID = "y4y0rvsz17aj0r4g"; // On Fire (Strong)

  async function handleToggle(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    if (!game.user.isGM) {
      ui.notifications.error("Only the GM can toggle On Fire.");
      return;
    }

    const button = $(ev.currentTarget);
    const targetId = button.attr("data-target-id") || button.data("target-id");
    const targetName = button.attr("data-target-name") || button.data("target-name");

    if (!targetId) {
      ui.notifications.error("No target ID found on the button.");
      return;
    }

    const target = canvas.tokens.get(targetId);
    if (!target?.actor) {
      ui.notifications.error(`Could not find token: ${targetName || targetId}`);
      return;
    }

    const actor = target.actor;
    const alreadyOnFire = actor.effects.some(e =>
      !e.disabled &&
      (e.statuses?.has(STATUS_ID) || e.name === "On Fire (Strong)")
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
      console.error("[Overheat Toggle] Failed:", err);
      ui.notifications.error("Failed to toggle On Fire (Strong).");
    }
  }

  function bindButtons(html) {
    const btn = html.find(".custom-apply-onfire");
    if (!btn.length) return;
    btn.off("click").on("click", handleToggle);
  }

  // Register on every chat message render
  Hooks.on("renderChatMessage", (message, html) => {
    bindButtons(html);
  });

  // Also bind any existing messages when the world is ready
  Hooks.once("ready", () => {
    // Re-bind existing chat messages
    document.querySelectorAll(".custom-apply-onfire").forEach(el => {
      $(el).off("click").on("click", handleToggle);
    });

    console.log("%cSanctum Overheat Toggle | Ready", "color: #ff9500; font-weight: bold");
  });
})();