/* ═══════════════════════════════════════════════════════════════════════════
   Livery AI Studio — Frontend Logic
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  wireframe_path: "",
  base_texture_path: "",
  reference_paths: [],          // array of reference image paths
  dataDir: "",
  generating: false,
  // Car library defaults (set when car changes)
  car_wire_url: "",   // /api/library/image/<slug>/wire.jpg
  car_diffuse_url: "", // /api/library/image/<slug>/diffuse.jpg
  // Whether current wireframe/base is a user override vs car default
  wireframe_is_override: false,
  base_is_override: false,
};

let currentMode = "new";  // "new" | "modify"
let iterateEnabled = false; // When true in modify mode, auto-loads result as base
let lastGeneratedPath = ""; // Track the last generated TGA for deploy
let lastGenerateCarFolder = ""; // Track car folder for deploy
let currentDetailItem = null; // Currently viewed history detail
let upscaleSourcePath = ""; // Path loaded in upscale tab
let upscaleOutputPath = ""; // Path of upscaled output

// ─── Hover-preview state (wireframe/base square hover → preview card) ─────────
let originalPreviewState = null; // { saved, emptyDisplay, imgDisplay, imgSrc }
let _hoverPreviewActive = false;

// Platform/dependency capabilities (populated by loadConfig)
let capabilities = {
  upscale_available: false,
};

// ─── Pricing Configuration ────────────────────────────────────────────────────
const PRICING = {
  flash_1k: 0.067,
  flash_2k: 0.101,
  pro: 0.134,
};

// Current model selection: 'flash' or 'pro'
let currentModel = 'pro';

function selectModel(model) {
  /**
   * Switch between Flash and Pro models.
   * Flash model has 1K/2K resolution options.
   * Pro model always uses 2K (no choice needed).
   */
  currentModel = model;
  
  // Update button states
  const flashBtn = document.getElementById("flashBtn");
  const proBtn = document.getElementById("proBtn");
  
  if (flashBtn) flashBtn.classList.toggle("active", model === "flash");
  if (proBtn) proBtn.classList.toggle("active", model === "pro");
  
  // Show resolution toggle only for Flash
  const resolutionToggleLabel = document.getElementById("resolutionToggleLabel");
  if (resolutionToggleLabel) {
    resolutionToggleLabel.style.display = model === "flash" ? "" : "none";
  }
  
  // Update pricing display
  updatePricingDisplay();
}

function updatePricingDisplay() {
  const resolution2KCheckbox = document.getElementById("resolution2K");
  const pricingModel = document.getElementById("pricingModel");
  const pricingResolution = document.getElementById("pricingResolution");
  const pricingTotal = document.getElementById("pricingTotal");
  const upscaleToggleLabel = document.getElementById("upscaleToggleLabel");
  
  if (!pricingModel) return;
  
  const isFlash = currentModel === "flash";
  const is2K = resolution2KCheckbox?.checked || false;
  
  let cost = 0;
  let modelText = "";
  let resolutionText = "";
  
  if (isFlash) {
    modelText = `Flash ($${PRICING.flash_1k}–$${PRICING.flash_2k})`;
    if (is2K) {
      cost = PRICING.flash_2k;
      resolutionText = `2K ($${PRICING.flash_2k})`;
    } else {
      cost = PRICING.flash_1k;
      resolutionText = `1K ($${PRICING.flash_1k})`;
    }
  } else {
    modelText = `Pro ($${PRICING.pro})`;
    cost = PRICING.pro;
    resolutionText = "—";
  }
  
  // Show upscale toggle only for Flash 1K
  if (upscaleToggleLabel) {
    upscaleToggleLabel.style.display = (isFlash && !is2K) ? "" : "none";
    // Auto-uncheck upscale if hiding it
    if (upscaleToggleLabel.style.display === "none") {
      const upscaleCheck = document.getElementById("upscaleResult");
      if (upscaleCheck) upscaleCheck.checked = false;
    }
  }
  
  if (pricingModel) pricingModel.textContent = modelText;
  if (pricingResolution) pricingResolution.textContent = resolutionText;
  if (pricingTotal) pricingTotal.textContent = `$${cost.toFixed(3)}`;
}


// ─── Tab Navigation ───────────────────────────────────────────────────────────
document.querySelectorAll(".topbar-nav-item").forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".topbar-nav-item").forEach(i => i.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    item.classList.add("active");
    document.getElementById(`tab-${item.dataset.tab}`).classList.add("active");

    // Load tab-specific data
    if (item.dataset.tab === "history") loadHistory();
    if (item.dataset.tab === "settings") loadSettings();
  });
});


// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadCars();
  loadConfig();
  await loadGenerateFormState();
  await loadSponsorsFormState();

  // Load spending tracker on boot
  try {
    const res = await fetch("/api/history");
    const items = await res.json();
    updateSpendingFromHistory(items);
  } catch (e) { /* ignore */ }

  // Clear masked API key when user focuses the field to enter a new one
  document.getElementById("settingsApiKey")?.addEventListener("focus", function () {
    if (this.dataset.masked === "true") {
      this.value = "";
      this.dataset.masked = "false";
      this.placeholder = "Paste new key here…";
    }
  });
});


// ─── Debug logger (routes to backend terminal since pywebview has no devtools) ─
function dbg(msg) {
  console.log(msg);
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msg }),
  }).catch(() => {});
}


// ─── Generate form state persistence ──────────────────────────────────────────
async function loadGenerateFormState() {
  try {
    const res = await fetch("/api/session");
    const data = await res.json();

    dbg(`[persist] loadGenerateFormState() called`);
    dbg(`[persist] last_context: ${data.last_context ? `"${data.last_context.slice(0, 40)}…"` : "(empty)"}`);
    dbg(`[persist] last_prompt: ${data.last_prompt ? `"${data.last_prompt.slice(0, 40)}…"` : "(empty)"}`);
    dbg(`[persist] last_car: ${data.last_car || "(empty)"}`);

    if (data.last_context) {
      document.getElementById("context").value = data.last_context;
      dbg("[persist] ✓ context restored");
    }

    if (data.last_prompt) {
      document.getElementById("prompt").value = data.last_prompt;
      dbg("[persist] ✓ prompt restored");
    }

    if (data.last_car) {
      const sel = document.getElementById("carSelect");
      sel.value = data.last_car;
      dbg(`[persist] carSelect set to: ${data.last_car} — actual value: ${sel.value}`);
      if (sel.value !== data.last_car) {
        dbg("[persist] ⚠ car option not found in dropdown");
      }
    }

    if (data.last_mode && (data.last_mode === "new" || data.last_mode === "modify" || data.last_mode === "iterate")) {
      const restoredMode = data.last_mode === "iterate" ? "modify" : data.last_mode;
      setMode(restoredMode, /* persist= */ false);
      dbg(`[persist] ✓ mode restored: ${restoredMode}`);
    }

    // Restore file paths (wireframe, base, reference) — session overrides take precedence
    if (data.wireframe_path) {
      state.wireframe_path = data.wireframe_path;
      state.wireframe_is_override = true;
      setFilePath("wireframe", data.wireframe_path);
      dbg("[persist] ✓ wireframe_path restored from session");
    }

    if (data.base_texture_path) {
      state.base_texture_path = data.base_texture_path;
      state.base_is_override = true;
      setFilePath("base", data.base_texture_path);
      dbg("[persist] ✓ base_texture_path restored from session");
    }

    // Load car library assets for the selected car
    const carVal = document.getElementById("carSelect").value;
    if (carVal) await applyCarLibraryAssets(carVal);
    // Show/hide generate form based on whether a car is selected
    updateGenerateCarGate(carVal);

    if (data.reference_image_paths && data.reference_image_paths.length > 0) {
      state.reference_paths = data.reference_image_paths;
      dbg(`[persist] ✓ reference_image_paths restored (${data.reference_image_paths.length} items)`);
    }
    // Always render reference grid (shows add card even when empty)
    renderReferenceGrid();
  } catch (e) {
    dbg(`[persist] ERROR loading session: ${e.message}`);
  }

  // Watch for changes and save (debounced 500ms for prompt and context)
  let promptSaveTimer = null;
  document.getElementById("prompt").addEventListener("input", () => {
    clearTimeout(promptSaveTimer);
    promptSaveTimer = setTimeout(() => {
      const val = document.getElementById("prompt").value;
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_prompt: val }),
      });
      dbg(`[persist] prompt saved: "${val.slice(0, 40)}…"`);
    }, 500);
  });

  let contextSaveTimer = null;
  document.getElementById("context").addEventListener("input", () => {
    clearTimeout(contextSaveTimer);
    contextSaveTimer = setTimeout(() => {
      const val = document.getElementById("context").value;
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_context: val }),
      });
      dbg(`[persist] context saved: "${val.slice(0, 40)}…"`);
    }, 500);
  });

  document.getElementById("carSelect").addEventListener("change", async () => {
    const val = document.getElementById("carSelect").value;
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_car: val }),
    });
    dbg(`[persist] car saved: ${val}`);
    await applyCarLibraryAssets(val);
    updateGenerateCarGate(val);
  });

  document.getElementById("upscaleResult").addEventListener("change", () => {
    const val = document.getElementById("upscaleResult").checked;
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upscale_preference: val }),
    });
    dbg(`[persist] upscale preference saved: ${val}`);
  });
}


// ─── Load cars into dropdowns + custom picker ───────────────────────────────
let _allCarsCache = []; // kept so car picker can re-render without re-fetching

async function loadCars() {
  try {
    const res = await fetch("/api/cars");
    const cars = await res.json();
    _allCarsCache = cars;

    // 1. Populate hidden native select (keeps all .value reads working)
    const nativeSelect = document.getElementById("carSelect");
    if (nativeSelect) {
      const savedVal = localStorage.getItem("generateCar") || nativeSelect.value;
      nativeSelect.innerHTML = '<option value="">Select a car…</option>';
      cars.forEach(car => {
        const opt = document.createElement("option");
        opt.value = car.folder;
        opt.textContent = car.display;
        nativeSelect.appendChild(opt);
      });
      if (savedVal) nativeSelect.value = savedVal;
    }

    // 3. Build custom car picker
    carPickerBuild(cars);

    // 4. Render unified settings car list
    renderSettingsCarList(cars);

    await loadRecents();
  } catch (e) {
    console.error("Failed to load cars:", e);
  }
}

// ─── Custom Car Picker ────────────────────────────────────────────────────────
// Starred folders stored in localStorage as JSON array under key "starredCars".
let _recentCarsCache = [];

function _getStarred() {
  try { return new Set(JSON.parse(localStorage.getItem("starredCars") || "[]")); }
  catch { return new Set(); }
}
function _saveStarred(set) {
  localStorage.setItem("starredCars", JSON.stringify([...set]));
}

function carPickerBuild(cars) {
  _patchCarSelectValue(); // ensure setter is installed
  // Sync trigger label from current hidden select value
  const sel = document.getElementById("carSelect");
  const curFolder = sel ? sel.value : "";
  _carPickerSetTrigger(curFolder, cars);
  // Pre-render the list (closed — just builds the DOM ready for open)
  _carPickerRenderList(cars, "");
}

function _carPickerSetTrigger(folder, cars) {
  const car = (cars || _allCarsCache).find(c => c.folder === folder);
  const label = document.getElementById("carPickerLabel");
  if (label) label.textContent = car ? car.display : "Select a car…";
}

function _carPickerRenderList(cars, query) {
  const starred = _getStarred();
  const q = query.trim().toLowerCase();

  const filtered = q
    ? cars.filter(c => c.display.toLowerCase().includes(q) || c.folder.toLowerCase().includes(q))
    : cars;

  const starredCars = filtered.filter(c => starred.has(c.folder));
  const rest = filtered.filter(c => !starred.has(c.folder));

  const list = document.getElementById("carPickerList");
  if (!list) return;
  list.innerHTML = "";

  if (!filtered.length) {
    list.innerHTML = '<div class="car-picker-empty">No cars match</div>';
    return;
  }

  const curFolder = document.getElementById("carSelect")?.value || "";

  const renderItem = (car, container) => {
    const isStarred = starred.has(car.folder);
    const isActive = car.folder === curFolder;
    const target = container || list;

    const item = document.createElement("div");
    item.className = "car-picker-item" + (isActive ? " car-picker-item--active" : "");
    item.dataset.folder = car.folder;
    item.innerHTML = `
      <div class="car-picker-item-info">
        <div class="car-picker-item-name">${escapeHtml(car.display)}</div>
        <div class="car-picker-item-folder">${escapeHtml(car.folder)}</div>
      </div>
      <button class="car-picker-star${isStarred ? " car-picker-star--on" : ""}" title="${isStarred ? "Unstar" : "Star"}" onclick="carPickerToggleStar(event,'${escapeHtml(car.folder)}')">
        ${isStarred ? "★" : "☆"}
      </button>
    `;
    item.addEventListener("click", e => {
      if (e.target.closest(".car-picker-star")) return;
      carPickerSelect(car.folder);
    });
    target.appendChild(item);
  };

  // ── Recents section (only when not searching) ──
  const recentsContainer = document.getElementById("carPickerRecents");
  if (recentsContainer) {
    if (!q && _recentCarsCache.length) {
      recentsContainer.style.display = "block";
      recentsContainer.innerHTML = '<div class="car-picker-section-header">🕐 Recent</div>';
      const folderSet = new Set(cars.map(c => c.folder));
      _recentCarsCache
        .filter(r => folderSet.has(r.folder))
        .forEach(r => renderItem(r, recentsContainer));
    } else {
      recentsContainer.style.display = "none";
      recentsContainer.innerHTML = "";
    }
  }

  // ── Starred section ──
  if (starredCars.length) {
    const hdr = document.createElement("div");
    hdr.className = "car-picker-section-header";
    hdr.textContent = "★ Starred";
    list.appendChild(hdr);
    starredCars.forEach(c => renderItem(c));
    if (rest.length) {
      const hdr2 = document.createElement("div");
      hdr2.className = "car-picker-section-header";
      hdr2.textContent = "All Cars";
      list.appendChild(hdr2);
    }
  }
  rest.forEach(c => renderItem(c));
}

function carPickerToggle() {
  const dd = document.getElementById("carPickerDropdown");
  if (!dd) return;
  const isOpen = dd.style.display !== "none";
  if (isOpen) {
    carPickerClose();
  } else {
    const trigger = document.getElementById("carPickerTrigger");
    const rect = trigger.getBoundingClientRect();
    dd.style.top = (rect.bottom + 5) + "px";
    dd.style.left = rect.left + "px";
    dd.style.display = "flex";
    _carPickerRenderList(_allCarsCache, "");
    const search = document.getElementById("carPickerSearch");
    if (search) { search.value = ""; search.focus(); }
    document.getElementById("carPickerTrigger")?.classList.add("car-picker-trigger--open");
  }
}

function carPickerClose() {
  const dd = document.getElementById("carPickerDropdown");
  if (dd) dd.style.display = "none";
  document.getElementById("carPickerTrigger")?.classList.remove("car-picker-trigger--open");
}

function carPickerFilter() {
  const q = document.getElementById("carPickerSearch")?.value || "";
  _carPickerRenderList(_allCarsCache, q);
}

function carPickerSelect(folder) {
  const sel = document.getElementById("carSelect");
  if (sel) sel.value = folder;
  // Persist
  localStorage.setItem("generateCar", folder);
  fetch("/api/session", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ last_car: folder }),
  });
  // Update trigger
  _carPickerSetTrigger(folder, _allCarsCache);
  carPickerClose();
  // Fire same side effects as the native change event
  applyCarLibraryAssets(folder);
  updateGenerateCarGate(folder);
  dbg(`[picker] car selected: ${folder}`);
}

/** Show the generate form when a car is selected; show placeholder when none. */
function updateGenerateCarGate(folder) {
  const hascar = !!folder;
  const placeholder = document.getElementById("noCarPlaceholder");
  const layout = document.getElementById("generateLayout");
  if (placeholder) placeholder.style.display = hascar ? "none" : "flex";
  if (layout)      layout.style.display      = hascar ? ""     : "none";
}

function carPickerToggleStar(event, folder) {
  event.stopPropagation();
  const starred = _getStarred();
  if (starred.has(folder)) starred.delete(folder);
  else starred.add(folder);
  _saveStarred(starred);
  // Re-render list in place
  const q = document.getElementById("carPickerSearch")?.value || "";
  _carPickerRenderList(_allCarsCache, q);
}

// Close picker when clicking outside
document.addEventListener("click", e => {
  const picker = document.getElementById("carPicker");
  if (picker && !picker.contains(e.target)) {
    const dd = document.getElementById("carPickerDropdown");
    if (dd && !dd.contains(e.target)) carPickerClose();
  }
});

// Reposition on scroll/resize so fixed dropdown tracks the trigger
window.addEventListener("resize", () => {
  const dd = document.getElementById("carPickerDropdown");
  if (!dd || dd.style.display === "none") return;
  const trigger = document.getElementById("carPickerTrigger");
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  dd.style.top = (rect.bottom + 5) + "px";
  dd.style.left = rect.left + "px";
});

// Allow carSelect.value = x from elsewhere to also update trigger label
const _origCarSelectDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
function _patchCarSelectValue() {
  const sel = document.getElementById("carSelect");
  if (!sel || sel.__pickerPatched) return;
  sel.__pickerPatched = true;
  let _val = sel.value;
  Object.defineProperty(sel, "value", {
    get() { return _origCarSelectDescriptor.get.call(this); },
    set(v) {
      _origCarSelectDescriptor.set.call(this, v);
      _carPickerSetTrigger(v, _allCarsCache);
    },
    configurable: true,
  });
}
document.addEventListener("DOMContentLoaded", _patchCarSelectValue);

// ─── Combined car list (library + manual) ────────────────────────────────────
let _libraryCarsCache = null;

async function _getLibraryCars() {
  if (_libraryCarsCache) return _libraryCarsCache;
  try {
    const res = await fetch("/api/library/cars");
    _libraryCarsCache = await res.json();
  } catch (e) { _libraryCarsCache = []; }
  return _libraryCarsCache;
}
function invalidateSettingsCarCache() { _libraryCarsCache = null; }

async function renderSettingsCarList(manualCars) {
  window._settingsLibCars = await _getLibraryCars();
  window._settingsManualCars = manualCars;
  const libCars = window._settingsLibCars;
  const totalLibrary = libCars.length;
  const totalManual = manualCars.length;
  const total = totalLibrary + totalManual;
  const summaryText = document.getElementById("settingsCarSummaryText");
  if (summaryText) {
    if (total === 0) {
      summaryText.textContent = "No cars";
    } else if (totalManual === 0) {
      summaryText.textContent = total + " car" + (total !== 1 ? "s" : "") + " (all from templates)";
    } else if (totalLibrary === 0) {
      summaryText.textContent = total + " car" + (total !== 1 ? "s" : "") + " (all manual)";
    } else {
      summaryText.textContent = total + " car" + (total !== 1 ? "s" : "") + " (" + totalLibrary + " from templates, " + totalManual + " manual)";
    }
  }
}

// ──── Cars Modal ────────────────────────────────────────────────
async function openCarsModal() {
  document.getElementById("carsModalOverlay").style.display = "flex";
  // Reset detail pane to empty state
  const detail = document.getElementById("carsModalDetail");
  if (detail) detail.innerHTML = '<div class="cars-modal-detail-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><p>Select a car to view details</p></div>';
  window._carsModalSelectedKey = null;
  await _renderCarsModalList(window._settingsLibCars || [], window._settingsManualCars || []);
  document.getElementById("carsModalSearch").value = "";
}

function closeCarsModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById("carsModalOverlay").style.display = "none";
}

function _buildModalRows(libCars, manualCars) {
  const rows = [];
  const seenFolders = new Set();
  for (const lc of libCars) {
    const folder = lc.iracing_folder || "";
    const manualMatch = manualCars.find(m => m.folder === folder);
    rows.push({
      folder,
      display: manualMatch ? manualMatch.display : lc.display_name,
      slug: lc.slug,
      wire_url: "/api/library/image/" + lc.slug + "/wire.jpg",
      diffuse_url: "/api/library/image/" + lc.slug + "/diffuse.jpg",
      wire_path: lc.wire_path, diffuse_path: lc.diffuse_path,
      isLibrary: true, isManual: !!manualMatch,
    });
    if (folder) seenFolders.add(folder);
    else seenFolders.add("__lib_" + lc.slug);
  }
  for (const mc of manualCars) {
    if (!seenFolders.has(mc.folder)) {
      rows.push({
        folder: mc.folder, display: mc.display,
        slug: null, wire_url: null, diffuse_url: null,
        wire_path: null, diffuse_path: null,
        isLibrary: false, isManual: true,
      });
    }
  }
  return rows;
}

async function _renderCarsModalList(libCars, manualCars) {
  const rows = _buildModalRows(libCars, manualCars);
  const body = document.getElementById("carsModalBody");
  if (!rows.length) {
    body.innerHTML = '<div class="cars-modal-empty">No cars yet. Import templates or add manually.</div>';
    return;
  }
  window._carsModalAllRows = rows;
  _updateCarsModalDisplay(rows);
}

function _updateCarsModalDisplay(rows) {
  const body = document.getElementById("carsModalBody");
  body.innerHTML = "";
  const selectedKey = window._carsModalSelectedKey || null;
  for (const car of rows) {
    const key = car.folder || ("__lib_" + car.slug);
    const item = document.createElement("div");
    item.className = "cars-modal-item" + (key === selectedKey ? " active" : "");
    item.dataset.carKey = key;
    const badge = car.isLibrary
      ? '<span class="cars-modal-badge cars-modal-badge--lib">Templates</span>'
      : '<span class="cars-modal-badge cars-modal-badge--manual">Manual</span>';
    item.innerHTML =
      '<div class="cars-modal-item-name">' + escapeHtml(car.display) + '</div>' +
      '<div class="cars-modal-item-meta">' + badge + '</div>';
    item.addEventListener("click", () => selectCarInModal(key));
    body.appendChild(item);
  }
}

function selectCarInModal(key) {
  const allRows = window._carsModalAllRows || [];
  const car = allRows.find(c => (c.folder || ("__lib_" + c.slug)) === key);
  if (!car) return;
  window._carsModalSelectedKey = key;

  // Highlight active item
  document.querySelectorAll(".cars-modal-item").forEach(el => {
    el.classList.toggle("active", el.dataset.carKey === key);
  });

  const detail = document.getElementById("carsModalDetail");
  if (!detail) return;

  const safeKey = escapeHtml(key);
  const safeSlug = escapeHtml(car.slug || "");
  const safeFolder = escapeHtml(car.folder || "");
  const badge = car.isLibrary
    ? '<span class="cars-modal-badge cars-modal-badge--lib">Templates</span>'
    : '<span class="cars-modal-badge cars-modal-badge--manual">Manual</span>';

  const wireHtml = car.wire_url
    ? `<div class="cars-modal-detail-img-wrap"><img src="${car.wire_url}" alt="Wireframe"><span class="cars-modal-detail-img-label">Wireframe</span></div>`
    : `<div class="cars-modal-detail-img-wrap cars-modal-detail-img-empty"><span>No wireframe</span></div>`;
  const diffuseHtml = car.diffuse_url
    ? `<div class="cars-modal-detail-img-wrap"><img src="${car.diffuse_url}" alt="Base / Diffuse"><span class="cars-modal-detail-img-label">Base / Diffuse</span></div>`
    : `<div class="cars-modal-detail-img-wrap cars-modal-detail-img-empty"><span>No base image</span></div>`;

  detail.innerHTML = `
    <div class="cars-modal-detail-header">
      <h3>${escapeHtml(car.display)}</h3>
      ${badge}
    </div>
    ${car.folder ? `<div class="cars-modal-detail-folder">📁 ${escapeHtml(car.folder)}</div>` : ""}
    <div class="cars-modal-detail-images">
      ${wireHtml}
      ${diffuseHtml}
    </div>
    <div class="cars-modal-detail-actions">
      <button class="cars-modal-detail-btn" onclick="ucarStartEdit('${safeKey}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Edit
      </button>
      <button class="cars-modal-detail-btn btn-danger" onclick="ucarDelete('${safeFolder}','${safeSlug}',${car.isLibrary},${car.isManual})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        Delete
      </button>
    </div>
  `;
}

function filterCarsModal() {
  const q = document.getElementById("carsModalSearch").value.trim().toLowerCase();
  if (!window._carsModalAllRows) return;
  const filtered = q
    ? window._carsModalAllRows.filter(c => c.display.toLowerCase().includes(q) || c.folder.toLowerCase().includes(q))
    : window._carsModalAllRows;
  _updateCarsModalDisplay(filtered);
}
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function ucarStartEdit(key) {
  // Find car data from the modal rows
  const allRows = window._carsModalAllRows || [];
  const car = allRows.find(c => (c.folder || ("__lib_" + c.slug)) === key);
  if (!car) return;

  const detail = document.getElementById("carsModalDetail");
  if (!detail) return;

  const slug = car.slug || "";
  const folder = key.startsWith("__lib_") ? "" : key;
  const wireSrc = car.wire_url || "";
  const diffuseSrc = car.diffuse_url || "";
  const safeKey = escapeHtml(key);
  const safeSlug = escapeHtml(slug);
  const badge = car.isLibrary
    ? '<span class="cars-modal-badge cars-modal-badge--lib">Templates</span>'
    : '<span class="cars-modal-badge cars-modal-badge--manual">Manual</span>';

  detail.innerHTML = `
    <div class="cars-modal-detail-header">
      <h3>${escapeHtml(car.display)}</h3>
      ${badge}
    </div>
    <div class="cars-modal-edit-panel">
      <div class="ucar-edit-fields">
        <div class="ucar-edit-field">
          <label class="ucar-edit-label">Display name</label>
          <input class="settings-car-edit-input" id="ucaredit_name_${safeKey}" value="${escapeHtml(car.display)}" placeholder="e.g. Ferrari 296 GT3">
        </div>
        <div class="ucar-edit-field">
          <label class="ucar-edit-label">iRacing folder</label>
          <input class="settings-car-edit-input" id="ucaredit_folder_${safeKey}" value="${escapeHtml(folder)}" placeholder="e.g. ferrari296gt3">
        </div>
      </div>
      <div class="ucar-edit-images">
        <div class="ucar-edit-img-group">
          <label class="ucar-edit-label">Wireframe</label>
          <div class="ucar-edit-upload-square-wrapper">
            <div class="upload-square ucar-edit-upload-square" id="ucaredit_wire_square_${safeKey}" style="cursor: pointer;">
              ${wireSrc
                ? `<img class="upload-square-img" id="ucaredit_wire_preview_${safeKey}" src="${wireSrc}" alt="Wireframe">`
                : `<div class="upload-square-empty" id="ucaredit_wire_preview_${safeKey}">
                    <span class="upload-square-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg></span>
                    <span class="upload-square-label">Wireframe</span>
                    <span class="upload-square-hint">Click or drag</span>
                  </div>`}
              <input type="file" id="ucaredit_wire_input_${safeKey}" accept=".jpg,.jpeg,.png,.tga,.tif,.tiff" style="display:none"
                onchange="ucarHandleImageUpload(event,'${safeKey}','wire','${safeSlug}')">
              ${wireSrc ? `<div class="upload-square-badge">Wireframe</div><button class="upload-square-clear" onclick="event.stopPropagation(); ucarClearImage('${safeKey}','wire')" style="display:${wireSrc ? 'flex' : 'none'}" title="Remove">&times;</button>` : ''}
            </div>
          </div>
        </div>
        <div class="ucar-edit-img-group">
          <label class="ucar-edit-label">Diffuse (base)</label>
          <div class="ucar-edit-upload-square-wrapper">
            <div class="upload-square ucar-edit-upload-square" id="ucaredit_diffuse_square_${safeKey}" style="cursor: pointer;">
              ${diffuseSrc
                ? `<img class="upload-square-img" id="ucaredit_diffuse_preview_${safeKey}" src="${diffuseSrc}" alt="Base / Diffuse">`
                : `<div class="upload-square-empty" id="ucaredit_diffuse_preview_${safeKey}">
                    <span class="upload-square-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span>
                    <span class="upload-square-label">Base Texture</span>
                    <span class="upload-square-hint">Click or drag</span>
                  </div>`}
              <input type="file" id="ucaredit_diffuse_input_${safeKey}" accept=".jpg,.jpeg,.png,.tga,.tif,.tiff" style="display:none"
                onchange="ucarHandleImageUpload(event,'${safeKey}','diffuse','${safeSlug}')">
              ${diffuseSrc ? `<div class="upload-square-badge">Base</div><button class="upload-square-clear" onclick="event.stopPropagation(); ucarClearImage('${safeKey}','diffuse')" style="display:${diffuseSrc ? 'flex' : 'none'}" title="Remove">&times;</button>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="ucar-edit-footer">
        <button class="btn-add-car-cancel" onclick="selectCarInModal('${safeKey}')">Cancel</button>
        <button class="btn-add-car-save" onclick="ucarSaveEdit('${safeKey}')">Save</button>
      </div>
    </div>
  `;
  detail.querySelectorAll("input:not([type=file])").forEach(inp => {
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") ucarSaveEdit(key);
      if (e.key === "Escape") selectCarInModal(key);
    });
  });
  
  // Setup upload square interactions
  ["wire", "diffuse"].forEach(type => {
    const square = detail.querySelector(`#ucaredit_${type}_square_${safeKey}`);
    const input = detail.querySelector(`#ucaredit_${type}_input_${safeKey}`);
    if (square && input) {
      // Click to upload
      square.addEventListener("click", () => input.click());
      // Drag-drop
      square.addEventListener("dragover", e => { e.preventDefault(); square.classList.add("drag-over"); });
      square.addEventListener("dragleave", () => square.classList.remove("drag-over"));
      square.addEventListener("drop", e => {
        e.preventDefault();
        square.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file) {
          input.files = e.dataTransfer.files;
          ucarHandleImageUpload({ target: input }, key, type, slug);
        }
      });
    }
  });
  detail.querySelector(`#ucaredit_name_${safeKey}`)?.focus();
}

function ucarCancelEdit(key) {
  selectCarInModal(key);
}

const _ucarPendingImages = {};

async function ucarHandleImageUpload(event, key, type, slug) {
  const file = event.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  if (slug) formData.append("slug", slug);
  try {
    const res = await fetch("/api/library/car/upload-image", { method: "POST", body: formData });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    
    const square = document.getElementById(`ucaredit_${type}_square_${key}`);
    const previewEl = document.getElementById(`ucaredit_${type}_preview_${key}`);
    
    if (previewEl?.tagName === "IMG") {
      previewEl.src = data.url + "?t=" + Date.now();
    } else if (previewEl) {
      const img = document.createElement("img");
      img.className = "upload-square-img";
      img.id = previewEl.id;
      img.src = data.url + "?t=" + Date.now();
      img.alt = type === "wire" ? "Wireframe" : "Base / Diffuse";
      previewEl.replaceWith(img);
    }
    
    // Add badge and clear button if not already present
    if (square && !square.querySelector(".upload-square-badge")) {
      const badge = document.createElement("div");
      badge.className = "upload-square-badge";
      badge.textContent = type === "wire" ? "Wireframe" : "Base";
      square.appendChild(badge);
      
      const clearBtn = document.createElement("button");
      clearBtn.className = "upload-square-clear";
      clearBtn.innerHTML = "&times;";
      clearBtn.onclick = (e) => { e.stopPropagation(); ucarClearImage(key, type); };
      clearBtn.title = "Remove";
      square.appendChild(clearBtn);
    }
    
    if (!_ucarPendingImages[key]) _ucarPendingImages[key] = {};
    _ucarPendingImages[key][type] = { path: data.path, url: data.url, slug: data.slug };
  } catch (e) { alert("Upload failed: " + e.message); }
}

function ucarClearImage(key, type) {
  const square = document.getElementById(`ucaredit_${type}_square_${key}`);
  const input = document.getElementById(`ucaredit_${type}_input_${key}`);
  if (!square || !input) return;
  
  // Clear the input
  input.value = "";
  
  // Replace image with empty state
  const emptyHtml = type === "wire"
    ? `<span class="upload-square-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg></span>
       <span class="upload-square-label">Wireframe</span>
       <span class="upload-square-hint">Click or drag</span>`
    : `<span class="upload-square-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></span>
       <span class="upload-square-label">Base Texture</span>
       <span class="upload-square-hint">Click or drag</span>`;
  
  const emptyDiv = document.createElement("div");
  emptyDiv.className = "upload-square-empty";
  emptyDiv.id = `ucaredit_${type}_preview_${key}`;
  emptyDiv.innerHTML = emptyHtml;
  
  const existingPreview = document.getElementById(`ucaredit_${type}_preview_${key}`);
  if (existingPreview) existingPreview.replaceWith(emptyDiv);
  
  // Remove badge and clear button
  square.querySelectorAll(".upload-square-badge, .upload-square-clear").forEach(el => el.remove());
  
  // Clear from pending images
  if (_ucarPendingImages[key]) delete _ucarPendingImages[key][type];
}

