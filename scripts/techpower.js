// ============================================
// Sanctum - Tech Rebuild / Power Rebuild
// Handles normal crits AND explosive ammo crits
// ============================================
import {
  FLAG_SCOPE, LOG_PREFIX, getElement, logError, isMessageAuthor,
  isDamageRollCard, getDamageCardTitle, resolveActor, resolveSpeakerActor,
  findWeaponsByTitle
} from "./shared.js";

console.log("%cSanctum Tech/Power Rebuild | Loading", "color: #ff6b00; font-weight: bold");

const SOURCE_MAX_AGE_MS = 120000;
const CRIT_BASE = 5;
const CRIT_POWER = 10;

// ---------------- Item sheet: Tech / Power flags ----------------

function doInjectWeapon(html, item) {
  const el = getElement(html);
  if (!el || !item || item.type !== "weapon") return false;
  if (el.querySelector(".tech-power-flags")) return true;
  const supLi = Array.from(el.querySelectorAll("li.item"))
    .find(li => li.textContent.includes("Has Suppressive Fire"));
  if (!supLi) return false;

  const makeRow = (label, key) => {
    const checked = !!item.getFlag(FLAG_SCOPE, key);
    const li = document.createElement("li");
    li.className = "item flexrow tech-power-flags";
    const iconClass = checked ? "far fa-circle-check" : "far fa-circle";
    li.innerHTML = `
      <div class="item flexrow setting-name text-nowrap">${label}</div>
      <div class="item flexrow setting-value text-nowrap item-end">
        <a class="item-checkbox" data-flag="${key}"><i class="${iconClass}"></i></a>
      </div>`;
    li.querySelector("a.item-checkbox").addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      try {
        await item.setFlag(FLAG_SCOPE, key, !item.getFlag(FLAG_SCOPE, key));
      } catch (err) {
        logError(`toggle ${key}`, err, true);
      }
    });
    return li;
  };

  supLi.insertAdjacentElement("afterend", makeRow("Has Power Rebuild", "isPowerWeapon"));
  supLi.insertAdjacentElement("afterend", makeRow("Has Tech Rebuild", "isTechWeapon"));
  return true;
}

function tryInjectWeapon(app, html) {
  const item = app.item ?? app.document;
  if (!item || item.type !== "weapon") return;
  if (doInjectWeapon(html, item)) return;
  setTimeout(() => doInjectWeapon(getElement(app.element) || getElement(html), item), 100);
}

// ---------------- Actor sheet: Charged toggle ----------------

async function applyChargedEffects(item, charged) {
  await item.update(charged
    ? { "system.canIgnoreArmor": true, "system.ignoreArmorPercent": 50 }
    : { "system.canIgnoreArmor": false, "system.ignoreArmorPercent": 0 });
}

async function setCharged(item, next) {
  try {
    await item.setFlag(FLAG_SCOPE, "isCharged", next);
    await applyChargedEffects(item, next);
  } catch (err) {
    logError("Charged toggle", err, true);
  }
}

