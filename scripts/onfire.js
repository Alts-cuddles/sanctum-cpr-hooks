console.log("Sanctum On Fire | Loading...");

if (window._cprOnFireHook) {
  Hooks.off("updateCombat", window._cprOnFireHook);
  delete window._cprOnFireHook;
}

window._cprLastCombatantId = null;

window._cprOnFireHook = async (combat, changed) => {
  if (!game.user.isGM) return;
  if (!("turn" in changed) && !("round" in changed)) return;

  const finishedId = window._cprLastCombatantId;
  window._cprLastCombatantId = combat.combatant?.id ?? null;

  if (!finishedId) return;

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
    const hasEffect = actor.effects.some(
      (e) => !e.disabled && e.name.toLowerCase() === name.toLowerCase()
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

  console.log(`[Sanctum OnFire] ${damage} to ${token.name} (end of turn)`);
};

Hooks.on("updateCombat", window._cprOnFireHook);

Hooks.once("ready", () => {
  if (game.combat?.combatant) {
    window._cprLastCombatantId = game.combat.combatant.id;
  }
  console.log("Sanctum On Fire | Ready (end of turn only)");
});