async function ucarSaveEdit(key) {
  const allRows = window._carsModalAllRows || [];
  const car = allRows.find(c => (c.folder || ("__lib_" + c.slug)) === key);
  if (!car) return;
  const originalFolder = key.startsWith("__lib_") ? "" : key;
  const slug = car.slug || "";
  const newDisplay = document.getElementById(`ucaredit_name_${key}`)?.value.trim();
  const newFolder = (document.getElementById(`ucaredit_folder_${key}`)?.value ?? "").trim();
  try {
    if (slug && newFolder !== originalFolder) {
      const r = await fetch(`/api/library/car/${slug}/set-folder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iracing_folder: newFolder }),
      });
      const d = await r.json();
      if (d.error) { alert(d.error); return; }
    }
    if (slug && newDisplay) {
      await fetch(`/api/library/car/${slug}/set-meta`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: newDisplay }),
      });
    }
    if (newFolder) {
      if (originalFolder && originalFolder !== newFolder) {
        await fetch("/api/cars/custom", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: originalFolder }),
        });
      }
      await fetch("/api/cars/custom", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: newFolder, display: newDisplay || newFolder }),
      });
    } else if (originalFolder && !slug) {
      await fetch("/api/cars/custom", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: originalFolder }),
      });
    }
    delete _ucarPendingImages[key];
    invalidateLibraryCache();
    invalidateSettingsCarCache();
    const sel = document.getElementById("carSelect");
    if (sel && sel.value === originalFolder && newFolder) sel.value = newFolder;
    await loadCars();
    // Re-render modal if open, then re-select the (possibly renamed) car
    if (document.getElementById("carsModalOverlay").style.display === "flex") {
      await _renderCarsModalList(window._settingsLibCars || [], window._settingsManualCars || []);
      // Determine the new key after possible folder rename
      const newKey = (slug ? (newFolder || ("__lib_" + slug)) : (newFolder || key));
      window._carsModalSelectedKey = newKey;
      _updateCarsModalDisplay(window._carsModalAllRows || []);
      selectCarInModal(newKey);
    }
  } catch (e) { alert("Failed to save: " + e.message); }
}

async function ucarDelete(folder, slug, isLibrary, isManual) {
  if (!confirm(`Remove "${folder || slug}"? This cannot be undone.`)) return;
  try {
    const ops = [];
    if (isLibrary && slug) ops.push(fetch(`/api/library/car/${slug}`, { method: "DELETE" }));
    if (isManual && folder) ops.push(fetch("/api/cars/custom", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    }));
    await Promise.all(ops);
    const sel = document.getElementById("carSelect");
    if (sel && sel.value === folder) sel.value = "";
    invalidateLibraryCache();
    invalidateSettingsCarCache();
    await loadCars();
    // Re-render modal if open, reset detail pane
    if (document.getElementById("carsModalOverlay").style.display === "flex") {
      window._carsModalSelectedKey = null;
      const detail = document.getElementById("carsModalDetail");
      if (detail) detail.innerHTML = '<div class="cars-modal-detail-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg><p>Select a car to view details</p></div>';
      await _renderCarsModalList(window._settingsLibCars || [], window._settingsManualCars || []);
    }
  } catch (e) { alert("Failed to delete: " + e.message); }
}

// Legacy stubs
function startEditCar(folder, display) { ucarStartEdit(folder); }
async function saveEditCar(f) { await ucarSaveEdit(f); }
async function deleteCarEntry(folder) { await ucarDelete(folder, "", false, true); }


// ─── Recently used cars ───────────────────────────────────────────────────────
async function loadRecents() {
  try {
    const res = await fetch("/api/cars/recent");
    _recentCarsCache = await res.json();
    // If the car picker dropdown is open, refresh it
    const dd = document.getElementById("carPickerDropdown");
    if (dd && dd.style.display !== "none") {
      _carPickerRenderList(_allCarsCache, document.getElementById("carPickerSearch")?.value || "");
    }
  } catch (e) {
    console.error("Failed to load recents:", e);
    _recentCarsCache = [];
  }
}


// ─── Add / delete / edit cars ──────────────────────────────────────────────────
function toggleSettingsAddCar() {
  const panel = document.getElementById("settingsAddCarPanel");
  const btn = document.getElementById("settingsAddCarBtn");
  const isOpen = panel.style.display !== "none";
  if (isOpen) {
    panel.style.display = "none";
    btn.textContent = "+ Add car";
    document.getElementById("settingsAddCarFolder").value = "";
    document.getElementById("settingsAddCarDisplay").value = "";
  } else {
    panel.style.display = "block";
    btn.textContent = "Cancel";
    document.getElementById("settingsAddCarFolder").focus();
    // Wire up Enter / Escape
    ["settingsAddCarFolder", "settingsAddCarDisplay"].forEach(id => {
      const el = document.getElementById(id);
      el.onkeydown = e => {
        if (e.key === "Enter") saveNewCar();
        if (e.key === "Escape") toggleSettingsAddCar();
      };
    });
  }
}

async function saveNewCar() {
  const folder = document.getElementById("settingsAddCarFolder").value.trim();
  const display = document.getElementById("settingsAddCarDisplay").value.trim();
  if (!folder) {
    document.getElementById("settingsAddCarFolder").focus();
    return;
  }
  try {
    const res = await fetch("/api/cars/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, display: display || folder }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    toggleSettingsAddCar();
    await loadCars();
    // Also update the generate tab select to the new car
    document.getElementById("carSelect").value = data.folder;
  } catch (e) {
    alert("Failed to add car: " + e.message);
  }
}

async function deleteCarEntry(folder) {
  if (!confirm(`Remove "${folder}" from your car list?`)) return;
  try {
    await fetch("/api/cars/custom", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });
    // Deselect if it was selected in the generate tab
    const sel = document.getElementById("carSelect");
    if (sel && sel.value === folder) sel.value = "";
    await loadCars();
  } catch (e) {
    console.error("Failed to delete car:", e);
  }
}


// ─── Car Library ──────────────────────────────────────────────────────────────
let _libraryPollTimer = null;

async function loadLibraryCars() {
  try {
    const res = await fetch("/api/library/cars");
    const cars = await res.json();
    renderLibraryCarList(cars);
  } catch (e) {
    console.error("Failed to load library cars:", e);
  }
}

// renderLibraryCarList no longer needed — unified list handles library cars
function renderLibraryCarList(cars) { /* no-op: merged into renderSettingsCarList */ }
async function librarySaveFolder(slug) { /* no-op: use Edit in the unified list */ }
async function libraryDeleteCar(slug, displayName) {
  if (!confirm(`Remove "${displayName}" from library? This cannot be undone.`)) return;
  try {
    await fetch(`/api/library/car/${slug}`, { method: "DELETE" });
    invalidateLibraryCache();
    invalidateSettingsCarCache();
    await loadCars();
  } catch (e) { alert("Failed to delete: " + e.message); }
}

async function libraryPickFolder() {
  try {
    const res = await fetch("/api/pick-folder", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    if (data.path) {
      await libraryStartFolderImport(data.path);
    }
  } catch (e) {
    alert("Folder picker failed: " + e.message);
  }
}

async function libraryStartFolderImport(folderPath) {
  try {
    const res = await fetch("/api/library/import/folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_path: folderPath }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    libraryShowProgress(`Importing from ${folderPath.split(/[\\/]/).pop()}…`);
    libraryStartPolling();
  } catch (e) {
    alert("Import failed: " + e.message);
  }
}

function libraryUploadZips() {
  document.getElementById("libraryZipInput").click();
}

async function libraryHandleZipUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const formData = new FormData();
  for (const f of files) formData.append("zips", f);
  event.target.value = ""; // reset input

  try {
    const res = await fetch("/api/library/import/zip", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    libraryShowProgress(`Importing ${files.length} zip(s)…`);
    libraryStartPolling();
  } catch (e) {
    alert("Upload failed: " + e.message);
  }
}

function libraryShowProgress(title) {
  const panel = document.getElementById("libraryProgressPanel");
  document.getElementById("libraryProgressTitle").textContent = title;
  document.getElementById("libraryLog").textContent = "";
  document.getElementById("libraryResults").innerHTML = "";
  document.getElementById("libraryProgressClose").style.display = "none";
  document.getElementById("btnLibraryFolder").disabled = true;
  document.getElementById("btnLibraryZip").disabled = true;
  panel.style.display = "block";
}

function libraryCloseProgress() {
  document.getElementById("libraryProgressPanel").style.display = "none";
  document.getElementById("btnLibraryFolder").disabled = false;
  document.getElementById("btnLibraryZip").disabled = false;
}

let _lastLogLen = 0;
let _lastResultLen = 0;

function libraryStartPolling() {
  _lastLogLen = 0;
  _lastResultLen = 0;
  clearInterval(_libraryPollTimer);
  _libraryPollTimer = setInterval(libraryPollStatus, 1000);
}

async function libraryPollStatus() {
  try {
    const res = await fetch("/api/library/import/status");
    const data = await res.json();

    // Append new log lines
    const logEl = document.getElementById("libraryLog");
    if (data.log && data.log.length > _lastLogLen) {
      const newLines = data.log.slice(_lastLogLen);
      logEl.textContent += newLines.join("\n") + "\n";
      logEl.scrollTop = logEl.scrollHeight;
      _lastLogLen = data.log.length;
    }

    // Append new result rows
    const resultsEl = document.getElementById("libraryResults");
    if (data.results && data.results.length > _lastResultLen) {
      const newResults = data.results.slice(_lastResultLen);
      for (const r of newResults) {
        const row = document.createElement("div");
        row.className = "library-result-row";
        if (r.ok) {
          const folder = r.iracing_folder ? `<span class="library-result-folder">${escapeHtml(r.iracing_folder)}</span>` : `<span class="library-result-folder" style="color:var(--text-muted)">no folder match</span>`;
          row.innerHTML = `
            <span class="library-result-icon library-result-icon--ok">✓</span>
            <span class="library-result-name">${escapeHtml(r.display_name || r.zip || "")}</span>
            ${folder}`;
        } else {
          row.innerHTML = `
            <span class="library-result-icon library-result-icon--fail">✗</span>
            <span class="library-result-name">${escapeHtml(r.zip || r.display_name || "")}</span>
            <span class="library-result-error">${escapeHtml(r.error || "")}</span>`;
        }
        resultsEl.appendChild(row);
      }
      _lastResultLen = data.results.length;
    }

    if (data.done || (!data.running && data.results.length > 0)) {
      clearInterval(_libraryPollTimer);
      const ok = data.results.filter(r => r.ok).length;
      const fail = data.results.filter(r => !r.ok).length;
      document.getElementById("libraryProgressTitle").textContent =
        `Done — ${ok} imported${fail ? `, ${fail} failed` : ""}`;
      document.getElementById("libraryProgressClose").style.display = "block";
      document.getElementById("btnLibraryFolder").disabled = false;
      document.getElementById("btnLibraryZip").disabled = false;
      invalidateLibraryCache(); // force re-fetch on next car change
      invalidateSettingsCarCache();
      await loadCars(); // refresh car dropdown + unified settings list
    }
  } catch (e) {
    console.error("Poll failed:", e);
  }
}

async function libraryAbortImport() {
  const abortBtn = document.getElementById("libraryProgressAbort");
  abortBtn.disabled = true;
  try {
    const res = await fetch("/api/library/import/abort", {method: "POST"});
    const data = await res.json();
    if (!data.ok) {
      alert("Abort failed: " + (data.message || "Unknown error"));
    }
  } catch (e) {
    alert("Abort failed: " + e.message);
  }
}


// ─── Folder picker ────────────────────────────────────────────────────────────
async function pickFolder(type) {
  try {
    const res = await fetch("/api/pick-folder", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    if (data.path) {
      if (type === "dataDir") {
        state.dataDir = data.path;
        const el = document.getElementById("dataDirPath");
        el.textContent = data.path;
        el.classList.add("has-file");
        el.title = data.path;
        document.getElementById("dataDirClear").style.display = "block";
      }
    }
  } catch (e) {
    console.error("Folder picker failed:", e);
  }
}

function clearDataDir() {
  state.dataDir = "";
  const el = document.getElementById("dataDirPath");
  el.textContent = "Default (./data)";
  el.classList.remove("has-file");
  el.title = "";
  document.getElementById("dataDirClear").style.display = "none";
}


// ─── Load config into generate form ───────────────────────────────────────────
async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const cfg = await res.json();

    // Store capabilities for use elsewhere
    capabilities.upscale_available = !!cfg.upscale_available;

    // Apply pricing overrides from config (so users can update them in Settings)
    if (cfg.price_flash_1k != null) PRICING.flash_1k = cfg.price_flash_1k;
    if (cfg.price_flash_2k != null) PRICING.flash_2k = cfg.price_flash_2k;
    if (cfg.price_pro      != null) PRICING.pro       = cfg.price_pro;

    // Apply defaults to generate form (only if not already set by session)
    if (cfg.default_car && !localStorage.getItem("generateCar") && !state.car_selection) {
      document.getElementById("carSelect").value = cfg.default_car;
    }
    // Initialize model selection (default to Pro)
    if (cfg.use_fast_model) {
      selectModel("flash");
    } else {
      selectModel("pro");
    }
    
    // Initialize pricing display
    updatePricingDisplay();

    // Upscale toggle availability
    const upscaleRow = document.getElementById("upscaleRow");
    const upscaleCheck = document.getElementById("upscaleResult");
    const upscaleHint = document.getElementById("upscaleHint");
    if (cfg.upscale_available) {
      upscaleRow.style.opacity = "1";
      upscaleCheck.disabled = false;
      upscaleHint.textContent = "GPU · Real-ESRGAN";
      upscaleHint.classList.remove("upscale-hint--unavailable");
      
      // Load persisted upscale preference after capabilities confirmed
      try {
        const res = await fetch("/api/session");
        const sessionData = await res.json();
        if (sessionData.upscale_preference) {
          upscaleCheck.checked = true;
          dbg("[persist] ✓ upscale preference restored: true");
        }
      } catch (err) {
        console.error("Failed to load upscale preference:", err);
      }
    } else {
      upscaleRow.style.opacity = "0.45";
      upscaleCheck.disabled = true;
      upscaleCheck.checked = false;
      upscaleHint.textContent = "not available — see GETTING_STARTED.md";
      upscaleHint.classList.add("upscale-hint--unavailable");
    }

    // Upscale tab availability
    const upscaleNavItem = document.querySelector('[data-tab="upscale"]');
    const upscaleTabPanel = document.getElementById("tab-upscale");
    if (!cfg.upscale_available) {
      upscaleNavItem.classList.add("nav-item--disabled");
      upscaleNavItem.title = "Requires NVIDIA GPU with Real-ESRGAN installed. Run start.bat --gpu to set up.";
      // Add disclaimer to upscale tab content
      let disclaimer = upscaleTabPanel.querySelector(".feature-unavailable-notice");
      if (!disclaimer) {
        disclaimer = document.createElement("div");
        disclaimer.className = "feature-unavailable-notice";
        disclaimer.innerHTML = `
          <div class="notice-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div class="notice-text">
            <strong>GPU Upscaling Unavailable</strong><br>
            This feature requires an NVIDIA GPU with CUDA support and Real-ESRGAN installed.<br>
            Run <code>start.bat --gpu</code> (or <code>./start.sh --gpu</code>) to install GPU dependencies.<br>
            <small>Compatible with RTX 30xx (CUDA 11), 40xx and 50xx (CUDA 12) series.</small>
          </div>
        `;
        upscaleTabPanel.querySelector(".panel-header").after(disclaimer);
      }
      // Disable the upscale button
      const btnUpscale = document.getElementById("btnUpscale");
      if (btnUpscale) {
        btnUpscale.disabled = true;
        btnUpscale.title = "GPU upscaling not available";
      }
    } else {
      upscaleNavItem.classList.remove("nav-item--disabled");
      upscaleNavItem.title = "";
    }
  } catch (e) {
    console.error("Failed to load config:", e);
  }
}


// ─── Sample Prompts (categorised) ─────────────────────────────────────────────
const SAMPLE_CATEGORIES = {
  new: {
    "Classic & Heritage": [
      { title: "Gulf Racing", prompt: "Gulf Racing heritage livery — pale powder blue base with broad burnt orange stripe across the hood and flanks, white roundels, period-correct Gulf logo placement, thin pinstripe border between colours" },
      { title: "Martini Racing", prompt: "Martini Racing tribute — white base, narrow red and dark blue tricolour bands running horizontally across the mid-body, Martini wordmark in elegant script along the sill" },
      { title: "John Player Special", prompt: "John Player Special homage — gloss black body, gold coachline accent along the beltline, subtle gold houndstooth texture on the hood, minimalist number treatment in gold" },
      { title: "Rothmans Rally", prompt: "Rothmans rally tribute — white upper body transitioning to dark navy lower, bold red block lettering, geometric blue accent stripe, clean official-sponsor aesthetic" },
      { title: "Jägermeister Orange", prompt: "Jägermeister racing tribute — bright tangerine orange body, bold white number on black roundel, deer head emblem on the door, clean 1970s touring car feel" },
      { title: "Castrol Rally", prompt: "Castrol rally livery — white base, bold red and green diagonal stripes across the mid-section, large Castrol shield logo on the door, clean professional rally aesthetic" },
      { title: "Porsche Pink Pig", prompt: "Porsche Pink Pig tribute — pastel pink body with butcher shop diagram lines showing meat cuts drawn across panels in dark pink, whimsical retro 1971 Le Mans aesthetic, number 23" },
      { title: "BMW Art Car", prompt: "BMW Art Car inspired — white base with bold multicoloured geometric paint splashes and abstract shapes across all panels, art gallery meets motorsport, Alexander Calder style" },
    ],
    "Modern Motorsport": [
      { title: "Neon Cyberpunk", prompt: "Aggressive black-to-carbon fade base, electric cyan accent stripe that traces the entire aero line from front splitter through door to rear diffuser, cyan glow-effect number" },
      { title: "Crimson Assault", prompt: "Deep crimson primary colour with aggressive angular white graphic cutting across both doors, matte black roof and hood, contrasting brushed-aluminium mirror caps" },
      { title: "Electric Storm", prompt: "Vibrant electric blue with a sweeping white chevron originating at the nose and fanning out across the roof and rear quarter, hi-vis yellow safety accents on the bumpers" },
      { title: "Split Contrast", prompt: "Two-tone split livery — gloss white upper half, gloss obsidian black lower half, separated by a razor-thin red pinstripe along the waistline, number in red on white door" },
      { title: "Circuit Board", prompt: "Matte dark grey body covered in subtle PCB trace patterns in metallic silver, LED-green accent highlights along aero edges, futuristic tech sponsor aesthetic" },
      { title: "Hyper GT", prompt: "Metallic pearl white body with holographic chrome accent panels on the lower sills and rear quarter, ultra-modern angular graphics in dark grey, premium hypercar feel" },
      { title: "Night Attack", prompt: "Satin black body with matte dark red geometric shards exploding from the rear quarter forward, as if the car is shattering through glass, aggressive motorsport energy" },
      { title: "Arctic Warfare", prompt: "White and pale ice blue dazzle camouflage pattern across the entire body, dark navy number panels, military precision meets motorsport, clean sharp edges" },
    ],
    "Elegant & Minimalist": [
      { title: "Midnight Silver", prompt: "Matte midnight blue body with a single broad silver metallic band sweeping rearward from the front splitter, polished-metal detailing on mirrors and spoiler, no sponsor clutter" },
      { title: "Carbon Champagne", prompt: "Satin graphite base coat with a subtle carbon-weave texture overlay on the hood and roof, champagne gold pinstripe outlining the door seams, understated race number in ivory" },
      { title: "Stealth Shadow", prompt: "Monochromatic gloss black with deep gunmetal grey graphic panels on the doors, ghost watermark of a circuit map in the background, minimal white number in a clean sans-serif" },
      { title: "Brooklands Green", prompt: "British Racing Green with a thin gold coachline running the full length of the car, cream race numbers on black roundels, classic Brooklands-era feel" },
      { title: "Monochrome Class", prompt: "Pure white body with a single thin black horizontal pinstripe at waistline height, race number in a refined serif font on the door, less is more racing elegance" },
      { title: "Gentleman Racer", prompt: "Deep burgundy body with tan leather-look accents on the roof and mirror caps, gold wire-wheel motif on the door, vintage gentleman racer aesthetic, number in cream" },
    ],
    "National Racing Colours": [
      { title: "Italian Tricolore", prompt: "Italian tricolore-inspired — verde hood into bianco mid-section into rosso rear quarter, subtle fade transitions, race number in classic gold on black shield" },
      { title: "Japanese Hinomaru", prompt: "Japanese racing white — clean white body with a single large red hinomaru on each door, red front bumper lip, minimal black detailing, purposeful and uncluttered" },
      { title: "German Silver Arrow", prompt: "German racing silver — brushed aluminium silver effect overall, eagle emblem watermark faint on the hood, black number panels, purposeful Motorsport pedigree aesthetic" },
      { title: "French Bleu", prompt: "French racing blue — deep Bleu de France body, white racing stripe from hood to tail, red accent on the wing mirrors, tricolore cockade emblem on the rear quarter" },
      { title: "American Stars", prompt: "American racing — navy blue body with broad white and red longitudinal stripes from nose to tail, star motif on the roof, patriotic but tasteful motorsport aesthetic" },
      { title: "Australian Gold", prompt: "Australian racing — dark green body with vivid gold kangaroo emblems on each door, gold accent stripes along the sill, Southern Cross constellation on the roof in white" },
    ],
    "Creative & Artsy": [
      { title: "Tuxedo", prompt: "Tuxedo livery — gloss white front half transitioning sharply to gloss black from the B-pillar rearward, bow-tie motif on the roof in silver foil effect, white number on black door" },
      { title: "Chequered Fade", prompt: "Chequered flag fade — white body with a large chequered flag graphic fading out from the rear quarter forward, becoming a ghost pattern towards the nose, bold black race number" },
      { title: "Sunset Gradient", prompt: "Sunset gradient — fiery deep orange at the nose softly blending through amber and coral to dusky violet at the rear, metallic flake finish, white race number edged in gold" },
      { title: "Vaporwave", prompt: "Vaporwave aesthetic — pastel pink and teal gradient body, retro sunset grid graphic on the hood, palm tree silhouettes on the rear quarter, synthwave purple accent lines, 80s nostalgia" },
      { title: "Watercolour Wash", prompt: "Watercolour splash livery — white base with loose, flowing watercolour washes of cerulean blue and emerald green across the doors and hood, paint drip effects along the lower edges" },
      { title: "Pop Art", prompt: "Pop Art livery — bold primary colour blocks in red, yellow, and blue separated by thick black outlines, comic book halftone dot pattern in the background, Roy Lichtenstein inspired" },
      { title: "Galaxy Nebula", prompt: "Deep space nebula livery — dark purple-black base with swirling nebula clouds in magenta, teal, and gold across the flanks, tiny star field dots, cosmic and otherworldly" },
      { title: "Graffiti Tag", prompt: "Urban graffiti livery — matte concrete grey base with vibrant spray-paint style tags, drips, and throw-ups across all panels, neon pink and lime green dominant colours, street art energy" },
    ],
    "Exotic & Unusual": [
      { title: "Dragon Scale", prompt: "Dragon scale livery — deep emerald green body with an overlapping scale texture across all panels, gold metallic edges on each scale, fiery orange-red accents on the splitter and diffuser" },
      { title: "Arctic Camo", prompt: "Arctic warfare camouflage — irregular white, pale grey, and ice blue camo blocks across the entire body, matte finish, tactical stencil-style number in dark grey" },
      { title: "Candy Chrome", prompt: "Candy chrome livery — iridescent colour-shifting paint that transitions from deep purple to electric blue to teal across the body length, mirror chrome accent on the roof scoop and wing" },
      { title: "Rust Rat Rod", prompt: "Rat rod patina livery — faux weathered bare metal body with realistic rust patches, primer spots in flat grey, hand-painted number in white house paint style, anti-establishment aesthetic" },
      { title: "Origami Paper", prompt: "Origami-inspired livery — white base with geometric folded-paper shadow effects creating a 3D faceted appearance across all panels, subtle pastel colour on alternate facets" },
      { title: "Tribal Ink", prompt: "Polynesian tribal tattoo livery — matte black base with intricate white tribal patterns flowing from the hood across the doors to the rear, bold cultural art meets motorsport" },
    ],
    "Joke & Meme": [
      { title: "Lambo Door LOL", prompt: "Lambo door joke livery — neon lime green body with massive upward-opening door graphics drawn as if the car's panels are hydraulic supercar doors that don't actually open, with exaggerated hinges and mechanical lines" },
      { title: "Minion Chaos", prompt: "Minion-inspired chaos livery — bright banana yellow base with big googly eyes on the hood, gibberish text in Comic Sans across the doors, chaotic splashes of blue and purple, absolute maximum meme energy" },
      { title: "E-Boy Drift", prompt: "E-boy drift car — hot pink and black split livery, fake LED light graphic running along the sills, tilted cat emoji decals, oversized winglets drawn on the side, ironic sponsorship of energy drinks and RGB cable brands" },
      { title: "Beans", prompt: "Beans livery — the entire car covered in realistic rendered 3D beans, hundreds of them scattered across every panel, various sizes, different bean types, suspended as if falling onto the car, absolute bean chaos" },
      { title: "Big Floppy Hat", prompt: "Big floppy hat livery — cartoony oversized comical straw hat graphic spanning the entire roof panel, hat flopping down the sides of the car, bow tie visible on the front, whimsical derp aesthetic" },
      { title: "Fish Eye", prompt: "Fish eye livery — the car's entire front fascia designed to look like a shocked fish face, massive wide-open eye graphics where the headlights go, alarmed expression, fish scales across the hood" },
      { title: "Speedlines Overload", prompt: "Speedlines overload — entire car plastered with aggressive blue and red speedlines shooting in all directions, so many lines they overlap and create visual chaos, thick neon trails, looks perpetually moving at 500mph" },
      { title: "Meme Text Racing", prompt: "Meme text racing — the entire livery is just overlapping Impact font text in various sizes and colours ('FAST', 'BEEP BEEP', 'ZOOM', 'VROOOOM', 'SPEED', random LOL speech bubbles) chaotically scattered everywhere" },
      { title: "Anime Protagonist", prompt: "Anime protagonist car — giant anime girl eyes taking up most of the hood, dramatic hair streaks flowing down the sides, roses and sparkle effects everywhere, dramatic shounen racing energy, impossible physics implied by the design" },
      { title: "Corporate Ipsum", prompt: "Corporate ipsum livery — entire car covered in Lorem Ipsum placeholder text as design, 'Lorem Dolor Sit Amet' stamped across panels in various enterprise-looking fonts, unironic corporate placeholder aesthetic" },
    ],
  },
  modify: {
    "Weathering & Age": [
      { title: "Race-Worn", prompt: "Add realistic race-worn weathering throughout — stone chips across the nose and leading edges, brake dust staining around the rear wheel arches, tyre rubber deposits along the lower sills, faded paint on the roof from prolonged sun exposure" },
      { title: "Gravel Rally Dust", prompt: "Apply a full gravel-rally dust treatment — thick fine dust build-up on the lower third of the car, stone impact marks scattered across the bonnet and front bumper, mud splatter on the rear quarter panels and diffuser" },
      { title: "30-Year Aged", prompt: "Age the livery 30 years — introduce UV sun-fade to the primary colours, hairline cracking in the clear coat over the roof and bonnet, yellowing of white graphics, oxidation mottling on the darker panels" },
      { title: "Battle Damage", prompt: "Add post-race battle damage — subtle panel scuffs on the driver-side door and rear quarter, light scratch marks on the front bumper consistent with wheel-to-wheel contact, minor paint transfer in a contrasting colour" },
      { title: "Fire Scorching", prompt: "Introduce fire scorching to the rear diffuser and lower rear bumper — blackened soot marks, heat discolouration transitioning from amber to blue on the exhaust-adjacent areas, blistering paint texture at the hottest points" },
      { title: "Mud Endurance", prompt: "Add heavy endurance race mud — thick dark brown mud coating the lower quarter of the car, splatter up the doors, partially obscured number and sponsors, windscreen washer streak marks across the hood" },
    ],
    "Sponsors & Branding": [
      { title: "Full Sponsor Package", prompt: "Add a full sponsor package — place 5–6 fictional sponsor logos across the hood, front quarter panels, doors, and rear bumper in a professional layout that respects the existing design flow and colour hierarchy" },
      { title: "Replace All Sponsors", prompt: "Replace all existing sponsor logos with fictional motorsport brands (e.g. HelixFuel, Torque88, VectorOil, ApexGear, NovaDrive) — match the size, position and style of the originals as closely as possible" },
      { title: "Title Sponsor", prompt: "Add a single prominent title sponsor across the full hood — large, bold wordmark in a colour that contrasts the hood base, with the sponsor's web address in small print along the lower bumper" },
      { title: "Tyre & Team Branding", prompt: "Add tyre brand markings on the lower sill area and a team name banner along the A-pillar and windscreen visor strip in a clean bold font" },
      { title: "Number Board", prompt: "Integrate a national motorsport series number board — white rectangular panel on each front door with the race number in large black digits and a small series logo at the top" },
      { title: "Racing Series Decals", prompt: "Add a complete racing series decal package — class sticker on rear quarter, technical inspection stickers near the A-pillar, fuel flap arrow, tow point markers in red triangles, windscreen banner" },
    ],
    "Colour & Finish": [
      { title: "Shift to Prussian Blue", prompt: "Shift the primary body colour from its current hue to a deep gloss Prussian blue, preserving all existing graphic elements, logos, and colour hierarchy exactly — only the primary base changes" },
      { title: "Gloss to Matte", prompt: "Convert the livery finish from gloss to matte throughout — desaturate slightly and remove all specular qualities from the base colour while keeping graphics and detailing intact" },
      { title: "Pearlescent Shift", prompt: "Add a two-tone pearlescent effect to the primary colour — the base now shifts subtly between a cool silver and the original hue depending on viewing angle, while keeping all graphics unchanged" },
      { title: "Chrome Graphics", prompt: "Introduce a chrome or polished-metal mirror finish on all white graphic areas while keeping the base body colour exactly as-is" },
      { title: "Darken 25%", prompt: "Darken the entire livery by 25% — richer, deeper tones throughout, as if photographed under overcast conditions — no structural changes to the graphics" },
      { title: "Neon Accents", prompt: "Replace all accent-colour elements with vivid neon versions — neon green, neon pink, or neon orange — while keeping the primary base colour untouched, creating an electrified contrast" },
      { title: "Satin Wrap", prompt: "Convert the entire body to a satin wrap finish — slightly more sheen than matte but nowhere near gloss, with a silky smooth quality, while retaining all graphic details precisely" },
    ],
    "Graphics & Decals": [
      { title: "Carbon Fibre Panels", prompt: "Add a wide carbon-fibre texture overlay to the hood, roof panel, and door mirror caps — the weave should blend naturally with the paint edges using a feathered mask" },
      { title: "Racing Stripes", prompt: "Add a pair of broad racing stripes running from the nose to the tail along the centreline of the car — stripes should be 15% of the car's width, in a contrasting colour to the primary body" },
      { title: "Waterfall Splash", prompt: "Introduce a waterfall graphic on each door — a complex brushstroke-like paint splash in a complementary accent colour, as if painted by hand at high speed" },
      { title: "Roof Flag", prompt: "Add a large national flag graphic — stretched across the entire roof panel and partially wrapping down onto the upper door, flag colours respecting the existing design palette" },
      { title: "Circuit Map Watermark", prompt: "Add a subtle ghosted circuit map of a famous track (e.g. Spa-Francorchamps or Suzuka) as a watermark pattern across the hood and bonnet in a monochromatic tint matching the base colour" },
      { title: "Hex Grid Overlay", prompt: "Add a subtle hexagonal grid pattern overlay across the lower third of the body in a slightly darker shade of the base colour, creating a modern tech-inspired texture" },
      { title: "Claw Mark Scratches", prompt: "Add dramatic diagonal claw-mark scratches across both doors revealing a contrasting colour underneath — as if a beast raked across the bodywork, with torn paint edges" },
    ],
    "Number & Identity": [
      { title: "Change Number to 77", prompt: "Change the race number to 77 — update every instance of the number on the car (doors, roof, nose) ensuring the same font, size, colour and backing panel treatment as the original" },
      { title: "Roof Number", prompt: "Reposition the race number from the doors to the roof panel — large enough to be visible from the camera helicopter angle, in a high-contrast colour to the roof base" },
      { title: "Retro Oversized Number", prompt: "Replace the current number treatment with a retro-style oversized number — filling almost the entire door surface, in a vintage font with a thin contrasting outline" },
      { title: "Driver Name Banners", prompt: "Add driver name banners — a driver name above each door number in a smaller but matching font treatment, and a second driver name on the windscreen visor strip" },
    ],
    "Structural Changes": [
      { title: "Waistline Stripe", prompt: "Add a bold contrasting stripe around the entire car at waistline height — 80px wide, hard-edged, in a colour that creates strong contrast with both the upper and lower body" },
      { title: "Rear Fade to Black", prompt: "Apply a gradient fade from the current primary colour to gloss black from the B-pillar rearward — transition should be smooth over approximately 30% of the body length" },
      { title: "Speed Blade", prompt: "Add a sharply angular forward-swept graphic on each front quarter panel — like a speed blade — in white or silver, giving a modern aggressive style without touching the door graphics" },
      { title: "Splatter Lower", prompt: "Wrap the lower 20% of the car in a dark splatter / hex-grid pattern in charcoal, transitioning to the main body colour with a hard masked edge at the sill line" },
      { title: "Roof Accent Panel", prompt: "Add a roof accent panel — contrasting colour panel with thin pinstripe border covering the full roof surface, as if the top of the car belongs to a different but complementary livery" },
      { title: "Diagonal Split", prompt: "Split the car diagonally — top-left to bottom-right across each side — with the existing colour on top and a complementary new colour on the bottom half, creating a dynamic angular division" },
    ],
    "Iterate — Edge & Clarity": [
      { title: "Sharpen All Edges", prompt: "Sharpen all edges and clean up any blurry or muddy transitions between colour blocks — crisp, vector-quality boundaries throughout" },
      { title: "Fix Misalignment", prompt: "Fix any misalignment between the graphics and the UV wireframe seams — ensure all elements respect panel boundaries" },
      { title: "Clean Up Artefacts", prompt: "Clean up the hood area — remove any artefacts and ensure the graphics are symmetrical and well-composed" },
      { title: "Smooth Transitions", prompt: "Make the colour transitions smoother and more professional — eliminate any banding or harsh unintended edges" },
      { title: "Fix Colour Bleeding", prompt: "Fix any colour bleeding across panel seams — each panel should have a clean, deliberate colour boundary" },
    ],
    "Iterate — Colour & Contrast": [
      { title: "Boost Saturation", prompt: "Improve colour saturation — make the primary colours richer and more vibrant without changing the actual hues" },
      { title: "Increase Contrast", prompt: "Increase contrast between the primary and accent colours for better visibility at race distance" },
      { title: "Add Depth", prompt: "Add more depth to the design — subtle gradient or texture overlays on large flat colour areas" },
      { title: "Fix Wheel Arches", prompt: "Fix the wheel arch and window cutout areas — ensure they are solid black (#000000) with clean edges" },
    ],
    "Iterate — Detail & Polish": [
      { title: "Refine Numbers", prompt: "Add more detail and refinement to the number graphics — cleaner font rendering, better placement, proper outline/shadow" },
      { title: "Reduce Clutter", prompt: "Reduce visual clutter — simplify overly busy areas while keeping the core design language intact" },
      { title: "Better Composition", prompt: "Improve the overall composition — better balance between graphic-heavy and breathing-space areas" },
      { title: "Polish Text", prompt: "Clean up text and sponsor placement — ensure all text is sharp, readable, and properly oriented" },
      { title: "Refine Pinstripes", prompt: "Refine the pinstripes and border lines — make them thinner, more consistent, and perfectly following body contours" },
      { title: "Premium Finish", prompt: "Make the overall design feel more premium and race-ready — polish every element to professional motorsport quality" },
    ],
  },
};


// ─── Mode Toggle ─────────────────────────────────────────────────────────────
function setMode(mode, persist = true) {
  currentMode = mode;

  // Update button active states
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  // Update prompt placeholder
  const promptEl = document.getElementById("prompt");
  if (mode === "modify") {
    promptEl.placeholder = iterateEnabled
      ? "e.g. Sharpen the colour transitions, fix any artefacts on the hood, and make the number graphics cleaner…"
      : "e.g. Add realistic race-worn weathering — stone chips on the nose, brake dust on the rear arches, faded paint on the roof…";
  } else {
    promptEl.placeholder = "e.g. Gulf Racing livery, pastel blue lower body, orange hood and roof, white number 7 on both doors, thin white pinstripe separating colours…";
  }

  // Update sample button label
  document.getElementById("sampleBtnLabel").textContent =
    mode === "modify" ? "Modification Ideas" : "New Livery Ideas";

  // Close samples modal if open
  closeSamplesModal();

  // Update modal title if it exists
  const modalTitle = document.getElementById("samplesModalTitle");
  if (modalTitle) {
    modalTitle.textContent = mode === "modify"
      ? "Modification Samples"
      : "Livery Samples";
  }

  // Show/hide preview post-action controls
  updatePreviewPostActions();

  if (persist) {
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ last_mode: mode }),
    });
    dbg(`[persist] mode saved: ${mode}`);
  }
}

// Show correct post-generate controls based on mode and whether a result exists
function updatePreviewPostActions() {
  const postActions = document.getElementById("previewPostActions");
  const modifyBtn = document.getElementById("btnPostModify");
  const modifyControls = document.getElementById("previewModifyControls");
  const iterateHint = document.getElementById("iterateHint");

  if (!lastGeneratedPath) {
    if (postActions) postActions.style.display = "none";
    return;
  }

  postActions.style.display = "flex";

  if (currentMode === "new") {
    modifyBtn.style.display = "";
    modifyControls.style.display = "none";
    iterateHint.style.display = "none";
  } else {
    // modify mode
    modifyBtn.style.display = "none";
    modifyControls.style.display = "flex";
    iterateHint.style.display = iterateEnabled ? "" : "none";
    // Disable "Set Base" when iterate is active (it's auto)
    document.getElementById("btnSetBase").disabled = iterateEnabled;
  }
}

function onIterateToggleChange() {
  iterateEnabled = document.getElementById("iterateToggle").checked;
  updatePreviewPostActions();

  // Update prompt placeholder when iterate changes
  const promptEl = document.getElementById("prompt");
  if (currentMode === "modify") {
    promptEl.placeholder = iterateEnabled
      ? "e.g. Sharpen the colour transitions, fix any artefacts on the hood, and make the number graphics cleaner…"
      : "e.g. Add realistic race-worn weathering — stone chips on the nose, brake dust on the rear arches, faded paint on the roof…";
  }
}

// Load the current preview result as the base texture
function setBaseFromPreview() {
  if (!lastGeneratedPath) return;
  state.base_texture_path = lastGeneratedPath;
  state.base_is_override = true;
  setFilePath("base", lastGeneratedPath);
  showStatus("statusBar", "success", "✓ Result loaded as base texture");
}

// Switch to modify mode with the current preview loaded as base
function modifyFromPreview() {
  if (!lastGeneratedPath) return;
  setMode("modify", true);
  state.base_texture_path = lastGeneratedPath;
  state.base_is_override = true;
  setFilePath("base", lastGeneratedPath);
  document.getElementById("prompt").value = "";
  document.getElementById("prompt").focus();
}


// ─── Samples Modal ────────────────────────────────────────────────────────────
let _samplesActiveCategory = null;

function getSamplesData() {
  const modeKey = currentMode === "modify" ? "modify" : "new";
  return SAMPLE_CATEGORIES[modeKey] || {};
}

function openSamplesModal(e) {
  if (e) e.stopPropagation();
  const overlay = document.getElementById("samplesModalOverlay");
  const catBar = document.getElementById("samplesModalCategories");
  const body   = document.getElementById("samplesModalBody");
  const title  = document.getElementById("samplesModalTitle");

  // Set title
  title.textContent = currentMode === "modify"
    ? "Modification Samples"
    : currentMode === "iterate"
    ? "Iteration Samples"
    : "Livery Samples";

  // Build category buttons
  const data = getSamplesData();
  const categoryNames = Object.keys(data);
  catBar.innerHTML = "";
  categoryNames.forEach((name, idx) => {
    const btn = document.createElement("button");
    btn.className = "samples-cat-btn" + (idx === 0 ? " active" : "");
    btn.textContent = name;
    btn.onclick = () => {
      catBar.querySelectorAll(".samples-cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderSamplesCategory(name);
    };
    catBar.appendChild(btn);
  });

  // Render first category
  if (categoryNames.length > 0) {
    _samplesActiveCategory = categoryNames[0];
    renderSamplesCategory(categoryNames[0]);
  } else {
    body.innerHTML = "<p style='color:var(--text-muted);padding:24px;'>No samples available for this mode.</p>";
  }

  overlay.style.display = "flex";
}

function renderSamplesCategory(categoryName) {
  _samplesActiveCategory = categoryName;
  const body = document.getElementById("samplesModalBody");
  const data = getSamplesData();
  const items = data[categoryName] || [];
  body.innerHTML = "";

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "sample-card";
    card.onclick = () => {
      document.getElementById("prompt").value = item.prompt;
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_prompt: item.prompt }),
      });
      closeSamplesModal();
    };

    const titleEl = document.createElement("div");
    titleEl.className = "sample-card-title";
    titleEl.textContent = item.title;
    card.appendChild(titleEl);

    const desc = document.createElement("div");
    desc.className = "sample-card-desc";
    desc.textContent = item.prompt;
    card.appendChild(desc);

    body.appendChild(card);
  });
}

function closeSamplesModal(e) {
  const overlay = document.getElementById("samplesModalOverlay");
  if (overlay) overlay.style.display = "none";
}

function closeSamplesModalOutside(e) {
  const modal = document.querySelector(".samples-modal");
  if (modal && !modal.contains(e.target)) closeSamplesModal();
}

// Wire up overlay click-to-close
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("samplesModalOverlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSamplesModal();
    });
  }
});


// ─── Prompt History ───────────────────────────────────────────────────────────
// Prompt history is persisted server-side in config.json via /api/prompt-history
let _promptHistoryCache = null;

async function addPromptToHistory(prompt) {
  if (!prompt || prompt.trim().length === 0) return;
  try {
    await fetch("/api/prompt-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt.trim() }),
    });
    _promptHistoryCache = null; // invalidate cache so modal re-fetches
  } catch (e) {
    console.warn("[history] Failed to save prompt:", e);
  }
}

async function getPromptHistory() {
  try {
    const res = await fetch("/api/prompt-history");
    const data = await res.json();
    _promptHistoryCache = Array.isArray(data) ? data : [];
    return _promptHistoryCache;
  } catch (e) {
    console.warn("[history] Failed to load history:", e);
    return [];
  }
}

async function openPromptHistoryModal() {
  const overlay = document.getElementById("promptHistoryOverlay");
  const body = document.getElementById("promptHistoryBody");

  if (!overlay) return;

  overlay.style.display = "flex";
  body.innerHTML = `<div class="history-empty"><p style="opacity:0.4">Loading…</p></div>`;

  const history = await getPromptHistory();

  if (history.length === 0) {
    body.innerHTML = `<div class="history-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <p>No prompts in history yet</p>
    </div>`;
  } else {
    const list = document.createElement("div");
    list.className = "history-list";
    history.forEach(item => {
      const div = document.createElement("div");
      div.className = "history-item";
      const timeStr = new Date(item.timestamp).toLocaleDateString() + " " + new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      div.innerHTML = `${escapeHtml(item.prompt)}<span class="history-item-time">${timeStr}</span>`;
      div.onclick = () => {
        document.getElementById("prompt").value = item.prompt;
        closePromptHistoryModal();
      };
      list.appendChild(div);
    });
    body.innerHTML = "";
    body.appendChild(list);
  }

  overlay.style.display = "flex";
}

function closePromptHistoryModal() {
  const overlay = document.getElementById("promptHistoryOverlay");
  if (overlay) overlay.style.display = "none";
}


// ─── Enhance Prompt ───────────────────────────────────────────────────────────
async function enhancePrompt() {
  const promptEl = document.getElementById("prompt");
  const prompt = promptEl.value.trim();
  if (!prompt) {
    showStatus("statusBar", "error", "Write a prompt first, then enhance it.");
    return;
  }

  const btn = document.getElementById("enhanceBtn");
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner" style="display:inline-block;width:12px;height:12px;margin-right:4px"></span> Enhancing…';

  try {
    const context = document.getElementById("context").value.trim();
    const res = await fetch("/api/enhance-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, context, mode: currentMode }),
    });
    const data = await res.json();
    if (data.error) {
      showStatus("statusBar", "error", data.error);
    } else if (data.enhanced) {
      promptEl.value = data.enhanced;
      // Persist enhanced prompt in session
      fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_prompt: data.enhanced }),
      });
      showStatus("statusBar", "success", "✓ Prompt enhanced");
    }
  } catch (e) {
    showStatus("statusBar", "error", "Enhancement failed: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}


// ─── File Picker ──────────────────────────────────────────────────────────────

/** Map upload type → persist category for /data/generate/{category}/ */
const UPLOAD_CATEGORY = { wireframe: "wire", base: "base", reference: "reference" };

async function pickFile(type) {
  try {
    const allowMulti = type === "reference";
    const res = await fetch("/api/pick-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_types: ["Image Files (*.png;*.jpg;*.jpeg;*.tga)"],
        allow_multiple: allowMulti,
      }),
    });
    const data = await res.json();
    if (allowMulti && data.paths && data.paths.length) {
      for (const p of data.paths) await addReferencePath(p);
    } else if (data.path) {
      applyUploadPath(type, data.path);
    }
  } catch (e) {
    console.error("File picker failed:", e);
  }
}

async function handleUploadDrop(event, type) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");
  const files = event.dataTransfer?.files;
  if (!files || !files.length) return;
  const category = UPLOAD_CATEGORY[type] || "";
  // For reference, support dropping multiple files
  const fileList = type === "reference" ? Array.from(files) : [files[0]];
  for (const file of fileList) {
    const formData = new FormData();
    formData.append("file", file);
    if (category) formData.append("category", category);
    try {
      const res = await fetch("/api/upload-file", { method: "POST", body: formData });
      const data = await res.json();
      if (data.path) {
        if (type === "reference") {
          await addReferencePath(data.path, /* alreadyPersisted */ true);
        } else {
          applyUploadPath(type, data.path, /* alreadyPersisted */ true);
        }
      } else if (data.error) {
        console.error("Upload error:", data.error);
      }
    } catch (e) {
      console.error("Upload failed:", e);
    }
  }
}

/** Persist an externally-picked file to data/generate/{category}/ if not already there */
async function persistUpload(path, category) {
  try {
    const res = await fetch("/api/persist-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, category }),
    });
    const data = await res.json();
    return data.path || path;
  } catch {
    return path;
  }
}

function applyUploadPath(type, path, alreadyPersisted = false) {
  const category = UPLOAD_CATEGORY[type];
  // Fire-and-forget persist to data/generate/{category}/
  if (category && !alreadyPersisted) {
    persistUpload(path, category);
  }
  if (type === "wireframe") {
    state.wireframe_path = path;
    state.wireframe_is_override = true;
    showUploadSquareThumb("wireframe", path);
    // Persist to session
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wireframe_path: path }),
    }).catch(() => {});
  } else if (type === "base") {
    state.base_texture_path = path;
    state.base_is_override = true;
    showUploadSquareThumb("base", path);
    // Persist to session
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_texture_path: path }),
    }).catch(() => {});
  } else if (type === "reference") {
    // For backward compat — single-add via applyUploadPath
    addReferencePath(path, alreadyPersisted);
  }
}

/** Add a reference image path (multi-reference support) */
async function addReferencePath(path, alreadyPersisted = false) {
  if (!path || state.reference_paths.includes(path)) return;
  state.reference_paths.push(path);
  renderReferenceGrid();
  // Persist to data/generate/reference/
  if (!alreadyPersisted) persistUpload(path, "reference");
  // Save to session
  fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference_image_paths: state.reference_paths }),
  }).catch(() => {});
  document.getElementById("referenceContextField").style.display = "block";
}

/** Remove a reference image by index */
function removeReference(index) {
  state.reference_paths.splice(index, 1);
  renderReferenceGrid();
  // Save to session
  fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference_image_paths: state.reference_paths }),
  }).catch(() => {});
  if (state.reference_paths.length === 0) {
    document.getElementById("referenceContextField").style.display = "none";
  }
}

/** Render the reference grid with thumbnails + add card */
function renderReferenceGrid() {
  const grid = document.getElementById("referenceGrid");
  grid.innerHTML = "";
  state.reference_paths.forEach((p, i) => {
    const thumb = document.createElement("div");
    thumb.className = "reference-thumb";
    const img = document.createElement("img");
    img.alt = "Reference " + (i + 1);
    // Fetch preview
    fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.preview_b64) img.src = "data:image/png;base64," + d.preview_b64; })
      .catch(() => {});
    thumb.appendChild(img);
    const btn = document.createElement("button");
    btn.className = "ref-remove";
    btn.innerHTML = "&times;";
    btn.title = "Remove reference";
    btn.onclick = (e) => { e.stopPropagation(); removeReference(i); };
    thumb.appendChild(btn);
    grid.appendChild(thumb);
  });
  // Add card (always present)
  const add = document.createElement("div");
  add.className = "ref-add-card";
  add.title = "Add reference image";
  add.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span class="ref-add-label">Add</span>`;
  add.onclick = () => pickFile("reference");
  // Enable drag-drop on the add card
  add.ondragover = (e) => { e.preventDefault(); add.classList.add("drag-over"); };
  add.ondragleave = () => add.classList.remove("drag-over");
  add.ondrop = (e) => { add.classList.remove("drag-over"); handleUploadDrop(e, "reference"); };
  grid.appendChild(add);
  // Show/hide context field
  document.getElementById("referenceContextField").style.display =
    state.reference_paths.length > 0 ? "block" : "none";
}

// ─── Browse Uploads Modal ─────────────────────────────────────────────────────
let _browseCategory = null; // current browse context

const BROWSE_TITLES = {
  wire: "Browse Wireframes",
  base: "Browse Base Textures",
  reference: "Browse Reference Images",
};

async function openBrowseModal(category) {
  _browseCategory = category;
  const overlay = document.getElementById("browseModalOverlay");
  const title = document.getElementById("browseModalTitle");
  const body = document.getElementById("browseModalBody");

  if (!overlay) return;

  title.textContent = BROWSE_TITLES[category] || "Browse Uploads";
  body.innerHTML = `<div class="browse-empty"><p style="opacity:0.4">Loading…</p></div>`;
  overlay.style.display = "flex";

  try {
    const res = await fetch(`/api/browse-uploads/${category}`);
    const items = await res.json();
    if (!items.length) {
      body.innerHTML = `<div class="browse-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p>No uploads found</p>
      </div>`;
      return;
    }
    body.innerHTML = "";
    for (const item of items) {
      const card = document.createElement("div");
      card.className = "browse-item";
      card.title = item.name;
      const img = document.createElement("img");
      img.alt = item.name;
      fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: item.path }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.preview_b64) img.src = "data:image/png;base64," + d.preview_b64; })
        .catch(() => {});
      card.appendChild(img);
      const label = document.createElement("div");
      label.className = "browse-item-name";
      label.textContent = item.name;
      card.appendChild(label);
      card.onclick = () => selectBrowseItem(item.path);
      body.appendChild(card);
    }
  } catch (e) {
    body.innerHTML = `<div class="browse-empty"><p>Failed to load uploads.</p></div>`;
  }
}

