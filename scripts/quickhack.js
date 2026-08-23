// ============================================
// Sanctum - Quick Hack UI
// ============================================

console.log("%cSanctum Quick Hack UI | Loading", "color: #42d3ea; font-weight: bold");

(() => {
  // ============================================================
  // DATA
  // ============================================================

  const actionDescriptions = {
    connect: "Connection radius to the Neuroport of a target in line of sight within 50m. When connecting, an Interface +1d10 check is made against the target's WILL +1d10. The netrunner connects even if they fail the check, but on failure the target becomes aware of the hack (Netrunners always know about connections). As an action on their turn, the target can try to evict the intruder by making a Concentration check against a new Interface +1d10 check by the Netrunner. On success, they cannot connect to the same target again for 60 minutes.",
    disconnect: "The Netrunner safely disconnects from the target's Neuroport.",
    breakIce: "If the target has Intra-ICE implants. For each implant installed, the Netrunner must spend one Net Action to bypass the ICE before running a Script. For each Intra-ICE installed on the target, the ICE bypass difficulty increases by 2. Bypassing ICE requires an Interface check against the ICE difficulty.",
    script: "If connected to the target and all ICE has been successfully bypassed. To run a Script, the Netrunner makes an Interface check against the Script's difficulty. Only one Script can be attempted per target per turn. The target affected by the Script immediately becomes aware that their Neuroport has been compromised (unless otherwise stated) and can attempt to evict the enemy Netrunner as described in the Connect action."
  };

  const scriptDescriptions = {
    "Movement Restriction": "The target's Speed is reduced by 1 for the next 60 seconds (20 rounds). If Speed is reduced to 0, the target cannot take Movement Actions.",
    "Sonic Shock": "The target suffers a Critical Ear Injury, but without additional damage. Effect lasts 60 seconds (20 rounds).",
    "Overheat": "The target is now on fire. At the end of their turn, they take 4 damage directly to HP until the fire is extinguished. This damage ignores armor but does not reduce its effectiveness. The fire can only be extinguished with an action that can be performed during the target's turn.",
    "Short Circuit": "The GM selects three cyberimplants except Cyberarms, Cyberlegs, Cybereyes, Cyberaudio, Neuroport, or Cyberdeck for Neuroport. Options related to these implants such as Mantis Blades or Low Light/IR/UV can be selected. Selected cyberimplants cease to function for 60 seconds (20 rounds).",
    "Cyberimplant Failure": "The Netrunner selects a cyberimplant on the target, except Neuroport or Cyberdeck for Neuroport, which becomes non-functional for 60 seconds (20 rounds). Non-functional Cyberlimbs act as if they have a Critical Arm/Leg Fracture. All options related to the selected cyberimplant also cease to function.",
    "Lure": "At the start of the target's next Turn, they are forced to take a Movement Action controlled by the Netrunner, as they feel compelled to investigate a noise only they can hear. The Lure works if the target is not aware of the Netrunner's connection. This script does not alert the target that they have been hacked. Cannot lure into obvious physical danger.",
    "Slowdown": "The target's Speed is reduced by 1d6 for the next 60 seconds (20 rounds). If Speed is reduced to 0, the target cannot take Movement Actions.",
    "Synapse Burnout": "Deal 3d6 damage directly to the target's HP. This damage ignores armor and does not reduce its effectiveness.",
    "Puppet": "You control the Action and Movement Action of the target during their next turn. You can make them attack themselves, pull the pin from a grenade, or shoot their friend. All checks are made using the target's STAT and Skills instead of the Puppeteer Netrunner's STATS.",
    "Chip Extraction": "Forcibly extracts and discards one of the target's chips (of your choice) to an adjacent cell. This script fails if the user has a protective Chip Slot cover (or even duct tape covering the slot).",
    "System Reset": "The target falls unconscious for 60 seconds (20 rounds) or until they take damage. Additionally, the target falls prone.",
    "Vital Signs Scan": "Allows the netrunner to know the target's current hit points (HP)."
  };

  const standardScripts = {
    "Basic (DV6)": [
      { name: "Movement Restriction", description: scriptDescriptions["Movement Restriction"], difficulty: 6 },
      { name: "Sonic Shock", description: scriptDescriptions["Sonic Shock"], difficulty: 6 },
      { name: "Vital Signs Scan", description: scriptDescriptions["Vital Signs Scan"], difficulty: 6, stealthy: true, infoScript: true }
    ],
    "Standard (DV8)": [
      { name: "Overheat", description: scriptDescriptions["Overheat"], difficulty: 8 },
      { name: "Short Circuit", description: scriptDescriptions["Short Circuit"], difficulty: 8 }
    ],
    "Complex (DV10)": [
      { name: "Cyberimplant Failure", description: scriptDescriptions["Cyberimplant Failure"], difficulty: 10 },
      { name: "Lure", description: scriptDescriptions["Lure"], difficulty: 10, stealthy: true },
      {
        name: "Slowdown",
        description: scriptDescriptions["Slowdown"],
        difficulty: 10,
        effectRoll: "1d6",
        effectDescription: "1 - Speed reduced by 1\n2 - Speed reduced by 2\n3 - Speed reduced by 3\n4 - Speed reduced by 4\n5 - Speed reduced by 5\n6 - Speed reduced by 6"
      },
      { name: "Synapse Burnout", description: scriptDescriptions["Synapse Burnout"], difficulty: 10, damageRoll: "3d6" }
    ],
    "Advanced (DV12)": [
      { name: "Puppet", description: scriptDescriptions["Puppet"], difficulty: 12 },
      { name: "Chip Extraction", description: scriptDescriptions["Chip Extraction"], difficulty: 12 },
      { name: "System Reset", description: scriptDescriptions["System Reset"], difficulty: 12 }
    ]
  };

  // ============================================================
  // SETTINGS
  // ============================================================

  async function registerSettings() {
    if (!game.settings.settings.get("world.cyberpunk-custom-scripts")) {
      game.settings.register("world", "cyberpunk-custom-scripts", {
        name: "Cyberpunk Custom Scripts",
        hint: "Custom scripts for Quick Hack UI",
        scope: "world",
        config: false,
        type: Object,
        default: {}
      });
    }
  }

  function loadCustomScripts() {
    try {
      return game.settings.get("world", "cyberpunk-custom-scripts") || {};
    } catch {
      return {};
    }
  }

  async function saveCustomScripts(scripts) {
    await game.settings.set("world", "cyberpunk-custom-scripts", scripts);
  }

  function getAllScripts() {
    const custom = loadCustomScripts();
    const merged = foundry.utils.deepClone(standardScripts);
    for (const [cat, list] of Object.entries(custom)) {
      merged[cat] = merged[cat] ? [...merged[cat], ...list] : list;
    }
    return merged;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  async function evaluateRollWithDice(formula) {
    const roll = await new Roll(formula).evaluate({ async: true });
    if (game.modules.get("dice-so-nice")?.active && game.dice3d) {
      await game.dice3d.showForRoll(roll, game.user, true);
    }
    return roll;
  }

  function getTargetToken() {
    return game.user.targets.first() || null;
  }

  function updateTargetInfo(state) {
    const token = getTargetToken();
    state.targetToken = token;
    state.targetName = token ? token.name : "Not selected";

    if (token) {
      const actor = token.actor;
      const hp = actor.system.derivedStats.hp;
      const sw = actor.system.derivedStats.seriouslyWounded || (hp.max / 2);
      state.targetWillPenalty = hp.value < sw ? -2 : 0;
      state.targetWill = (actor.system.stats.will.value || 0) + state.targetWillPenalty;
      state.currentDifficulty = 6 + ((state.iceCount - 1) * 2);
    }

    const nameEl = document.getElementById("targetNameDisplay");
    if (nameEl) nameEl.textContent = state.targetName;
  }

  function updateNetrunnerPenalties(state) {
    const hp = state.actor.system.derivedStats.hp;
    const sw = state.actor.system.derivedStats.seriouslyWounded || (hp.max / 2);
    let penalty = 0;
    if (hp.value < 1) penalty = -4;
    else if (hp.value < sw) penalty = -2;

    state.netrunnerPenalty = penalty;
    const el = document.getElementById("netrunnerPenaltyDisplay");
    if (el) el.textContent = penalty !== 0 ? ` (${penalty})` : "";
    return penalty;
  }

  function createRollFormula(roll, baseValue, penalty, isWill = false) {
    const d10 = roll.terms[0].results[0].result;
    const stat = isWill ? "WILL" : "Interface";
    let html = `<div style="display:inline-flex;align-items:center;gap:3px;color:#fff;font-size:12px;font-family:'Courier New',monospace;">
        <span>${d10}</span><i class="fas fa-dice-d10" style="color:#ff00ff;font-size:12px;"></i>
        <span>+ ${stat} ${baseValue}</span>`;
    if (penalty !== 0) {
      html += ` <span style="color:${penalty < 0 ? '#ff073a' : '#39ff14'};">(${penalty > 0 ? '+' : ''}${penalty}${isWill && penalty < 0 ? ', serious wound' : ''})</span>`;
    }
    return html + `</div>`;
  }

  // ============================================================
  // CHAT MESSAGES
  // ============================================================

  async function createConnectMessage(interfaceRoll, willRoll, targetName, interfaceValue, targetWill, penalty, targetWillPenalty, actor) {
    const success = interfaceRoll.total > willRoll.total;
    const resultText = success ? "✅ Connection established. Hack attempt not detected." : "⚠️ Connection established. Hack attempt detected.";

    const content = `
<div class="cyberpunk-card" style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);border:1px solid #42d3ea;box-shadow:0 0 15px rgba(66,211,234,0.5);">
  <div class="cyberpunk-header" style="background:rgba(20,20,40,0.8);border-bottom:1px solid #42d3ea;padding:8px 10px;">
    <div class="cyberpunk-title" style="color:#42d3ea;font-size:14px;text-shadow:0 0 5px #42d3ea;">Connection</div>
    <div class="cyberpunk-subtitle" style="color:#39ff14;font-size:12px;text-align:center;text-shadow:0 0 3px #39ff14;">${targetName}</div>
  </div>
  <div class="cyberpunk-content" style="padding:10px;">
    <div style="display:flex;justify-content:space-between;border-bottom:1px solid rgba(66,211,234,0.3);padding:8px 0;margin-bottom:8px;">
      <div>
        <div style="color:#42d3ea;font-size:12px;">Connection roll</div>
        <div style="color:#fff;font-size:11px;font-family:'Courier New',monospace;">${createRollFormula(interfaceRoll, interfaceValue, penalty)}</div>
      </div>
      <div style="font-size:32px;font-weight:bold;color:#42d3ea;text-shadow:0 0 10px #42d3ea;">${interfaceRoll.total}</div>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;">
      <div>
        <div style="color:#42d3ea;font-size:12px;">Resistance roll</div>
        <div style="color:#fff;font-size:11px;font-family:'Courier New',monospace;">${createRollFormula(willRoll, targetWill - targetWillPenalty, targetWillPenalty, true)}</div>
      </div>
      <div style="font-size:32px;font-weight:bold;color:#42d3ea;text-shadow:0 0 10px #42d3ea;">${willRoll.total}</div>
    </div>
    <div style="margin-top:10px;padding:8px;background:rgba(20,20,40,0.8);border:1px solid ${success ? '#39ff14' : '#ff073a'};text-align:center;">
      <span style="color:${success ? '#39ff14' : '#ff073a'};text-shadow:0 0 5px ${success ? '#39ff14' : '#ff073a'};font-size:13px;font-weight:bold;">${resultText}</span>
    </div>
  </div>
</div>`;

    return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
  }

  async function createScriptMessage(scriptName, targetName, rollResult, rollFormula, difficulty, resultText, actor) {
    const success = resultText.includes("✅");
    const content = `
<div class="cyberpunk-card" style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);border:1px solid ${success ? '#39ff14' : '#ff073a'};box-shadow:0 0 15px ${success ? 'rgba(57,255,20,0.3)' : 'rgba(255,7,58,0.3)'};">
  <div class="cyberpunk-header" style="background:rgba(20,20,40,0.8);border-bottom:1px solid ${success ? '#39ff14' : '#ff073a'};padding:8px 10px;">
    <div class="cyberpunk-title" style="color:${success ? '#39ff14' : '#ff073a'};font-size:14px;text-shadow:0 0 5px ${success ? '#39ff14' : '#ff073a'};">${scriptName}</div>
    <div class="cyberpunk-subtitle" style="color:#39ff14;font-size:12px;text-align:center;text-shadow:0 0 3px #39ff14;">${targetName}</div>
  </div>
  <div class="cyberpunk-content" style="padding:10px;">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
      <div>
        <div style="color:#fff;font-size:11px;font-family:'Courier New',monospace;">${rollFormula}</div>
        <div style="color:#42d3ea;font-size:11px;margin-top:3px;">Difficulty: ${difficulty}</div>
      </div>
      <div style="font-size:32px;font-weight:bold;color:${success ? '#39ff14' : '#ff073a'};text-shadow:0 0 10px ${success ? '#39ff14' : '#ff073a'};">${rollResult}</div>
    </div>
    <div style="margin-top:10px;padding:8px;background:rgba(20,20,40,0.8);border:1px solid ${success ? '#39ff14' : '#ff073a'};text-align:center;">
      <span style="color:${success ? '#39ff14' : '#ff073a'};text-shadow:0 0 5px ${success ? '#39ff14' : '#ff073a'};font-size:13px;font-weight:bold;">${resultText}</span>
    </div>
  </div>
</div>`;

    return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
  }

  async function rollDamageOrEffect(scriptName, rollFormula, targetName, isDamage = false, effectDescription = "", targetToken = null, actor = null) {
    const roll = await evaluateRollWithDice(rollFormula);

    if (isDamage) {
      const total = roll.total;

      let diceHtml = "";
      if (roll.terms[0]?.results) {
        for (const r of roll.terms[0].results) {
          diceHtml += `<img class="d6 d6-40" src="systems/cyberpunk-red-core/icons/dice/black/d6_${r.result}.svg" />`;
        }
      }

      const targetActorId = targetToken?.actor?.id || "";
      const targetTokenId = targetToken?.id || "";

      const content = `
<div class="rollcard">
  <div class="rollcard-top">
    <div class="cpr-block chat-rollTitle-stat">
      <div class="text-center text-padding-top text-normal text-semi">
        ${scriptName}
      </div>
      <div class="rollcard-subtitle">
        <div class="rollcard-subtitle-center text-small">
          Damage
        </div>
        <div class="rollcard-subtitle-right">
          <a class="clickable" data-action="applyDamage" data-scope="global" data-total-damage="${total}" data-bonus-damage="0" data-damage-location="brain" data-ablation="0" data-ignore-armor-percent="0">
            <i class="fas fa-bolt" data-tooltip="Apply damage to this token."></i>
          </a>
        </div>
      </div>
    </div>
  </div>
  <div class="rollcard-bottom">
    <div class="cpr-block">
      <div class="d6-rollcard-data">
        <div class="d6-dice-div">
          ${diceHtml}
        </div>
        <div class="d6-number-div">
          <span class="clickable" data-action="toggleVisibility" data-visible-element="d6-data-details">${total}</span>
        </div>
        <div class="d6-data-div">
          <div class="d6-data-details hide"></div>
        </div>
      </div>
    </div>
  </div>
  <br />
  <div class="rollcard-top">
    <div class="cpr-block chat-rollTitle-stat">
      <div class="text-center text-padding-top text-normal">
        Apply damage to the following token(s).
      </div>
      <div class="rollcard-subtitle"></div>
    </div>
  </div>
  <div class="rollcard-bottom">
    <div class="cpr-block">
      <br />
      <div class="text-left text-small">
        1. ${targetName}
        <a class="clickable" data-action="applyDamage" data-scope="local" data-actor-id="${targetActorId}" data-token-id="${targetTokenId}" data-total-damage="${total}" data-bonus-damage="0" data-damage-location="brain" data-ablation="0" data-ignore-armor-percent="0">
          <i class="fas fa-bolt" data-tooltip="Apply damage to this token."></i>
        </a>
      </div>
    </div>
  </div>
</div>`;

      return await ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: ""
      });
    }

    // Effect rolls
    let description = "";
    if (effectDescription) {
      const effectLines = effectDescription.split('\n');
      const effectValue = roll.total;
      let effectResult = "Effect undefined";

      for (const line of effectLines) {
        if (line.startsWith(`${effectValue} - `)) {
          effectResult = line.replace(`${effectValue} - `, "");
          break;
        } else if (line.startsWith(`${effectValue}`)) {
          effectResult = line.replace(`${effectValue}`, "");
          break;
        }
      }
      description = `<div style="font-size:12px;margin-top:5px;color:#fff;"><strong>Effect result:</strong> ${effectResult}</div>`;
    }

    const content = `
<div class="cyberpunk-card" style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1a2e 100%);border:1px solid #ff00ff;box-shadow:0 0 15px rgba(255,0,255,0.3);">
  <div class="cyberpunk-header" style="background:rgba(20,20,40,0.8);border-bottom:1px solid #ff00ff;padding:8px 10px;">
    <div class="cyberpunk-title" style="color:#ff00ff;font-size:14px;text-shadow:0 0 5px #ff00ff;">${scriptName} Effect</div>
  </div>
  <div class="cyberpunk-subtitle" style="color:#39ff14;font-size:12px;text-align:center;text-shadow:0 0 3px #39ff14;">${targetName}</div>
  <div class="cyberpunk-content" style="padding:10px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="color:#fff;font-size:11px;font-family:'Courier New',monospace;">${rollFormula}</div>
      ${description}
    </div>
    <div style="font-size:32px;font-weight:bold;color:#42d3ea;text-shadow:0 0 10px #42d3ea;">${roll.total}</div>
  </div>
</div>`;

    return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
  }

  // ============================================================
  // PANELS
  // ============================================================

  function showScriptsPanel(state) {
    if (state.currentRightPanel === "scripts") {
      state.currentRightPanel = null;
      state.activeAction = null;
      document.getElementById("right-panel").innerHTML = `<div style="color:#42d3ea;padding:10px;text-align:center;font-size:12px;">Hover over action to view description</div>`;
      document.querySelectorAll(".net-action-btn").forEach(b => b.classList.remove("active"));
      return;
    }

    const allScripts = getAllScripts();
    const custom = loadCustomScripts();
    let html = "";

    for (const [category, list] of Object.entries(allScripts)) {
      const isCustom = custom.hasOwnProperty(category);
      html += `<div class="script-category" style="margin-bottom:15px;">
            <h3 style="margin:5px 0;padding-bottom:5px;color:#ff00ff;text-shadow:0 0 5px #ff00ff;font-size:13px;text-transform:uppercase;border-bottom:1px solid rgba(255,0,255,0.5);">${category}</h3>
            <div class="script-list">`;

      for (const script of list) {
        const isCustomScript = isCustom && custom[category].some(s => s.name === script.name);
        html += `
            <div class="script-item" style="margin-bottom:10px;padding:8px;background:rgba(20,20,40,0.5);border:1px solid rgba(66,211,234,0.3);">
                <div class="script-header" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                    <div style="font-weight:bold;color:#fff;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${script.name}</div>
                    <div>
                        ${isCustomScript ? `<a class="cyberpunk-button delete-script" style="margin-right:5px;color:#ff073a;"><i class="fas fa-trash"></i></a>` : ""}
                        ${script.effectRoll ? `<a class="cyberpunk-button roll-effect" style="margin-right:5px;color:#42d3ea;"><i class="fas fa-dice-d10"></i></a>` : ""}
                        ${script.damageRoll ? `<a class="cyberpunk-button show-damage" style="margin-right:5px;color:#ff073a;"><i class="fas fa-dice-d10"></i></a>` : ""}
                        <a class="cyberpunk-button info-script" style="margin-right:5px;color:#42d3ea;"><i class="fas fa-info-circle"></i></a>
                        <a class="cyberpunk-button run-script" style="color:#39ff14;"><i class="fas fa-play"></i></a>
                    </div>
                </div>
                <div class="script-description" style="display:none;margin-top:10px;padding:8px;background:rgba(10,10,20,0.7);border:1px solid rgba(66,211,234,0.3);color:#fff;font-size:11px;line-height:1.4;">
                    ${script.description}
                    ${script.name === "Vital Signs Scan" ? `<div style="margin-top:10px;"><label style="color:#42d3ea;font-size:11px;">Difficulty:</label> <input type="number" class="cyberpunk-input custom-difficulty" min="6" max="20" value="${script.difficulty}" style="width:50px;"></div>` : ""}
                </div>
            </div>`;
      }
      html += `</div></div>`;
    }

    state.currentRightPanel = "scripts";
    state.activeAction = "script";

    const panel = document.getElementById("right-panel");
    panel.innerHTML = `
        <div style="height:100%;overflow:hidden;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid rgba(255,0,255,0.5);">
                <h2 style="margin:0;color:#ff00ff;text-shadow:0 0 5px #ff00ff;font-size:13px;text-transform:uppercase;">Scripts</h2>
            </div>
            <div style="flex:1;overflow-y:auto;padding-right:5px;">${html}</div>
            <button id="addScriptBtn" class="cyberpunk-button" style="margin-top:10px;width:100%;padding:8px;background:rgba(20,20,40,0.8);border:1px solid #42d3ea;color:#42d3ea;">
                <i class="fas fa-plus" style="margin-right:5px;"></i> Add Custom Script
            </button>
        </div>`;

    panel.querySelectorAll(".script-header").forEach(el => {
      el.addEventListener("click", () => {
        const desc = el.nextElementSibling;
        desc.style.display = desc.style.display === "none" ? "block" : "none";
      });
    });

    panel.querySelectorAll(".run-script").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!state.targetToken) return ui.notifications.error("❌ Select a target!");
        const item = btn.closest(".script-item");
        const name = item.querySelector(".script-header div").textContent;
        const category = item.closest(".script-category").querySelector("h3").textContent;
        const script = getAllScripts()[category].find(s => s.name === name);

        let diff = script.difficulty;
        const customInput = item.querySelector(".custom-difficulty");
        if (customInput) diff = parseInt(customInput.value) || diff;

        updateNetrunnerPenalties(state);
        const mod = state.interfaceValue + state.netrunnerPenalty - state.manualPenalty + state.manualBonus;
        const roll = await evaluateRollWithDice(`1d10 + ${mod}`);
        const success = roll.total > diff;
        const resultText = success
          ? (script.stealthy ? `✅ Success, target "${state.targetToken.name}" unaware of hack` : `✅ Success, target "${state.targetToken.name}" aware of hack`)
          : `❌ Failed`;

        await createScriptMessage(name, state.targetToken.name, roll.total, createRollFormula(roll, state.interfaceValue, state.netrunnerPenalty - state.manualPenalty + state.manualBonus), diff, resultText, state.actor);

        // Vital Signs Scan
        if (success && name === "Vital Signs Scan") {
          const hp = state.targetToken.actor.system.derivedStats.hp;
          ChatMessage.create({
            content: `<div class="cyberpunk-card" style="background:linear-gradient(135deg,#0a0a0a,#1a1a2e);border:1px solid #39ff14;padding:15px;text-align:center;">
                        <div style="color:#39ff14;font-size:14px;margin-bottom:8px;">Vital Signs Scan: ${state.targetToken.name}</div>
                        <div style="font-size:24px;font-weight:bold;color:#39ff14;">HP: ${hp.value} / ${hp.max}</div>
                    </div>`,
            speaker: ChatMessage.getSpeaker({ actor: state.actor })
          });
        }

        // Overheat → Toggle On Fire (Strong)
        if (success && name === "Overheat") {
          const targetId = state.targetToken?.id || "";
          const targetName = state.targetToken?.name || "Unknown";

          const content = `
<div class="rollcard">
  <div class="rollcard-top">
    <div class="cpr-block chat-rollTitle-stat">
      <div class="text-center text-padding-top text-normal text-semi">
        Overheat
      </div>
      <div class="rollcard-subtitle">
        <div class="rollcard-subtitle-center text-small">
          Toggle On Fire (Strong)
        </div>
        <div class="rollcard-subtitle-right">
          <a class="custom-apply-onfire" 
             style="cursor:pointer; color:#ff9500; font-size:16px;"
             data-target-id="${targetId}"
             data-target-name="${targetName}"
             title="Toggle On Fire (Strong) on ${targetName}">
            <i class="fas fa-fire"></i>
          </a>
        </div>
      </div>
    </div>
  </div>
  <div class="rollcard-bottom">
    <div class="cpr-block" style="padding: 10px; text-align: center;">
      <div style="color: #000000; font-size: 13px;">
        Target will take 4 damage at the end of their turn<br>
        <span style="font-size: 11px; opacity: 0.8;">until the fire is extinguished</span>
      </div>
    </div>
  </div>
</div>`;

          await ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker({ actor: state.actor })
          });
        }
      });
    });

    panel.querySelectorAll(".show-damage").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!state.targetToken) return ui.notifications.error("❌ Select a target!");
        const item = btn.closest(".script-item");
        const name = item.querySelector(".script-header div").textContent;
        const category = item.closest(".script-category").querySelector("h3").textContent;
        const script = getAllScripts()[category].find(s => s.name === name);
        if (script.damageRoll) {
          await rollDamageOrEffect(name, script.damageRoll, state.targetToken.name, true, "", state.targetToken, state.actor);
        }
      });
    });

    panel.querySelectorAll(".roll-effect").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!state.targetToken) return ui.notifications.error("❌ Select a target!");
        const item = btn.closest(".script-item");
        const name = item.querySelector(".script-header div").textContent;
        const category = item.closest(".script-category").querySelector("h3").textContent;
        const script = getAllScripts()[category].find(s => s.name === name);
        if (script.effectRoll) {
          await rollDamageOrEffect(name, script.effectRoll, state.targetToken.name, false, script.effectDescription, state.targetToken, state.actor);
        }
      });
    });

    document.getElementById("addScriptBtn")?.addEventListener("click", showAddScriptDialog);
  }

  function showBreakIcePanel(state) {
    if (state.currentRightPanel === "breakIce") {
      state.currentRightPanel = null;
      state.activeAction = null;
      document.getElementById("right-panel").innerHTML = `<div style="color:#42d3ea;padding:10px;text-align:center;font-size:12px;">Hover over action to view description</div>`;
      document.querySelectorAll(".net-action-btn").forEach(b => b.classList.remove("active"));
      return;
    }

    if (!state.targetToken) return ui.notifications.error("❌ Select a target to hack ICE!");

    state.iceCount = Math.max(1, Math.min(3, state.iceCount || 1));
    const difficulty = 6 + ((state.iceCount - 1) * 2);
    state.currentRightPanel = "breakIce";
    state.activeAction = "breakIce";

    document.getElementById("right-panel").innerHTML = `
        <div style="width:100%;">
            <div style="margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid rgba(255,0,255,0.5);">
                <h2 style="margin:0;color:#ff00ff;text-shadow:0 0 5px #ff00ff;font-size:13px;text-transform:uppercase;">ICE Bypass</h2>
            </div>
            <div style="display:flex;flex-direction:column;gap:15px;color:#fff;font-size:12px;padding:10px;background:rgba(20,20,40,0.5);border:1px solid rgba(66,211,234,0.3);">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <label style="color:#42d3ea;">Intra-ICE level:</label>
                    <input type="number" id="iceCountInput" min="1" max="3" value="${state.iceCount}" class="cyberpunk-input" style="width:60px;">
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <label style="color:#42d3ea;">Bypass difficulty:</label>
                    <div id="difficultyDisplay" style="font-weight:bold;color:#ff073a;font-size:16px;">${difficulty}</div>
                </div>
                <button id="attemptBreakIce" class="cyberpunk-button" style="padding:8px;background:rgba(20,20,40,0.8);border:1px solid #ff073a;color:#ff073a;">
                    <i class="fas fa-bolt" style="margin-right:5px;"></i> Attempt Bypass
                </button>
            </div>
        </div>`;

    const input = document.getElementById("iceCountInput");
    input.addEventListener("input", () => {
      let val = Math.max(1, Math.min(3, parseInt(input.value) || 1));
      input.value = val;
      state.iceCount = val;
      document.getElementById("difficultyDisplay").textContent = 6 + ((val - 1) * 2);
    });

    document.getElementById("attemptBreakIce").addEventListener("click", async () => {
      const ice = Math.max(1, Math.min(3, parseInt(input.value) || 1));
      state.iceCount = ice;
      const diff = 6 + ((ice - 1) * 2);

      updateNetrunnerPenalties(state);
      const mod = state.interfaceValue + state.netrunnerPenalty - state.manualPenalty + state.manualBonus;
      const roll = await evaluateRollWithDice(`1d10 + ${mod}`);
      const success = roll.total > diff;

      await createScriptMessage(
        "ICE Bypass",
        state.targetToken.name,
        roll.total,
        createRollFormula(roll, state.interfaceValue, state.netrunnerPenalty - state.manualPenalty + state.manualBonus),
        diff,
        success ? "✅ ICE bypass successful!" : "❌ Failed to bypass ICE",
        state.actor
      );
    });
  }

  function showAddScriptDialog() {
    const custom = loadCustomScripts();
    const cats = [...new Set([...Object.keys(standardScripts), ...Object.keys(custom)])];

    new Dialog({
      title: "Add New Script",
      content: `<form style="display:flex;flex-direction:column;gap:10px;padding:10px;">
            <div><label style="color:#42d3ea;">Script Name:</label><input type="text" id="scriptName" class="cyberpunk-input" style="width:100%;"></div>
            <div><label style="color:#42d3ea;">Description:</label><textarea id="scriptDescription" rows="3" class="cyberpunk-input" style="width:100%;"></textarea></div>
            <div><label style="color:#42d3ea;">Category:</label>
                <select id="scriptCategory" class="cyberpunk-input" style="width:100%;">
                    ${cats.map(c => `<option value="${c}">${c}</option>`).join("")}
                    <option value="_new">-- New Category --</option>
                </select>
            </div>
            <div id="newCat" style="display:none;">
                <input type="text" id="newCategoryName" placeholder="New Category Name" class="cyberpunk-input" style="width:100%;margin-bottom:5px;">
                <input type="number" id="newCategoryDifficulty" min="6" max="20" value="6" class="cyberpunk-input" style="width:100%;">
            </div>
            <div><input type="checkbox" id="scriptStealthy"> <label for="scriptStealthy" style="color:#fff;">Stealthy</label></div>
            <div><input type="checkbox" id="scriptHasDamage"> <label for="scriptHasDamage" style="color:#fff;">Has Damage</label>
                <input type="text" id="scriptDamageRoll" placeholder="3d6" class="cyberpunk-input" style="width:100%;display:none;margin-top:5px;">
            </div>
        </form>`,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save",
          callback: async (html) => {
            const name = html.find("#scriptName").val();
            if (!name) return ui.notifications.error("Name required");
            const category = html.find("#scriptCategory").val();
            const isNew = category === "_new";
            const finalCat = isNew ? `${html.find("#newCategoryName").val()} (DV${html.find("#newCategoryDifficulty").val()})` : category;
            const difficulty = isNew ? parseInt(html.find("#newCategoryDifficulty").val()) : parseInt(category.match(/DV(\d+)/)[1]);

            const data = {
              name,
              description: html.find("#scriptDescription").val(),
              difficulty,
              stealthy: html.find("#scriptStealthy").is(":checked")
            };
            if (html.find("#scriptHasDamage").is(":checked")) data.damageRoll = html.find("#scriptDamageRoll").val();

            const customs = loadCustomScripts();
            if (!customs[finalCat]) customs[finalCat] = [];
            customs[finalCat].push(data);
            await saveCustomScripts(customs);
            ui.notifications.info(`Script "${name}" added`);
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
      },
      render: (html) => {
        html.find("#scriptCategory").on("change", e => html.find("#newCat").toggle(e.target.value === "_new"));
        html.find("#scriptHasDamage").on("change", e => html.find("#scriptDamageRoll").toggle(e.target.checked));
      }
    }, { width: 450, classes: ["cyberpunk-dialog"] }).render(true);
  }

  // ============================================================
  // MAIN OPEN FUNCTION
  // ============================================================

  async function runQuickHackUI() {
    const token = canvas.tokens.controlled[0];
    if (!token) return ui.notifications.error("❌ Select a token!");

    const actor = token.actor;
    const storageKey = `interfaceValue_${actor.id}`;
    const savedValue = actor.getFlag("world", storageKey) || 0;

    const state = {
      token, actor, storageKey,
      targetToken: null, targetName: "Not selected",
      targetWillPenalty: 0, targetWill: 0,
      iceCount: 1, currentDifficulty: 6,
      netrunnerPenalty: 0, manualPenalty: 0, manualBonus: 0,
      interfaceValue: savedValue,
      currentRightPanel: null, activeAction: null
    };

    updateTargetInfo(state);
    updateNetrunnerPenalties(state);
    await registerSettings();

    const dialog = new Dialog({
      title: `Quick Hack UI - ${token.name}`,
      content: `
            <div id="cyberpunk-connection-dialog" style="display:flex;gap:10px;height:100%;padding:10px;background:linear-gradient(135deg,#0a0a0a,#1a1a2e);border:1px solid #42d3ea;font-family:'Courier New',monospace;color:#fff;">
                <div style="flex:0 0 180px;display:flex;flex-direction:column;gap:5px;border-right:1px solid rgba(66,211,234,0.5);padding-right:10px;">
                    <div style="margin-bottom:5px;">
                        <label style="color:#42d3ea;font-size:11px;">Netrunner:</label>
                        <div style="font-weight:bold;color:#39ff14;font-size:12px;">${token.name}</div>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label style="color:#42d3ea;font-size:11px;">Target:</label>
                        <div id="targetNameDisplay" style="font-weight:bold;color:#39ff14;font-size:12px;">${state.targetName}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:5px;margin-bottom:10px;">
                        <label style="color:#42d3ea;font-size:12px;">Interface:</label>
                        <input type="number" id="interfaceValue" min="0" value="${savedValue}" class="cyberpunk-input" style="width:60px;">
                        <span id="netrunnerPenaltyDisplay" style="color:#ff073a;font-size:12px;"></span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:15px;">
                        <div style="display:flex;align-items:center;gap:5px;">
                            <label style="color:#ff073a;font-size:12px;">Penalty:</label>
                            <input type="number" id="manualPenaltyInput" min="0" value="0" class="cyberpunk-input" style="width:60px;">
                        </div>
                        <div style="display:flex;align-items:center;gap:5px;">
                            <label style="color:#39ff14;font-size:12px;">Bonus:</label>
                            <input type="number" id="manualBonusInput" min="0" value="0" class="cyberpunk-input" style="width:60px;">
                        </div>
                    </div>
                    <button class="net-action-btn cyberpunk-button" data-action="connect" style="padding:8px;margin-bottom:5px;background:rgba(20,20,40,0.8);border:1px solid #42d3ea;color:#42d3ea;"><i class="fas fa-plug"></i> Connect</button>
                    <button class="net-action-btn cyberpunk-button" data-action="disconnect" style="padding:8px;margin-bottom:5px;background:rgba(20,20,40,0.8);border:1px solid #42d3ea;color:#42d3ea;"><i class="fas fa-unlink"></i> Disconnect</button>
                    <button class="net-action-btn cyberpunk-button" data-action="breakIce" style="padding:8px;margin-bottom:5px;background:rgba(20,20,40,0.8);border:1px solid #ff00ff;color:#ff00ff;"><i class="fas fa-lock-open"></i> Hack</button>
                    <button class="net-action-btn cyberpunk-button" data-action="script" style="padding:8px;background:rgba(20,20,40,0.8);border:1px solid #39ff14;color:#39ff14;"><i class="fas fa-code"></i> Script</button>
                </div>
                <div id="right-panel" style="flex:1;padding-left:10px;overflow-y:auto;">
                    <div style="color:#42d3ea;padding:10px;text-align:center;font-size:12px;">Hover over action to view description</div>
                </div>
            </div>
            <style>
                .cyberpunk-input{padding:5px;background:rgba(10,10,20,0.8);border:1px solid #42d3ea;color:#fff;font-family:'Courier New',monospace;font-size:12px;}
                .cyberpunk-input:focus{outline:none;border-color:#ff00ff;}
                .cyberpunk-button{display:block;text-align:left;cursor:pointer;transition:all .15s;font-family:'Courier New',monospace;font-size:12px;text-decoration:none!important;}
                .cyberpunk-button:hover{background:rgba(66,211,234,0.2)!important;color:#fff!important;}
                .cyberpunk-button.active{background:rgba(66,211,234,0.3)!important;color:#fff!important;}
                .cyberpunk-dialog .window-content{background:linear-gradient(135deg,#0a0a0a,#1a1a2e)!important;color:#fff!important;border:1px solid #42d3ea!important;}
            </style>`,
      buttons: {},
      render: (html) => {
        html.find("#interfaceValue").on("change", e => {
          state.interfaceValue = parseInt(e.target.value) || 0;
          actor.setFlag("world", storageKey, state.interfaceValue);
        });
        html.find("#manualPenaltyInput").on("change", e => state.manualPenalty = parseInt(e.target.value) || 0);
        html.find("#manualBonusInput").on("change", e => state.manualBonus = parseInt(e.target.value) || 0);

        const onCanvasClick = () => setTimeout(() => updateTargetInfo(state), 50);
        canvas.app.view.addEventListener("click", onCanvasClick);

        html.find(".net-action-btn").on("mouseenter", function () {
          if (!state.currentRightPanel) {
            const action = this.dataset.action;
            document.getElementById("right-panel").innerHTML = `
                        <div style="padding:10px;background:rgba(20,20,40,0.5);border:1px solid rgba(66,211,234,0.3);">
                            <h2 style="margin:0 0 8px;color:#42d3ea;font-size:13px;border-bottom:1px solid rgba(66,211,234,0.3);padding-bottom:5px;">${this.textContent.trim()}</h2>
                            <div style="line-height:1.5;font-size:12px;color:#fff;">${actionDescriptions[action]}</div>
                        </div>`;
          }
        }).on("mouseleave", function () {
          if (!state.currentRightPanel) {
            document.getElementById("right-panel").innerHTML = `<div style="color:#42d3ea;padding:10px;text-align:center;font-size:12px;">Hover over action to view description</div>`;
          }
        });

        html.find('[data-action="connect"]').on("click", async () => {
          updateTargetInfo(state);
          if (!state.targetToken) return ui.notifications.error("❌ Select a target!");
          state.interfaceValue = parseInt(html.find("#interfaceValue").val()) || 0;
          await actor.setFlag("world", storageKey, state.interfaceValue);
          updateNetrunnerPenalties(state);

          const mod = state.interfaceValue + state.netrunnerPenalty - state.manualPenalty + state.manualBonus;
          const iRoll = await evaluateRollWithDice(`1d10 + ${mod}`);
          const wRoll = await evaluateRollWithDice(`1d10 + ${state.targetWill}`);
          await createConnectMessage(iRoll, wRoll, state.targetToken.name, state.interfaceValue, state.targetWill, state.netrunnerPenalty - state.manualPenalty + state.manualBonus, state.targetWillPenalty, state.actor);
        });

        html.find('[data-action="disconnect"]').on("click", async () => {
          updateTargetInfo(state);
          if (!state.targetToken) return ui.notifications.error("❌ Select a target!");
          ChatMessage.create({
            content: `<div class="cyberpunk-card" style="background:linear-gradient(135deg,#0a0a0a,#1a1a2e);border:1px solid #39ff14;padding:15px;text-align:center;">
                        <div style="color:#39ff14;font-size:14px;">Disconnected from ${state.targetToken.name}</div>
                        <div style="font-size:18px;font-weight:bold;color:#39ff14;margin-top:8px;">✅ Disconnected successfully</div>
                    </div>`,
            speaker: ChatMessage.getSpeaker({ actor: state.actor })
          });
        });

        html.find('[data-action="breakIce"]').on("click", function () {
          updateTargetInfo(state);
          document.querySelectorAll(".net-action-btn").forEach(b => b.classList.remove("active"));
          this.classList.add("active");
          showBreakIcePanel(state);
        });

        html.find('[data-action="script"]').on("click", function () {
          updateTargetInfo(state);
          document.querySelectorAll(".net-action-btn").forEach(b => b.classList.remove("active"));
          this.classList.add("active");
          showScriptsPanel(state);
        });

        dialog.options.close = () => {
          canvas.app.view.removeEventListener("click", onCanvasClick);
        };
      }
    }, {
      width: 600,
      height: 450,
      resizable: true,
      classes: ["cyberpunk-dialog"]
    }).render(true);
  }

  // Expose globally
  window.SanctumQuickHack = {
    open: runQuickHackUI
  };

  console.log("%cSanctum Quick Hack UI | Ready", "color: #42d3ea; font-weight: bold");
})();