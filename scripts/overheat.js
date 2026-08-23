// ============================================
// Sanctum - Overheat Toggle (HEAVY DEBUG)
// ============================================

console.log("%c========== OVERHEAT SCRIPT START ==========", "color: #ff9500; font-weight: bold; font-size: 16px");
console.log("[Overheat] Timestamp:", new Date().toISOString());
console.log("[Overheat] game.ready =", game?.ready);
console.log("[Overheat] typeof Hooks =", typeof Hooks);
console.log("[Overheat] window.sanctumOverheatRegistered =", window.sanctumOverheatRegistered);

if (window.sanctumOverheatRegistered) {
  console.warn("%c[Overheat] ALREADY REGISTERED – aborting to prevent double load", "color: #ff9800; font-weight: bold");
} else {
  window.sanctumOverheatRegistered = true;
  console.log("%c[Overheat] First load – proceeding with registration", "color: #4caf50");
}

const STATUS_ID = "y4y0rvsz17aj0r4g";
console.log("[Overheat] STATUS_ID set to:", STATUS_ID);

async function sanctumHandleOverheat(ev) {
  console.log("%c[Overheat] CLICK DETECTED", "color: #00e5ff; font-weight: bold");
  console.log("[Overheat] Event target:", ev.currentTarget);

  ev.preventDefault();
  ev.stopPropagation();

  if (!game.user.isGM) {
    console.warn("[Overheat] User is not GM – blocked");
    ui.notifications.error("Only the GM can toggle On Fire.");
    return;
  }

  const button = $(ev.currentTarget);
  const targetId = button.attr("data-target-id") || button.data("target-id");
  const targetName = button.attr("data-target-name") || button.data("target-name") || "Unknown";

  console.log("[Overheat] targetId:", targetId);
  console.log("[Overheat] targetName:", targetName);

  if (!targetId) {
    console.error("[Overheat] No targetId found on button");
    ui.notifications.error("No target ID found on the button.");
    return;
  }

  const target = canvas.tokens.get(targetId);
  console.log("[Overheat] Found token:", target?.name || "NULL");

  if (!target?.actor) {
    console.error("[Overheat] Token or actor not found");
    ui.notifications.error(`Could not find token: ${targetName}`);
    return;
  }

  const actor = target.actor;
  const effects = actor.effects.map(e => ({
    name: e.name,
    disabled: e.disabled,
    statuses: [...(e.statuses || [])]
  }));
  console.log("[Overheat] Actor effects:", effects);

  const alreadyOnFire = actor.effects.some(e =>
    !e.disabled && (e.statuses?.has(STATUS_ID) || e.name === "On Fire (Strong)")
  );
  console.log("[Overheat] alreadyOnFire =", alreadyOnFire);

  try {
    if (alreadyOnFire) {
      console.log("[Overheat] Turning OFF On Fire");
      await actor.toggleStatusEffect(STATUS_ID, { active: false });
      ui.notifications.info(`${target.name} is no longer On Fire`);
      button.css({ opacity: "1", color: "#ff9500" }).html(`<i class="fas fa-fire"></i>`);
    } else {
      console.log("[Overheat] Turning ON On Fire (Strong)");
      await actor.toggleStatusEffect(STATUS_ID, { active: true });
      ui.notifications.info(`${target.name} is now On Fire (Strong)`);
      button.css({ opacity: "0.7", color: "#39ff14" }).html(`<i class="fas fa-check"></i>`);
    }
    console.log("%c[Overheat] Toggle SUCCESS", "color: #4caf50; font-weight: bold");
  } catch (err) {
    console.error("%c[Overheat] Toggle FAILED", "color: #f44336; font-weight: bold", err);
    ui.notifications.error("Failed to toggle On Fire.");
  }
}

window.sanctumHandleOverheat = sanctumHandleOverheat;
console.log("[Overheat] window.sanctumHandleOverheat assigned");

function sanctumBindOverheat(html, source = "unknown") {
  const $html = html ? $(html) : $(document);
  const buttons = $html.find(".custom-apply-onfire");
  console.log(`[Overheat] bind called from "${source}" – found ${buttons.length} button(s)`);

  buttons.each(function (i) {
    const $btn = $(this);
    $btn.off("click.sanctumOverheat").on("click.sanctumOverheat", sanctumHandleOverheat);
    console.log(`[Overheat] Bound button ${i}:`, $btn.attr("data-target-name") || $btn.attr("data-target-id"));
  });
}

// Register hooks
console.log("[Overheat] Registering Hooks.on('renderChatMessage')...");
Hooks.on("renderChatMessage", (message, html) => {
  console.log("%c[Overheat] renderChatMessage fired", "color: #42d3ea");
  sanctumBindOverheat(html, "renderChatMessage");
});

console.log("[Overheat] Registering Hooks.on('renderChatLog')...");
Hooks.on("renderChatLog", () => {
  console.log("%c[Overheat] renderChatLog fired", "color: #42d3ea");
  sanctumBindOverheat(null, "renderChatLog");
});

console.log("[Overheat] Registering Hooks.once('ready')...");
Hooks.once("ready", () => {
  console.log("%c[Overheat] ready hook fired", "color: #4caf50; font-weight: bold");
  sanctumBindOverheat(null, "ready");
  console.log("%c========== OVERHEAT READY ==========", "color: #4caf50; font-weight: bold; font-size: 16px");
  ui.notifications.info("Overheat Toggle (DEBUG) active");
});

// Force interval for the first 20 seconds
let forceCount = 0;
const forceInterval = setInterval(() => {
  forceCount++;
  console.log(`[Overheat] Force bind #${forceCount}`);
  sanctumBindOverheat(null, `force-${forceCount}`);
  if (forceCount >= 7) {
    clearInterval(forceInterval);
    console.log("[Overheat] Force interval finished");
  }
}, 3000);

console.log("%c========== OVERHEAT SCRIPT END OF FILE ==========", "color: #ff9500; font-weight: bold; font-size: 16px");