function selectBrowseItem(path) {
  closeBrowseModal();
  if (!_browseCategory) return;
  if (_browseCategory === "reference") {
    addReferencePath(path, /* alreadyPersisted */ true);
  } else {
    const typeMap = { wire: "wireframe", base: "base" };
    const type = typeMap[_browseCategory] || _browseCategory;
    applyUploadPath(type, path, /* alreadyPersisted */ true);
  }
}

function closeBrowseModal() {
  document.getElementById("browseModalOverlay").style.display = "none";
  _browseCategory = null;
}

async function showUploadSquareThumb(type, path) {
  const idMap = {
    wireframe: { img: "wireframeSquareImg", empty: "wireframeSquareEmpty", badge: "wireframeSquareBadge", square: "wireframeSquare" },
    base: { img: "baseSquareImg", empty: "baseSquareEmpty", badge: "baseSquareBadge", square: "baseSquare" },
  };
  const ids = idMap[type];
  if (!ids) return;

  const clearBtn = document.getElementById(ids.square)?.querySelector(".upload-square-clear");

  if (!path) {
    document.getElementById(ids.img).style.display = "none";
    document.getElementById(ids.empty).style.display = "flex";
    document.getElementById(ids.badge).style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";
    updateSourceImageButtons();
    return;
  }

  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.preview_b64) {
      const img = document.getElementById(ids.img);
      img.src = `data:image/png;base64,${data.preview_b64}`;
      img.style.display = "block";
      document.getElementById(ids.empty).style.display = "none";
      document.getElementById(ids.badge).style.display = "block";
      if (clearBtn) clearBtn.style.display = "flex";
      updateSourceImageButtons();
    }
  } catch (e) {
    console.error("Square thumb failed:", e);
  }
}

