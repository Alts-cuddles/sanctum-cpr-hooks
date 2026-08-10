console.log("Sanctum Speedware Dodge Tracker | Loading...");

(() => {
  if (game.speedwareDodgeTrackerRegistered) return;
  game.speedwareDodgeTrackerRegistered = true;

  const SYSTEM_SPEAKER = { alias: "System" };

  function createSpeedwareMessage(content, backgroundColor = "#1a1a1a") {
    return ChatMessage.create({
      speaker: SYSTEM_SPEAKER,
      content: `<div class="cpr-block" style="padding:10px;background-color:${backgroundColor}">${content}</div>`,
    }, { chatBubble: false });
  }

  if (game.speedwareDodgeHook) {
    Hooks.off("updateCombat", game.speedwareDodgeHook);
  }
  if (game.speedwareCombatEndHook) {
    Hooks.off("combatEnd", game.speedwareCombatEndHook);
  }

  game.speedwareDodgeHook = Hooks.on("updateCombat", async (combat, changed) => {
    if (changed.round === undefined) return;
    if (!game.user.isGM) return;

    for (const combatant of combat.combatants) {
      const token = combatant.token;
      if (!token) continue;

      const actor = token.actor;
      const dodgeData = actor.getFlag("world", "speedwareDodge");
      if (!dodgeData) continue;

      let { name, remaining, max } = dodgeData;

      if (remaining > 0) {
        await createSpeedwareMessage(
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
          `<b>${token.name}</b> <span class="fg-red">is out of dodges</span>!<br>
           <b style="color:#ff6666;">Better find cover, choom!</b>`,
          "#b90202ff"
        );
      }
    }
  });

  game.speedwareCombatEndHook = Hooks.on("combatEnd", async (combat) => {
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
  });

  console.log("%cSpeedware Dodge Tracker ready", "color: #0d4f5c; font-weight: bold;");
})();