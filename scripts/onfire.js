// ============================================
// Sanctum - On Fire Damage (End of Turn Only)
// Module-safe + lock-based (no duplicates)
// Ignores backward rounds
// ============================================

console.log("%cSanctum On Fire | Loading", "color: #ff6b00; font-weight: bold");

(() => {
  if (globalThis.sanctumOnFireRegistered) return;
  globalThis.sanctumOnFireRegistered = true;

  if (globalThis.sanctumOnFireHook) {
    Hooks.off("updateCombat", globalThis.sanctumOnFireHook);
  }

  globalThis.sanctumLastCombatantId = null;
  globalThis.sanctumLastRound = null;

  globalThis.sanctumOnFireHook = async (combat, changed) => {
    if (!game.user.isGM) return;
    if (!("turn" in changed) && !("round" in changed)) return;

    const currentRound = combat.round ?? 0;
    const currentCombatantId = combat.combatant?.id ?? null;

    // Ignore backward round movement
    if (globalThis.sanctumLastRound !== null && currentRound < globalThis.sanctumLastRound) {
      globalThis.sanctumLastRound = currentRound;
      globalThis.sanctumLastCombatantId = currentCombatantId;
      return;
    }

    const finishedId = globalThis.sanctumLastCombatantId;

    globalThis.sanctumLastCombatantId = currentCombatantId;
    globalThis.sanctumLastRound = currentRound;

    if (!finishedId) return;
    if (finishedId === currentCombatantId) return;

    // Shared lock – prevents duplicates across GMs
    const lockKey = `${combat.id}-${finishedId}-${currentRound}`;
    const announced = foundry.utils.duplicate(combat.getFlag("world", "onFireAnnounced") || {});

    if (announced[lockKey]) return;

    announced[lockKey] = game.user.id;
    try {
      await combat.setFlag("world", "onFireAnnounced", announced);
    } catch (err) {
      return;
    }

    const fresh = combat.getFlag("world", "onFireAnnounced") || {};
    if (fresh[lockKey] !== game.user.id) return;

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

    if (!damage) return;

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
  };

  Hooks.on("updateCombat", globalThis.sanctumOnFireHook);

  if (game.combat?.combatant) {
    globalThis.sanctumLastCombatantId = game.combat.combatant.id;
    globalThis.sanctumLastRound = game.combat.round ?? 0;
  }

  Hooks.on("combatStart", (combat) => {
    globalThis.sanctumLastCombatantId = combat.combatant?.id ?? null;
    globalThis.sanctumLastRound = combat.round ?? 0;
  });

  Hooks.on("combatEnd", async (combat) => {
    if (!game.user.isGM) return;
    await combat.unsetFlag("world", "onFireAnnounced");
  });

  console.log("%cSanctum On Fire | Ready (module-safe + lock-protected)", "color: #ff6b00; font-weight: bold");
})();