// ─── Hover-preview: show wireframe/base in main preview on hover ─────────────
function _startHoverPreview(squareImgId) {
  const squareImg = document.getElementById(squareImgId);
  if (!squareImg || squareImg.style.display === "none" || !squareImg.src) return;

  const previewImg = document.getElementById("previewImg");
  const previewEmpty = document.getElementById("previewEmpty");
  if (!previewImg || !previewEmpty) return;

  // Save current state so we can restore on mouse leave
  originalPreviewState = {
    saved: true,
    emptyDisplay: previewEmpty.style.display || "flex",
    imgDisplay: previewImg.style.display || "none",
    imgSrc: previewImg.src || "",
  };

  _hoverPreviewActive = true;
  previewImg.src = squareImg.src;
  previewImg.style.display = "block";
  previewEmpty.style.display = "none";
  // Reset zoom for hover preview
  previewZoom.scale = 1; previewZoom.panX = 0; previewZoom.panY = 0;
  previewZoomApply();
}

function _endHoverPreview() {
  if (!_hoverPreviewActive) return;
  _hoverPreviewActive = false;

  const previewImg = document.getElementById("previewImg");
  const previewEmpty = document.getElementById("previewEmpty");
  if (!previewImg || !previewEmpty) return;

  if (originalPreviewState && originalPreviewState.saved) {
    previewEmpty.style.display = originalPreviewState.emptyDisplay;
    previewImg.style.display = originalPreviewState.imgDisplay;
    if (originalPreviewState.imgSrc) {
      previewImg.src = originalPreviewState.imgSrc;
    }
    // Reset zoom back to fit
    previewZoom.scale = 1; previewZoom.panX = 0; previewZoom.panY = 0;
    previewZoomApply();
  }
}

// Wire up hover listeners on wireframe and base upload squares
(function initUploadSquareHoverPreview() {
  const hoverTargets = [
    { squareId: "wireframeSquare", imgId: "wireframeSquareImg" },
    { squareId: "baseSquare",      imgId: "baseSquareImg" },
  ];
  hoverTargets.forEach(({ squareId, imgId }) => {
    const square = document.getElementById(squareId);
    if (!square) return;
    square.addEventListener("mouseenter", () => _startHoverPreview(imgId));
    square.addEventListener("mouseleave", _endHoverPreview);
  });
})();

// ─── Copy/Download Source Images (wireframe/base) ────────────────────────────
async function copySourceImage(type) {
  const sourceType = type === "wireframe" ? "wireframe_path" : "base_texture_path";
  const path = state[sourceType];
  if (!path) return;

  try {
    const res = await fetch("/api/image-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.base64) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": new Blob(
            [Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))],
            { type: "image/png" }
          ),
        }),
      ]);
      showStatus("statusBar", "success", `${type.charAt(0).toUpperCase() + type.slice(1)} copied to clipboard`);
    }
  } catch (e) {
    console.error("Copy source image failed:", e);
    showStatus("statusBar", "error", "Failed to copy image");
  }
}

async function downloadSourceImage(type) {
  const sourceType = type === "wireframe" ? "wireframe_path" : "base_texture_path";
  const path = state[sourceType];
  if (!path) return;

  try {
    const res = await fetch("/api/image-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.base64) {
      const blob = new Blob(
        [Uint8Array.from(atob(data.base64), c => c.charCodeAt(0))],
        { type: "image/png" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error("Download source image failed:", e);
    showStatus("statusBar", "error", "Failed to download image");
  }
}

// Update copy/download button visibility when images are shown
function updateSourceImageButtons() {
  const types = ["wireframe", "base"];
  types.forEach(type => {
    const btnCopy = document.getElementById(type === "wireframe" ? "wireframeCopyBtn" : "baseCopyBtn");
    const btnDownload = document.getElementById(type === "wireframe" ? "wireframeDownloadBtn" : "baseDownloadBtn");
    const imgElement = document.getElementById(type === "wireframe" ? "wireframeSquareImg" : "baseSquareImg");
    
    if (btnCopy && btnDownload && imgElement) {
      const hasImage = imgElement.style.display !== "none" && imgElement.src;
      btnCopy.style.display = hasImage ? "flex" : "none";
      btnDownload.style.display = hasImage ? "flex" : "none";
    }
  });
}

function clearUploadSquare(type) {
  if (type === "wireframe") {
    state.wireframe_path = "";
    state.wireframe_is_override = false;
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wireframe_path: "" }),
    }).catch(() => {});
    // Revert to car library asset if available
    if (state.car_wire_url) {
      showUploadSquareThumbUrl("wireframe", state.car_wire_url, "Wireframe");
    } else {
      showUploadSquareThumb("wireframe", "");
    }
  }
  else if (type === "base") {
    state.base_texture_path = "";
    state.base_is_override = false;
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_texture_path: "" }),
    }).catch(() => {});
    // Revert to car library asset if available
    if (state.car_diffuse_url) {
      showUploadSquareThumbUrl("base", state.car_diffuse_url, "Base");
    } else {
      showUploadSquareThumb("base", "");
    }
  }
  else if (type === "reference") {
    state.reference_paths = [];
    fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference_image_paths: [] }),
    }).catch(() => {});
    document.getElementById("referenceContextField").style.display = "none";
    document.getElementById("referenceContext").value = "";
    renderReferenceGrid();
  }
}

function setFilePath(type, path) {
  // For backward-compat: also update upload squares
  if (type === "wireframe") showUploadSquareThumb("wireframe", path);
  if (type === "base") showUploadSquareThumb("base", path);
}

function clearFile(type) {
  clearUploadSquare(type);
}


// ─── Car Library Asset Loading ────────────────────────────────────────────────

// Cache of iracing_folder -> {wire_url, diffuse_url} built once from /api/library/cars
let _libraryByFolder = null;

async function _getLibraryByFolder() {
  if (_libraryByFolder) return _libraryByFolder;
  try {
    const res = await fetch("/api/library/cars");
    const cars = await res.json();
    _libraryByFolder = {};
    for (const car of cars) {
      if (car.iracing_folder) {
        _libraryByFolder[car.iracing_folder] = {
          wire_url: `/api/library/image/${car.slug}/wire.jpg`,
          diffuse_url: `/api/library/image/${car.slug}/diffuse.jpg`,
          wire_path: car.wire_path,
          diffuse_path: car.diffuse_path,
        };
      }
    }
  } catch (e) {
    _libraryByFolder = {};
  }
  return _libraryByFolder;
}

// Invalidate cache when library changes (e.g. after import)
function invalidateLibraryCache() { _libraryByFolder = null; }

async function applyCarLibraryAssets(carFolder) {
  const lib = await _getLibraryByFolder();
  const entry = lib[carFolder] || null;

  state.car_wire_url = entry ? entry.wire_url : "";
  state.car_diffuse_url = entry ? entry.diffuse_url : "";
  state.car_wire_path = entry ? entry.wire_path : "";
  state.car_diffuse_path = entry ? entry.diffuse_path : "";

  // Refresh the picker trigger thumbnail now that library data is loaded
  _carPickerSetTrigger(carFolder, _allCarsCache);

  // Only update the square if the user hasn't set an override
  if (!state.wireframe_is_override) {
    if (entry) {
      showUploadSquareThumbUrl("wireframe", entry.wire_url, "Wireframe");
    } else {
      showUploadSquareThumb("wireframe", "");
    }
  }
  if (!state.base_is_override) {
    if (entry) {
      showUploadSquareThumbUrl("base", entry.diffuse_url, "Base");
    } else {
      showUploadSquareThumb("base", "");
    }
  }
}

// Show a URL-based image in an upload square (no file-path session fetch needed)
function showUploadSquareThumbUrl(type, url, badgeLabel, isOverride = false) {
  const idMap = {
    wireframe: { img: "wireframeSquareImg", empty: "wireframeSquareEmpty", badge: "wireframeSquareBadge", square: "wireframeSquare" },
    base: { img: "baseSquareImg", empty: "baseSquareEmpty", badge: "baseSquareBadge", square: "baseSquare" },
  };
  const ids = idMap[type];
  if (!ids) return;
  const clearBtn = document.getElementById(ids.square)?.querySelector(".upload-square-clear");
  const img = document.getElementById(ids.img);
  img.src = url + "?t=" + Date.now(); // cache-bust
  img.style.display = "block";
  document.getElementById(ids.empty).style.display = "none";
  const badge = document.getElementById(ids.badge);
  badge.textContent = badgeLabel || type;
  badge.style.display = "block";
  // Only show clear button if this is an override, not a library default
  if (clearBtn) clearBtn.style.display = isOverride ? "flex" : "none";
}


// ─── Preview Actions (Copy/Download/Explorer) ────────────────────────────────
function showPreviewActions() {
  const previewImg = document.getElementById("previewImg");
  const actions = document.getElementById("previewActions");
  // Only show if there's an actual image (not empty state)
  if (previewImg.style.display !== "none" && previewImg.src) {
    actions.style.display = "flex";
    document.getElementById("previewZoomControls").style.display = "flex";
  }
}

function hidePreviewActions() {
  document.getElementById("previewActions").style.display = "none";
  // Keep zoom controls visible while zoomed in
  if (previewZoom.scale <= 1.01) {
    document.getElementById("previewZoomControls").style.display = "none";
  }
}

// ─── Preview Zoom / Pan ───────────────────────────────────────────────────────
const previewZoom = { scale: 1, panX: 0, panY: 0, dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 };

