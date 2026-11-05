import { FLAG_SCOPE, logError } from "./shared.js";

console.log("%c[Sanctum AF DV] file loaded", "color: #0f0; font-weight: bold");

(() => {
  if (window.__cprAfDvInit) return;

  const FLAG_KEY = "autofireDvTable";

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, function (c) {
      if (c === "&") return "&" + "amp;";
      if (c === "<") return "&" + "lt;";
      if (c === ">") return "&" + "gt;";
      if (c === '"') return "&" + "quot;";
      return "&" + "#39;";
    });
  }

  function packId() {
    try {
      return game.settings.get("cyberpunk-red-core", "dvRollTableCompendium") || "";
    } catch {
      return "";
    }
  }

  function hasAF(item) {
    const n = Number(item.system?.fireModes?.autoFire);
    return Number.isFinite(n) && n > 0;
  }

  function tableNames() {
    const names = [];
    const seen = new Set();
    const add = (n) => {
      if (!n || !/autofire/i.test(n) || seen.has(n)) return;
      seen.add(n);
      names.push(n);
    };
    const pack = game.packs.get(packId());
    if (pack) for (const e of pack.index) add(e.name);
    for (const t of game.tables) add(t.name);
    return names.sort((a, b) => a.localeCompare(b));
  }

  async function loadTable(name) {
    if (!name) return null;
    const pack = game.packs.get(packId());
    if (pack) {
      const e = pack.index.getName(name);
      if (e) return await pack.getDocument(e._id);
    }
    const core = game.packs.get("cyberpunk-red-core.internal_dv-tables");
    if (core) {
      const e = core.index.getName(name);
      if (e) return await core.getDocument(e._id);
    }
    return game.tables.getName(name) || null;
  }

  function dvAt(table, dist) {
    if (!table) return -1;
    const d = Number(dist);
    for (const r of table.results) {
      let a, b;
      if (Array.isArray(r.range) && r.range.length >= 2) {
        a = Number(r.range[0]);
        b = Number(r.range[1]);
      } else {
        const m = String(r.range ?? "").match(/(\d+)\s*[-–]\s*(\d+)/);
        if (!m) continue;
        a = Number(m[1]);
        b = Number(m[2]);
      }
      if (d >= Math.min(a, b) && d <= Math.max(a, b)) {
        const n = parseInt(r.text, 10);
        return Number.isFinite(n) ? n : -1;
      }
    }
    return -1;
  }

  function getDistance(a, b) {
    try {
      return canvas.grid.measurePath([{ x: a.x, y: a.y }, { x: b.x, y: b.y }]).distance;
    } catch {
      return 0;
    }
  }

  function lastRolledWeapon() {
    const msgs = game.messages.contents.slice(-50).reverse(); // recent messages only
    const actors = canvas.tokens.controlled.map((t) => t.actor).filter(Boolean);
    const weapons = actors.flatMap((a) => a.items.filter((i) => i.type === "weapon"));
    for (const m of msgs) {
      const text = m.content || "";
      if (!/Autofire|Tracer|Skill/i.test(text)) continue;
      for (const w of weapons) {
        if (text.includes(w.name)) return w;
      }
    }
    return null;
  }

  async function patchDiwako() {
    try {
      const mod = await import("/modules/diwako-cpred-additions/scripts/utils.js");
      if (!mod?.Utils?.getDV) return false;
      if (mod.Utils.__cprAfPatched) return true;
      mod.Utils.getDV = async function (dvTable, dist) {
        let name = dvTable;
        if (/autofire/i.test(dvTable || "")) {
          const w = lastRolledWeapon();
          const flag = w?.getFlag(FLAG_SCOPE, FLAG_KEY);
          if (flag) {
            name = flag;
            console.log("[AF DV] rolled", w.name, "-> using", flag, "instead of", dvTable);
          }
        }
        const table = await loadTable(name);
        if (!table) {
          console.warn("[AF DV] no table", name);
          return -1;
        }
        return dvAt(table, dist);
      };
      mod.Utils.__cprAfPatched = true;
      console.log("%c[Sanctum AF DV] Diwako getDV patched (card uses rolled weapon)", "color: #0f0");
      return true;
    } catch (err) {
      console.warn("[AF DV] Diwako patch failed", err);
      return false;
    }
  }

  // Diwako returns early when system.dvTable is empty.
  // Post the card ourselves from the Autofire flag in that case.
  function fallbackCard() {
    if (window.__cprAfDvFallback) return;
    window.__cprAfDvFallback = true;
    Hooks.on("createChatMessage", async (message) => {
      try {
        if (game.userId !== (message.author?.id || message.user?.id)) return;
        const div = document.createElement("div");
        div.innerHTML = message.content || "";
        const isAttack = div.querySelector("[data-action=rollDamage]");
        if (!isAttack) return;
        const data = isAttack.dataset || {};
        const attackType = (div.querySelector("div.rollcard-subtitle-center")?.textContent || "").trim();
        const afLabel = game.i18n.localize("CPR.global.itemType.skill.autofire");
        if (attackType !== afLabel) return;

        const actor = game.actors.get(data.actorId)
          || canvas.tokens.get(data.tokenId)?.actor;
        const item = actor?.items?.get(data.itemId);
        if (!item) return;
        if (item.system?.dvTable) return;

        const flag = item.getFlag(FLAG_SCOPE, FLAG_KEY);
        if (!flag) return;

        const target = message.author?.targets?.first?.() || game.user.targets.first();
        if (!target) return;

        const token = canvas.tokens.get(data.tokenId)
          || canvas.tokens.placeables.find((t) => t.actor?.id === actor.id);
        if (!token) return;

        const dist = getDistance(token, target);
        const table = await loadTable(flag);
        const dv = dvAt(table, dist);
        if (dv < 0) return;

        const attackRoll = parseInt(
          div.querySelector("span.clickable[data-action='toggleVisibility']")?.textContent || "",
          10
        );
        if (!Number.isFinite(attackRoll)) return;

        const hit = attackRoll > dv;
        const ref = target.actor?.system?.stats?.ref?.value ?? 0;
        const evade = ref >= 8;
        const bg = hit ? "var(--cpr-text-chat-success, #2d9f36)" : "var(--cpr-text-chat-failure, #b90202ff)";
        const verb = hit ? "hit" : "missed";
        const by = Math.abs(attackRoll - dv);
        const evadeNote = evade
          ? " IF they have declared that they are dodging AND your roll has beat their evasion roll."
          : "";
        const text = `${token.name} ${verb} ${target.name} by ${by} according to the ranged DV (${dv})!${evadeNote}`;

        await ChatMessage.create({
          speaker: message.speaker,
          content: `<div class="cpr-block" style="padding:10px;background-color:${bg}">${text}</div>`,
          whisper: message.whisper
        }, { chatBubble: false });

        console.log("[AF DV] fallback card from flag", flag, "dv", dv);
      } catch (err) {
        logError("AF DV fallback card", err);
      }
    });
  }

  function forceHover() {
    const proto = Token.prototype;
    if (!proto.showDVDisplay || proto.__cprAfForced) return;
    const orig = proto.showDVDisplay;
    proto.showDVDisplay = async function (...args) {
      await orig.apply(this, args);
      try {
        const controlled = canvas.tokens.controlled[0];
        if (!controlled?.actor || controlled === this) return;
        const display = this.dvDisplay;
        if (!display) return;
        const textObj = display.children.find((c) => c && typeof c.text === "string");
        if (!textObj) return;
        const dist = getDistance(controlled, this);
        const lines = (textObj.text || "").split("\n").map((l) => l.trim()).filter(Boolean);
        const kept = lines.filter((l) => !/\(Autofire\)/i.test(l));
        for (const w of controlled.actor.items) {
          if (w.type !== "weapon" || w.system?.equipped !== "equipped") continue;
          const flag = w.getFlag(FLAG_SCOPE, FLAG_KEY);
          if (!flag) continue;
          const table = await loadTable(flag);
          const dv = dvAt(table, dist);
          if (dv < 0) continue;
          kept.push("DV: " + dv + " " + w.name + " (Autofire)");
        }
        kept.sort((a, b) => {
          const da = parseInt(a.match(/DV:\s*(\d+)/)?.[1] || "999", 10);
          const db = parseInt(b.match(/DV:\s*(\d+)/)?.[1] || "999", 10);
          return da - db;
        });
        textObj.text = kept.join("\n");
      } catch (err) {
        console.warn("[Sanctum AF DV] hover failed", err);
      }
    };
    proto.__cprAfForced = true;
  }

  function hostOf(app, html) {
    if (html?.jquery) return html[0];
    if (html instanceof HTMLElement) return html;
    return html?.[0] ?? app.element?.[0] ?? app.element;
  }

  function inject(app, html) {
    try {
      const item = app.document ?? app.item ?? app.object;
      if (!item || item.type !== "weapon") return;
      const host = hostOf(app, html);
      if (!host) return;
      host.querySelector("#world-autofire-dv-row")?.remove();
      if (!hasAF(item)) return;
      const anchor = host.querySelector('select[name="system.dvTable"]');
      if (!anchor) return;

      const chosen = item.getFlag(FLAG_SCOPE, FLAG_KEY) || "";
      const opts = ['<option value="">(pick one)</option>']
        .concat(tableNames().map((n) =>
          '<option value="' + esc(n) + '"' + (n === chosen ? " selected" : "") + ">" + esc(n) + "</option>"
        )).join("");

      const wrap = document.createElement("div");
      wrap.id = "world-autofire-dv-row";
      wrap.style.cssText = "display:block;width:100%;clear:both;margin:6px 0;";
      wrap.innerHTML =
        '<div style="display:grid;grid-template-columns:minmax(140px,auto) minmax(220px,1fr);align-items:center;column-gap:12px;width:100%;">' +
        '<span>Autofire DV Table:</span>' +
        '<select id="world-autofire-dv" style="width:100%;min-width:220px;box-sizing:border-box;">' + opts + "</select>" +
        "</div>";
      (anchor.closest("tr, li, .form-group") || anchor.parentElement).after(wrap);

      const sel = wrap.querySelector("#world-autofire-dv");
      const w = anchor.getBoundingClientRect().width;
      if (w > 50) sel.style.width = w + "px";

      sel.addEventListener("change", async (ev) => {
        const val = ev.currentTarget.value;
        if (val) await item.setFlag(FLAG_SCOPE, FLAG_KEY, val);
        else await item.unsetFlag(FLAG_SCOPE, FLAG_KEY);
        ui.notifications.info(item.name + ": Autofire DV = " + (val || "none"));
      });
    } catch (err) {
      logError("AF DV inject", err);
    }
  }

  Hooks.on("renderItemSheet", inject);
  Hooks.on("renderItemSheetV2", inject);
  // renderCPRItemSheet removed: CPRItemSheet extends ItemSheet, so renderItemSheet already fires for it.

  game.cprWorld ??= {};
  game.cprWorld.getAutofireDvTable = (item) => item?.getFlag(FLAG_SCOPE, FLAG_KEY) || "";
  game.cprWorld.getAutofireDvTableNames = tableNames;
  window.__cprAfDvInit = true;

  const start = () => {
    forceHover();
    patchDiwako();
    fallbackCard();
    console.log("%c[Sanctum AF DV] Ready", "color: #0f0");
  };

  if (game.ready) start();
  else Hooks.once("ready", start);
})();
