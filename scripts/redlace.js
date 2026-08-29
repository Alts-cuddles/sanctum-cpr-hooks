// ============ RED LACE – DRUG ITEM SCRIPT ============
const DRUG_NAME = "Red Lace";

["createActiveEffect", "updateActiveEffect", "deleteActiveEffect", "updateItem"].forEach(h => {
  if (window[`_redLace_${h}`] !== undefined) {
    Hooks.off(h, window[`_redLace_${h}`]);
    delete window[`_redLace_${h}`];
  }
});
if (window._redLaceCritHookId !== undefined) {
  Hooks.off("createChatMessage", window._redLaceCritHookId);
  delete window._redLaceCritHookId;
}

window._redLaceHumanityDone = window._redLaceHumanityDone || new Set();
window._redLaceProcessed = window._redLaceProcessed || new Set();

function effectName(e) {
  return (e?.name || "").trim();
}

function isRedLaceEffect(e) {
  return effectName(e).toLowerCase().includes("red lace");
}

function getRedLaceState(actor) {
  if (!actor) return { item: null, effect: null, active: false };

  const item = actor.items.find(i =>
    i.type === "drug" && (i.name || "").toLowerCase().includes("red lace")
  );

  const itemEffect = item?.effects?.contents?.find(e => isRedLaceEffect(e) && !e.disabled) || null;
  const actorEffect = actor.effects?.find(e => isRedLaceEffect(e) && !e.disabled) || null;
  const effect = itemEffect || actorEffect;

  return { item, effect, active: !!effect };
}

function getHumanityPosterId(actor) {
  const owners = game.users.filter(u =>
    u.active && actor.testUserPermission(u, "OWNER")
  );
  if (!owners.length) return null;
  return owners.sort((a, b) => a.id.localeCompare(b.id))[0].id;
}