function previewZoomApply() {
  const img = document.getElementById("previewImg");
  const container = document.getElementById("previewZoomContainer");
  if (!img || !container) return;

  if (previewZoom.scale <= 1.01) {
    // Reset to normal contain mode
    img.style.transform = "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.position = "";
    container.style.cursor = "grab";
  } else {
    // Zoomed: position absolutely, apply transform
    const rect = container.getBoundingClientRect();
    const natW = img.naturalWidth || 2048;
    const natH = img.naturalHeight || 2048;
    
    // Fit the image into the container first (contain logic)
    const fitScale = Math.min(rect.width / natW, rect.height / natH);
    const baseW = natW * fitScale;
    const baseH = natH * fitScale;
    
    const scaledW = baseW * previewZoom.scale;
    const scaledH = baseH * previewZoom.scale;
    
    // Center offset
    const offsetX = (rect.width - baseW) / 2;
    const offsetY = (rect.height - baseH) / 2;
    
    // Clamp pan so image stays within container bounds
    // The image is positioned at (offsetX + panX, offsetY + panY) after centering
    // When scaled, it extends from (offsetX + panX) to (offsetX + panX + scaledW)
    // We want: offsetX + panX >= 0 AND offsetX + panX + scaledW <= rect.width
    // Solving: panX >= -offsetX AND panX <= rect.width - offsetX - scaledW
    const minPanX = -offsetX;
    const maxPanX = rect.width - offsetX - scaledW;
    const minPanY = -offsetY;
    const maxPanY = rect.height - offsetY - scaledH;
    previewZoom.panX = Math.max(minPanX, Math.min(maxPanX, previewZoom.panX));
    previewZoom.panY = Math.max(minPanY, Math.min(maxPanY, previewZoom.panY));
    
    img.style.objectFit = "none";
    img.style.width = `${baseW}px`;
    img.style.height = `${baseH}px`;
    img.style.position = "absolute";
    img.style.left = `0px`;
    img.style.top = `0px`;
    // Use translate to both center and pan. Center offset + user pan.
    const tx = offsetX + previewZoom.panX;
    const ty = offsetY + previewZoom.panY;
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${previewZoom.scale})`;
    img.style.transformOrigin = "center center";
    container.style.cursor = previewZoom.dragging ? "grabbing" : "grab";
  }
}

function previewZoomIn() {
  previewZoom.scale = Math.min(8, previewZoom.scale * 1.5);
  previewZoomApply();
  document.getElementById("previewZoomControls").style.display = "flex";
}

function previewZoomOut() {
  previewZoom.scale = Math.max(1, previewZoom.scale / 1.5);
  if (previewZoom.scale <= 1.01) { previewZoom.panX = 0; previewZoom.panY = 0; }
  previewZoomApply();
}

function previewZoomReset() {
  previewZoom.scale = 1; previewZoom.panX = 0; previewZoom.panY = 0;
  previewZoomApply();
  if (document.getElementById("previewImg").style.display !== "none") {
    document.getElementById("previewZoomControls").style.display = "flex";
  }
}

// Mouse wheel zoom on preview
(function initPreviewZoomPan() {
  const container = document.getElementById("previewZoomContainer");
  if (!container) return;

  container.addEventListener("wheel", (e) => {
    const img = document.getElementById("previewImg");
    if (!img || img.style.display === "none") return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.18;
    previewZoom.scale = Math.max(1, Math.min(8, previewZoom.scale * delta));
    if (previewZoom.scale <= 1.01) { previewZoom.panX = 0; previewZoom.panY = 0; }
    previewZoomApply();
    document.getElementById("previewZoomControls").style.display = "flex";
  }, { passive: false });

  container.addEventListener("mousedown", (e) => {
    if (previewZoom.scale <= 1.01) return;
    e.preventDefault();
    previewZoom.dragging = true;
    previewZoom.startX = e.clientX;
    previewZoom.startY = e.clientY;
    previewZoom.startPanX = previewZoom.panX;
    previewZoom.startPanY = previewZoom.panY;
    container.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!previewZoom.dragging) return;
    previewZoom.panX = previewZoom.startPanX + (e.clientX - previewZoom.startX);
    previewZoom.panY = previewZoom.startPanY + (e.clientY - previewZoom.startY);
    previewZoomApply();
  });

  window.addEventListener("mouseup", () => {
    if (previewZoom.dragging) {
      previewZoom.dragging = false;
      const container = document.getElementById("previewZoomContainer");
      if (container) container.style.cursor = "grab";
    }
  });
})();

// ─── Full-resolution preview loader (for zoom) ──────────────────────────────
async function loadFullResPreview(path) {
  try {
    dbg("[preview] Loading full-resolution preview for zoom…");
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, full: true }),
    });
    const data = await res.json();
    if (data.preview_b64) {
      const img = document.getElementById("previewImg");
      const fullSrc = `data:image/png;base64,${data.preview_b64}`;
      img.src = fullSrc;
      originalPreviewState.imgSrc = fullSrc;
      dbg("[preview] Full-res preview loaded");
    }
  } catch (e) {
    dbg(`[preview] Full-res load failed: ${e.message}`);
  }
}

async function openInExplorer(path) {
  if (!path) return;
  try {
    await fetch("/api/open-explorer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
  } catch (e) {
    console.error("Open in explorer failed:", e);
  }
}

// History detail preview actions
function showDetailPreviewActions() {
  const img = document.getElementById("detailPreviewImg");
  if (img.src) document.getElementById("detailPreviewActions").style.display = "flex";
}
function hideDetailPreviewActions() {
  document.getElementById("detailPreviewActions").style.display = "none";
}
async function copyDetailPreview() {
  const img = document.getElementById("detailPreviewImg");
  if (!img.src) return;
  try {
    const blob = await (await fetch(img.src)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    alert("✓ Image copied to clipboard");
  } catch (e) { alert("Failed to copy image"); }
}
function downloadDetailPreview() {
  if (!currentDetailItem || !currentDetailItem.path) return;
  downloadFileFromPath(currentDetailItem.path);
}

// Upscale preview actions
function showUpscaleSourceActions() {
  const img = document.getElementById("upscaleSourceImg");
  if (img.style.display !== "none" && img.src) document.getElementById("upscaleSourceActions").style.display = "flex";
}
function hideUpscaleSourceActions() {
  document.getElementById("upscaleSourceActions").style.display = "none";
}
function showUpscaleResultActions() {
  const img = document.getElementById("upscaleResultImg");
  if (img.style.display !== "none" && img.src) document.getElementById("upscaleResultActions").style.display = "flex";
}
function hideUpscaleResultActions() {
  document.getElementById("upscaleResultActions").style.display = "none";
}
async function copyUpscaleImg(which) {
  const imgId = which === "source" ? "upscaleSourceImg" : "upscaleResultImg";
  const img = document.getElementById(imgId);
  if (!img.src) return;
  try {
    const blob = await (await fetch(img.src)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showStatus("upscaleStatus", "success", "✓ Image copied to clipboard");
  } catch (e) { showStatus("upscaleStatus", "error", "Failed to copy image"); }
}
function downloadUpscaleResult() {
  if (!upscaleOutputPath) return;
  downloadFileFromPath(upscaleOutputPath, "upscaleStatus");
}

async function copyPreviewToClipboard() {
  const previewImg = document.getElementById("previewImg");
  if (!previewImg.src) return;

  try {
    const response = await fetch(previewImg.src);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob })
    ]);
    showStatus("statusBar", "success", "✓ Image copied to clipboard");
  } catch (e) {
    console.error("Copy failed:", e);
    showStatus("statusBar", "error", "Failed to copy image");
  }
}

function downloadPreview() {
  if (!lastGeneratedPath) {
    showStatus("statusBar", "error", "No generated livery to download.");
    return;
  }
  downloadFileFromPath(lastGeneratedPath, "statusBar");
}

// Generic helper: download an actual file via native save dialog
async function downloadFileFromPath(filePath, statusId) {
  if (!filePath) return;
  try {
    const res = await fetch("/api/download-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
    });
    const data = await res.json();
    if (data.error) {
      if (statusId) showStatus(statusId, "error", data.error);
    } else if (data.path) {
      if (statusId) showStatus(statusId, "success", "Saved: " + data.path.split(/[\\\/]/).pop());
    } else {
      if (statusId) showStatus(statusId, "error", "Save cancelled");
    }
  } catch (e) {
    if (statusId) showStatus(statusId, "error", "Download failed: " + e.message);
  }
}


// ─── Generate ─────────────────────────────────────────────────────────────────
async function generate() {
  if (state.generating) return;

  let prompt = document.getElementById("prompt").value.trim();
  const context = document.getElementById("context").value.trim();
  
  // Prepend context to prompt if context is provided
  if (context) {
    prompt = context + "\n\n" + prompt;
  }

  const carName = document.getElementById("carSelect").value;
  const autoDeploy = document.getElementById("autoDeploy").checked;
  const isFlashMode = currentModel === "flash";
  const upscaleResult = document.getElementById("upscaleResult")?.checked ?? false;

  // Fetch customer ID from saved config
  let customerId = "";
  try {
    const cfgRes = await fetch("/api/config");
    const cfg = await cfgRes.json();
    customerId = cfg.customer_id || "";
  } catch (e) { /* ignore, validation below will catch it */ }

  // Client-side validation
  if (!prompt) return showStatus("statusBar", "error", "Please enter a livery description.");
  const effectiveWireframe = state.wireframe_is_override ? state.wireframe_path : (state.car_wire_path || state.wireframe_path);
  const effectiveBase = state.base_is_override ? state.base_texture_path : (state.car_diffuse_path || state.base_texture_path);
  if (!effectiveWireframe) return showStatus("statusBar", "error", "Please select a car with a library wireframe, or upload a wireframe manually.");
  if (autoDeploy && !carName) return showStatus("statusBar", "error", "Please select a car.");
  if (autoDeploy && !customerId) return showStatus("statusBar", "error", "Customer ID not set — add it in Settings.");

  // Save to prompt history (use raw prompt without context prepend)
  await addPromptToHistory(document.getElementById("prompt").value.trim());

  // Lock UI
  state.generating = true;
  const btn = document.getElementById("btnGenerate");
  btn.disabled = true;
  btn.querySelector(".btn-text").textContent = "Generating…";
  btn.querySelector(".btn-spinner").style.display = "block";
  showStatus("statusBar", "loading", "Sending to Nano Banana " + (isFlashMode ? "Flash" : "Pro") + "… this takes 15–30 seconds." + (upscaleResult ? " Upscaling will run after." : ""));

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        wireframe_path: effectiveWireframe,
        base_texture_path: effectiveBase,
        reference_image_paths: state.reference_paths,
        reference_context: document.getElementById("referenceContext")?.value?.trim() || "",
        car_name: carName,
        customer_id: customerId,
        auto_deploy: autoDeploy,
        use_fast_model: isFlashMode,
        resolution_2k: isFlashMode ? document.getElementById("resolution2K").checked : true,
        mode: (currentMode === "modify" && iterateEnabled) ? "iterate" : currentMode,
        upscale_result: upscaleResult,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      showStatus("statusBar", "error", data.error || "Generation failed.");
      return;
    }

    // Show preview
    if (data.preview_b64) {
      const src = `data:image/png;base64,${data.preview_b64}`;
      document.getElementById("previewEmpty").style.display = "none";
      const img = document.getElementById("previewImg");
      img.src = src;
      img.style.display = "block";
      // Reset zoom state for new image
      previewZoom.scale = 1; previewZoom.panX = 0; previewZoom.panY = 0;
      previewZoomApply();
      // Reset hover-swap state so restoreLiveryPreview() returns to THIS new image
      originalPreviewState = { saved: true, emptyDisplay: "none", imgDisplay: "block", imgSrc: src };
      dbg("[generate] preview_b64 received, image set");

      // Load full-resolution preview in background for zoom
      if (data.generated_path) {
        loadFullResPreview(data.generated_path);
      }
    } else {
      dbg("[generate] WARNING: no preview_b64 in response");
    }

    // Show info chips
    document.getElementById("infoModel").textContent = data.model_used || "—";
    document.getElementById("infoDeployed").textContent = data.deployed_to
      ? data.car_folder || "Yes"
      : "Not deployed";

    // Store last generated path for deploy/iterate
    lastGeneratedPath = data.archive_path || data.generated_path || "";
    lastGenerateCarFolder = carName;

    // Show post-generate action buttons
    updatePreviewPostActions();

    // If iterate mode is active, auto-load result as base for next generation
    if (currentMode === "modify" && iterateEnabled && lastGeneratedPath) {
      state.base_texture_path = lastGeneratedPath;
      state.base_is_override = true;
      setFilePath("base", lastGeneratedPath);
    }

    // Success message
    let msg = "✓ Livery generated!";
    if (data.deployed_to) msg += ` Deployed to ${data.deployed_to.split(/[/\\]/).pop()}`;
    showStatus("statusBar", "success", msg);

    // Refresh recents chips
    if (carName) loadRecents();

    // Auto-capture iRacing preview window
    autoCapturAfterGenerate();

  } catch (e) {
    showStatus("statusBar", "error", `Request failed: ${e.message}`);
  } finally {
    state.generating = false;
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Generate Livery";
    btn.querySelector(".btn-spinner").style.display = "none";
  }
}


// ─── Deploy current preview to iRacing ────────────────────────────────────────
async function deployCurrentPreview() {
  if (!lastGeneratedPath) {
    showStatus("statusBar", "error", "No generated livery to deploy.");
    return;
  }
  const carName = lastGenerateCarFolder || document.getElementById("carSelect").value;
  if (!carName) {
    showStatus("statusBar", "error", "No car selected — pick a car first.");
    return;
  }
  try {
    showStatus("statusBar", "loading", "Deploying to iRacing…");
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: lastGeneratedPath, car_folder: carName }),
    });
    const data = await res.json();
    if (data.error) {
      showStatus("statusBar", "error", data.error);
    } else {
      showStatus("statusBar", "success", `✓ Deployed to ${data.deployed_to.split(/[/\\]/).pop()}`);
      autoCapturAfterGenerate();
    }
  } catch (e) {
    showStatus("statusBar", "error", `Deploy failed: ${e.message}`);
  }
}


// ─── Clear iRacing paint files ────────────────────────────────────────────────
async function clearIRacingPaint(type) {
  const carFolder = document.getElementById("carSelect").value;
  if (!carFolder) {
    showStatus("statusBar", "error", "Select a car first.");
    return;
  }
  const label = type === "spec" ? "spec map" : "texture";
  try {
    const res = await fetch("/api/clear-paint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, car_folder: carFolder }),
    });
    const data = await res.json();
    if (data.error) {
      showStatus("statusBar", "error", data.error);
    } else if (data.deleted) {
      showStatus("statusBar", "success", `✓ Cleared ${label}: ${data.deleted.split(/[/\\]/).pop()}`);
    } else {
      showStatus("statusBar", "success", `${label} was already clear.`);
    }
  } catch (e) {
    showStatus("statusBar", "error", `Failed to clear ${label}: ${e.message}`);
  }
}


// ─── Spending tracker ─────────────────────────────────────────────────────────
let _spendingHistoryItems = []; // Store for spending modal
let _historyItems = []; // Store for history card actions

function getCostFromMetadata(item) {
  /**
   * Get cost from stored estimated_cost field.
   * Uses the price stored at generation time for historical accuracy,
   * ensuring costs remain consistent even if pricing constants change later.
   */
  if (item.estimated_cost !== undefined && item.estimated_cost !== null) {
    return parseFloat(item.estimated_cost);
  }
  
  // Fallback: derive from model + resolution (for very old files without stored cost)
  const model = item.model || "Pro";
  const resolution = item.resolution || "2K";
  
  if (model === "Flash" && resolution === "1K") {
    return PRICING.flash_1k;
  } else if (model === "Flash" && resolution === "2K") {
    return PRICING.flash_2k;
  } else if (model === "Pro") {
    return PRICING.pro;
  } else {
    return PRICING.pro;
  }
}

function updateSpendingFromHistory(items) {
  _spendingHistoryItems = items; // Store for modal
  let total = 0;
  for (const item of items) {
    total += getCostFromMetadata(item);
  }
  const el = document.getElementById("spendingAmount");
  if (el) el.textContent = `$${total.toFixed(2)}`;
  const container = document.getElementById("spendingSummary");
  if (container) container.title = `Estimated API cost: $${total.toFixed(2)} (${items.length} generations)`;
}

function openSpendingModal() {
  const items = _spendingHistoryItems;

  // Calculate totals
  let grandTotal = 0;
  let proCount = 0, flashCount = 0;
  const byDay = {};

  for (const item of items) {
    const cost = getCostFromMetadata(item);
    grandTotal += cost;
    if (item.model === "Flash") flashCount++; else proCount++;

    let dateKey = "Unknown";
    if (item.generated_at) {
      const d = new Date(item.generated_at);
      dateKey = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } else if (item.modified) {
      const d = new Date(item.modified * 1000);
      dateKey = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    if (!byDay[dateKey]) byDay[dateKey] = { count: 0, cost: 0 };
    byDay[dateKey].count++;
    byDay[dateKey].cost += cost;
  }

  // Total summary (show both Flash and Pro counts)
  document.getElementById("spendingModalTotal").innerHTML =
    `<div class="spending-total-amount">$${grandTotal.toFixed(2)}</div>` +
    `<div class="spending-total-detail">${items.length} generations · ${proCount} Pro · ${flashCount} Flash</div>`;

  // Per-day table
  const tbody = document.getElementById("spendingModalTableBody");
  tbody.innerHTML = "";
  const sortedDays = Object.entries(byDay).sort((a, b) => {
    // Sort newest first; "Unknown" goes last
    if (a[0] === "Unknown") return 1;
    if (b[0] === "Unknown") return -1;
    return new Date(b[0]) - new Date(a[0]);
  });
  for (const [day, data] of sortedDays) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${day}</td><td>${data.count}</td><td>$${data.cost.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  }

  const spendingOverlay = document.getElementById("spendingModalOverlay");
  if (spendingOverlay) spendingOverlay.style.display = "flex";
}

function closeSpendingModal(e) {
  if (e && e.target !== e.currentTarget) return;
  const spendingOverlay = document.getElementById("spendingModalOverlay");
  if (spendingOverlay) spendingOverlay.style.display = "none";
}


// ─── History — with detail viewer ─────────────────────────────────────────────
async function loadHistory() {
  const grid = document.getElementById("historyGrid");
  try {
    const res = await fetch("/api/history");
    const items = await res.json();

    // Update spending tracker
    updateSpendingFromHistory(items);

    if (!items.length) {
      grid.innerHTML = '<div class="history-empty"><p>No liveries generated yet.</p></div>';
      return;
    }

    grid.innerHTML = "";
    _historyItems = []; // Reset for card action index lookups
    for (const item of items) {
      const card = document.createElement("div");
      card.className = "history-card";
      card.onclick = () => openHistoryDetail(item);

      // Format date
      let dateStr = "";
      if (item.generated_at) {
        const d = new Date(item.generated_at);
        dateStr = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
          + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      } else if (item.modified) {
        const d = new Date(item.modified * 1000);
        dateStr = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      }

      const modeBadge = item.mode === "modify"
        ? `<span class="history-badge history-badge--modify"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Modify</span>`
        : item.mode === "iterate"
        ? `<span class="history-badge history-badge--iterate"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> Iterate</span>`
        : `<span class="history-badge history-badge--new"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> New</span>`;

      const modelBadgeHtml = item.model
        ? `<span class="history-badge history-badge--model">${item.model}</span>` : "";

      const upscaledBadgeHtml = item.upscaled
        ? `<span class="history-badge history-badge--upscaled"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> 2K</span>` : "";

      const costBadgeHtml = item.estimated_cost
        ? `<span class="history-badge history-badge--cost">$${item.estimated_cost.toFixed(2)}</span>` : "";

      const carHtml = item.car
        ? `<div class="history-meta-row">${escapeHtml(item.car)}</div>` : "";

      const promptHtml = item.prompt
        ? `<div class="history-prompt" title="${escapeHtml(item.prompt)}">${escapeHtml(item.prompt)}</div>` : "";

      // Hover actions — full tray matching the preview action tray
      const cardIdx = _historyItems.length;
      _historyItems.push(item);
      const hoverActions = `
        <div class="history-card-actions">
          <button class="history-card-action" onclick="event.stopPropagation(); copyHistoryImage(this)" title="Copy to clipboard"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          <button class="history-card-action" onclick="event.stopPropagation(); historyCardDownload(${cardIdx})" title="Download TGA"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
          <button class="history-card-action" onclick="event.stopPropagation(); historyCardDeploy(${cardIdx})" title="Load in iRacing"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></button>
          <button class="history-card-action" onclick="event.stopPropagation(); historyCardExplorer(${cardIdx})" title="Show in Explorer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>
          <button class="history-card-action" onclick="event.stopPropagation(); historyCardModify(${cardIdx})" title="Modify"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="history-card-action history-card-action--danger" onclick="event.stopPropagation(); historyCardDelete(${cardIdx})" title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      `;

      card.innerHTML = `
        <div class="history-thumb">
          <span class="placeholder-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.2"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg></span>
          ${hoverActions}
        </div>
        <div class="history-info">
          <div class="history-badges">${modeBadge}${modelBadgeHtml}${upscaledBadgeHtml}${costBadgeHtml}</div>
          ${promptHtml}
          ${carHtml}
          <div class="history-meta-row history-date">${dateStr}</div>
        </div>
      `;
      grid.appendChild(card);

      // Lazy-load thumbnail — prefer preview JPG if available
      if (item.preview_jpg) {
        loadThumbnailFromJpg(card, item.preview_jpg);
      } else {
        loadThumbnail(card, item.path);
      }
    }
  } catch (e) {
    grid.innerHTML = '<div class="history-empty"><p>Failed to load history.</p></div>';
  }
}

async function loadThumbnailFromJpg(card, jpgPath) {
  try {
    const res = await fetch("/api/preview-jpg", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: jpgPath }),
    });
    const data = await res.json();
    if (data.preview_b64) {
      const thumb = card.querySelector(".history-thumb");
      thumb.querySelector(".placeholder-icon").style.display = "none";
      const img = document.createElement("img");
      img.src = `data:image/jpeg;base64,${data.preview_b64}`;
      img.alt = "Livery thumbnail";
      thumb.insertBefore(img, thumb.firstChild);
    }
  } catch (e) { /* ignore */ }
}

async function loadThumbnail(card, path) {
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.preview_b64) {
      const thumb = card.querySelector(".history-thumb");
      thumb.querySelector(".placeholder-icon").style.display = "none";
      const img = document.createElement("img");
      img.src = `data:image/png;base64,${data.preview_b64}`;
      img.alt = "Livery thumbnail";
      thumb.insertBefore(img, thumb.firstChild);
    }
  } catch (e) { /* ignore thumbnail failures */ }
}

async function quickDeployHistory(path, carFolder, customerId) {
  if (!carFolder) {
    alert("No car folder recorded for this livery. Cannot deploy.");
    return;
  }
  try {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, car_folder: carFolder, customer_id: customerId }),
    });
    const data = await res.json();
    if (data.error) alert(data.error);
  } catch (e) {
    alert(`Deploy failed: ${e.message}`);
  }
}

// Copy a history card's thumbnail image to clipboard
async function copyHistoryImage(btn) {
  const card = btn.closest(".history-card");
  const img = card ? card.querySelector(".history-thumb img") : null;
  if (!img || !img.src) { alert("No image to copy."); return; }
  try {
    const blob = await (await fetch(img.src)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  } catch (e) { alert("Failed to copy image"); }
}

// History card action helpers using index into _historyItems
function historyCardDownload(idx) {
  const item = _historyItems[idx];
  if (item) downloadFileFromPath(item.path);
}
function historyCardDeploy(idx) {
  const item = _historyItems[idx];
  if (item) quickDeployHistory(item.path, item.car_folder || '', item.customer_id || '');
}
function historyCardExplorer(idx) {
  const item = _historyItems[idx];
  if (item) openInExplorer(item.path);
}
function historyCardModify(idx) {
  const item = _historyItems[idx];
  if (item) modifyFromHistory(item.path, item.car_folder || '', item.wireframe_path || '');
}

// Switch to modify mode with a specific history item loaded as base
function modifyFromHistory(path, carFolder, wireframePath) {
  // Switch to generate tab
  document.querySelectorAll(".topbar-nav-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="generate"]').classList.add("active");
  document.getElementById("tab-generate").classList.add("active");

  // Set modify mode
  setMode("modify", true);

  // Load the image as the base texture
  state.base_texture_path = path;
  state.base_is_override = true;
  setFilePath("base", path);

  // Restore car and wireframe
  if (carFolder) document.getElementById("carSelect").value = carFolder;
  if (wireframePath) {
    state.wireframe_path = wireframePath;
    state.wireframe_is_override = true;
    setFilePath("wireframe", wireframePath);
  }

  document.getElementById("prompt").value = "";
  document.getElementById("prompt").focus();

  closeHistoryDetail();
}


// ─── History Detail Viewer ────────────────────────────────────────────────────
async function openHistoryDetail(item) {
  currentDetailItem = item;
  const overlay = document.getElementById("historyDetailOverlay");
  overlay.style.display = "flex";

  // Load preview
  const img = document.getElementById("detailPreviewImg");
  img.src = "";
  try {
    const endpoint = item.preview_jpg ? "/api/preview-jpg" : "/api/preview";
    const previewPath = item.preview_jpg || item.path;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: previewPath }),
    });
    const data = await res.json();
    if (data.preview_b64) {
      const mime = item.preview_jpg ? "image/jpeg" : "image/png";
      img.src = `data:${mime};base64,${data.preview_b64}`;
    }
  } catch (e) { /* ignore */ }

  // Badges
  const badges = document.getElementById("detailBadges");
  let badgesHtml = "";
  if (item.mode === "modify") badgesHtml += '<span class="history-badge history-badge--modify"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Modify</span>';
  else if (item.mode === "iterate") badgesHtml += '<span class="history-badge history-badge--iterate"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> Iterate</span>';
  else badgesHtml += '<span class="history-badge history-badge--new"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> New</span>';
  if (item.model) badgesHtml += `<span class="history-badge history-badge--model">${item.model}</span>`;
  if (item.upscaled) badgesHtml += '<span class="history-badge history-badge--upscaled"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> 2K</span>';
  if (item.estimated_cost) badgesHtml += `<span class="history-badge history-badge--cost">$${item.estimated_cost.toFixed(2)}</span>`;
  badges.innerHTML = badgesHtml;

  // Prompt
  document.getElementById("detailPrompt").textContent = item.prompt || "(no prompt recorded)";

  // Meta
  let metaHtml = "";
  if (item.car) metaHtml += `<div class="detail-meta-item"><strong>Car:</strong> ${escapeHtml(item.car)}</div>`;
  if (item.generated_at) {
    const d = new Date(item.generated_at);
    metaHtml += `<div class="detail-meta-item"><strong>Date:</strong> ${d.toLocaleString()}</div>`;
  }
  if (item.api_requests) metaHtml += `<div class="detail-meta-item"><strong>API Requests:</strong> ${item.api_requests}</div>`;
  if (item.estimated_cost) metaHtml += `<div class="detail-meta-item"><strong>Estimated Cost:</strong> $${item.estimated_cost.toFixed(4)}</div>`;
  if (item.cost_breakdown && Object.keys(item.cost_breakdown).length) {
    metaHtml += `<div class="detail-meta-item"><strong>Cost Breakdown:</strong></div>`;
    for (const [step, info] of Object.entries(item.cost_breakdown)) {
      metaHtml += `<div class="detail-meta-item detail-meta-indent">${escapeHtml(step)}: ${info.requests} req × ${info.model} = $${info.cost.toFixed(4)}</div>`;
    }
  }
  if (item.wireframe_path) metaHtml += `<div class="detail-meta-item"><strong>Wireframe:</strong> ${escapeHtml(item.wireframe_path.split(/[/\\]/).pop())}</div>`;
  if (item.base_texture_path) metaHtml += `<div class="detail-meta-item"><strong>Base:</strong> ${escapeHtml(item.base_texture_path.split(/[/\\]/).pop())}</div>`;
  if (item.customer_id) metaHtml += `<div class="detail-meta-item"><strong>Customer ID:</strong> ${item.customer_id}</div>`;
  metaHtml += `<div class="detail-meta-item"><strong>File:</strong> ${escapeHtml(item.filename)}</div>`;
  document.getElementById("detailMeta").innerHTML = metaHtml;

  // Render conversation log if available
  const convLogEl = document.getElementById("detailConversationLog");
  if (item.conversation_log) {
    const log = item.conversation_log;
    let convHtml = "";
    
    // User prompt section
    if (log.user_prompt) {
      convHtml += `<div class="log-section">`;
      convHtml += `<span class="log-label">User Prompt</span>`;
      convHtml += `<div>${escapeHtml(log.user_prompt)}</div>`;
      convHtml += `</div>`;
    }
    
    // Full system prompt section
    if (log.full_system_prompt) {
      convHtml += `<div class="log-section">`;
      convHtml += `<span class="log-label">Full System Prompt Sent to ${escapeHtml(log.model)}</span>`;
      convHtml += `<div>${escapeHtml(log.full_system_prompt)}</div>`;
      convHtml += `</div>`;
    }
    
    // Images sent
    if (log.images_sent) {
      convHtml += `<div class="log-section">`;
      convHtml += `<span class="log-label">Images Included</span>`;
      const imgs = [];
      if (log.images_sent.wireframe) imgs.push("Wireframe (UV guide)");
      if (log.images_sent.base_or_reference) imgs.push(log.images_sent.reference ? "Reference image" : "Base texture");
      convHtml += `<div>${imgs.join(", ")}</div>`;
      convHtml += `</div>`;
    }
    
    // Model response
    if (log.model_response) {
      convHtml += `<div class="log-section">`;
      convHtml += `<span class="log-label">Model Response</span>`;
      convHtml += `<div>${escapeHtml(log.model_response)}</div>`;
      convHtml += `</div>`;
    }
    
    convLogEl.innerHTML = convHtml;
  } else {
    convLogEl.innerHTML = `<p style="color: var(--text-muted);">No conversation log recorded for this generation.</p>`;
  }

  // Load JSON
  try {
    const res = await fetch("/api/history-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.path }),
    });
    const data = await res.json();
    document.getElementById("detailJson").textContent = JSON.stringify(data.raw || {}, null, 2);
  } catch (e) {
    document.getElementById("detailJson").textContent = "Failed to load JSON";
  }

  // Disable upscale button if GPU upscaling not available
  const detailUpscaleBtn = document.querySelector('.detail-action-btn[onclick="detailUpscale()"]');
  if (detailUpscaleBtn) {
    if (!capabilities.upscale_available) {
      detailUpscaleBtn.disabled = true;
      detailUpscaleBtn.title = "GPU upscaling unavailable — run start.bat --gpu to install";
      detailUpscaleBtn.style.opacity = "0.45";
    } else {
      detailUpscaleBtn.disabled = false;
      detailUpscaleBtn.title = "";
      detailUpscaleBtn.style.opacity = "";
    }
  }
}

function closeHistoryDetail(event) {
  if (event && event.target !== document.getElementById("historyDetailOverlay")) return;
  document.getElementById("historyDetailOverlay").style.display = "none";
  currentDetailItem = null;
}

async function detailDeployToIRacing() {
  if (!currentDetailItem) return;
  const item = currentDetailItem;
  if (!item.car_folder) {
    alert("No car folder recorded for this livery. Cannot deploy.");
    return;
  }
  try {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: item.path,
        car_folder: item.car_folder,
        customer_id: item.customer_id || "",
      }),
    });
    const data = await res.json();
    if (data.error) alert(data.error);
  } catch (e) {
    alert(`Deploy failed: ${e.message}`);
  }
}

function detailLoadSettings() {
  if (!currentDetailItem) return;
  const item = currentDetailItem;

  // Switch to generate tab
  document.querySelectorAll(".topbar-nav-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="generate"]').classList.add("active");
  document.getElementById("tab-generate").classList.add("active");

  // Restore settings
  if (item.prompt) document.getElementById("prompt").value = item.prompt;
  if (item.car_folder) document.getElementById("carSelect").value = item.car_folder;
  const restoredMode = (item.mode === "iterate") ? "modify" : (item.mode || "new");
  setMode(restoredMode, true);
  if (item.wireframe_path) {
    state.wireframe_path = item.wireframe_path;
    setFilePath("wireframe", item.wireframe_path);
  }
  if (item.base_texture_path) {
    state.base_texture_path = item.base_texture_path;
    setFilePath("base", item.base_texture_path);
  }

  // Persist
  fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      last_prompt: item.prompt || "",
      last_car: item.car_folder || "",
      last_mode: restoredMode,
    }),
  });

  closeHistoryDetail();
}

function detailIterate() {
  if (!currentDetailItem) return;
  const item = currentDetailItem;

  // Switch to generate tab
  document.querySelectorAll(".topbar-nav-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="generate"]').classList.add("active");
  document.getElementById("tab-generate").classList.add("active");

  // Set modify mode with iterate enabled
  setMode("modify", true);
  iterateEnabled = true;
  document.getElementById("iterateToggle").checked = true;

  // Load the generated image as the base texture
  state.base_texture_path = item.path;
  state.base_is_override = true;
  setFilePath("base", item.path);

  // Store as lastGeneratedPath so post-actions show correctly
  lastGeneratedPath = item.path;

  // Restore other settings
  if (item.car_folder) document.getElementById("carSelect").value = item.car_folder;
  if (item.wireframe_path) {
    state.wireframe_path = item.wireframe_path;
    state.wireframe_is_override = true;
    setFilePath("wireframe", item.wireframe_path);
  }

  // Clear prompt for new iteration instruction
  document.getElementById("prompt").value = "";
  document.getElementById("prompt").focus();

  updatePreviewPostActions();

  // Persist
  fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      last_prompt: "",
      last_car: item.car_folder || "",
      last_mode: "modify",
    }),
  });

  closeHistoryDetail();
}

function detailUpscale() {
  if (!currentDetailItem) return;
  loadIntoUpscaleTab(currentDetailItem.path);
  closeHistoryDetail();
}


// ─── Upscale Tab ──────────────────────────────────────────────────────────────
async function loadIntoUpscaleTab(path) {
  // Switch to upscale tab
  document.querySelectorAll(".topbar-nav-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="upscale"]').classList.add("active");
  document.getElementById("tab-upscale").classList.add("active");

  upscaleSourcePath = path;
  upscaleOutputPath = "";

  // Reset result
  document.getElementById("upscaleResultEmpty").style.display = "block";
  document.getElementById("upscaleResultImg").style.display = "none";
  document.getElementById("upscaleResultInfo").style.display = "none";

  // Load source preview
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.preview_b64) {
      document.getElementById("upscaleSourceEmpty").style.display = "none";
      const img = document.getElementById("upscaleSourceImg");
      img.src = `data:image/png;base64,${data.preview_b64}`;
      img.style.display = "block";
      document.getElementById("upscaleSourceInfo").style.display = "flex";
      document.getElementById("upscaleSourceSize").textContent = path.split(/[/\\]/).pop();
    }
  } catch (e) {
    console.error("Failed to load upscale source:", e);
  }

  // Enable upscale button
  document.getElementById("btnUpscale").disabled = false;
  document.getElementById("upscaleStatus").style.display = "none";
}

async function runUpscale() {
  if (!upscaleSourcePath) return;

  const btn = document.getElementById("btnUpscale");
  btn.disabled = true;
  btn.querySelector(".btn-text").textContent = "Upscaling…";
  btn.querySelector(".btn-spinner").style.display = "block";
  showStatus("upscaleStatus", "loading", "Running Real-ESRGAN upscale… this may take 10–30 seconds.");

  try {
    const res = await fetch("/api/upscale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: upscaleSourcePath }),
    });
    const data = await res.json();

    if (data.error) {
      showStatus("upscaleStatus", "error", data.error);
      return;
    }

    upscaleOutputPath = data.output_path;

    // Show result
    if (data.preview_b64) {
      document.getElementById("upscaleResultEmpty").style.display = "none";
      const img = document.getElementById("upscaleResultImg");
      img.src = `data:image/png;base64,${data.preview_b64}`;
      img.style.display = "block";
    }

    document.getElementById("upscaleResultInfo").style.display = "flex";
    document.getElementById("upscaleResultSize").textContent =
      data.size ? `${data.size[0]}×${data.size[1]}` : "2048×2048";

    showStatus("upscaleStatus", "success", `✓ Upscaled → ${data.output_path.split(/[/\\]/).pop()}`);
  } catch (e) {
    showStatus("upscaleStatus", "error", `Upscale failed: ${e.message}`);
  } finally {
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Upscale to 2048";
    btn.querySelector(".btn-spinner").style.display = "none";
  }
}

async function deployUpscaled() {
  if (!upscaleOutputPath) return;
  const carFolder = document.getElementById("carSelect")?.value;
  if (!carFolder) {
    alert("Select a car in the Generate tab first.");
    return;
  }
  try {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: upscaleOutputPath, car_folder: carFolder }),
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else alert(`✓ Deployed upscaled texture to iRacing: ${data.deployed_to.split(/[/\\]/).pop()}`);
  } catch (e) {
    alert(`Deploy failed: ${e.message}`);
  }
}


// ─── History (old preview function — kept for compatibility) ──────────────────
async function previewHistoryItem(path) {
  // Switch to generate tab and show preview
  document.querySelectorAll(".topbar-nav-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="generate"]').classList.add("active");
  document.getElementById("tab-generate").classList.add("active");

  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (data.preview_b64) {
      document.getElementById("previewEmpty").style.display = "none";
      const img = document.getElementById("previewImg");
      img.src = `data:image/png;base64,${data.preview_b64}`;
      img.style.display = "block";
    }
  } catch (e) {
    console.error("Preview failed:", e);
  }
}


// ─── Settings ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  // Refresh car list whenever the settings tab is opened
  loadCars();
  loadLibraryCars();
  try {
    const res = await fetch("/api/config");
    const cfg = await res.json();

    const keyInput = document.getElementById("settingsApiKey");
    if (cfg.gemini_api_key_set) {
      // Show masked value so it's obvious the key is saved — clear it to type a new one
      keyInput.value = cfg.gemini_api_key_masked;
      keyInput.placeholder = "";
      keyInput.dataset.masked = "true";
    } else {
      keyInput.value = "";
      keyInput.placeholder = "AIzaSy…";
      keyInput.dataset.masked = "false";
    }

    document.getElementById("settingsCustomerId").value = cfg.customer_id || "";
    if (cfg.data_dir) {
      state.dataDir = cfg.data_dir;
      const el = document.getElementById("dataDirPath");
      el.textContent = cfg.data_dir;
      el.classList.add("has-file");
      el.title = cfg.data_dir;
      document.getElementById("dataDirClear").style.display = "block";
    }

    if (cfg.default_wireframe) {
      state.settingsWireframe = cfg.default_wireframe;
      setFilePath("settingsWireframe", cfg.default_wireframe);
    }
    if (cfg.default_base_texture) {
      state.settingsBase = cfg.default_base_texture;
      setFilePath("settingsBase", cfg.default_base_texture);
    }

    // Pricing overrides
    const defaults = { price_flash_1k: 0.067, price_flash_2k: 0.101, price_pro: 0.134 };
    document.getElementById("settingsPriceFlash1k").value = cfg.price_flash_1k ?? defaults.price_flash_1k;
    document.getElementById("settingsPriceFlash2k").value = cfg.price_flash_2k ?? defaults.price_flash_2k;
    document.getElementById("settingsPricePro").value      = cfg.price_pro      ?? defaults.price_pro;
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}

async function saveSettings() {
  const keyInput = document.getElementById("settingsApiKey");
  const apiKey = keyInput.value.trim();
  const payload = {
    customer_id: document.getElementById("settingsCustomerId").value.trim(),
    data_dir: state.dataDir || "",
  };

  // Only include API key if user typed a real new key (not the masked display value)
  const isMasked = keyInput.dataset.masked === "true" && apiKey === keyInput.value.trim();
  if (apiKey && !isMasked && !apiKey.includes("…") && !apiKey.includes("•")) {
    payload.gemini_api_key = apiKey;
  }

  // Only include file paths if the user has actually set them in this session
  // (omitting them leaves any previously-saved value untouched)
  if (state.settingsWireframe) payload.default_wireframe = state.settingsWireframe;
  if (state.settingsBase)      payload.default_base_texture = state.settingsBase;

  // Pricing overrides — parse as floats, only include if valid positive numbers
  const pf1k = parseFloat(document.getElementById("settingsPriceFlash1k").value);
  const pf2k = parseFloat(document.getElementById("settingsPriceFlash2k").value);
  const ppro = parseFloat(document.getElementById("settingsPricePro").value);
  if (pf1k > 0) payload.price_flash_1k = pf1k;
  if (pf2k > 0) payload.price_flash_2k = pf2k;
  if (ppro > 0) payload.price_pro      = ppro;

  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showStatus("settingsStatus", "success", "Settings saved.");
      loadConfig();
    } else {
      showStatus("settingsStatus", "error", "Failed to save settings.");
    }
  } catch (e) {
    showStatus("settingsStatus", "error", `Error: ${e.message}`);
  }
}

function toggleApiKeyVisibility() {
  const input = document.getElementById("settingsApiKey");
  input.type = input.type === "password" ? "text" : "password";
}

function openExternal(url) {
  // In pywebview context, open in system browser
  window.open(url, "_blank");
}

// ─── Sponsors Tab ─────────────────────────────────────────────────────────────
const sponsorsState = {
  base_texture_path: "",
  wireframe_path: "",
  reference_path: "",
  logos: [],           // array of { path, name, thumb_b64 }
  generating: false,
  lastArchivePath: "",
  lastCarFolder: "",
};



// ─── Load sponsors form state on app start ───────────────────────────────────
async function loadSponsorsFormState() {
  try {
    const res = await fetch("/api/session");
    const data = await res.json();

    dbg(`[persist] loadSponsorsFormState() called`);

    // Restore file paths — session takes precedence
    if (data.sponsors_base_path) {
      sponsorsState.base_texture_path = data.sponsors_base_path;
      showSponsorsUploadSquareThumb("base", data.sponsors_base_path);
      dbg("[persist] ✓ sponsors_base_path restored from session");
    }

    if (data.sponsors_wireframe_path) {
      sponsorsState.wireframe_path = data.sponsors_wireframe_path;
      showSponsorsUploadSquareThumb("wireframe", data.sponsors_wireframe_path);
      dbg("[persist] ✓ sponsors_wireframe_path restored from session");
    }

    if (data.sponsors_reference_path) {
      sponsorsState.reference_path = data.sponsors_reference_path;
      showSponsorsUploadSquareThumb("reference", data.sponsors_reference_path);
      dbg("[persist] ✓ sponsors_reference_path restored from session");
    }
  } catch (e) {
    dbg(`[persist] ERROR loading sponsors session: ${e.message}`);
  }
}

async function pickSponsorsFile(type) {
  try {
    const res = await fetch("/api/pick-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_types: ["Image Files (*.png;*.jpg;*.jpeg;*.tga)"] }),
    });
    const data = await res.json();
    if (!data.path) return;
    applySponsorsUploadPath(type, data.path);
  } catch (e) {
    console.error("Sponsors file pick failed:", e);
  }
}

async function handleSponsorsUploadDrop(evt, type) {
  evt.preventDefault();
  evt.stopPropagation();
  const square = document.getElementById(`sponsors${type.charAt(0).toUpperCase() + type.slice(1)}Square`);
  if (square) square.classList.remove("drag-over");
  
  const files = evt.dataTransfer.files;
  if (files.length === 0) return;
  
  const file = files[0];
  try {
    const b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    const res = await fetch("/api/save-temp-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_b64: b64, filename: file.name }),
    });
    const data = await res.json();
    if (data.path) {
      applySponsorsUploadPath(type, data.path);
    }
  } catch (e) {
    console.error("Sponsors drag-drop failed:", e);
  }
}

function applySponsorsUploadPath(type, path) {
  const typeUpper = type.charAt(0).toUpperCase() + type.slice(1);
  const squareId = `sponsors${typeUpper}Square`;
  const imgId = `sponsors${typeUpper}SquareImg`;
  const emptyId = `sponsors${typeUpper}SquareEmpty`;
  const badgeId = `sponsors${typeUpper}SquareBadge`;
  const clearBtnId = `sponsors${typeUpper}ClearBtn`;
  
  if (type === "base") {
    sponsorsState.base_texture_path = path;
  } else if (type === "wireframe") {
    sponsorsState.wireframe_path = path;
  } else if (type === "reference") {
    sponsorsState.reference_path = path;
  }
  
  showSponsorsUploadSquareThumb(type, path);
  
  // Post to session for persistence
  fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [`sponsors_${type}_path`]: path }),
  });
}

function showSponsorsUploadSquareThumb(type, path) {
  const typeUpper = type.charAt(0).toUpperCase() + type.slice(1);
  const imgId = `sponsors${typeUpper}SquareImg`;
  const emptyId = `sponsors${typeUpper}SquareEmpty`;
  const badgeId = `sponsors${typeUpper}SquareBadge`;
  const clearBtnId = `sponsors${typeUpper}ClearBtn`;
  
  fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  })
  .then(r => r.json())
  .then(data => {
    if (data.preview_b64) {
      const img = document.getElementById(imgId);
      img.src = `data:image/png;base64,${data.preview_b64}`;
      img.style.display = "block";
      document.getElementById(emptyId).style.display = "none";
      document.getElementById(badgeId).style.display = "block";
      document.getElementById(badgeId).textContent = typeUpper;
      document.getElementById(clearBtnId).style.display = "block";
    }
  })
  .catch(e => console.error("Sponsors preview failed:", e));
}

function clearSponsorsUploadSquare(type) {
  const typeUpper = type.charAt(0).toUpperCase() + type.slice(1);
  const imgId = `sponsors${typeUpper}SquareImg`;
  const emptyId = `sponsors${typeUpper}SquareEmpty`;
  const badgeId = `sponsors${typeUpper}SquareBadge`;
  const clearBtnId = `sponsors${typeUpper}ClearBtn`;
  
  if (type === "base") {
    sponsorsState.base_texture_path = "";
  } else if (type === "wireframe") {
    sponsorsState.wireframe_path = "";
  } else if (type === "reference") {
    sponsorsState.reference_path = "";
  }
  
  const img = document.getElementById(imgId);
  img.style.display = "none";
  img.src = "";
  document.getElementById(emptyId).style.display = "block";
  document.getElementById(badgeId).style.display = "none";
  document.getElementById(clearBtnId).style.display = "none";
  
  // Clear from session
  fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [`sponsors_${type}_path`]: "" }),
  });
}

async function pickMultipleSponsorLogos() {
  try {
    // Open file picker with multiple-select support
    const res = await fetch("/api/pick-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        file_types: ["Image Files (*.png;*.jpg;*.jpeg)"],
        allow_multiple: true
      }),
    });
    const data = await res.json();
    if (!data.paths || data.paths.length === 0) return;

    // Add all selected files
    for (const path of data.paths) {
      const name = path.split(/[/\\]/).pop();
      const logo = { path, name, thumb_b64: null };
      sponsorsState.logos.push(logo);

      // Load thumbnail for each
      try {
        const prev = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        const pdata = await prev.json();
        if (pdata.preview_b64) {
          logo.thumb_b64 = pdata.preview_b64;
        }
      } catch (e) { /* thumb failed */ }
    }
    
    renderSponsorsLogoList();
    renderSponsorsThumbStrip();
  } catch (e) {
    console.error("Add sponsor logos failed:", e);
  }
}

function removeSponsorLogo(idx) {
  sponsorsState.logos.splice(idx, 1);
  renderSponsorsLogoList();
  renderSponsorsThumbStrip();
}

function renderSponsorsLogoList() {
  const list = document.getElementById("sponsorsLogosList");
  const empty = document.getElementById("sponsorsLogosEmpty");
  if (!sponsorsState.logos.length) {
    if (empty) empty.style.display = "block";
    list.querySelectorAll(".sponsor-logo-row").forEach(r => r.remove());
    return;
  }
  if (empty) empty.style.display = "none";

  // Rebuild rows
  list.querySelectorAll(".sponsor-logo-row").forEach(r => r.remove());
  sponsorsState.logos.forEach((logo, idx) => {
    const row = document.createElement("div");
    row.className = "sponsor-logo-row";
    row.innerHTML = `
      <div class="sponsor-logo-thumb">
        ${logo.thumb_b64
          ? `<img src="data:image/png;base64,${logo.thumb_b64}" alt="${escapeHtml(logo.name)}">`
          : `<span class="sponsor-logo-placeholder">🖼</span>`}
      </div>
      <span class="sponsor-logo-name" title="${escapeHtml(logo.path)}">${escapeHtml(logo.name)}</span>
      <span class="sponsor-logo-order">#${idx + 1}</span>
      <button class="settings-car-delete-btn" onclick="removeSponsorLogo(${idx})" title="Remove">✕</button>
    `;
    list.appendChild(row);
  });
}

function renderSponsorsThumbStrip() {
  const strip = document.getElementById("sponsorsThumbStrip");
  const inner = document.getElementById("sponsorsThumbStripInner");
  if (!sponsorsState.logos.length) { strip.style.display = "none"; return; }
  strip.style.display = "flex";
  inner.innerHTML = "";
  sponsorsState.logos.forEach(logo => {
    const wrap = document.createElement("div");
    wrap.className = "sponsors-thumb-item";
    wrap.title = logo.name;
    wrap.innerHTML = logo.thumb_b64
      ? `<img src="data:image/png;base64,${logo.thumb_b64}" alt="${escapeHtml(logo.name)}">`
      : `<span>\ud83d\uddbc</span>`;
    inner.appendChild(wrap);
  });
}

async function runSponsors() {
  if (sponsorsState.generating) return;

  if (!sponsorsState.base_texture_path) {
    showStatus("sponsorsStatus", "error", "Please select a base livery texture.");
    return;
  }
  if (!sponsorsState.logos.length) {
    showStatus("sponsorsStatus", "error", "Please add at least one sponsor logo.");
    return;
  }

  const carName   = document.getElementById("carSelect").value;
  const autoDeploy = document.getElementById("sponsorsAutoDeploy").checked;
  const fastMode   = document.getElementById("sponsorsFastMode").checked;
  const notes      = document.getElementById("sponsorsNotes").value.trim();

  if (autoDeploy && !carName) {
    showStatus("sponsorsStatus", "error", "Select a car for auto-deploy, or uncheck Auto-deploy.");
    return;
  }

  // Fetch customer ID
  let customerId = "";
  try {
    const cfgRes = await fetch("/api/config");
    const cfg = await cfgRes.json();
    customerId = cfg.customer_id || "";
  } catch (e) { /* ignore */ }
  if (autoDeploy && !customerId) {
    showStatus("sponsorsStatus", "error", "Customer ID not set — add it in Settings.");
    return;
  }

  sponsorsState.generating = true;
  const btn = document.getElementById("btnSponsors");
  btn.disabled = true;
  btn.querySelector(".btn-text").textContent = "Placing sponsors…";
  btn.querySelector(".btn-spinner").style.display = "block";
  const count = sponsorsState.logos.length;
  showStatus("sponsorsStatus", "loading",
    `Sending ${count} logo${count > 1 ? "s" : ""} to Nano Banana ${fastMode ? "2" : "Pro"}… this takes 20–40 seconds.`);

  try {
    const res = await fetch("/api/sponsors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_texture_path: sponsorsState.base_texture_path,
        wireframe_path: sponsorsState.wireframe_path || "",
        reference_path: sponsorsState.reference_path || "",
        sponsor_paths: sponsorsState.logos.map(l => l.path),
        notes,
        use_fast_model: fastMode,
        car_name: carName,
        customer_id: customerId,
        auto_deploy: autoDeploy,
      }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      showStatus("sponsorsStatus", "error", data.error || "Failed.");
      return;
    }

    // Show preview
    if (data.preview_b64) {
      document.getElementById("sponsorsPreviewEmpty").style.display = "none";
      const img = document.getElementById("sponsorsPreviewImg");
      img.src = `data:image/png;base64,${data.preview_b64}`;
      img.style.display = "block";
    }

    sponsorsState.lastArchivePath = data.archive_path || "";
    sponsorsState.lastCarFolder   = carName;

    document.getElementById("sponsorsPreviewInfo").style.display = "flex";
    document.getElementById("sponsorsInfoModel").textContent = data.model_used || "—";
    document.getElementById("sponsorsInfoDeployed").textContent = data.deployed_to
      ? (data.car_folder || "Yes") : "Not deployed";

    let msg = "✓ Sponsors placed!";
    if (data.deployed_to) msg += ` Deployed to ${data.deployed_to.split(/[/\\]/).pop()}`;
    showStatus("sponsorsStatus", "success", msg);

    // Auto-capture iRacing preview after sponsor placement
    autoCapturAfterGenerate();

    // Update spending tracker
    try {
      const hr = await fetch("/api/history");
      const hi = await hr.json();
      updateSpendingFromHistory(hi);
    } catch (e) { /* ignore */ }

  } catch (e) {
    showStatus("sponsorsStatus", "error", `Request failed: ${e.message}`);
  } finally {
    sponsorsState.generating = false;
    btn.disabled = false;
    btn.querySelector(".btn-text").textContent = "Place Sponsors";
    btn.querySelector(".btn-spinner").style.display = "none";
  }
}

function showSponsorsActions() {
  const img = document.getElementById("sponsorsPreviewImg");
  const actions = document.getElementById("sponsorsPreviewActions");
  if (img.style.display !== "none" && img.src) actions.style.display = "flex";
}
function hideSponsorsActions() {
  document.getElementById("sponsorsPreviewActions").style.display = "none";
}

async function copySponsorsPreview() {
  const img = document.getElementById("sponsorsPreviewImg");
  if (!img.src) return;
  try {
    const blob = await (await fetch(img.src)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showStatus("sponsorsStatus", "success", "✓ Image copied to clipboard");
  } catch (e) {
    showStatus("sponsorsStatus", "error", "Failed to copy image");
  }
}

function downloadSponsorsPreview() {
  const img = document.getElementById("sponsorsPreviewImg");
  if (!img.src) return;
  
  const src = img.src;
  const base64 = src.startsWith('data:') ? src.split(',')[1] : src;

  fetch("/api/save-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_b64: base64,
      filename: `sponsored-livery-${Date.now()}.png`,
    }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.path) {
        showStatus("sponsorsStatus", "success", "Saved: " + data.path.split(/[\\\/]/).pop());
      }
    })
    .catch(e => {});
}

async function deploySponsorsPreview() {
  if (!sponsorsState.lastArchivePath) {
    showStatus("sponsorsStatus", "error", "No result to deploy yet.");
    return;
  }
  if (!sponsorsState.lastCarFolder) {
    showStatus("sponsorsStatus", "error", "No car selected — select a car and run again.");
    return;
  }
  try {
    showStatus("sponsorsStatus", "loading", "Deploying to iRacing…");
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: sponsorsState.lastArchivePath, car_folder: sponsorsState.lastCarFolder }),
    });
    const data = await res.json();
    if (data.error) showStatus("sponsorsStatus", "error", data.error);
    else showStatus("sponsorsStatus", "success", `✓ Deployed to ${data.deployed_to.split(/[/\\]/).pop()}`);
  } catch (e) {
    showStatus("sponsorsStatus", "error", `Deploy failed: ${e.message}`);
  }
}

// Load a history item into the sponsors tab as the base texture
function detailAddSponsors() {
  if (!currentDetailItem) return;
  const item = currentDetailItem;

  // Switch to sponsors tab
  document.querySelectorAll(".topbar-nav-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="sponsors"]').classList.add("active");
  document.getElementById("tab-sponsors").classList.add("active");
  // Set base texture to this history item's TGA
  sponsorsState.base_texture_path = item.path;
  applySponsorsUploadPath("base", item.path);

  // Set wireframe if available
  if (item.wireframe_path) {
    sponsorsState.wireframe_path = item.wireframe_path;
    applySponsorsUploadPath("wireframe", item.wireframe_path);
  }

  // Set car in the main topbar selector
  if (item.car_folder) {
    document.getElementById("carSelect").value = item.car_folder;
  }

  closeHistoryDetail();
}

// ─── Delete livery ────────────────────────────────────────────────────────────
async function detailDeleteLivery() {
  if (!currentDetailItem) return;
  if (!confirm("Delete this livery permanently? This cannot be undone.")) return;
  try {
    const res = await fetch("/api/history/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: currentDetailItem.path }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    closeHistoryDetail();
    loadHistory();
  } catch (e) { alert("Failed to delete: " + e.message); }
}

async function historyCardDelete(idx) {
  const item = _historyItems[idx];
  if (!item) return;
  if (!confirm("Delete this livery permanently? This cannot be undone.")) return;
  try {
    const res = await fetch("/api/history/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: item.path }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    loadHistory();
  } catch (e) { alert("Failed to delete: " + e.message); }
}


// ─── Status Helper ────────────────────────────────────────────────────────────
function showStatus(id, type, message) {
  const bar = document.getElementById(id);
  bar.style.display = "flex";
  bar.className = `status-bar ${type}`;
  const icons = { success: "✓", error: "✗", loading: "⏳" };
  bar.querySelector(".status-icon").textContent = icons[type] || "";
  bar.querySelector(".status-text").textContent = message;

  // Auto-hide success after 5s
  if (type === "success") {
    setTimeout(() => { bar.style.display = "none"; }, 5000);
  }
}

// No-op: window capture removed
async function autoCapturAfterGenerate() {}
