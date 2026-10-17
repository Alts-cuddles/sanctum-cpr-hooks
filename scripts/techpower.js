// ============================================
// Sanctum - Tech Rebuild / Power Rebuild
// Handles normal crits AND explosive ammo crits
// ============================================

console.log("%cSanctum Tech/Power Rebuild | Loading", "color: #ff6b00; font-weight: bold");

const SCOPE = "world";

function getElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  return null;
}

function doInjectWeapon(html, item) {
  const el = getElement(html);
  if (!el || !item || item.type !== "weapon") return;
  if (el.querySelector(".tech-power-flags")) return;
  const lis = Array.from(el.querySelectorAll("li.item"));
  const supLi = lis.find(li => li.textContent.includes("Has Suppressive Fire"));
  if (!supLi) return false;

  const makeRow = (label, key) => {
    const checked = !!item.getFlag(SCOPE, key);
    const li = document.createElement("li");
    li.className = "item flexrow tech-power-flags";
    const iconClass = checked ? "far fa-circle-check" : "far fa-circle";
    li.innerHTML = `
      <div class="item flexrow setting-name text-nowrap">${label}</div>
      <div class="item flexrow setting-value text-nowrap item-end">
        <a class="item-checkbox" data-flag="${key}"><i class="${iconClass}"></i></a>
      </div>`;
    const link = li.querySelector("a.item-checkbox");
    link.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      const currently = !!item.getFlag(SCOPE, key);
      await item.setFlag(SCOPE, key, !currently);
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

async function applyChargedEffects(item, charged) {
  if (charged) {
    await item.update({ "system.canIgnoreArmor": true, "system.ignoreArmorPercent": 50 });
  } else {
    await item.update({ "system.canIgnoreArmor": false, "system.ignoreArmorPercent": 0 });
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

  const grids = Array.from(el.querySelectorAll(".weapon-grid[data-item-id]"));
  grids.forEach(grid => {
    const item = actor.items.get(grid.dataset.itemId);
    if (!item || !item.getFlag(SCOPE, "isTechWeapon")) return;
    const list = grid.querySelector("ul");
    if (!list) return;

    const checked = !!item.getFlag(SCOPE, "isCharged");
    const iconClass = checked ? "far fa-circle-dot" : "far fa-circle";
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="text-padding-sides-small">Charged</span>
      <a class="fire-checkbox" data-item-id="${item.id}">
        <i class="${iconClass} text-padding-right-smallest"></i>
      </a>`;
    const link = li.querySelector("a");
    link.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const next = !item.getFlag(SCOPE, "isCharged");
      await item.setFlag(SCOPE, "isCharged", next);
      await applyChargedEffects(item, next);
    });
    list.appendChild(li);
    grid.style.height = "auto";
    grid.style.minHeight = "80px";

    const autofire = list.querySelector('a.fire-checkbox[data-fire-mode="autofire"]');
    if (autofire && !autofire.dataset.chargedListener) {
      autofire.dataset.chargedListener = "1";
      autofire.addEventListener("click", async () => {
        if (item.getFlag(SCOPE, "isCharged")) {
          await item.setFlag(SCOPE, "isCharged", false);
          await applyChargedEffects(item, false);
        }
      });
    }
  });
}

function normalize(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isPowerWeaponContent(content, speakerId) {
  const normContent = normalize(content);
  const candidates = [];
  if (speakerId) {
    const a = game.actors.get(speakerId);
    if (a) candidates.push(a);
  }
  if (!candidates.length) candidates.push(...game.actors.contents);

  for (const actor of candidates) {
    for (const item of actor.items) {
      if (item.type !== "weapon") continue;
      if (!item.getFlag(SCOPE, "isPowerWeapon")) continue;
      const n = normalize(item.name);
      if (n && normContent.includes(n)) return true;
    }
  }
  return false;
}

function lastCritIsPower() {
  const msgs = game.messages.contents.slice().reverse();
  for (const msg of msgs) {
    const c = msg.content || "";
    if (!/Critical Damage/i.test(c) && !/data-bonus-damage/.test(c)) continue;
    if (/HP Reduced By/i.test(c) || /Damage Dealt To/i.test(c)) continue;
    if (msg.getFlag(SCOPE, "powerCrit")) return true;
    if (/Critical Damage:\s*\+?10/i.test(c) || /data-bonus-damage="10"/.test(c)) return true;
    return false;
  }
  return false;
}

async function upgradePowerCrit(message) {
  const content = message.content || "";
  if (/HP Reduced By/i.test(content) || /Damage Dealt To/i.test(content)) return;
  if (!/Critical Damage/i.test(content) && !/data-bonus-damage="5"/.test(content)) return;
  if (message.getFlag(SCOPE, "powerCrit")) return;

  const speakerId = message.speaker?.actor;
  if (!isPowerWeaponContent(content, speakerId)) return;

  const next = content
    .replace(/Critical Damage:\s*\+?5/gi, "Critical Damage: +10")
    .replace(/data-bonus-damage="5"/g, 'data-bonus-damage="10"');

  await message.update({
    content: next,
    [`flags.${SCOPE}.powerCrit`]: true
  });
}

function register() {
  if (globalThis._cprWeaponFlagsHooks) {
    globalThis._cprWeaponFlagsHooks.forEach(id => {
      Hooks.off("renderItemSheetV2", id);
      Hooks.off("renderItemSheet", id);
    });
  }
  globalThis._cprWeaponFlagsHooks = [
    Hooks.on("renderItemSheetV2", (app, html) => tryInjectWeapon(app, html)),
    Hooks.on("renderItemSheet", (app, html) => tryInjectWeapon(app, html))
  ];

  if (globalThis._cprChargedHook) {
    Hooks.off("renderActorSheet", globalThis._cprChargedHook);
    Hooks.off("renderActorSheetV2", globalThis._cprChargedHook);
  }
  globalThis._cprChargedHook = Hooks.on("renderActorSheet", (app, html) => injectCharged(app, html));
  Hooks.on("renderActorSheetV2", (app, html) => injectCharged(app, html));

  if (globalThis._powerDisplayHook) Hooks.off("preCreateChatMessage", globalThis._powerDisplayHook);
  globalThis._powerDisplayHook = Hooks.on("preCreateChatMessage", (message, data) => {
    let content = data.content || message.content || "";
    if (/HP Reduced By/i.test(content) || /Damage Dealt To/i.test(content)) return;
    if (!/Critical Damage/i.test(content) && !/data-bonus-damage="5"/.test(content)) return;

    const speakerId = message.speaker?.actor || data.speaker?.actor;
    if (!isPowerWeaponContent(content, speakerId)) return;

    content = content
      .replace(/Critical Damage:\s*\+?5/gi, "Critical Damage: +10")
      .replace(/data-bonus-damage="5"/g, 'data-bonus-damage="10"');
    data.content = content;

    const flags = foundry.utils.duplicate(data.flags || message.flags || {});
    flags[SCOPE] = flags[SCOPE] || {};
    flags[SCOPE].powerCrit = true;
    data.flags = flags;
    if (message.updateSource) message.updateSource({ content, flags });
  });

  // Catch explosive ammo updates (and any late rewrites)
  if (globalThis._powerExplosiveHook) Hooks.off("updateChatMessage", globalThis._powerExplosiveHook);
  globalThis._powerExplosiveHook = Hooks.on("updateChatMessage", (message) => {
    upgradePowerCrit(message);
  });

  if (globalThis._powerCreateHook) Hooks.off("createChatMessage", globalThis._powerCreateHook);
  globalThis._powerCreateHook = Hooks.on("createChatMessage", (message) => {
    // Delay so explosive ammo hook can finish its update first
    setTimeout(() => upgradePowerCrit(message), 300);
  });

  const ActorClass = CONFIG.Actor.documentClass;
  if (ActorClass?.prototype?._applyDamage) {
    if (!globalThis._origApplyDamage) {
      globalThis._origApplyDamage = ActorClass.prototype._applyDamage;
    }
    ActorClass.prototype._applyDamage = async function (...args) {
      if (args[1] === 5 && lastCritIsPower()) args[1] = 10;
      return globalThis._origApplyDamage.apply(this, args);
    };
  }

  console.log("%cSanctum Tech/Power Rebuild | Ready (explosive + flag)", "color: #ff6b00; font-weight: bold");
}

if (game.ready) register();
else Hooks.once("ready", register);