// ========== SPEEDWARE DODGE TRACKER ==========
// Module-safe + multi-GM lock + ignores backward rounds

console.log("Sanctum Speedware Dodge Tracker | Loading...");

(() => {
  if (globalThis.sanctumSpeedwareRegistered) return;
  globalThis.sanctumSpeedwareRegistered = true;

  function createSpeedwareMessage(token, content, backgroundColor = "#1a1a1a") {
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ token }),
      content: `<div class="cpr-block" style="padding:10px;background-color:${backgroundColor}">${content}</div>`,
    }, { chatBubble: false });
  }

  if (globalThis.sanctumSpeedwareDodgeHook) {
    Hooks.off("updateCombat", globalThis.sanctumSpeedwareDodgeHook);
  }
  if (globalThis.sanctumSpeedwareCombatEndHook) {
    Hooks.off("combatEnd", globalThis.sanctumSpeedwareCombatEndHook);
  }

  globalThis.sanctumSpeedwareDodgeHook = Hooks.on("updateCombat", async (combat, changed) => {
    if (changed.round === undefined) return;
    if (!game.user.isGM) return;

    // Ignore backward round movement
    const previousRound = combat.previous?.round;
    if (typeof previousRound === "number" && changed.round < previousRound) {
      return;
    }

    const currentRound = combat.round;
    const announced = foundry.utils.duplicate(combat.getFlag("world", "speedwareAnnounced") || {});

    for (const combatant of combat.combatants) {
      const token = combatant.token;
      if (!token?.actor) continue;

      const actor = token.actor;
      const dodgeData = actor.getFlag("world", "speedwareDodge");
      if (!dodgeData) continue;

      const key = `${combat.id}-${combatant.id}-${currentRound}`;
      if (announced[key]) continue;

      // Claim lock first
      announced[key] = game.user.id;
      try {
        await combat.setFlag("world", "speedwareAnnounced", announced);
      } catch (err) {
        return;
      }

      const fresh = combat.getFlag("world", "speedwareAnnounced") || {};
      if (fresh[key] !== game.user.id) return;

      let { name, remaining, max } = dodgeData;

      if (remaining > 0) {
        await createSpeedwareMessage(
          token,
          `<b>${token.name}</b> is dodging with <b>${name}</b><br>
           <span style="font-size:1.1em;"><b>${remaining}/${max}</b> rounds remaining</span>`,
          "#0d4f5c"
        );

        remaining -= 1;
        await actor.setFlag("world", "speedwareDodge", { name, remaining, max });
      } else {
        await actor.unsetFlag("world", "speedwareDodge");

        const effect = actor.effects.find(e => e.getFlag("world", "isSpeedwareDodge"));
        if (effect) {
          await effect.update({
            name: "Out of Dodges",
            icon: "icons/svg/falling.svg",
            "flags.world.isSpeedwareDodge": false,
            "flags.world.isSpeedwareOut": true,
            duration: { rounds: null, turns: null, seconds: null }
          });
        } else {
          await actor.createEmbeddedDocuments("ActiveEffect", [{
            name: "Out of Dodges",
            icon: "icons/svg/falling.svg",
            disabled: false,
            flags: { world: { isSpeedwareOut: true } }
          }]);
        }

        await createSpeedwareMessage(
          token,
          `<b>${token.name}</b> <span class="fg-red">is out of dodges</span>!<br>
           <b style="color:#ff6666;">Better find cover, choom!</b>`,
          "#b90202ff"
        );
      }
    }
  });

  globalThis.sanctumSpeedwareCombatEndHook = Hooks.on("combatEnd", async (combat) => {
    if (!game.user.isGM) return;

    for (const combatant of combat.combatants) {
      const actor = combatant.actor;
      if (!actor) continue;

      await actor.unsetFlag("world", "speedwareDodge");

      const effectsToRemove = actor.effects.filter(e =>
        e.getFlag("world", "isSpeedwareDodge") || e.getFlag("world", "isSpeedwareOut")
      );

      if (effectsToRemove.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToRemove.map(e => e.id));
      }
    }

    await combat.unsetFlag("world", "speedwareAnnounced");
  });

  console.log("%cSpeedware Dodge Tracker ready (module-safe + multi-GM hardened)", "color: #0d4f5c; font-weight: bold;");
})();