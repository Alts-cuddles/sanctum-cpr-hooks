// ============================================
// Sanctum - Overheat Toggle (On Fire Strong)
// Separate from End-of-Turn damage (onfire.js)
// Handles the button from Quick Hack UI
// ============================================

console.log("%cSanctum Overheat Toggle | Loading", "color: #ff9500; font-weight: bold");

(() => {
  // Clean any previous handler
  $('#chat-log').off('click', '.custom-apply-onfire');

  $('#chat-log').on('click', '.custom-apply-onfire', async function (ev) {
    ev.preventDefault();
    ev.stopPropagation();

    if (!game.user.isGM) {
      ui.notifications.error("Only the GM can toggle On Fire.");
      return;
    }

    const button = $(this);
    const targetId = button.attr('data-target-id') || button.data('target-id');
    const targetName = button.attr('data-target-name') || button.data('target-name');

    if (!targetId) {
      ui.notifications.error("No target ID found on the button.");
      return;
    }

    const target = canvas.tokens.get(targetId);
    if (!target?.actor) {
      ui.notifications.error(`Could not find token: ${targetName || targetId}`);
      return;
    }

    const statusId = "y4y0rvsz17aj0r4g"; // On Fire (Strong)
    const actor = target.actor;

    const alreadyOnFire = actor.effects.some(e =>
      !e.disabled &&
      (e.statuses?.has(statusId) || e.name === "On Fire (Strong)")
    );

    try {
      if (alreadyOnFire) {
        // Turn OFF
        await actor.toggleStatusEffect(statusId, { active: false });
        ui.notifications.info(`${target.name} is no longer On Fire`);
        button.css({ opacity: "1", pointerEvents: "auto", color: "#ff9500" });
        button.html(`<i class="fas fa-fire"></i>`);
      } else {
        // Turn ON
        await actor.toggleStatusEffect(statusId, { active: true });
        ui.notifications.info(`${target.name} is now On Fire (Strong)`);
        button.css({ opacity: "0.7", color: "#39ff14" });
        button.html(`<i class="fas fa-check"></i>`);
      }
    } catch (err) {
      console.error("[Overheat Toggle] Failed:", err);
      ui.notifications.error("Failed to toggle On Fire (Strong).");
    }
  });

  console.log("%cSanctum Overheat Toggle | Ready", "color: #ff9500; font-weight: bold");
})();