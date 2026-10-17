// Sanctum Autofire DV
// Replaces machinegun.js, machinepistol.js, subcompactsmg.js, and the old hardcoded dvDisplay.js.
// Injects the Autofire DV Table dropdown and makes Diwako use the flag live.

console.log("%c[Sanctum AF DV] Loading", "color: #0f0; font-weight: bold");

(() => {
  if (window.__cprAfDvInit) return;

  const FLAG_SCOPE = "world";
  const FLAG_KEY = "autofireDvTable";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;"
  }[c]));

  function packId() {
    return game.cprWorld?.dvSourcePack
      || (game.settings.settings.has("world.cprAfDvPack") && game.settings.get("world", "cprAfDvPack"))
      || game.settings.get("cyberpunk-red-core", "dvRollTableCompendium")
      || "";
  }

  function hasAF(item) {
    const n = Number(item.system?.fireModes?.autoFire);
    return Number.isFinite(n) && n > 0;
  }

  function tableNames() {
    if (Array.isArray(game.cprWorld?.allowedAfTables) && game.cprWorld.allowedAfTables.length) {
      return game.cprWorld.allowedAfTables.filter((n) => /autofire/i.test(n));
    }
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

  function dvFromTable(table, dist) {
    const d = Number(dist);
    const rows = [];
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
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      rows.push({ a, b, text: r.text, mid: (a + b) / 2 });
      if (d >= Math.min(a, b) && d <= Math.max(a, b)) {
        const n = parseInt(r.text, 10);
        if (Number.isFinite(n)) return n;
      }
    }
    if (!rows.length) return -1;
    rows.sort((x, y) => Math.abs(d - x.mid) - Math.abs(d - y.mid));
    const n = parseInt(rows[0].text, 10);
    return Number.isFinite(n) ? n : -1;
  }

  function getChosenAfName() {
    const actors = [
      ...canvas.tokens.controlled.map((t) => t.actor),
      canvas.tokens.hover?.actor
    ].filter(Boolean);
    for (const a of actors) {
      for (const w of a.items) {
        if (w.type !== "weapon" || !hasAF(w)) continue;
        const flag = w.getFlag(FLAG_SCOPE, FLAG_KEY);
        if (flag) return flag;
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
        if (dvTable && /autofire/i.test(dvTable)) {
          const chosen = getChosenAfName();
          if (chosen) name = chosen;
        }
        const table = await loadTable(name);
        if (!table) {
          console.warn("AF DV: no table", name);
          return -1;
        }
        return dvFromTable(table, dist);
      };
      mod.Utils.__cprAfPatched = true;
      console.log("AF DV: Diwako uses Autofire DV flag");
      return true;
    } catch (err) {
      console.warn("AF DV: Diwako patch failed", err);
      return false;
    }
  }

  function hostOf(app, html) {
    if (html?.jquery) return html[0];
    if (html instanceof HTMLElement) return html;
    return html?.[0] ?? app.element?.[0] ?? app.element;
  }

  function inject(app, html) {
    const item = app.document ?? app.item ?? app.object;
    if (!item || item.type !== "weapon") return;
    const host = hostOf(app, html);
    if (!host) return;
    host.querySelector("#world-autofire-dv-row")?.remove();
    if (!hasAF(item)) return;
    const dvSelect = host.querySelector('select[name="system.dvTable"]');
    if (!dvSelect) return;

    const chosen = item.getFlag(FLAG_SCOPE, FLAG_KEY) || "";
    const opts = ['<option value="">(pick one)</option>']
      .concat(tableNames().map((n) =>
        `<option value="${esc(n)}" ${n === chosen ? "selected" : ""}>${esc(n)}</option>`
      )).join("");

    const wrap = document.createElement("div");
    wrap.id = "world-autofire-dv-row";
    wrap.style.cssText = "display:block;width:100%;flex-basis:100%;clear:both;margin:6px 0;";
    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:minmax(140px,auto) minmax(220px,1fr);align-items:center;column-gap:12px;width:100%;">
        <span>Autofire DV Table:</span>
        <select id="world-autofire-dv" style="width:100%;min-width:220px;box-sizing:border-box;">${opts}</select>
      </div>`;
    (dvSelect.closest("tr") || dvSelect.parentElement).after(wrap);

    const sel = wrap.querySelector("#world-autofire-dv");
    const w = dvSelect.getBoundingClientRect().width;
    if (w > 50) sel.style.width = w + "px";

    sel.addEventListener("change", async (ev) => {
      const val = ev.currentTarget.value;
      if (val) await item.setFlag(FLAG_SCOPE, FLAG_KEY, val);
      else await item.unsetFlag(FLAG_SCOPE, FLAG_KEY);
      ui.notifications.info(item.name + ": Autofire DV = " + (val || "none"));
    });
  }

  Hooks.on("renderItemSheet", inject);
  Hooks.on("renderItemSheetV2", inject);
  Hooks.on("renderCPRItemSheet", inject);

  game.cprWorld ??= {};
  game.cprWorld.getAutofireDvTable = (item) => item?.getFlag(FLAG_SCOPE, FLAG_KEY) || "";
  game.cprWorld.getAutofireDvTableNames = tableNames;
  window.__cprAfDvInit = true;

  const start = () => {
    patchDiwako().then((ok) => {
      const apps = [
        ...Object.values(ui.windows ?? {}),
        ...(foundry.applications?.instances ? [...foundry.applications.instances.values()] : [])
      ];
      for (const app of apps) {
        const it = app.document ?? app.item;
        if (it?.type === "weapon") inject(app, app.element);
      }
      if (ok) console.log("%c[Sanctum AF DV] Ready. Hover uses the table you pick.", "color: #0f0");
      else console.warn("[Sanctum AF DV] Dropdown ready. Diwako patch failed.");
    });
  };

  if (game.ready) start();
  else Hooks.once("ready", start);
})();