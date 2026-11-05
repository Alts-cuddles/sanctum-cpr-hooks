import { FLAG_SCOPE, logError } from "./shared.js";

// ========== SPEEDWARE DODGE TRACKER ==========
// The user who ran the activation macro owns the chat posts

console.log("Sanctum Speedware Dodge Tracker | Loading...");

(() => {
  if (globalThis.sanctumSpeedwareRegistered) return;
  globalThis.sanctumSpeedwareRegistered = true;

  function createSpeedwareMessage(token, content, backgroundColor = "#1a1a1a") {
    const actor = token?.actor;
    return ChatMessage.create({
      type: "base",
      style: 0,
      whisper: [],
      flavor: "",
      speaker: {
        scene: null,
        actor: actor?.id ?? null,
        token: null,
        alias: token?.name || actor?.name || "System"
      },
      content: `<div class="cpr-block" style="padding:10px;background-color:${backgroundColor}">${content}</div>`
    }, { chatBubble: false });
  }

  if (globalThis.sanctumSpeedwareDodgeHook) {
    Hooks.off("updateCombat", globalThis.sanctumSpeedwareDodgeHook);
  }
  if (globalThis.sanctumSpeedwareCombatEndHook) {
    Hooks.off("deleteCombat", globalThis.sanctumSpeedwareCombatEndHook);
  }

  globalThis.sanctumSpeedwareDodgeHook = Hooks.on("updateCombat", async (combat, changed) => {
    if (changed.round === undefined) return;
    try {

    const previousRound = combat.previous?.round;
    if (typeof previousRound === "number" && changed.round < previousRound) {
      return;
    }

    const currentRound = combat.round;

    for (const combatant of combat.combatants) {
      const token = combatant.token;
      if (!token?.actor) continue;

      const actor = token.actor;
      const dodgeData = actor.getFlag(FLAG_SCOPE, "speedwareDodge");
      if (!dodgeData) continue;

      // Only the user who activated Speedware on this actor
      if (dodgeData.ownerId !== game.user.id) continue;

      const lastRound = actor.getFlag(FLAG_SCOPE, "speedwareLastRound");
      if (lastRound === currentRound) continue;
      await actor.setFlag(FLAG_SCOPE, "speedwareLastRound", currentRound);

      let { name, remaining, max, ownerId } = dodgeData;

      if (remaining > 0) {
        await createSpeedwareMessage(
          token,
          `<b>${token.name}</b> is dodging with <b>${name}</b><br>
           <span style="font-size:1.1em;"><b>${remaining}/${max}</b> rounds remaining</span>`,
          "#0d4f5c"
        );

        remaining -= 1;
        await actor.setFlag(FLAG_SCOPE, "speedwareDodge", { name, remaining, max, ownerId });
      } else {
        await actor.unsetFlag(FLAG_SCOPE, "speedwareDodge");
        await actor.unsetFlag(FLAG_SCOPE, "speedwareLastRound");

        const effect = actor.effects.find(e => e.getFlag(FLAG_SCOPE, "isSpeedwareDodge"));
        if (effect) {
          await effect.update({
            name: "Out of Dodges",
            img: "icons/svg/falling.svg",
            [`flags.${FLAG_SCOPE}.isSpeedwareDodge`]: false,
            [`flags.${FLAG_SCOPE}.isSpeedwareOut`]: true,
            duration: { rounds: null, turns: null, seconds: null }
          });
        } else {
          await actor.createEmbeddedDocuments("ActiveEffect", [{
            name: "Out of Dodges",
            img: "icons/svg/falling.svg",
            disabled: false,
            flags: { [FLAG_SCOPE]: { isSpeedwareOut: true } }
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
    } catch (err) {
      logError("Speedware round tick", err);
    }
  });

  // v12 has no "combatEnd" hook (the original never fired). deleteCombat fires on
  // every client, so only one client cleans up: the active GM, or the owner if no GM.
  globalThis.sanctumSpeedwareCombatEndHook = Hooks.on("deleteCombat", async (combat) => {
    try {
    const gm = game.users.activeGM;
    for (const combatant of combat.combatants) {
      const actor = combatant.actor;
      if (!actor?.isOwner) continue;
      if (gm ? !gm.isSelf : false) continue;
      if (!actor.getFlag(FLAG_SCOPE, "speedwareDodge") && !actor.getFlag(FLAG_SCOPE, "speedwareLastRound")
        && !actor.effects.some(e => e.getFlag(FLAG_SCOPE, "isSpeedwareDodge") || e.getFlag(FLAG_SCOPE, "isSpeedwareOut"))) continue;

      await actor.unsetFlag(FLAG_SCOPE, "speedwareDodge");
      await actor.unsetFlag(FLAG_SCOPE, "speedwareLastRound");

      const effectsToRemove = actor.effects.filter(e =>
        e.getFlag(FLAG_SCOPE, "isSpeedwareDodge") || e.getFlag(FLAG_SCOPE, "isSpeedwareOut")
      );

      if (effectsToRemove.length) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", effectsToRemove.map(e => e.id));
      }
    }
    } catch (err) {
      logError("Speedware cleanup", err);
    }
  });

  console.log("%cSpeedware ready (activator owns the chat posts)", "color: #0d4f5c; font-weight: bold;");
})();
