// ============ BLACK / WHITE LACE HUMANITY ============
const PRIMARY = {
  "White Lace Primary": "White Lace",
  "Black Lace Primary": "Black Lace"
};

["createActiveEffect","updateActiveEffect","deleteActiveEffect","updateItem"].forEach(h => {
  if (window[`_bwLace_${h}`] !== undefined) {
    Hooks.off(h, window[`_bwLace_${h}`]);
    delete window[`_bwLace_${h}`];
  }
});

window._bwLaceDone = window._bwLaceDone || new Set();

function fxName(e) { return (e?.name || "").trim(); }
function matchPrimary(e) {
  const n = fxName(e).toLowerCase();
  return Object.keys(PRIMARY).find(k => k.toLowerCase() === n) || null;
}
function actorFromEffect(effect) {
  let doc = effect?.parent;
  if (doc?.documentName === "Item") doc = doc.parent;
  return doc?.documentName === "Actor" ? doc : null;
}

async function applyBWHumanity(actor, label, key) {
  if (!actor || window._bwLaceDone.has(key)) return;
  window._bwLaceDone.add(key);
  if (!(game.user.isGM || actor.isOwner)) return;

  const roll = await new Roll("1d6").evaluate({ async: true });
  const loss = roll.total;
  if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

  let current = null, path = null;
  if (foundry.utils.hasProperty(actor, "system.humanity.value")) {
    current = actor.system.humanity.value; path = "system.humanity.value";
  } else if (foundry.utils.hasProperty(actor, "system.derivedStats.humanity.value")) {
    current = actor.system.derivedStats.humanity.value; path = "system.derivedStats.humanity.value";
  }
  if (current == null) return ui.notifications.error(`${label}: Could not find Humanity.`);

  const next = Math.max(0, current - loss);
  await actor.update({ [path]: next });
  if (actor.sheet?.rendered) actor.sheet.render(false);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cpr-block" style="padding:10px;background-color:#2a1a4a;border:1px solid #b388ff;">
      <b style="color:#ce93d8;">${label} – Humanity Loss</b><br>
      ${actor.name} loses <b>${loss}</b> Humanity (1d6).<br>
      Humanity: ${current} → <b>${next}</b>
    </div>`
  });
}

function handlePrimary(effect, changes = {}) {
  const label = matchPrimary(effect);
  if (!label) return;
  const actor = actorFromEffect(effect);
  if (!actor) return;
  const key = `${actor.id}-${label}`;
  const disabled = (typeof changes.disabled === "boolean") ? changes.disabled : effect.disabled;
  if (disabled) window._bwLaceDone.delete(key);
  else applyBWHumanity(actor, label, key);
}

window._bwLace_createActiveEffect = Hooks.on("createActiveEffect", e => handlePrimary(e, { disabled: e.disabled }));
window._bwLace_updateActiveEffect = Hooks.on("updateActiveEffect", (e, c) => handlePrimary(e, c));
window._bwLace_deleteActiveEffect = Hooks.on("deleteActiveEffect", e => {
  const label = matchPrimary(e);
  const actor = actorFromEffect(e);
  if (label && actor) window._bwLaceDone.delete(`${actor.id}-${label}`);
});
window._bwLace_updateItem = Hooks.on("updateItem", item => {
  if (item.type !== "drug") return;
  const actor = item.parent;
  if (actor?.documentName !== "Actor") return;
  for (const e of (item.effects?.contents || [])) handlePrimary(e, { disabled: e.disabled });
});

console.log("%cBlack/White Lace script LOADED", "color:violet;font-weight:bold");
ui.notifications.info("Black/White Lace script loaded");