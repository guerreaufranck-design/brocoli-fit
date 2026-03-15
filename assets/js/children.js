// ============================================================
// BROCOLI.FIT — Multi-child storage & management module
// Centralizes all multi-child logic: migration, CRUD, limits
// Must be loaded BEFORE dashboard.js, plan.js, questionnaire.js, etc.
// ============================================================

window.CHILDREN = (function () {
  'use strict';

  var STORAGE_KEY = 'brocoliChildren';
  var VERSION = 1;

  // ── Unique ID generator ──────────────────────────────────
  function generateId() {
    return 'child_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Load / Save ──────────────────────────────────────────
  function _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
    catch (e) { return null; }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function _ensureStore() {
    var store = _load();
    if (!store || !store.children) {
      store = { version: VERSION, activeChildId: null, children: {} };
      _save(store);
    }
    return store;
  }

  // ── Migration from single-child localStorage ─────────────
  function migrate() {
    // Already migrated?
    var existing = _load();
    if (existing && existing.version) return;

    var oldProfile  = null;
    var oldPlan     = null;
    var oldPlanDate = null;
    var oldHistory  = [];
    var oldCheckins = [];

    try { oldProfile  = JSON.parse(localStorage.getItem('brocoliProfile')  || 'null'); } catch (e) { /* ignore */ }
    try { oldPlan     = JSON.parse(localStorage.getItem('brocoliPlan')     || 'null'); } catch (e) { /* ignore */ }
    try { oldPlanDate = localStorage.getItem('brocoliPlanDate') || null; } catch (e) { /* ignore */ }
    try { oldHistory  = JSON.parse(localStorage.getItem('brocoliHistory')  || '[]'); } catch (e) { /* ignore */ }
    try { oldCheckins = JSON.parse(localStorage.getItem('brocoliCheckins') || '[]'); } catch (e) { /* ignore */ }

    var store = { version: VERSION, activeChildId: null, children: {} };

    // If there was an existing profile, migrate it as the first child
    if (oldProfile && (oldProfile.name || oldProfile.profil || oldProfile.age)) {
      var id = generateId();
      store.children[id] = {
        id: id,
        createdAt: new Date().toISOString(),
        profile:  oldProfile,
        plan:     oldPlan,
        planDate: oldPlanDate,
        history:  oldHistory,
        checkins: oldCheckins
      };
      store.activeChildId = id;
    }

    _save(store);

    // Remove legacy keys
    localStorage.removeItem('brocoliProfile');
    localStorage.removeItem('brocoliPlan');
    localStorage.removeItem('brocoliPlanDate');
    localStorage.removeItem('brocoliHistory');
    localStorage.removeItem('brocoliCheckins');
  }

  // ── Plan tier helpers ────────────────────────────────────
  function getTier() {
    try {
      var sub = JSON.parse(localStorage.getItem('brocoliSubscription') || '{}');
      return sub.plan || localStorage.getItem('brocoliSelectedPlan') || 'free';
    } catch (e) { return 'free'; }
  }

  function getMaxChildren() {
    var tier = getTier();
    if (tier === 'premium') return Infinity;
    if (tier === 'essential') return 2;
    return 1; // free
  }

  function childCount() {
    var store = _ensureStore();
    return Object.keys(store.children).length;
  }

  function canAddChild() {
    return childCount() < getMaxChildren();
  }

  // ── Active child ─────────────────────────────────────────
  function getActiveChildId() {
    var store = _ensureStore();
    // Validate that active ID exists
    if (store.activeChildId && store.children[store.activeChildId]) {
      return store.activeChildId;
    }
    // Fallback to first child
    var ids = Object.keys(store.children);
    if (ids.length) {
      store.activeChildId = ids[0];
      _save(store);
      return ids[0];
    }
    return null;
  }

  function setActiveChild(childId) {
    var store = _ensureStore();
    if (store.children[childId]) {
      store.activeChildId = childId;
      _save(store);
    }
  }

  function getActiveChild() {
    var store = _ensureStore();
    var id = getActiveChildId();
    return id ? store.children[id] : null;
  }

  // ── CRUD ─────────────────────────────────────────────────
  function getAllChildren() {
    var store = _ensureStore();
    return Object.values(store.children);
  }

  function getChild(childId) {
    var store = _ensureStore();
    return store.children[childId] || null;
  }

  function addChild(profile) {
    if (!canAddChild()) return null;
    var store = _ensureStore();
    var id = generateId();
    store.children[id] = {
      id: id,
      createdAt: new Date().toISOString(),
      profile:  profile || {},
      plan:     null,
      planDate: null,
      history:  [],
      checkins: []
    };
    store.activeChildId = id;
    _save(store);
    return id;
  }

  function removeChild(childId) {
    var store = _ensureStore();
    if (!store.children[childId]) return;
    delete store.children[childId];
    // If removed the active child, switch to first remaining
    if (store.activeChildId === childId) {
      var remaining = Object.keys(store.children);
      store.activeChildId = remaining.length > 0 ? remaining[0] : null;
    }
    _save(store);
  }

  // ── Backward-compatible getters (return same shape as old localStorage) ──
  function getProfile() {
    var child = getActiveChild();
    return child ? (child.profile || {}) : {};
  }

  function getPlan() {
    var child = getActiveChild();
    return child ? (child.plan || null) : null;
  }

  function getHistory() {
    var child = getActiveChild();
    return child ? (child.history || []) : [];
  }

  function getCheckins() {
    var child = getActiveChild();
    return child ? (child.checkins || []) : [];
  }

  function getPlanDate() {
    var child = getActiveChild();
    return child ? (child.planDate || null) : null;
  }

  // ── Setters ──────────────────────────────────────────────
  function saveProfile(profile) {
    var store = _ensureStore();
    var id = getActiveChildId();
    if (id && store.children[id]) {
      store.children[id].profile = profile;
      // Mark as complete if profile has been filled (has profil type)
      if (profile && profile.profil) {
        delete store.children[id]._incomplete;
      }
      _save(store);
    }
  }

  function savePlan(plan) {
    var store = _ensureStore();
    var id = getActiveChildId();
    if (id && store.children[id]) {
      store.children[id].plan = plan;
      store.children[id].planDate = new Date().toISOString();
      _save(store);
    }
  }

  function saveHistory(history) {
    var store = _ensureStore();
    var id = getActiveChildId();
    if (id && store.children[id]) {
      store.children[id].history = history;
      _save(store);
    }
  }

  function saveCheckins(checkins) {
    var store = _ensureStore();
    var id = getActiveChildId();
    if (id && store.children[id]) {
      store.children[id].checkins = checkins;
      _save(store);
    }
  }

  // ── Add child flow ───────────────────────────────────────
  function startAddChildFlow() {
    if (!canAddChild()) return false;
    var newId = addChild({});
    // Mark as incomplete
    var store = _load();
    if (store && store.children[newId]) {
      store.children[newId]._incomplete = true;
      _save(store);
    }
    window.location.href = 'questionnaire.html?mode=add-child&childId=' + newId;
    return true;
  }

  // ── Cleanup incomplete children (abandoned questionnaires) ──
  function cleanupIncomplete() {
    var store = _ensureStore();
    var changed = false;
    var keys = Object.keys(store.children);
    for (var i = 0; i < keys.length; i++) {
      var child = store.children[keys[i]];
      if (child._incomplete && (!child.profile || !child.profile.profil)) {
        delete store.children[keys[i]];
        changed = true;
      }
    }
    if (changed) {
      // Revalidate activeChildId
      if (!store.children[store.activeChildId]) {
        var remaining = Object.keys(store.children);
        store.activeChildId = remaining[0] || null;
      }
      _save(store);
    }
  }

  // ── Upgrade popup UI ─────────────────────────────────────
  function showUpgradePopup() {
    var _t = function (k) { return (window.I18N && window.I18N.t(k)) || null; };
    var tier = getTier();

    var title = _t('children.upgrade.title') || 'Limite atteinte';
    var desc = tier === 'free'
      ? (_t('children.limit.free') || 'Le plan Découverte est limité à 1 enfant. Passez au plan Essentiel pour ajouter jusqu\'à 2 enfants.')
      : (_t('children.limit.essential') || 'Le plan Essentiel est limité à 2 enfants. Passez au plan Premium pour un nombre illimité d\'enfants.');

    var essLabel = _t('plan.ess.name') || 'Essentiel';
    var premLabel = _t('plan.prem.name') || 'Premium';

    var overlay = document.createElement('div');
    overlay.className = 'upgrade-overlay';

    var actions = '';
    if (tier === 'free') {
      actions = '<a href="login.html?redirect=checkout&plan=essential" class="btn btn-green btn-sm" style="min-width:200px">'
        + '⭐ ' + essLabel + ' — 9\u20AC/mois (2 enfants)</a>'
        + '<a href="login.html?redirect=checkout&plan=premium" class="btn btn-dark btn-sm" style="min-width:200px">'
        + '👑 ' + premLabel + ' — 14,90\u20AC/mois (illimité)</a>';
    } else {
      actions = '<a href="login.html?redirect=checkout&plan=premium" class="btn btn-dark btn-sm" style="min-width:200px">'
        + '👑 ' + premLabel + ' — 14,90\u20AC/mois (illimité)</a>';
    }

    overlay.innerHTML =
      '<div class="upgrade-popup">' +
        '<button class="upgrade-close" onclick="this.closest(\'.upgrade-overlay\').remove()">&times;</button>' +
        '<div style="font-size:3rem;margin-bottom:1rem">🔓</div>' +
        '<h3 class="upgrade-popup-title">' + title + '</h3>' +
        '<p class="upgrade-popup-desc">' + desc + '</p>' +
        '<div class="upgrade-popup-actions">' + actions + '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  // ── Public API ───────────────────────────────────────────
  return {
    migrate: migrate,
    getTier: getTier,
    getMaxChildren: getMaxChildren,
    childCount: childCount,
    canAddChild: canAddChild,
    getActiveChildId: getActiveChildId,
    setActiveChild: setActiveChild,
    getActiveChild: getActiveChild,
    getAllChildren: getAllChildren,
    getChild: getChild,
    addChild: addChild,
    removeChild: removeChild,
    startAddChildFlow: startAddChildFlow,
    cleanupIncomplete: cleanupIncomplete,
    showUpgradePopup: showUpgradePopup,
    // Backward-compatible getters
    getProfile: getProfile,
    getPlan: getPlan,
    getHistory: getHistory,
    getCheckins: getCheckins,
    getPlanDate: getPlanDate,
    // Setters
    saveProfile: saveProfile,
    savePlan: savePlan,
    saveHistory: saveHistory,
    saveCheckins: saveCheckins
  };
})();
