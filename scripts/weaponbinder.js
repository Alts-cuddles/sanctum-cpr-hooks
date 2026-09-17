console.log("%cSanctum Weapon Binder | Loading", "color:#c0392b;font-weight:bold");

const MODULE_ID = "sanctum-cpr-hooks";
const SOCKET_EVENT = `module.${MODULE_ID}`;

function sameName(a, b) {
  return String(a || "").replace(/\s+/g, "").toLowerCase() === String(b || "").replace(/\s+/g, "").toLowerCase();
}
function cleanPath(path) {
  if (!path) return "";
  return String(path).trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/^data\//i, "").replace(/ /g, "%20");
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
function openPanel() {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  new Dialog({
    title: "Sanctum Weapon Binder",
    content: `
      <p>AA ${game.modules.get("autoanimations")?.active ? "on" : "OFF"} · Sequencer ${game.modules.get("sequencer")?.active ? "on" : "OFF"}</p>
      <p>If this window opened, weaponbinder.js is loaded.</p>
    `,
    buttons: {
      binder: {
        icon: '<i class="fas fa-link"></i>',
        label: "Open Binder Macro Needed",
        callback: () => ui.notifications.info("Panel loaded. Use the full binder file next if this worked.")
      },
      perms: {
        icon: '<i class="fas fa-users"></i>',
        label: "Fix Player Playback",
        callback: async () => {
          const perms = foundry.utils.duplicate(game.settings.get("core", "permissions") || {});
          if (!Array.isArray(perms.FILES_BROWSE)) perms.FILES_BROWSE = [];
          let changed = false;
          for (const role of [CONST.USER_ROLES.PLAYER, CONST.USER_ROLES.TRUSTED]) {
            if (!perms.FILES_BROWSE.includes(role)) { perms.FILES_BROWSE.push(role); changed = true; }
          }
          if (changed) await game.settings.set("core", "permissions", perms);
          ui.notifications.info(changed ? "Player file-browser on. Players refresh once." : "Already on.");
        }
      }
    }
  }).render(true);
}

function attachApi() {
  globalThis.sanctumOpenBinderPanel = openPanel;
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = Object.assign(mod.api || {}, { openPanel });
  console.log("%cSanctum Weapon Binder | Ready", "color:#c0392b;font-weight:bold");
}

Hooks.once("ready", () => {
  try {
    if (!game.settings.settings.has(`${MODULE_ID}.aabBroadcastSounds`)) {
      game.settings.register(MODULE_ID, "aabBroadcastSounds", {
        name: "Broadcast bound weapon sounds to players",
        scope: "world", config: true, type: Boolean, default: true
      });
    }
  } catch (err) {
    console.warn("Sanctum Weapon Binder settings", err);
  }
  game.socket.on(SOCKET_EVENT, (payload) => {
    if (payload?.type !== "aab-sound" || !game.user.isGM || !payload.src) return;
    playForRecipients(payload.src, payload.volume, game.users.filter(u => u.active && (payload.includeGM || !u.isGM)).map(u => u.id));
  });
  Hooks.on("AutomatedAnimations-WorkflowStart", (workflow) => {
    try {
      if (!game.settings.get(MODULE_ID, "aabBroadcastSounds")) return;
    } catch (e) { return; }
    const snd = findBoundSound(workflow?.item?.name);
    if (!snd) return;
    if (game.user.isGM) {
      playForRecipients(snd.file, snd.volume, game.users.filter(u => u.active && !u.isGM).map(u => u.id));
    } else {
      game.socket.emit(SOCKET_EVENT, { type: "aab-sound", src: snd.file, volume: snd.volume, includeGM: true });
    }
  });
  attachApi();
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  controls.find(c => c.name === "token")?.tools.push({
    name: "sanctum-weapon-binder",
    title: "Sanctum Weapon Binder",
    icon: "fas fa-gun",
    button: true,
    onClick: () => openPanel()
  });
});