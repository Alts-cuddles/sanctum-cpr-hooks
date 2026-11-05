// ============================================
// Sanctum CPR Hooks - shared helpers
// ============================================

export const MODULE_ID = "sanctum-cpr-hooks";

// All existing item/actor/message/combat flags were written under the "world"
// scope. Keep it so existing world data (power/tech flags, AF DV tables,
// speedware state, etc.) keeps working.
export const FLAG_SCOPE = "world";

export const LOG_PREFIX = "Sanctum CPR Hooks |";

export function logError(context, err, notify = false) {
  console.error(`${LOG_PREFIX} ${context}:`, err);
  if (notify) ui.notifications?.error(`Sanctum CPR Hooks: ${context} failed (see console).`);
}

export function logWarn(context, ...args) {
  console.warn(`${LOG_PREFIX} ${context}`, ...args);
}

/** Return the raw HTMLElement from a v12 jQuery object or an element. */
export function getElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  if (html[0] instanceof HTMLElement) return html[0];
  return null;
}

/** Lowercase, alphanumeric-only comparison key. */
export function normalizeName(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** The active GM if there is one (v12: game.users.activeGM). */
export function isActiveGM() {
  const gm = game.users.activeGM;
  return gm ? gm.isSelf : false;
}

/** True when this client created the message (v12 `author`, v11 `user`). */
export function isMessageAuthor(message) {
  const id = message?.author?.id ?? message?.user?.id ?? message?._source?.author;
  return id === game.user.id;
}

// --------------------------------------------
// CPR 0.92.4 damage card helpers
// --------------------------------------------
// cpr-damage-rollcard.hbs renders:
//   <div class="cpr-block chat-rollTitle-stat"><div class="text-center ...">{{rollTitle}}</div>
//   <a class="clickable" data-action="applyDamage" data-scope="global" data-bonus-damage=...>
// For weapons rollTitle is item.name (CPRItem._createDamageRoll: rollName = this.name).
// The card carries NO item id, and CPRChat.RenderRollCard sets
// speaker = { actor, alias } only (no token id; for unlinked tokens `actor`
// resolves to the base actor id and alias is the synthetic actor's name).
// The attack card's rollDamage button does carry data-actor-id/-token-id/-item-id,
// so techpower.js records the last clicked one as the damage source.

export function isDamageRollCard(content) {
  if (!content) return false;
  if (!content.includes('data-action="applyDamage"')) return false;
  // exclude the damage application result card and anything already applied
  if (/HP Reduced By/i.test(content) || /Damage Dealt To/i.test(content)) return false;
  return true;
}

export function getDamageCardTitle(content) {
  if (!content) return "";
  const div = document.createElement("div");
  div.innerHTML = content;
  const el = div.querySelector(".chat-rollTitle-stat .text-center")
    ?? div.querySelector(".chat-rollTitle-stat > div");
  return (el?.textContent ?? "").trim();
}

/** Resolve an actor from ids, preferring the (possibly unlinked) token actor. */
export function resolveActor({ actorId, tokenId, sceneId } = {}) {
  if (tokenId) {
    const tokActor = game.actors.tokens?.[tokenId]
      ?? canvas?.tokens?.get(tokenId)?.actor
      ?? (sceneId ? game.scenes.get(sceneId)?.tokens.get(tokenId)?.actor : null);
    if (tokActor) return tokActor;
  }
  return actorId ? game.actors.get(actorId) ?? null : null;
}

/**
 * Resolve the actor behind a chat speaker. CPR's speaker has no token id, so for
 * unlinked tokens we look for a canvas token whose actor has the base id and the
 * alias as name (controlled tokens first).
 */
export function resolveSpeakerActor(speaker = {}) {
  if (speaker.token) {
    const a = resolveActor({ actorId: speaker.actor, tokenId: speaker.token, sceneId: speaker.scene });
    if (a) return a;
  }
  const base = speaker.actor ? game.actors.get(speaker.actor) : null;
  if (base && base.prototypeToken?.actorLink) return base;
  const tokens = canvas?.tokens?.placeables ?? [];
  const pool = [...(canvas?.tokens?.controlled ?? []), ...tokens];
  const hit = pool.find(t => t.actor && !t.document.actorLink
    && (t.document.actorId === speaker.actor)
    && (!speaker.alias || t.actor.name === speaker.alias || t.name === speaker.alias));
  return hit?.actor ?? base ?? null;
}

/** Exact (normalized) name match of a weapon on THIS actor only. */
export function findWeaponsByTitle(actor, title) {
  const key = normalizeName(title);
  if (!actor || !key) return [];
  return actor.items.filter(i => i.type === "weapon" && normalizeName(i.name) === key);
}
