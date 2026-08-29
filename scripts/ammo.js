console.log("Sanctum Ammo Hooks 2.2 | Loading...");

const ammoHookList = [
  "_explosiveDamageHookId",
  "_explosiveCritHookId",
  "_explosiveUpdateHookId",
  "_highPrecisionHookId",
  "_ammoReminderHookId"
];

ammoHookList.forEach(id => {
  if (window[id]) {
    Hooks.off("renderCPRRollDialog", window[id]);
    Hooks.off("createChatMessage", window[id]);
    Hooks.off("updateActor", window[id]);
    delete window[id];
  }
});

if (!window._ammoHookProcessed) window._ammoHookProcessed = new WeakMap();
if (!window._sanctumProcessed) window._sanctumProcessed = new Set();
if (!window._explosiveProcessed) window._explosiveProcessed = new Set();

function getDiceValues(content) {
  const values = [];
  const regex = /d6_(\d)(_preem)?\.svg/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    values.push(parseInt(match[1]));
  }
  if (values.length === 0) {
    const numbers = [...content.matchAll(/>([1-6])</g)].map(m => parseInt(m[1]));
    if (numbers.length >= 3) values.push(...numbers.slice(0, 6));
  }
  return values;
}

function alreadyProcessed(id) {
  if (window._sanctumProcessed.has(id)) return true;
  window._sanctumProcessed.add(id);
  if (window._sanctumProcessed.size > 100) {
    const first = window._sanctumProcessed.values().next().value;
    window._sanctumProcessed.delete(first);
  }
  return false;
}

function getSelectedFireMode(itemId) {
  if (!itemId) return null;
  const checkboxes = document.querySelectorAll(`a.fire-checkbox[data-item-id="${itemId}"]`);
  for (const a of checkboxes) {
    const icon = a.querySelector("i");
    if (icon && icon.classList.contains("fa-circle-dot")) {
      return a.dataset.fireMode;
    }
  }
  return null;
}

function canUseHighPrecision(actor, item) {
  if (!actor || !item) return false;

  let soloRank = 0;

  const roleInfo = actor.system?.roleInfo;
  if (roleInfo) {
    if (roleInfo.activeRole?.toLowerCase() === "solo") {
      soloRank = roleInfo.rank ?? roleInfo.roleRank ?? roleInfo.value ?? 0;
    }
    if (roleInfo.roles) {
      const solo = Object.values(roleInfo.roles).find(r =>
        (r.name || r.role || "").toLowerCase() === "solo"
      );
      if (solo) soloRank = solo.rank ?? solo.value ?? solo.level ?? 0;
    }
  }

  if (soloRank < 1) {
    const soloItem = actor.items.find(i =>
      i.type === "role" && i.name.toLowerCase() === "solo"
    );
    if (soloItem) {
      soloRank = soloItem.system?.rank ?? soloItem.system?.value ?? soloItem.system?.level ?? 0;
    }
  }

  if (soloRank >= 1) {
    console.log("%c[High Precision] Qualified via Solo role (rank " + soloRank + ")", "color: #7dffa0");
    return true;
  }

  const skillName = item.system?.weaponSkill || item.system?.skill || "";
  if (!skillName) {
    console.log("%c[High Precision] No weapon skill found on item", "color: orange");
    return false;
  }

  const skillItem = actor.items.find(i =>
    i.type === "skill" && i.name.toLowerCase() === skillName.toLowerCase()
  );

  let skillRank = 0;
  if (skillItem) {
    skillRank = skillItem.system?.level ?? skillItem.system?.value ?? skillItem.system?.rank ?? 0;
  } else {
    const skills = actor.system?.skills || {};
    const skillData = skills[skillName] || skills[skillName.toLowerCase()];
    if (skillData) {
      skillRank = skillData.level ?? skillData.value ?? skillData.rank ?? 0;
    }
  }

  if (skillRank >= 7) {
    console.log(`%c[High Precision] Qualified via ${skillName} skill rank: ${skillRank}`, "color: #7dffa0");
    return true;
  }

  console.log("%c[High Precision] NOT qualified", "color: #ff5252", {
    soloRank,
    skillName,
    skillRank
  });
  return false;
}

