console.log("%c[Sanctum AF DV] file loaded", "color: #0f0; font-weight: bold");

(() => {
  if (window.__cprAfDvInit) return;

  const FLAG_SCOPE = "world";
  const FLAG_KEY = "autofireDvTable";

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
      console.warn("[Sanctum AF DV] inject failed", err);
    }
  }

  Hooks.on("renderItemSheet", inject);
  Hooks.on("renderItemSheetV2", inject);
  Hooks.on("renderCPRItemSheet", inject);

  game.cprWorld ??= {};
  game.cprWorld.getAutofireDvTable = (item) => item?.getFlag(FLAG_SCOPE, FLAG_KEY) || "";
  game.cprWorld.getAutofireDvTableNames = tableNames;
  window.__cprAfDvInit = true;

  const start = () => {
    forceHover();
    console.log("%c[Sanctum AF DV] Ready", "color: #0f0");
  };

  if (game.ready) start();
  else Hooks.once("ready", start);
})();