function injectCharged(app, html) {
  const el = getElement(html);
  if (!el) return;
  const actor = app.actor ?? app.document;
  if (!actor || !el.querySelector(".weapon-grid")) return;

  el.querySelectorAll(".weapon-grid li").forEach(li => {
    if (li.textContent.trim().startsWith("Charged")) li.remove();
  });

  for (const grid of el.querySelectorAll(".weapon-grid[data-item-id]")) {
    const item = actor.items.get(grid.dataset.itemId);
    if (!item?.getFlag(FLAG_SCOPE, "isTechWeapon")) continue;
    const list = grid.querySelector("ul");
    if (!list) continue;

    const checked = !!item.getFlag(FLAG_SCOPE, "isCharged");
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="text-padding-sides-small">Charged</span>
      <a class="fire-checkbox" data-item-id="${item.id}">
        <i class="${checked ? "far fa-circle-dot" : "far fa-circle"} text-padding-right-smallest"></i>
      </a>`;
    li.querySelector("a").addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setCharged(item, !item.getFlag(FLAG_SCOPE, "isCharged"));
    });
    list.appendChild(li);
    grid.style.height = "auto";
    grid.style.minHeight = "80px";

    const autofire = list.querySelector('a.fire-checkbox[data-fire-mode="autofire"]');
    if (autofire && !autofire.dataset.chargedListener) {
      autofire.dataset.chargedListener = "1";
      autofire.addEventListener("click", () => {
        if (item.getFlag(FLAG_SCOPE, "isCharged")) setCharged(item, false);
      });
    }
  }
}

// ---------------- Damage source tracking ----------------
// CPR 0.92.4's damage card has no item id. The attack card's "rollDamage"
// button does (data-actor-id / data-token-id / data-item-id), and the damage
// card is created on the same client right after that click. Record it.

let lastDamageSource = null;

function recordDamageSource(ev) {
  const btn = ev.target?.closest?.('[data-action="rollDamage"]');
  if (!btn) return;
  const { actorId, tokenId, itemId } = btn.dataset;
  if (!itemId) return;
  lastDamageSource = { actorId, tokenId, itemId, time: Date.now() };
}

function bindDamageSourceCapture(message, html) {
  const el = getElement(html);
  if (!el || el.dataset.sanctumDmgSrc) return;
  if (!el.querySelector('[data-action="rollDamage"]')) return;
  el.dataset.sanctumDmgSrc = "1";
  // capture phase: runs before CPR's delegated jQuery ".clickable" handler
  el.addEventListener("click", recordDamageSource, true);
}

/**
 * Identify the weapon that produced a damage card.
 * Returns { item, actor, via } or null. Never looks outside the attacker.
 */
function identifyDamageWeapon(content, speaker, flags) {
  const title = getDamageCardTitle(content);

  // 1. Already stamped (by our preCreate) on the message
  const stamped = flags?.[FLAG_SCOPE]?.damageSource;
  if (stamped?.itemId) {
    const actor = resolveActor(stamped);
    const item = actor?.items.get(stamped.itemId);
    if (item) return { item, actor, via: "stamp" };
  }

  // 2. The rollDamage button this client just clicked (item id), if its name
  //    matches the card title (guards against a stale/unrelated click).
  const src = lastDamageSource;
  if (src && Date.now() - src.time < SOURCE_MAX_AGE_MS) {
    const actor = resolveActor(src);
    const item = actor?.items.get(src.itemId);
    if (item && item.type === "weapon" && (!title || item.name.trim() === title)) {
      return { item, actor, via: "click" };
    }
  }

  // 3. Fallback (macros, rollItemMacro): exact title match on the speaker's own items.
  const actor = resolveSpeakerActor(speaker);
  const matches = findWeaponsByTitle(actor, title);
  if (matches.length === 1) return { item: matches[0], actor, via: "title" };
  if (matches.length > 1) {
    // Several identically named weapons: only treat it as a power crit if they
    // are all flagged, otherwise it's ambiguous -> not a power weapon.
    const allPower = matches.every(i => i.getFlag(FLAG_SCOPE, "isPowerWeapon"));
    return { item: allPower ? matches[0] : null, actor, via: "title-ambiguous" };
  }
  return null;
}

function isPowerWeapon(item) {
  return !!(item && item.type === "weapon" && item.getFlag(FLAG_SCOPE, "isPowerWeapon"));
}

function hasBaseCrit(content) {
  return /Critical Damage:\s*\+?5\b/i.test(content) || /data-bonus-damage="5"/.test(content);
}

function rewriteCrit(content) {
  return content
    .replace(/Critical Damage:\s*\+?5\b/gi, `Critical Damage: +${CRIT_POWER}`)
    .replace(/data-bonus-damage="5"/g, `data-bonus-damage="${CRIT_POWER}"`);
}

// Runs only on the creating client.
function onPreCreateChatMessage(message, data) {
  try {
    const content = data.content ?? message.content ?? "";
    if (!isDamageRollCard(content)) return;

    const speaker = data.speaker ?? message.speaker ?? {};
    const found = identifyDamageWeapon(content, speaker, data.flags ?? message.flags);
    if (found?.via === "click") lastDamageSource = null;

    const update = {};
    if (found?.item) {
      const a = found.actor;
      update[`flags.${FLAG_SCOPE}.damageSource`] = {
        actorId: a?.isToken ? a.token?.actorId ?? a.id : a?.id,
        tokenId: a?.isToken ? a.token?.id : null,
        sceneId: a?.isToken ? a.token?.parent?.id : null,
        itemId: found.item.id
      };
    }
    if (hasBaseCrit(content) && isPowerWeapon(found?.item)) {
      update.content = rewriteCrit(content);
      update[`flags.${FLAG_SCOPE}.powerCrit`] = true;
    }
    if (Object.keys(update).length) message.updateSource(foundry.utils.expandObject(update));
  } catch (err) {
    logError("Power crit (preCreate)", err);
  }
}

// Late rewrites (explosive ammo crit cards are created at +5 after creation).
async function upgradePowerCrit(message) {
  try {
    if (!isMessageAuthor(message)) return; // one writer, and the only one with permission
    if (message.getFlag(FLAG_SCOPE, "powerCrit")) return;
    const content = message.content || "";
    if (!isDamageRollCard(content) || !hasBaseCrit(content)) return;

    const found = identifyDamageWeapon(content, message.speaker, message.flags);
    if (!isPowerWeapon(found?.item)) return;

    await message.update({ content: rewriteCrit(content), [`flags.${FLAG_SCOPE}.powerCrit`]: true });
  } catch (err) {
    logError("Power crit (update)", err);
  }
}

function lastCritIsPower() {
  for (const msg of game.messages.contents.slice().reverse()) {
    const c = msg.content || "";
    if (!/Critical Damage/i.test(c) && !/data-bonus-damage/.test(c)) continue;
    if (/HP Reduced By/i.test(c) || /Damage Dealt To/i.test(c)) continue;
    if (msg.getFlag(FLAG_SCOPE, "powerCrit")) return true;
    return /Critical Damage:\s*\+?10/i.test(c) || /data-bonus-damage="10"/.test(c);
  }
  return false;
}

// ---------------- Registration (once) ----------------

const HOOKS = [
  ["renderItemSheet", (app, html) => tryInjectWeapon(app, html)],
  ["renderItemSheetV2", (app, html) => tryInjectWeapon(app, html)],
  ["renderActorSheet", (app, html) => injectCharged(app, html)],
  ["renderActorSheetV2", (app, html) => injectCharged(app, html)],
  ["renderChatMessage", bindDamageSourceCapture],
  ["preCreateChatMessage", onPreCreateChatMessage],
  ["updateChatMessage", (message) => upgradePowerCrit(message)],
  // Delay so the explosive ammo hook can finish its update first
  ["createChatMessage", (message) => { if (isMessageAuthor(message)) setTimeout(() => upgradePowerCrit(message), 300); }]
];

function register() {
  const prev = globalThis._sanctumTechPowerHooks;
  if (prev) for (const [name, id] of prev) Hooks.off(name, id);
  globalThis._sanctumTechPowerHooks = HOOKS.map(([name, fn]) => [name, Hooks.on(name, fn)]);

  const ActorClass = CONFIG.Actor.documentClass;
  const proto = ActorClass?.prototype;
  if (proto?._applyDamage && !proto._applyDamage.__sanctumPower) {
    const orig = proto._applyDamage;
    globalThis._origApplyDamage ??= orig;
    const wrapped = async function (...args) {
      if (args[1] === CRIT_BASE && lastCritIsPower()) args[1] = CRIT_POWER;
      return orig.apply(this, args);
    };
    wrapped.__sanctumPower = true;
    proto._applyDamage = wrapped;
  }

  console.log(`%c${LOG_PREFIX} Tech/Power Rebuild ready (weapon-specific power crit)`, "color: #ff6b00; font-weight: bold");
}

if (game.ready) register();
else Hooks.once("ready", register);
