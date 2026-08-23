// ============================================
// Sanctum - On Fire System
// - End of Turn damage (your original logic)
// - Toggle On Fire button (from Quick Hack UI)
// ============================================

console.log("%cSanctum On Fire | Loading (lock-based + Toggle button)", "color: #ff6b00; font-weight: bold");

(() => {
  // --------------------------------------------------
  // 1. TOGGLE ON FIRE BUTTON (new)
  // --------------------------------------------------
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
        await actor.toggleStatusEffect(statusId, { active: false });
        ui.notifications.info(`${target.name} is no longer On Fire`);
        button.css({ opacity: "1", pointerEvents: "auto", color: "#ff9500" });
        button.html(`<i class="fas fa-fire"></i>`);
      } else {
        await actor.toggleStatusEffect(statusId, { active: true });
        ui.notifications.info(`${target.name} is now On Fire (Strong)`);
        button.css({ opacity: "0.7", color: "#39ff14" });
        button.html(`<i class="fas fa-check"></i>`);
      }
    } catch (err) {
      console.error("[OnFire] Failed to toggle status:", err);
      ui.notifications.error("Failed to toggle On Fire (Strong).");
    }
  });

  console.log("%c[OnFire] Toggle button handler attached", "color: #4caf50");

  // --------------------------------------------------
  // 2. END OF TURN DAMAGE (your original logic)
  // --------------------------------------------------
  if (globalThis.sanctumOnFireHook) {
    Hooks.off("updateCombat", globalThis.sanctumOnFireHook);
    console.log("[OnFire] Removed old hook");
  }

  globalThis.sanctumLastCombatantId = null;
  globalThis.sanctumLastRound = null;

  globalThis.sanctumOnFireHook = async (combat, changed) => {
    // Only GMs may run the logic (players never apply the damage)
    if (!game.user.isGM) return;

    // Only care about turn / round changes
    if (!("turn" in changed) && !("round" in changed)) return;

    const currentRound = combat.round ?? 0;
    const currentCombatantId = combat.combatant?.id ?? null;

    // Ignore backward round movement
    if (globalThis.sanctumLastRound !== null && currentRound < globalThis.sanctumLastRound) {
      console.log("%c[OnFire] Round moved backward – ignoring", "color: #ff9800");
      globalThis.sanctumLastRound = currentRound;
      globalThis.sanctumLastCombatantId = currentCombatantId;
      return;
    }

    const finishedId = globalThis.sanctumLastCombatantId;

    // Update local tracking
    globalThis.sanctumLastCombatantId = currentCombatantId;
    globalThis.sanctumLastRound = currentRound;

    if (!finishedId) {
      console.log("[OnFire] No finished combatant yet (first turn)");
      return;
    }

    // Same combatant → no real turn change
    if (finishedId === currentCombatantId) return;

    // ========== SHARED LOCK ==========
    // Key is unique per combatant per round
    const lockKey = `${combat.id}-${finishedId}-${currentRound}`;
    const announced = foundry.utils.duplicate(combat.getFlag("world", "onFireAnnounced") || {});

    // Already claimed by someone?
    if (announced[lockKey]) {
      console.log("%c[OnFire] Lock already claimed – skipping (no duplicate)", "color: #4caf50");
      return;
    }

    // Claim the lock FIRST (before damage or message)
    announced[lockKey] = game.user.id;
    try {
      await combat.setFlag("world", "onFireAnnounced", announced);
    } catch (err) {
      console.warn("[OnFire] Failed to claim lock – aborting", err);
      return;
    }

    // Re-read to confirm we still own it
    const fresh = combat.getFlag("world", "onFireAnnounced") || {};
    if (fresh[lockKey] !== game.user.id) {
      console.log("%c[OnFire] Lost the race – another client claimed it", "color: #ff9800");
      return;
    }
    // ========== WE OWN THE LOCK ==========

    const combatant = combat.combatants.get(finishedId);
    if (!combatant?.token) return;

    const token = combatant.token.object ?? canvas.tokens.get(combatant.token.id);
    if (!token?.actor) return;

    const actor = token.actor;

    const FIRE_EFFECTS = {
      "On Fire (Mild)": 2,
      "On Fire (Strong)": 4,
      "On Fire (Deadly)": 6
    };

    let damage = 0;
    let intensity = null;

    for (const [name, dmg] of Object.entries(FIRE_EFFECTS)) {
      const hasEffect = actor.effects.some(e =>
        !e.disabled && e.name.toLowerCase() === name.toLowerCase()
      );
      if (hasEffect) {
        damage = dmg;
        intensity = name;
        break;
      }
    }

    if (!damage) {
      console.log("[OnFire] No fire effect on", token.name);
      return;
    }

    // Apply damage
    const hpPath = "system.derivedStats.hp.value";
    const currentHP = foundry.utils.getProperty(actor, hpPath) ?? 0;
    const newHP = Math.max(0, currentHP - damage);

    await actor.update({ [hpPath]: newHP });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ token }),
      content: `
        <div class="cpr-block" style="padding:10px;background-color:#3a1500;border:1px solid #ff6b00;">
          <b><i class="fas fa-fire" style="color:#ff6b00;"></i> ${token.name} is burning!</b><br>
          <b>${intensity}</b> → <b>${damage}</b> damage direct to HP
        </div>
      `
    }, { chatBubble: false });

    console.log(`%c[OnFire] ${damage} to ${token.name} (lock held by ${game.user.name})`, "color: #4caf50; font-weight: bold");
  };

  // Register
  Hooks.on("updateCombat", globalThis.sanctumOnFireHook);

  // Seed if combat already running
  if (game.combat?.combatant) {
    globalThis.sanctumLastCombatantId = game.combat.combatant.id;
    globalThis.sanctumLastRound = game.combat.round ?? 0;
  }

  // Seed on new combat
  Hooks.on("combatStart", (combat) => {
    globalThis.sanctumLastCombatantId = combat.combatant?.id ?? null;
    globalThis.sanctumLastRound = combat.round ?? 0;
  });

  // Clean the lock when combat ends
  Hooks.on("combatEnd", async (combat) => {
    if (!game.user.isGM) return;
    await combat.unsetFlag("world", "onFireAnnounced");
  });

  ui.notifications.info("On Fire active (Toggle button + End of Turn)");
  console.log("%cSanctum On Fire | Ready", "color: #ff6b00; font-weight: bold");
})();