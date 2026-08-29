// ============================================
// Sanctum - MOVE Restriction / Slowdown Toggle
// Direct MOVE.value write. No Active Effects.
// ============================================

console.log("%cSanctum MOVE Toggle | Loading", "color: #42d3ea; font-weight: bold");

(() => {
  if (window.sanctumSlowRegistered) {
    console.log("%cSanctum MOVE Toggle | Already registered – skipping", "color: #ff9800");
    return;
  }
  window.sanctumSlowRegistered = true;

  const FLAG_KEY = "sanctumMovePenalty";

  function getMoveValue(actor) {
    const move = actor.system?.stats?.move;
    if (move && typeof move === "object") return Number(move.value) || 0;
    if (typeof move === "number") return move;
    return 0;
  }

  async function setMoveValue(actor, value) {
    const safe = Math.max(0, Number(value) || 0);
    return actor.update({ "system.stats.move": { value: safe } });
  }

  async function handleToggle(ev) {
    ev.preventDefault();
    ev.stopPropagation();

    if (!game.user.isGM) {
      ui.notifications.error("Only the GM can apply MOVE reduction.");
      return;
    }

    const button = $(ev.currentTarget);
    const targetId = button.attr("data-target-id") || button.data("target-id");
    const targetName = button.attr("data-target-name") || button.data("target-name") || "Unknown";
    const amount = Math.max(1, parseInt(button.attr("data-amount") || button.data("amount") || "1", 10));

    const target = canvas.tokens.get(targetId);
    if (!target?.actor) {
      ui.notifications.error(`Could not find token: ${targetName}`);
      return;
    }

    const actor = target.actor;
    const existing = actor.getFlag("world", FLAG_KEY);
    const currentMove = getMoveValue(actor);

    try {
      if (existing) {
        const restore = Math.max(0, Number(existing.original) || (currentMove + amount));
        await setMoveValue(actor, restore);
        await actor.unsetFlag("world", FLAG_KEY);
        ui.notifications.info(`${target.name}: MOVE reduction removed`);
        button.css({ opacity: "1", color: "#42d3ea" }).html(`<i class="fas fa-walking"></i>`);
      } else {
        const newMove = Math.max(0, currentMove - amount);
        await setMoveValue(actor, newMove);
        await actor.setFlag("world", FLAG_KEY, { amount, original: currentMove });
        ui.notifications.info(`${target.name}: MOVE reduced by ${amount}`);
        button.css({ opacity: "0.7", color: "#39ff14" }).html(`<i class="fas fa-check"></i>`);
      }
    } catch (err) {
      console.error("[MOVE Toggle] Failed:", err);
      ui.notifications.error("Failed to toggle MOVE reduction.");
    }
  }

  function bindButtons(context = document) {
    $(context).find(".custom-apply-slow").off("click.sanctumSlow").on("click.sanctumSlow", handleToggle);
  }

  Hooks.on("renderChatMessage", (message, html) => bindButtons(html));
  Hooks.on("renderChatLog", () => bindButtons(document));

  const start = () => {
    bindButtons(document);
    console.log("%cSanctum MOVE Toggle | Ready", "color: #42d3ea; font-weight: bold");
  };

  if (game.ready) start();
  else Hooks.once("ready", start);
})();