function normalizeName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/^eq\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function getDamageDice(message) {
  const content = message.content || "";
  const fromSvg = [...content.matchAll(/d6_(\d)(_preem)?\.svg/g)].map(m => Number(m[1]));
  if (fromSvg.length) return fromSvg;

  const fromHtml = [
    ...content.matchAll(/<(?:li|span)[^>]*class="[^"]*\b(?:roll\s+)?(?:die\s+)?d6\b[^"]*"[^>]*>\s*(\d+)\s*</gi),
    ...content.matchAll(/data-die-result=["'](\d+)["']/gi)
  ].map(m => Number(m[1])).filter(n => n >= 1 && n <= 6);
  if (fromHtml.length) return fromHtml;

  const fromRolls = [];
  for (const roll of (message.rolls || [])) {
    for (const term of roll.terms || []) {
      if (term.faces === 6 && Array.isArray(term.results)) {
        for (const r of term.results) {
          if (r.active !== false) fromRolls.push(Number(r.result));
        }
      }
    }
  }
  return fromRolls;
}

function isRangedWeapon(item, title = "") {
  const blob = `${item?.system?.weaponType || ""} ${item?.name || ""} ${title}`.toLowerCase();
  return /pistol|smh|smg|rifle|shotgun|bow|sniper|launcher|grenade|autofire|machinegun|machine gun|subcompact/.test(blob);
}

async function applyRedLaceHumanity(actor, key) {
  if (!actor) return;
  if (window._redLaceHumanityDone.has(key)) return;
  if (game.user.id !== getHumanityPosterId(actor)) return;
  window._redLaceHumanityDone.add(key);

  const roll = await new Roll("1d6").evaluate({ async: true });
  const loss = roll.total;
  if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

  let current = null;
  let path = null;
  if (foundry.utils.hasProperty(actor, "system.humanity.value")) {
    current = actor.system.humanity.value;
    path = "system.humanity.value";
  } else if (foundry.utils.hasProperty(actor, "system.derivedStats.humanity.value")) {
    current = actor.system.derivedStats.humanity.value;
    path = "system.derivedStats.humanity.value";
  }
  if (current == null) {
    ui.notifications.error("Red Lace: Could not find Humanity.");
    return;
  }

  const next = Math.max(0, current - loss);
  await actor.update({ [path]: next });
  if (actor.sheet?.rendered) actor.sheet.render(false);

  ChatMessage.create({
    type: "base",
    style: 0,
    whisper: [],
    flavor: "",
    speaker: {
      scene: null,
      actor: actor.id,
      token: null,
      alias: actor.name
    },
    content: `<div class="cpr-block" style="padding:10px;background-color:#4a0000;border:1px solid #ff4444;">
      <b style="color:#ff5555;">Red Lace – Humanity Loss</b><br>
      ${actor.name} loses <b>${loss}</b> Humanity (1d6).<br>
      Humanity: ${current} → <b>${next}</b>
    </div>`
  }, { chatBubble: false });
}

function handleEffectChange(effect, changes = {}) {
  if (!isRedLaceEffect(effect)) return;

  let actor = effect.parent;
  if (actor?.documentName === "Item") actor = actor.parent;
  if (actor?.documentName !== "Actor") return;

  const key = `${actor.id}-redlace`;
  const nowDisabled = (typeof changes.disabled === "boolean") ? changes.disabled : effect.disabled;

  if (nowDisabled) {
    window._redLaceHumanityDone.delete(key);
    return;
  }
  applyRedLaceHumanity(actor, key);
}

window._redLace_createActiveEffect = Hooks.on("createActiveEffect", (effect) => {
  handleEffectChange(effect, { disabled: effect.disabled });
});
window._redLace_updateActiveEffect = Hooks.on("updateActiveEffect", (effect, changes) => {
  handleEffectChange(effect, changes);
});
window._redLace_deleteActiveEffect = Hooks.on("deleteActiveEffect", (effect) => {
  let actor = effect.parent;
  if (actor?.documentName === "Item") actor = actor.parent;
  if (actor?.documentName === "Actor") window._redLaceHumanityDone.delete(`${actor.id}-redlace`);
});
window._redLace_updateItem = Hooks.on("updateItem", (item) => {
  if (item.type !== "drug" || !(item.name || "").toLowerCase().includes("red lace")) return;
  const actor = item.parent;
  if (actor?.documentName !== "Actor") return;

  const fx = item.effects?.contents?.find(e => isRedLaceEffect(e));
  if (!fx) return;

  const key = `${actor.id}-redlace`;
  if (fx.disabled) window._redLaceHumanityDone.delete(key);
  else applyRedLaceHumanity(actor, key);
});

window._redLaceCritHookId = Hooks.on("createChatMessage", (message) => {
  try {
    const authorId = message.author?.id || message.user?.id;
    if (authorId !== game.user.id) return;
    if (window._redLaceProcessed.has(message.id)) return;
    window._redLaceProcessed.add(message.id);

    const content = message.content || "";
    const isDamageCard =
      content.includes("d6-rollcard-data") ||
      content.includes("data-action=\"applyDamage\"");

    if (!isDamageCard) return;
    if (/damage dealt to/i.test(content)) return;
    if (/Critical Damage:/i.test(content)) return;

    const actor = game.actors.get(message.speaker?.actor)
      || canvas.tokens.get(message.speaker?.token)?.actor;
    if (!actor) return;

    const state = getRedLaceState(actor);
    if (!state.active) return;

    const rawTitle = content.match(/chat-rollTitle-stat[\s\S]*?<div[^>]*>\s*([^<]+?)\s*<\/div>/i)?.[1]?.trim() || "";
    const titleNorm = normalizeName(rawTitle);

    const weapons = actor.items.filter(i => i.type === "weapon");
    const hit = weapons.find(i => {
      const n = normalizeName(i.name);
      return n && (titleNorm === n || titleNorm.includes(n) || n.includes(titleNorm));
    });

    const ranged = isRangedWeapon(hit, rawTitle);
    console.log("[Red Lace Crit]", {
      actor: actor.name,
      rawTitle,
      hit: hit?.name,
      type: hit?.system?.weaponType,
      ranged
    });
    if (ranged) return;

    const dice = getDamageDice(message);
    const sixes = dice.filter(v => v === 6).length;
    const high = dice.filter(v => v === 5 || v === 6).length;
    console.log("[Red Lace Crit] dice", dice, { sixes, high });

    if (!dice.length) return;
    if (sixes >= 2 || high < 2) return;

    let updated = content;
    updated = updated.replace(
      /(<a[^>]*data-action="applyDamage"[^>]*)>/g,
      (full, openTag) => /data-bonus-damage="\d+"/.test(openTag)
        ? openTag.replace(/data-bonus-damage="\d+"/, 'data-bonus-damage="5"') + ">"
        : openTag + ' data-bonus-damage="5">'
    );

    if (!/Critical Damage:/i.test(updated)) {
      updated = updated.replace(
        /(<div class="d6-data-div">\s*)/,
        `$1<div class="text-normal text-semi">Critical Damage: 5</div>`
      );
      if (!/Critical Damage:/i.test(updated)) {
        updated = updated.replace(
          /(<div class="d6-dice-div">)/,
          `<div class="text-normal text-semi">Critical Damage: 5</div>$1`
        );
      }
    }

    updated = updated.replace(/icons\/dice\/black\/d6_6\.svg/g, "icons/dice/red/d6_6_preem.svg");
    updated = updated.replace(
      /<img([^>]*\bd6_5(?:_preem)?\.svg[^>]*)>/g,
      '<span style="display:inline-block;border:2px solid #ffd700;border-radius:4px;"><img$1></span>'
    );

    message.update({ content: updated }).then(() => {
      const el = document.querySelector(`li[data-message-id="${message.id}"]`);
      const div = el?.querySelector(".message-content");
      if (div) div.innerHTML = updated;
      console.log("%c[Red Lace Crit] card updated +5", "color:lime;font-weight:bold");
    });
  } catch (err) {
    console.error("Red Lace error:", err);
  }
});

console.log("%cRed Lace DRUG script LOADED", "color:lime;font-weight:bold;font-size:14px");
Hooks.once("ready", () => {
  ui.notifications.info("Red Lace drug script loaded");
});