function weaponHasExplosiveAmmo(actor, weaponName) {
  if (!actor || !weaponName) return false;
  const title = weaponName.toLowerCase().trim();

  const weapons = actor.items.filter(i => i.type === "weapon");
  const hit = weapons.find(i => {
    const n = (i.name || "").toLowerCase();
    return n && (title === n || title.includes(n) || n.includes(title.replace(/\s*\(.*\)\s*$/, "")));
  });

  const checkItem = (item) => {
    if (!item) return false;
    const installed = item.system?.installedItems?.list || [];
    const ammoItems = installed
      .map(id => actor.items.get(id))
      .filter(a => a?.type === "ammo");
    return ammoItems.some(a => a.system?.type === "explosive" || /explosive/i.test(a.name));
  };

  if (checkItem(hit)) return true;

  return weapons.some(w =>
    w.system?.equipped === "equipped" &&
    checkItem(w) &&
    (title.includes((w.name || "").toLowerCase()) || (w.name || "").toLowerCase().includes(title.replace(/\s*\(.*\)\s*$/, "")))
  );
}

function applyExplosiveCritCard(content) {
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
      `$1<div class="text-normal text-semi">
              Critical Damage:
              5
            </div>
`
    );
  }

  updated = updated.replace(/icons\/dice\/black\/d6_6\.svg/g, "icons/dice/red/d6_6_preem.svg");

  updated = updated.replace(
    /<img([^>]*\bd6_5(?:_preem)?\.svg[^>]*)>/g,
    '<span style="display:inline-block;border:2px solid #ffd700;border-radius:4px;"><img$1></span>'
  );

  return updated;
}

// ============================================================
// EXPLOSIVE AMMO – Red Lace style crit card
// 5s count as 6s. Normal 2+ natural 6s are ignored.
// +5 is written onto the damage card itself.
// ============================================================

window._explosiveCritHookId = Hooks.on("createChatMessage", async (message) => {
  try {
    const authorId = message.author?.id || message.user?.id;
    if (authorId !== game.user.id) return;
    if (window._explosiveProcessed.has(message.id)) return;
    window._explosiveProcessed.add(message.id);
    if (window._explosiveProcessed.size > 80) {
      window._explosiveProcessed.delete(window._explosiveProcessed.values().next().value);
    }

    const content = message.content || "";
    if (!content.includes("d6-rollcard-data")) return;
    if (!/rollcard-subtitle-center[^>]*>\s*Damage\s*</i.test(content)) return;
    if (/damage dealt to/i.test(content)) return;
    if (/Critical Damage:/i.test(content)) return;

    const actor = game.actors.get(message.speaker?.actor)
      || canvas.tokens.get(message.speaker?.token)?.actor;
    if (!actor) return;

    const rawTitle = content.match(/chat-rollTitle-stat[\s\S]*?<div[^>]*>\s*([^<]+?)\s*<\/div>/i)?.[1]?.trim() || "";

    const isExplosiveByText = /explosive/i.test(content) || /explosive/i.test(rawTitle);
    const isExplosiveByItem = weaponHasExplosiveAmmo(actor, rawTitle);

    if (!isExplosiveByText && !isExplosiveByItem) return;

    const dice = [...content.matchAll(/d6_(\d)(_preem)?\.svg/g)].map(m => Number(m[1]));
    if (!dice.length) return;

    const sixes = dice.filter(v => v === 6).length;
    const high = dice.filter(v => v === 5 || v === 6).length;

    if (sixes >= 2 || high < 2) return;

    const updated = applyExplosiveCritCard(content);

    await message.update({ content: updated });

    const el = document.querySelector(`li[data-message-id="${message.id}"]`);
    const div = el?.querySelector(".message-content");
    if (div) div.innerHTML = updated;

    console.log("%c[Explosive] Crit card updated (5s as 6s, +5 on apply)", "color: #ff5555; font-weight: bold", {
      actor: actor.name,
      title: rawTitle,
      dice,
      sixes,
      high
    });
  } catch (err) {
    console.error("[Sanctum] Explosive Crit error:", err);
  }
});

// ============================================================
// TO-HIT MODIFIERS
// ============================================================

