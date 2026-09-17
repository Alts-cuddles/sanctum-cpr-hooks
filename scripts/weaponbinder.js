console.log("%cSanctum Weapon Binder | Loading", "color:#c0392b;font-weight:bold");

(() => {
  if (globalThis.sanctumWeaponBinderRegistered) return;
  globalThis.sanctumWeaponBinderRegistered = true;

  const MODULE_ID = "sanctum-cpr-hooks";
  const SOCKET_EVENT = `module.${MODULE_ID}`;

  const TYPES = [
    { id: "arrow", label: "Arrow / Bow", menu: "range", preferred: ["Arrow (Basic)", "Bow (Excellent)"], keys: ["arrow", "bow"] },
    { id: "pistol", label: "Pistol (Medium)", menu: "range", preferred: ["Medium Pistol (Basic)", "Medium Pistol"], keys: ["medium pistol"] },
    { id: "heavy-pistol", label: "Heavy Pistol", menu: "range", preferred: ["Heavy Pistol (Basic)", "Heavy Pistol"], keys: ["heavy pistol"] },
    { id: "vhp", label: "Very Heavy Pistol", menu: "range", preferred: ["Very Heavy Pistol (Basic)", "Very Heavy Pistol"], keys: ["very heavy pistol"] },
    { id: "revolver", label: "Revolver", menu: "range", preferred: ["Double-Action Revolver", "Very Heavy Pistol (Basic)"], keys: ["revolver", "very heavy pistol"] },
    { id: "smg", label: "SMG", menu: "range", preferred: ["SMG (Poor)"], keys: ["smg"] },
    { id: "heavy-smg", label: "Heavy SMG", menu: "range", preferred: ["Heavy SMG (Excellent)", "Militech-Issued Heavy SMG", "SMG (Poor)"], keys: ["heavy smg", "smg"] },
    { id: "shotgun", label: "Shotgun", menu: "range", preferred: ["Shotgun", "Shotgun Slug (Basic)"], keys: ["shotgun"] },
    { id: "rifle", label: "Assault Rifle / Rifle", menu: "range", preferred: ["Assault Rifle", "Rifle (Basic)"], keys: ["assault rifle", "rifle"] },
    { id: "sniper", label: "Sniper", menu: "range", preferred: ["Nya-Boom", "Assault Rifle", "Rifle (Basic)"], keys: ["nya-boom", "sniper", "rifle"] },
    { id: "grenade", label: "Grenade", menu: "preset", preferred: ["Grenade (Flashbang)", "Grenade (Armor-Piercing)", "Molotov Cocktail"], keys: ["grenade"] },
    { id: "rocket", label: "Rocket", menu: "preset", preferred: ["Rocket (Armor-Piercing)", "Rocket (Smart)"], keys: ["rocket"] },
    { id: "flamethrower", label: "Flamethrower", menu: "range", preferred: ["Heavy Flamethrower"], keys: ["flamethrower"] },
    { id: "sword", label: "Sword / Katana", menu: "melee", preferred: ["Sword", "Thermal Katana", "Machete"], keys: ["sword", "katana", "machete"] },
    { id: "knife", label: "Knife", menu: "melee", preferred: ["Combat Knife", "Tomahawk"], keys: ["knife"] },
    { id: "bat", label: "Bat / Club", menu: "melee", preferred: ["Baseball Bat", "Spiked Bat", "Heavy Melee (Excellent)"], keys: ["bat", "club"] },
    { id: "pipe", label: "Pipe / Crowbar", menu: "melee", preferred: ["Lead Pipe", "Crowbar"], keys: ["pipe", "crowbar"] },
    { id: "sledge", label: "Sledgehammer", menu: "melee", preferred: ["Sledgehammer", "Heavy Melee (Excellent)"], keys: ["sledge", "hammer"] },
    { id: "chainsaw", label: "Chainsaw", menu: "melee", preferred: ["Chainsaw"], keys: ["chainsaw"] },
    { id: "unarmed", label: "Unarmed / Punch", menu: "melee", preferred: ["Unarmed", "Big Knucks"], keys: ["unarmed", "knucks"] }
  ];

  const WEAPON_TYPE_MAP = {
    assaultRifle: "rifle", rifle: "rifle", bow: "arrow", bowsAndCrossbows: "arrow", crossbow: "arrow",
    grenadeLauncher: "grenade", heavyMelee: "bat", heavymelee: "bat",
    heavyPistol: "heavy-pistol", hvyPistol: "heavy-pistol",
    heavySMG: "heavy-smg", heavySmg: "heavy-smg", hvySmg: "heavy-smg",
    lightMelee: "knife", lightmelee: "knife",
    mediumPistol: "pistol", medPistol: "pistol", pistol: "pistol",
    rocketLauncher: "rocket", shotgun: "shotgun", smg: "smg",
    sniperRifle: "sniper", sniper: "sniper", thrownWeapon: "grenade",
    unarmed: "unarmed", martialArts: "unarmed",
    veryHeavyMelee: "sword", vHeavyMelee: "sword",
    veryHeavyPistol: "vhp", vHeavyPistol: "vhp",
    flamethrower: "flamethrower", machinegun: "rifle", machineGun: "rifle",
    machinepistol: "pistol", subcompactsmg: "smg"
  };

  const AMMO_VARIETY_MAP = {
    arrow: "arrow", medPistol: "pistol", mediumPistol: "pistol",
    hvyPistol: "heavy-pistol", heavyPistol: "heavy-pistol",
    vHeavyPistol: "vhp", veryHeavyPistol: "vhp", smg: "smg",
    hvySmg: "heavy-smg", heavySmg: "heavy-smg", rifle: "rifle",
    shotgunShell: "shotgun", shotgunSlug: "shotgun", slug: "shotgun",
    grenade: "grenade", rocket: "rocket", battery: "rifle"
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sameName = (a, b) => String(a || "").replace(/\s+/g, "").toLowerCase() === String(b || "").replace(/\s+/g, "").toLowerCase();
  const cleanPath = (path) => {
    if (!path) return "";
    let p = String(path).trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/^data\//i, "");
    return p.split("/").filter(Boolean).map(seg => {
      try { seg = decodeURIComponent(seg); } catch (e) {}
      return seg.replace(/ /g, "%20");
    }).join("/");
  };
  function uuidv4() {
    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const typeById = (id) => TYPES.find(t => t.id === id) || null;
  function getMenu(menu) {
    const raw = game.settings.get("autoanimations", `aaAutorec-${menu}`);
    if (Array.isArray(raw)) return raw;
    throw new Error(`AA menu "${menu}" is not an array.`);
  }
  function resolveType(item) {
    const rawType = String(item.system?.weaponType || "").trim();
    if (rawType && WEAPON_TYPE_MAP[rawType]) return typeById(WEAPON_TYPE_MAP[rawType]);
    for (const v of [].concat(item.system?.ammoVariety || [])) {
      if (AMMO_VARIETY_MAP[v]) return typeById(AMMO_VARIETY_MAP[v]);
    }
    const blob = `${item.name} ${rawType}`.toLowerCase();
    const hits = [
      ["very heavy pistol", "vhp"], ["heavy smg", "heavy-smg"], ["heavy pistol", "heavy-pistol"],
      ["assault rifle", "rifle"], ["machine gun", "rifle"], ["sniper", "sniper"], ["shotgun", "shotgun"],
      ["medium pistol", "pistol"], ["machine pistol", "pistol"], ["smg", "smg"], ["grenade", "grenade"],
      ["rocket", "rocket"], ["bow", "arrow"], ["sword", "sword"], ["knife", "knife"], ["bat", "bat"],
      ["rifle", "rifle"], ["pistol", "pistol"]
    ];
    for (const [key, id] of hits) if (blob.includes(key)) return typeById(id);
    return null;
  }
  function findBoundSound(itemName) {
    if (!itemName) return null;
    for (const menu of ["range", "melee", "preset"]) {
      const hit = (game.settings.get("autoanimations", `aaAutorec-${menu}`) || [])
        .find(e => sameName(e.label, itemName) && e.primary?.sound?.file);
      if (hit) return { file: cleanPath(hit.primary.sound.file), volume: Number(hit.primary.sound.volume ?? 0.75) };
    }
    return null;
  }
  function playForRecipients(src, volume, recipients) {
    const file = cleanPath(src);
    if (!file || !recipients?.length) return;
    AudioHelper.play({ src: file, volume: volume ?? 0.75, autoplay: true, loop: false }, { recipients });
  }
  function handleSoundRequest(payload) {
    if (!game.user.isGM || !payload?.src) return;
    const recipients = game.users.filter(u => u.active && (payload.includeGM || !u.isGM)).map(u => u.id);
    playForRecipients(payload.src, payload.volume, recipients);
  }
  function onWorkflowStart(workflow) {
    if (!game.settings.get(MODULE_ID, "aabBroadcastSounds")) return;
    const snd = findBoundSound(workflow?.item?.name);
    if (!snd) return;
    if (game.user.isGM) {
      playForRecipients(snd.file, snd.volume, game.users.filter(u => u.active && !u.isGM).map(u => u.id));
      return;
    }
    game.socket.emit(SOCKET_EVENT, { type: "aab-sound", src: snd.file, volume: snd.volume, includeGM: true });
  }
  function forceSound(entry, customSound) {
    entry.primary = entry.primary || {};
    const file = cleanPath(customSound || entry.primary.sound?.file || "");
    entry.primary.sound = Object.assign(
      { enable: false, delay: 0, file: "", repeat: 1, repeatDelay: 100, startTime: 0, volume: 0.75 },
      entry.primary.sound || {},
      file ? { enable: true, file } : {}
    );
    return entry;
  }
  function findTemplate(type) {
    const list = getMenu(type.menu);
    for (const label of type.preferred || []) {
      const hit = list.find(e => sameName(e.label, label));
      if (hit) return { list, src: hit };
    }
    for (const key of type.keys || []) {
      const hit = list.find(e => String(e.label || "").toLowerCase().includes(key) && e.primary?.sound?.file);
      if (hit) return { list, src: hit };
    }
    return { list, src: list.find(e => e.primary?.sound?.file) || list[0] };
  }
  function cloneTemplate(type, name, customSound, exact) {
    const { list, src } = findTemplate(type);
    if (!src) throw new Error(`No ${type.menu} entry to clone for ${type.label}.`);
    const entry = JSON.parse(JSON.stringify(src));
    entry.id = uuidv4();
    entry.label = name;
    entry.menu = type.menu;
    delete entry.metaData;
    entry.advanced = entry.advanced || { excludedTerms: [] };
    entry.advanced.exactMatch = exact;
    entry.isEnabled = true;
    entry.isCustomized = true;
    entry.fromAmmo = false;
    entry.version = 5;
    forceSound(entry, customSound);
    return { entry, clonedFrom: src.label };
  }
  async function writeLabel(type, name, customSound, exact, overwrite = true) {
    const { entry, clonedFrom } = cloneTemplate(type, name, customSound, exact);
    const list = getMenu(type.menu);
    const idx = list.findIndex(e => sameName(e.label, name));
    if (idx >= 0) {
      if (!overwrite) return { entry: list[idx], skipped: true, clonedFrom };
      const oldId = String(list[idx].id || "");
      entry.id = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(oldId) ? oldId : uuidv4();
      list.splice(idx, 1, entry);
    } else list.push(entry);
    await game.settings.set("autoanimations", `aaAutorec-${type.menu}`, list);
    return { entry, skipped: false, clonedFrom };
  }
  async function stampWeaponOnly(item, template) {
    const flags = JSON.parse(JSON.stringify(template));
    flags.id = uuidv4();
    flags.label = item.name;
    flags.isEnabled = true;
    flags.isCustomized = true;
    flags.fromAmmo = false;
    flags.version = 5;
    if (flags.primary?.sound?.file) flags.primary.sound.file = cleanPath(flags.primary.sound.file);
    await item.update({ "flags.autoanimations": flags });
  }
  async function scanWeaponPacks() {
    const packInfos = [];
    for (const pack of [...game.packs].filter(p => p.documentName === "Item")) {
      try {
        const index = await pack.getIndex({ fields: ["type"] });
        const count = index.filter(e => e.type === "weapon").length;
        if (!count) continue;
        packInfos.push({ id: pack.collection, label: pack.metadata.label || pack.collection, count });
      } catch (err) { console.warn("[Sanctum Binder] skip pack", pack.collection, err); }
    }
    packInfos.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return packInfos;
  }
  async function bindCompendium(packId, exact, overwrite, quiet = false) {
    const pack = game.packs.get(packId);
    if (!pack) throw new Error("That compendium is not available.");
    const index = await pack.getIndex({ fields: ["type", "name"] });
    const weaponEntries = index.filter(e => e.type === "weapon");
    let written = 0, skipped = 0;
    const unknown = [];
    for (const entry of weaponEntries) {
      const doc = await pack.getDocument(entry._id);
      if (!doc) continue;
      const type = resolveType(doc);
      if (!type) { unknown.push(doc.name); continue; }
      const result = await writeLabel(type, doc.name, "", exact, overwrite);
      if (result.skipped) skipped++; else written++;
    }
    if (!quiet) ui.notifications.info(`Bound ${written} from ${pack.metadata.label}. Reopen AA.`);
    return { written, skipped, unknown };
  }
  async function bindAllWeapons(packInfos, exact, overwrite) {
    let written = 0, skipped = 0;
    for (const doc of game.items.filter(i => i.type === "weapon")) {
      const type = resolveType(doc);
      if (!type) continue;
      const result = await writeLabel(type, doc.name, "", exact, overwrite);
      if (result.skipped) skipped++; else written++;
    }
    for (const info of packInfos) {
      const result = await bindCompendium(info.id, exact, overwrite, true);
      written += result.written; skipped += result.skipped;
    }
    ui.notifications.info(`Bound ${written} weapons. Reopen AA.`);
  }
  async function enablePlayerPlayback() {
    const perms = foundry.utils.duplicate(game.settings.get("core", "permissions") || game.permissions || {});
    let changed = false;
    if (!Array.isArray(perms.FILES_BROWSE)) perms.FILES_BROWSE = [];
    for (const role of [CONST.USER_ROLES.PLAYER, CONST.USER_ROLES.TRUSTED]) {
      if (!perms.FILES_BROWSE.includes(role)) { perms.FILES_BROWSE.push(role); changed = true; }
    }
    if (changed) await game.settings.set("core", "permissions", perms);
    return changed;
  }
  async function clearFlagsOnActor(actorDoc) {
    let n = 0;
    for (const item of actorDoc.items) {
      if (!item.flags?.autoanimations) continue;
      await item.update({ "flags.-=autoanimations": null });
      n++;
    }
    return n;
  }
  const rootOf = (html) => html?.jquery ? html[0] : (html?.[0] ?? html);

  async function openBinder() {
    if (!game.user.isGM) return ui.notifications.error("GM only.");
    if (!game.modules.get("autoanimations")?.active) return ui.notifications.error("Automated Animations is not active.");
    const selectedActor = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;
    const packInfos = await scanWeaponPacks();
    const packOpts = packInfos.map(p => `<option value="${esc(p.id)}">${esc(p.label)} (${p.count})</option>`).join("");
    let itemOpts = `<option value="">— paste a name below —</option>`;
    if (selectedActor) {
      const weapons = Array.from(selectedActor.items ?? []).filter(i => i.type === "weapon")
        .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }));
      itemOpts += weapons.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("");
    }
    const content = `
      <form class="flexcol" style="gap:8px">
        <p>One shared AA world row per weapon name.</p>
        <div><label><b>Apply to</b></label>
          <select id="aab-scope">
            <option value="item">This weapon only</option>
            <option value="global">This item name (all players / world)</option>
            <option value="compendium">Every weapon in a compendium</option>
            <option value="all">Every weapon in every pack + world items</option>
          </select></div>
        <div id="aab-pack-wrap" style="display:none">
          <label><b>Item compendium</b></label>
          <select id="aab-pack"><option value="ALL">All weapon packs + world items</option>${packOpts}</select>
        </div>
        <div id="aab-single-wrap">
          <div><label><b>Weapon on selected token</b></label><select id="aab-pick">${itemOpts}</select></div>
          <div><label><b>Item name</b></label><input type="text" id="aab-name" placeholder="Malorian Arms 3516"/></div>
          <div><label><b>Animation type</b></label>
            <select id="aab-type">${TYPES.map(t => `<option value="${t.id}" ${t.id === "vhp" ? "selected" : ""}>${t.label}</option>`).join("")}</select></div>
          <div><label><b>Custom sound</b></label>
            <div class="flexrow"><input type="text" id="aab-sound"/>
            <button type="button" id="aab-browse"><i class="fas fa-file-audio"></i></button></div></div>
        </div>
        <label><input type="checkbox" id="aab-exact" checked/> Exact name match</label>
        <label><input type="checkbox" id="aab-overwrite" checked/> Overwrite existing rows</label>
      </form>`;
    new Dialog({
      title: "Sanctum AA Weapon Binder",
      content,
      buttons: {
        ok: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Add",
          callback: async (html) => {
            const r = rootOf(html);
            const scope = r.querySelector("#aab-scope").value;
            const exact = r.querySelector("#aab-exact").checked;
            const overwrite = r.querySelector("#aab-overwrite").checked;
            if (scope === "all") return bindAllWeapons(packInfos, exact, overwrite);
            if (scope === "compendium") {
              const packId = r.querySelector("#aab-pack").value;
              if (packId === "ALL") return bindAllWeapons(packInfos, exact, overwrite);
              return bindCompendium(packId, exact, overwrite);
            }
            const name = r.querySelector("#aab-name").value.trim();
            const type = TYPES.find(t => t.id === r.querySelector("#aab-type").value);
            const sound = cleanPath(r.querySelector("#aab-sound").value.trim());
            const picked = selectedActor?.items.get(r.querySelector("#aab-pick")?.value) ?? null;
            if (!name) return ui.notifications.warn("Enter the item name.");
            if (scope === "item") {
              if (!picked) return ui.notifications.warn("Pick a weapon.");
              const { entry } = cloneTemplate(type, picked.name, sound, exact);
              await stampWeaponOnly(picked, entry);
              return ui.notifications.info(`Bound "${picked.name}".`);
            }
            const result = await writeLabel(type, name, sound, exact, overwrite);
            ui.notifications.info(`World row "${name}" saved from "${result.clonedFrom}".`);
          }
        },
        cancel: { label: "Cancel" }
      },
      render: (html) => {
        const r = rootOf(html);
        const scope = r.querySelector("#aab-scope");
        const toggle = () => {
          const packMode = scope.value === "compendium";
          r.querySelector("#aab-pack-wrap").style.display = packMode ? "block" : "none";
          r.querySelector("#aab-single-wrap").style.display = (packMode || scope.value === "all") ? "none" : "block";
        };
        scope.addEventListener("change", toggle);
        toggle();
        r.querySelector("#aab-pick")?.addEventListener("change", () => {
          const picked = selectedActor?.items.get(r.querySelector("#aab-pick").value);
          if (!picked) return;
          r.querySelector("#aab-name").value = picked.name ?? "";
          const guessed = resolveType(picked);
          if (guessed) r.querySelector("#aab-type").value = guessed.id;
        });
        r.querySelector("#aab-browse").addEventListener("click", ev => {
          ev.preventDefault();
          new FilePicker({ type: "audio", current: "assets/Weapon Sounds", callback: path => {
            r.querySelector("#aab-sound").value = cleanPath(path);
          }}).render(true);
        });
      }
    }, { width: 520, height: "auto", resizable: true }).render(true);
  }

  class SanctumBinderPanel extends Application {
    static get defaultOptions() {
      return foundry.utils.mergeObject(super.defaultOptions, {
        id: "sanctum-aab-panel",
        title: "Sanctum Weapon Binder",
        width: 360,
        height: "auto",
        resizable: true
      });
    }
    getData() {
      const aa = !!game.modules.get("autoanimations")?.active;
      const seq = !!game.modules.get("sequencer")?.active;
      const relay = game.settings.get(MODULE_ID, "aabBroadcastSounds");
      const browse = game.permissions?.FILES_BROWSE?.includes(CONST.USER_ROLES.PLAYER);
      return { aa, seq, relay, browse };
    }
    async _renderInner() {
      const d = this.getData();
      return $(`
        <div style="padding:8px;display:flex;flex-direction:column;gap:8px">
          <p>AA ${d.aa ? "on" : "OFF"} · Sequencer ${d.seq ? "on" : "OFF"} · Relay ${d.relay ? "on" : "off"} · Player browse ${d.browse ? "on" : "OFF"}</p>
          <button type="button" data-aab="binder">Open Binder</button>
          <button type="button" data-aab="perms">Fix Player Playback</button>
          <button type="button" data-aab="repair">Repair Selected Token Flags</button>
          <button type="button" data-aab="test">Test Bound Sound To Table</button>
        </div>`);
    }
    activateListeners(html) {
      super.activateListeners(html);
      html.find("[data-aab]").on("click", async ev => {
        const act = ev.currentTarget.dataset.aab;
        if (act === "binder") return openBinder();
        if (act === "perms") {
          const changed = await enablePlayerPlayback();
          ui.notifications.info(changed ? "Player file-browser on. Players refresh once." : "Already on.");
          return this.render();
        }
        if (act === "repair") {
          const actor = canvas.tokens?.controlled?.[0]?.actor;
          if (!actor) return ui.notifications.warn("Select a token.");
          const n = await clearFlagsOnActor(actor);
          return ui.notifications.info(`Cleared ${n} item flag(s).`);
        }
        if (act === "test") {
          const name = canvas.tokens?.controlled?.[0]?.actor?.items.find(i => i.type === "weapon")?.name;
          const snd = findBoundSound(name);
          if 