window._highPrecisionHookId = Hooks.on("renderCPRRollDialog", (app, html) => {
  if (!window._ammoHookProcessed) window._ammoHookProcessed = new WeakMap();
  if (window._ammoHookProcessed.has(app)) return;
  window._ammoHookProcessed.set(app, true);

  try {
    const { actor, item } = app;
    if (!item || item.type !== "weapon") return;

    const title = (html.closest(".app")?.find(".window-title").text() || "").toLowerCase();
    const bodyText = html.text().toLowerCase();

    const isDamageDialog =
      title.includes("damage") ||
      title.includes("rolling damage") ||
      bodyText.includes("rolling damage") ||
      bodyText.includes("damage:") ||
      bodyText.includes("damage 5d6") ||
      bodyText.includes("damage 4d6") ||
      bodyText.includes("damage 3d6") ||
      bodyText.includes("damage 2d6") ||
      bodyText.includes("damage 1d6");

    if (isDamageDialog) {
      console.log("%c→ Skipping DAMAGE dialog", "color: orange");
      return;
    }

    const installed = item.system?.installedItems?.list || [];
    const ammoItems = installed
      .map(id => actor.items.get(id))
      .filter(a => a?.type === "ammo");

    const hasTracer = ammoItems.some(a => a.system?.type === "tracer" || /tracer/i.test(a.name));
    const hasHighPrecision = ammoItems.some(a => a.system?.type === "highprecision" || /high.?precision/i.test(a.name));
    const hasExplosive = ammoItems.some(a => a.system?.type === "explosive" || /explosive/i.test(a.name));

    const selectedMode = getSelectedFireMode(item.id);
    const isSuppressive = selectedMode === "suppressive";
    const isAutofire = selectedMode === "autofire";
    const isAimed = selectedMode === "aimed";

    const precisionAllowed = hasHighPrecision ? canUseHighPrecision(actor, item) : false;

    console.log("%c[Sanctum FireMode]", "color: #00e5ff", {
      selectedMode,
      isAimed,
      isAutofire,
      isSuppressive,
      hasTracer,
      hasHighPrecision,
      precisionAllowed
    });

    const modInput = html.find("input[name='additionalMods']");
    if (!modInput.length) return;

    const applyMods = () => {
      let added = 0;
      const messages = [];

      if (hasHighPrecision && precisionAllowed && !isAutofire && !isSuppressive) {
        if (isAimed) {
          added += 2;
          messages.push("High Precision Ammo: +2 To Hit (Aimed)");
        } else {
          added += 1;
          messages.push("High Precision Ammo: +1 To Hit");
        }
      } else if (hasHighPrecision && !precisionAllowed) {
        messages.push("High Precision Ammo: Requires Solo (any rank) or Weapon Skill 7+");
      }

      if (hasTracer && isAutofire && !isSuppressive) {
        added += 1;
        messages.push("Tracer Ammo: +1 To Hit (Autofire)");
      }

      if (hasExplosive) {
        if (isAimed) {
          added -= 100;
          messages.push("Explosive Ammo: –100 To Hit (Aimed)");
        } else {
          added -= 2;
          messages.push("Explosive Ammo: –2 To Hit");
        }
      }

      console.log("%c[Sanctum Mods]", "color: #ffeb3b", { added, messages });

      html.find("p.sanctum-ammo-msg").remove();

      if (added !== 0 || messages.length) {
        if (added !== 0) {
          modInput.val(added);
          const el = modInput[0];
          el.dispatchEvent(new Event("focus", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
          modInput.trigger("focus").trigger("input").trigger("change").trigger("blur");
        } else {
          modInput.val(0);
          modInput.trigger("input").trigger("change");
        }

        messages.forEach(msg => {
          const color = msg.includes("Requires") ? "#ff9800" : "#e74c3c";
          modInput.closest(".form-group").after(
            `<p class="sanctum-ammo-msg" style="color:${color};font-weight:bold;margin:6px 0;">${msg}</p>`
          );
        });
      } else {
        modInput.val(0);
        modInput.trigger("input").trigger("change");
      }
    };

    setTimeout(applyMods, 100);

  } catch (err) {
    console.error("[Sanctum] To-hit error:", err);
  }
});

// ============================================================
// OTHER AMMO REMINDERS
// ============================================================

window._ammoReminderHookId = Hooks.on("createChatMessage", (message) => {
  const authorId = message.author?.id || message.user?.id;
  if (authorId !== game.user.id) return;
  if (alreadyProcessed(message.id + "-reminder")) return;

  const c = (message.content || "").toLowerCase();
  if (!c.includes("rollcard-data")) return;

  const dice = getDiceValues(message.content);

  if (c.includes("burrowing") && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Burrowing Ammo</b><br>Critical Injuries are harder to Quick Fix (DV +2).</div>`
    }, { chatBubble: false });
  }

  if (c.includes("high velocity") || c.includes("highvelocity")) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>High Velocity Ammo</b><br>Target takes –2 to Dodge.</div>`
    }, { chatBubble: false });
  }

  if (c.includes("hyper expansive") && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Hyper Expansive Ammo</b><br>Extra Critical Injury roll.</div>`
    }, { chatBubble: false });
  }

  if ((c.includes("hollow point") || c.includes("serrated")) && dice.filter(v => v === 6).length >= 2) {
    ChatMessage.create({
      speaker: message.speaker,
      content: `<div class="cpr-block" style="padding:10px;background-color:#5c1a1a"><b>Hollow Point / Serrated</b><br>+1 Base Death Save + possible extra Injury.</div>`
    }, { chatBubble: false });
  }
});

console.log("Sanctum Ammo Hooks 2.2 | Ready – Explosive uses Red Lace crit card");