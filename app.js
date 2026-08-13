// ALWAYS Use Actual Target App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbymA0CfeEuSx7_yetVi8gSxNDL9Zvbse30dHa9FsVPoa5zDZkipTwVlsHpKL7hooozvvg/exec'; 

// Added batches array to global state to hold Google Sheets data
let inventoryViewMode = 'table'; // Tracks which layout is active
let selectedInventoryKeys = new Set(); // ✅ Tracks selected cards across view toggles
let state = { inventory: [], groups: [], sales: [], trash: [], invoices: [], batches: [] };
let saleCart = [];
let masterPokemonDictionary = {};

const customPokemonDictionary = {
  "buusuta": "Flareon", "buusutaa": "Flareon", "bacyuru": "Joltik", "bachuru": "Joltik",
  "burakki": "Umbreon", "burakkii": "Umbreon", "rizaadon": "Charizard", "lizaadon": "Charizard",
  "kairyu": "Dragonite", "kairyuu": "Dragonite", "gekkouga": "Greninja", "myuutsuu": "Mewtwo",
  "myutsu": "Mewtwo", "pukachu": "Pikachu"
};

async function loadMasterDictionary() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv');
    const csvText = await response.text();
    const lines = csvText.split('\n');
    let tempMap = {}; 
    
    for(let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if(parts.length < 3) continue;
      const speciesId = parts[0];
      const langId = parts[1]; 
      const name = parts[2].replace(/"/g, '').trim();
      
      if (!tempMap[speciesId]) tempMap[speciesId] = {};
      if (langId === '9') tempMap[speciesId].en = name;                 
      if (langId === '2') tempMap[speciesId].romaji = name.toLowerCase(); 
      if (langId === '1') tempMap[speciesId].kana = name;             
      if (langId === '11') tempMap[speciesId].kanji = name;            
    }
    
    Object.values(tempMap).forEach(entry => {
      if (entry.en) {
        // ADD THIS LINE: Index the English name as a searchable key
        masterPokemonDictionary[entry.en.toLowerCase()] = entry.en; 
        
        if (entry.romaji) masterPokemonDictionary[entry.romaji] = entry.en;
        if (entry.kana) masterPokemonDictionary[entry.kana] = entry.en;
        if (entry.kanji) masterPokemonDictionary[entry.kanji] = entry.en;
      }
    });
  } catch (e) {
    console.error("Failed to load master dictionary", e);
  }
}

function toKatakana(str) {
  return str.replace(/[\u3041-\u3096]/g, function(match) {
    return String.fromCharCode(match.charCodeAt(0) + 0x60);
  });
}

function translatePokemonName(input) {
  if (!input) return input;
  const lowerInput = input.toLowerCase().trim();
  if (customPokemonDictionary[lowerInput]) return customPokemonDictionary[lowerInput];
  if (masterPokemonDictionary[lowerInput]) return masterPokemonDictionary[lowerInput];
  const katakanaInput = toKatakana(lowerInput);
  if (katakanaInput.length >= 2) {
    for (let key in masterPokemonDictionary) {
      if (key.includes(katakanaInput)) return masterPokemonDictionary[key];
    }
  }
  if (lowerInput.length >= 3) {
    for (let key in masterPokemonDictionary) {
      if (/^[a-z]+$/.test(key) && key.startsWith(lowerInput)) return masterPokemonDictionary[key];
    }
  }
  return input; 
}

let views, navItems, addCardsBody, modalOverlay, groupModal;

const conditionCriteria = {
  "Scratches": ["Light", "Moderate", "Heavy"],
  "Dents": ["Micro", "Minor", "Moderate", "Major"],
  "Marks": ["Light Surface", "Stain / Dirt", "Heavy Blemish"],
  "Whitening": ["Slight", "Moderate", "Heavy"],
  "Lifting / Peeling": ["Minor Edge", "Moderate", "Severe"],
  "Texture Loss": ["Slight", "Moderate", "Severe"],
  "Shining / Foil Wear": ["Faint", "Prominent"],
  "Print Lines": ["Faint", "Single", "Multiple", "Severe"],
  "Creases": ["Micro / Spider", "Minor", "Major"],
  "Perfect Centering": ["Yes"]
};

document.addEventListener('DOMContentLoaded', () => {
// 🤖 Inject the Auto FB Sync Button into Stage 2
    const loggerSelect = document.getElementById('logger-batch-select');
    if (loggerSelect) {
        const syncBtn = document.createElement('button');
        syncBtn.id = 'btn-sync-fb-bids';
        syncBtn.className = 'btn-outline';
        syncBtn.innerHTML = '🤖 Paste & Sync FB Bids';
        syncBtn.style.cssText = 'padding: 8px 12px; border-color: #a855f7; color: #a855f7; margin-left: 10px; cursor: pointer; border-radius: 6px; font-weight: bold;';
        
        syncBtn.addEventListener('click', async () => {
            const batchNo = loggerSelect.value;
            if (!batchNo) return alert('Please select a running batch first!');

            const pastedData = prompt('Paste the data you copied from the Facebook Bookmarklet here:');
            if (!pastedData) return;

            let rawComments;
            try {
                rawComments = JSON.parse(pastedData);
            } catch (e) {
                return alert('Invalid data format. Please make sure you pasted the exact text copied by the bookmarklet.');
            }

            const orig = syncBtn.innerHTML;
            syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
            syncBtn.disabled = true;

            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'autoSyncFBBids',
                        pass: sessionStorage.getItem('appPass'),
                        batchNo: batchNo,
                        rawComments: rawComments
                    })
                });
                const data = await res.json();
                
                if (data.success) {
                    alert('✅ Bids successfully synced! Refreshing table...');
                    await fetchData(); // Fetch latest data from database
                    loggerSelect.dispatchEvent(new Event('change')); // Reload the table visuals
                } else {
                    alert('❌ Database Error: ' + data.error);
                }
            } catch(e) {
                alert('❌ Network Error: ' + e.message);
            } finally {
                syncBtn.innerHTML = orig;
                syncBtn.disabled = false;
            }
        });
        
        // Place it right next to the batch selector dropdown
        loggerSelect.parentNode.insertBefore(syncBtn, loggerSelect.nextSibling);
    }
  views = document.querySelectorAll('.view');
  navItems = document.querySelectorAll('.nav-item');
  addCardsBody = document.getElementById('add-cards-body');
  modalOverlay = document.getElementById('modal-overlay');
  groupModal = document.getElementById('modal-group');
  
  setupThemeToggle();
  setupNavigation();
setupModals();
  setupSearchFilters(); 
  buildConditionModalUI();
  
  // ✅ NEW: Load draft if exists, otherwise add 10 empty rows
  if (!loadAddCardsDraft()) {
      addMultipleRows(10);
  }
  
  // ✅ NEW: Autosave every 1 second AND instantly when the page refreshes/closes
  setInterval(saveAddCardsDraft, 1000);
  window.addEventListener('beforeunload', saveAddCardsDraft);
  
  // ✅ UPDATED: Grid View Toggle Button Logic
  const btnToggleView = document.getElementById('btn-toggle-view');
  if (btnToggleView) {
      btnToggleView.addEventListener('click', (e) => {
          e.preventDefault(); // Stops the millisecond flicker/scroll jump
          e.stopPropagation();
          
          inventoryViewMode = inventoryViewMode === 'table' ? 'grid' : 'table';
          
          // Target the specific wrapper we just fixed in HTML
          const invTable = document.getElementById('inventory-table-wrapper');
          const gridContainer = document.getElementById('inventory-grid-container');
          
          if (inventoryViewMode === 'table') {
              e.currentTarget.innerHTML = '<i class="fas fa-th-large"></i> Grid View';
              if (invTable) invTable.style.display = 'block'; // Switched to block since it's a div wrapper
              if (gridContainer) gridContainer.style.display = 'none';
          } else {
              e.currentTarget.innerHTML = '<i class="fas fa-list"></i> Table View';
              if (invTable) invTable.style.display = 'none'; // Hides header + rows entirely
              if (gridContainer) gridContainer.style.display = 'grid';
          }
          
          // Re-render to draw the correct layout
          renderInventory(); 
      });
  }

  const mobileToggle = document.getElementById('mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggle) { mobileToggle.addEventListener('click', () => { sidebar.classList.toggle('open'); }); }
  document.addEventListener('click', (e) => { if (window.innerWidth <= 768 && sidebar.classList.contains('open')) { if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) sidebar.classList.remove('open'); } });

  const authScreen = document.getElementById('auth-screen');
  const authInput = document.getElementById('auth-password');
  const authBtn = document.getElementById('btn-login');
  const authErr = document.getElementById('auth-error');

  async function unlockDatabase() {
    const attemptedPass = authInput.value;
    if(!attemptedPass) return;
    authBtn.textContent = "Verifying...";
    authBtn.style.opacity = "0.7";
    authBtn.style.pointerEvents = "none";
    try {
      const res = await fetch(`${API_URL}?pass=${encodeURIComponent(attemptedPass)}`);
      const data = await res.json();
      if (data.error === "Unauthorized") {
        authErr.style.display = 'block'; authInput.value = ''; authBtn.textContent = "Unlock Database"; authBtn.style.opacity = "1"; authBtn.style.pointerEvents = "auto";
      } else {
        sessionStorage.setItem('appPass', attemptedPass);
        // ✅ NEW: Save data to Local Storage immediately upon login
        localStorage.setItem('pokemonInventoryCache', JSON.stringify(data)); 
        
        state.inventory = data.inventory || []; state.groups = data.groups || []; state.sales = data.sales || []; state.trash = data.trash || []; state.invoices = data.invoices || []; state.batches = data.batches || [];
        updateDashboard(); renderInventory(); renderGroups(); renderSales(); renderTrash(); loadMasterDictionary();
        refreshLoggerDropdown(); 
        authScreen.style.opacity = '0'; setTimeout(() => authScreen.style.display = 'none', 400);
      }
    } catch(err) {
      authErr.textContent = "Network error. Try again."; authErr.style.display = 'block'; authBtn.textContent = "Unlock Database"; authBtn.style.opacity = "1"; authBtn.style.pointerEvents = "auto";
    }
  }

  if (sessionStorage.getItem('appPass')) { authScreen.style.display = 'none'; fetchData(); loadMasterDictionary(); } else { authBtn.addEventListener('click', unlockDatabase); authInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlockDatabase(); }); }

  const recordSaleBtn = document.getElementById('btn-record-sale');
  if (recordSaleBtn) recordSaleBtn.addEventListener('click', openGlobalSaleSearchModal);
  document.addEventListener('click', () => { document.querySelectorAll('.action-dropdown').forEach(d => d.remove()); });

  // ✅ GLOBAL SCAN BUTTON LOGIC
  const btnGlobalScan = document.getElementById('btn-global-scan');
  const searchContainer = document.getElementById('global-scan-search-container');
  const searchInput = document.getElementById('global-scan-search-input');
  const datalist = document.getElementById('global-inventory-list');

  if (btnGlobalScan) {
      btnGlobalScan.addEventListener('click', () => {
          activeScanTarget = { type: 'global' };
          
          datalist.innerHTML = '';
          if (searchInput) searchInput.value = ''; 
          
          state.inventory.forEach(item => {
              const option = document.createElement('option');
              option.value = `${item.name} (${item.set || '-'} • ${item.rarity || '-'})`;
              option.dataset.id = item.id;
              datalist.appendChild(option);
          });
          
          if (searchContainer) searchContainer.style.display = 'block';
          openCameraModal();
      });
  }
});

/* ============================================================== */
/* CONDITION CHECKLIST MODAL LOGIC                                */
/* ============================================================== */
let currentConditionBtn = null;

function buildConditionModalUI() {
  const contentDiv = document.getElementById('condition-content');
  if (!contentDiv) return;
  
  let html = '';
  
  html += `<div class="side-panel"><div class="condition-title">Overall Grade</div>
           <div class="condition-grid" style="grid-template-columns: 1fr 1fr 1fr;">
             <label class="check-label"><input type="radio" name="overall-grade" value="M-NM"> Mint / Near Mint (M-NM)</label>
             <label class="check-label"><input type="radio" name="overall-grade" value="NM"> Near Mint (NM)</label>
             <label class="check-label"><input type="radio" name="overall-grade" value="Binder"> Binder</label>
           </div></div>`;

  ['Frontside', 'Backside'].forEach(side => {
      html += `<div class="side-panel"><div class="condition-title">${side} Checklist</div>`;
      for (const [category, options] of Object.entries(conditionCriteria)) {
          html += `<div class="condition-group"><div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px; font-weight: 500;">${category}</div><div class="condition-grid">`;
          options.forEach(opt => {
              const val = `${category}(${opt})`;
              html += `<label class="check-label"><input type="checkbox" data-side="${side}" value="${val}"> ${opt}</label>`;
          });
          html += `</div></div>`;
      }
      html += `</div>`;
  });
            
  contentDiv.innerHTML = html;

  document.getElementById('save-condition-btn').addEventListener('click', () => {
    if(!currentConditionBtn) return;
    const data = { front: [], back: [], grade: '' };
    
    document.querySelectorAll('#modal-condition input[type="checkbox"]:checked').forEach(chk => {
        if(chk.getAttribute('data-side') === 'Frontside') data.front.push(chk.value);
        if(chk.getAttribute('data-side') === 'Backside') data.back.push(chk.value);
    });
    
    const grade = document.querySelector('#modal-condition input[name="overall-grade"]:checked');
    if(grade) data.grade = grade.value;
    
    currentConditionBtn.setAttribute('data-cond', JSON.stringify(data));
    
    const count = data.front.length + data.back.length + (data.grade ? 1 : 0);
    if(count > 0) {
      currentConditionBtn.innerHTML = `✅ Set (${count})`;
      currentConditionBtn.style.color = 'var(--accent-yellow)';
      currentConditionBtn.style.borderColor = 'var(--accent-yellow)';
    } else {
      currentConditionBtn.innerHTML = `Set`;
      currentConditionBtn.style.color = '';
      currentConditionBtn.style.borderColor = '';
    }
    
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-condition').style.display = 'none';
  });
  
  document.getElementById('cancel-condition').addEventListener('click', () => {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modal-condition').style.display = 'none';
  });
}

function openConditionModal(btn) {
  currentConditionBtn = btn;
  const data = JSON.parse(btn.getAttribute('data-cond') || '{}');
  
  document.querySelectorAll('#modal-condition input[type="checkbox"]').forEach(chk => chk.checked = false);
  document.querySelectorAll('#modal-condition input[type="radio"]').forEach(rad => rad.checked = false);
  
  if(data.front) {
    data.front.forEach(val => {
       const cb = document.querySelector(`#modal-condition input[data-side="Frontside"][value="${val}"]`);
       if(cb) cb.checked = true;
    });
  }
  if(data.back) {
    data.back.forEach(val => {
       const cb = document.querySelector(`#modal-condition input[data-side="Backside"][value="${val}"]`);
       if(cb) cb.checked = true;
    });
  }
  if(data.grade) {
     const rad = document.querySelector(`#modal-condition input[name="overall-grade"][value="${data.grade}"]`);
     if(rad) rad.checked = true;
  }
  
  document.getElementById('modal-overlay').style.display = 'block';
  document.getElementById('modal-condition').style.display = 'flex';
}

function setupNavigation() {
  if (!navItems) return;
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault(); const target = item.getAttribute('data-target');
      navItems.forEach(n => n.classList.remove('active')); item.classList.add('active');
      views.forEach(v => v.classList.remove('active'));
      const targetView = document.getElementById(`view-${target}`); if (targetView) targetView.classList.add('active');
      refreshCurrentView(target);
      if (window.innerWidth <= 768) document.querySelector('.sidebar').classList.remove('open');
    });
  });
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle') || document.querySelector('.theme-toggle'); if (!themeToggle) return;
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'dark') { document.body.setAttribute('data-theme', 'dark'); document.body.classList.remove('light'); document.body.classList.add('dark'); themeToggle.innerHTML = '<i class="fas fa-moon"></i> Night'; } else { document.body.setAttribute('data-theme', 'light'); document.body.classList.remove('dark'); document.body.classList.add('light'); themeToggle.innerHTML = '<i class="fas fa-sun"></i> Day'; }
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark');
    if (isDark) { document.body.setAttribute('data-theme', 'light'); document.body.classList.remove('dark'); document.body.classList.add('light'); themeToggle.innerHTML = '<i class="fas fa-sun"></i> Day'; localStorage.setItem('theme', 'light'); } else { document.body.setAttribute('data-theme', 'dark'); document.body.classList.remove('light'); document.body.classList.add('dark'); themeToggle.innerHTML = '<i class="fas fa-moon"></i> Night'; localStorage.setItem('theme', 'dark'); }
  });
}

function setupSearchFilters() {
  const searchInput = document.getElementById('search-inventory'); 
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { renderInventory(); }, 300);
    });
  }
  const filterGroup = document.getElementById('filter-group'); const filterLang = document.getElementById('filter-lang'); const sortInventory = document.getElementById('sort-inventory');
  if (filterGroup) filterGroup.addEventListener('change', renderInventory); if (filterLang) filterLang.addEventListener('change', renderInventory); if (sortInventory) sortInventory.addEventListener('change', renderInventory);
}
async function fetchData() {
  const pass = sessionStorage.getItem('appPass'); if(!pass) return;
  
  // ✅ NEW 1. INSTANT LOAD: Check Local Storage first
  const savedLocalData = localStorage.getItem('pokemonInventoryCache');
  if (savedLocalData) {
    try {
      const data = JSON.parse(savedLocalData);
      state.inventory = data.inventory || []; state.groups = data.groups || []; state.sales = data.sales || []; state.trash = data.trash || []; state.invoices = data.invoices || []; state.batches = data.batches || [];
      updateDashboard(); renderInventory(); renderGroups(); renderSales(); renderTrash(); refreshLoggerDropdown();
      if (typeof updateInvoiceBatchList === 'function') { updateInvoiceBatchList(); updateInvoiceWinnerList(); }
      if (typeof renderInvoiceHistory === 'function') renderInvoiceHistory();
    } catch(e) { console.error("Error parsing local cache", e); }
  }

  // ✅ NEW 2. BACKGROUND FETCH: Get fresh data from Google Apps Script
  try {
    const res = await fetch(`${API_URL}?pass=${encodeURIComponent(pass)}`); 
    const data = await res.json(); 
    if(data.error) return; 
    
    // ✅ NEW 3. UPDATE CACHE: Save fresh data for the next reload
    localStorage.setItem('pokemonInventoryCache', JSON.stringify(data));
    
    // ✅ NEW 4. SILENT REFRESH: Apply the fresh data invisibly
    state.inventory = data.inventory || []; state.groups = data.groups || []; state.sales = data.sales || []; state.trash = data.trash || []; state.invoices = data.invoices || []; state.batches = data.batches || [];
    updateDashboard(); renderInventory(); renderGroups(); renderSales(); renderTrash(); refreshLoggerDropdown();
    if (typeof updateInvoiceBatchList === 'function') { updateInvoiceBatchList(); updateInvoiceWinnerList(); }
    if (typeof renderInvoiceHistory === 'function') renderInvoiceHistory();
  } catch(err) { console.error("Failed to fetch data", err); }
}

async function postData(action, payload) {
  const pass = sessionStorage.getItem('appPass'); if(!pass) return;
  try { const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, pass, ...payload }) }); const data = await res.json(); if(data.success) { await fetchData(); } else { alert("Google Sheets Error: " + data.error); } } catch(err) { console.error("Failed to save data", err); }
}

async function silentPostData(action, payload) {
  const pass = sessionStorage.getItem('appPass'); if(!pass) return;
  try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, pass, ...payload }) }); } catch(err) {}
}

function refreshCurrentView(view) { if (view === 'dashboard') updateDashboard(); if (view === 'inventory') renderInventory(); if (view === 'groups') renderGroups(); if (view === 'sold-cards') renderSales(); if (view === 'trash') renderTrash(); if (view === 'auction') { if (typeof updateInvoiceBatchList === 'function') { updateInvoiceBatchList(); updateInvoiceWinnerList(); } if (typeof renderInvoiceHistory === 'function') renderInvoiceHistory(); } }

function getCalculatedData() {
  let groupsMap = {};
  state.groups.forEach(g => { groupsMap[g.name] = { rate: Number(g.exchangerate || 0), shippingFee: Number(g.shippingfee || 0), totalCardsInGroup: 0, shippingDivider: 1 }; });
  let currentGroupStock = {};
  state.inventory.forEach(item => { if (groupsMap[item.group]) currentGroupStock[item.group] = (currentGroupStock[item.group] || 0) + Number(item.quantity || 0); });
  let maxGroupStock = JSON.parse(localStorage.getItem('maxGroupStock')) || {};
  Object.keys(groupsMap).forEach(group => { const currentStock = currentGroupStock[group] || 0; const historicalMax = maxGroupStock[group] || 0; if (currentStock > historicalMax) maxGroupStock[group] = currentStock; groupsMap[group].totalCardsInGroup = currentStock; groupsMap[group].shippingDivider = maxGroupStock[group] > 0 ? maxGroupStock[group] : 1; });
  localStorage.setItem('maxGroupStock', JSON.stringify(maxGroupStock));

  let mergedInventory = {}; let totalValueRp = 0; let totalValueYen = 0;
  let variantTracker = {}; // Tracks A, B, C variants per card type

  state.inventory.forEach(item => {
    // Master Key (Groups purely by Name, Set, and Rarity for the neat grid)
    const masterKey = `${item.name || ''}_${item.set || ''}_${item.rarity || ''}`.toLowerCase().trim();
    // Variant Key (Tracks the specific unique qualities)
    const baseVariantKey = `${item.name || ''}_${item.set || ''}_${item.rarity || ''}_${item.language || ''}_${item.condition || ''}`.toLowerCase().trim();
    
    const front = item.frontImage || item.frontimage || '';
    const back = item.backImage || item.backimage || '';
    const hasUniquePhoto = (front.length > 5 || back.length > 5);
    
   let uniqueHash = ''; let displaySuffix = '';
    if (hasUniquePhoto) {
        if (variantTracker[baseVariantKey] === undefined) variantTracker[baseVariantKey] = 1;
        const variantNum = variantTracker[baseVariantKey];
        variantTracker[baseVariantKey]++;
        uniqueHash = `_img_${item.id}`;
        displaySuffix = ` [${variantNum}]`;
    }
    
    const variantKey = baseVariantKey + uniqueHash; 
    const qty = Number(item.quantity || 0); const yenPrice = Number(item.yenprice || 0); const groupInfo = groupsMap[item.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 }; const basePriceRp = yenPrice * groupInfo.rate; const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0; const totalCostPerCard = basePriceRp + shippingPerCard;
    
    if (qty > 0) { totalValueYen += (yenPrice * qty); totalValueRp += (totalCostPerCard * qty); }
    
    if (!mergedInventory[masterKey]) { 
      mergedInventory[masterKey] = { id: item.id, name: item.name, set: item.set, cardNo: item.cardNo || item.cardno || '', rarity: item.rarity, language: item.language, condition: item.condition, conditionMedia: item.conditionMedia || item.conditionmedia || '{}', storage: item.storage, frontImage: front, backImage: back, quantity: 0, yenprice: 0, priceRp: 0, shippingAllocation: 0, totalCost: 0, group: item.group, sellPrice: Number(item.sellPrice || item.sellprice || 0), _rawItems: [], variants: {} }; 
    }
    
    mergedInventory[masterKey].quantity += qty; 
    mergedInventory[masterKey]._rawItems.push({ qty, yenPrice, basePriceRp, shippingPerCard, totalCostPerCard, group: item.group, storage: item.storage });

    // Store the specific variant
    if (!mergedInventory[masterKey].variants[variantKey]) {
        mergedInventory[masterKey].variants[variantKey] = { 
            ...item, 
            displayName: item.name + displaySuffix, 
            quantity: 0,
            totalCost: totalCostPerCard,
            sellPrice: Number(item.sellPrice || item.sellprice || 0)
        };
    }
    mergedInventory[masterKey].variants[variantKey].quantity += qty;
  });  

  Object.values(mergedInventory).forEach(mergedItem => {
    let totalYen = 0, totalBaseRp = 0, totalShipping = 0, totalCost = 0; let activeGroups = new Set(); let activeStorage = new Set(); let qtyToAverage = mergedItem.quantity;
    if (qtyToAverage === 0) { mergedItem._rawItems.forEach(raw => { totalYen += raw.yenPrice; totalBaseRp += raw.basePriceRp; totalShipping += raw.shippingPerCard; totalCost += raw.totalCostPerCard; if(raw.group) activeGroups.add(raw.group); if(raw.storage) activeStorage.add(raw.storage); }); qtyToAverage = mergedItem._rawItems.length || 1; } else { mergedItem._rawItems.forEach(raw => { if (raw.qty > 0) { totalYen += (raw.yenPrice * raw.qty); totalBaseRp += (raw.basePriceRp * raw.qty); totalShipping += (raw.shippingPerCard * raw.qty); totalCost += (raw.totalCostPerCard * raw.qty); if(raw.group) activeGroups.add(raw.group); if(raw.storage) activeStorage.add(raw.storage); } }); }
    mergedItem.yenprice = totalYen / qtyToAverage; mergedItem.priceRp = totalBaseRp / qtyToAverage; mergedItem.shippingAllocation = totalShipping / qtyToAverage; mergedItem.totalCost = totalCost / qtyToAverage;
    if (activeGroups.size > 1) mergedItem.group = Array.from(activeGroups).join(', '); else if (activeGroups.size === 1) mergedItem.group = Array.from(activeGroups)[0];
    if (activeStorage.size > 1) mergedItem.storage = Array.from(activeStorage).join(', '); else if (activeStorage.size === 1) mergedItem.storage = Array.from(activeStorage)[0]; else mergedItem.storage = '';
  });
  return { mergedList: Object.values(mergedInventory), totalValueRp, totalValueYen, groupsMap };
}function updateDashboard() {
  const calc = getCalculatedData();
  const totalQty = state.inventory.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  let totalSalesRevenue = 0; let totalCostOfSold = 0;
  state.sales.forEach(sale => { totalSalesRevenue += Number(sale.price || 0); const linkedCard = state.inventory.find(c => c.id === sale.cardid); if (linkedCard) { const groupInfo = calc.groupsMap[linkedCard.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 }; const basePriceRp = Number(linkedCard.yenprice || 0) * groupInfo.rate; const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0; totalCostOfSold += (basePriceRp + shippingPerCard) * Number(sale.quantity || 1); } });
  const netProfit = totalSalesRevenue - totalCostOfSold;
  
  const uniqueEl = document.getElementById('stat-unique'); const totalEl = document.getElementById('stat-total'); const rpEl = document.getElementById('stat-val-rp'); const yenEl = document.getElementById('stat-val-yen'); const soldEl = document.getElementById('stat-sold'); const profitEl = document.getElementById('stat-profit');
  if (uniqueEl) uniqueEl.textContent = calc.mergedList.filter(c => c.quantity > 0).length; if (totalEl) totalEl.textContent = totalQty; if (rpEl) rpEl.textContent = "Rp " + Math.round(calc.totalValueRp).toLocaleString('id-ID'); if (yenEl) yenEl.textContent = "¥" + calc.totalValueYen.toLocaleString('ja-JP'); if (soldEl) soldEl.textContent = state.sales.reduce((sum, s) => sum + Number(s.quantity || 0), 0); if (profitEl) profitEl.textContent = "Rp " + Math.round(netProfit).toLocaleString('id-ID');
  renderSalesMetricsChart();
}

function renderSalesMetricsChart() {
  let viewDashboard = document.getElementById('view-dashboard'); if (!viewDashboard) return;
  let chartPanel = document.getElementById('dashboard-analytics-chart-panel');
  if (!chartPanel) { chartPanel = document.createElement('div'); chartPanel.id = 'dashboard-analytics-chart-panel'; chartPanel.className = 'card-panel'; chartPanel.style.cssText = 'margin-top: 24px; padding: 24px; position: relative; border-radius: 12px; box-sizing: border-box; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);'; viewDashboard.appendChild(chartPanel); }
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; let operationalDistribution = {};
  for (let i = 11; i >= 0; i--) { let d = new Date(); d.setMonth(d.getMonth() - i); let key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`; operationalDistribution[key] = { label: `${monthLabels[d.getMonth()]} '${String(d.getFullYear()).substring(2,4)}`, revenue: 0, cards: 0 }; }
  if (state.sales && state.sales.length > 0) { state.sales.forEach(sale => { let sDate = new Date(sale.date || Date.now()); let key = `${sDate.getFullYear()}-${String(sDate.getMonth()).padStart(2, '0')}`; if (operationalDistribution[key]) { operationalDistribution[key].revenue += Number(sale.price || 0); operationalDistribution[key].cards += Number(sale.quantity || 0); } }); }
  const dataset = Object.values(operationalDistribution); let maxDataValue = Math.max(...dataset.map(item => item.revenue)); const maxRevenue = maxDataValue > 0 ? maxDataValue * 1.1 : 100000; 
  const formatCurrency = (val) => val >= 1000000 ? (val/1000000).toFixed(1).replace('.0','') + 'm' : (val/1000).toFixed(0) + 'k';
  let gridHTML = `<div style="position:absolute; top:0; left:55px; right:0; height:100%; display:flex; flex-direction:column; justify-content:space-between; z-index:0; pointer-events:none; padding-bottom: 24px; box-sizing: border-box;"><div style="border-top:1px dashed rgba(150,150,150,0.25); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">${formatCurrency(maxRevenue)}</span></div><div style="border-top:1px dashed rgba(150,150,150,0.25); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">${formatCurrency(maxRevenue * 0.75)}</span></div><div style="border-top:1px dashed rgba(150,150,150,0.25); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">${formatCurrency(maxRevenue * 0.5)}</span></div><div style="border-top:1px dashed rgba(150,150,150,0.25); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">${formatCurrency(maxRevenue * 0.25)}</span></div><div style="border-top:1px solid rgba(150,150,150,0.4); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">0</span></div></div>`;
  let barElementsHTML = '';
  dataset.forEach(point => { const proportionalHeight = (point.revenue / maxRevenue) * 100; const hasData = point.revenue > 0; barElementsHTML += `<div class="chart-column-node" style="flex:1; display:flex; flex-direction:column; align-items:center; position:relative; z-index:1; height: 100%; justify-content: flex-end;"><div class="chart-tooltip-bubble" style="opacity:0; pointer-events:none; position:absolute; bottom:calc(${proportionalHeight}% + 16px); background:var(--bg-surface); color:var(--text-primary); padding:8px 12px; border-radius:8px; font-size:12px; white-space:nowrap; box-shadow:0 10px 25px rgba(0,0,0,0.15); border:1px solid var(--border-color); text-align:center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); z-index:10; transform: translateY(10px);"><div style="font-weight:700; color:var(--accent-yellow); margin-bottom: 2px;">Rp ${Math.round(point.revenue).toLocaleString('id-ID')}</div><div style="color:inherit; opacity:0.7; font-size:11px;">${point.cards} Card(s) Sold</div></div><div class="chart-bar-fill" style="width:70%; max-width:40px; height:${Math.max(proportionalHeight, 1)}%; background:${hasData ? 'linear-gradient(to top, #ca8a04, #fde047)' : 'rgba(150,150,150,0.15)'}; border-radius:4px 4px 0 0; cursor:pointer; transition: all 0.2s ease; box-shadow: ${hasData ? '0 0 12px rgba(253,224,71,0.15)' : 'none'}; border: 1px solid ${hasData ? '#fef08a' : 'transparent'}; border-bottom: none;"></div><div style="margin-top:8px; font-size:11px; color:inherit; opacity:${hasData ? '0.9' : '0.5'}; font-weight:500; height: 16px;">${point.label}</div></div>`; });
  chartPanel.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;"><div><h3 style="margin-top:0; margin-bottom:4px; font-size:16px; color:inherit; opacity:0.9; display:flex; align-items:center; gap:8px;"><i class="fas fa-chart-line" style="color:var(--accent-yellow, #eab308);"></i> Revenue History (Last 12 Months)</h3><p style="color:inherit; opacity:0.6; font-size:12px; margin:0;">Hover over the columns to see detailed monthly metrics.</p></div></div><div style="position:relative; display:flex; height:240px; padding-left: 55px; align-items:flex-end;">${gridHTML}<div style="display:flex; width: 100%; height: calc(100% - 24px); position: relative; z-index: 1;">${barElementsHTML}</div></div>`;
  chartPanel.querySelectorAll('.chart-column-node').forEach(node => { const bubble = node.querySelector('.chart-tooltip-bubble'); const bar = node.querySelector('.chart-bar-fill'); node.addEventListener('mouseenter', () => { bubble.style.opacity = '1'; bubble.style.transform = 'translateY(0px)'; if (bar.style.height !== '1%') { bar.style.filter = 'brightness(1.15)'; bar.style.transform = 'scaleY(1.02)'; bar.style.transformOrigin = 'bottom'; } }); node.addEventListener('mouseleave', () => { bubble.style.opacity = '0'; bubble.style.transform = 'translateY(10px)'; if (bar.style.height !== '1%') { bar.style.filter = 'brightness(1)'; bar.style.transform = 'scaleY(1)'; } }); });
}

function setupModals() {
  const newGroupBtn1 = document.getElementById('btn-new-group'); const newGroupBtn2 = document.getElementById('btn-create-group-page');
  if (newGroupBtn1) newGroupBtn1.addEventListener('click', openGroupModal); if (newGroupBtn2) newGroupBtn2.addEventListener('click', openGroupModal);
  document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModal));
}
function openGroupModal() { if (modalOverlay && groupModal) { modalOverlay.style.display = 'block'; groupModal.style.display = 'block'; } }
function closeModal() { if (modalOverlay && groupModal) { modalOverlay.style.display = 'none'; groupModal.style.display = 'none'; } const saleModal = document.getElementById('modal-sale'); if (saleModal) saleModal.style.display = 'none'; }

const saveGroupBtn = document.getElementById('save-new-group');
if (saveGroupBtn) {
  saveGroupBtn.addEventListener('click', () => {
    const name = document.getElementById('new-group-name').value; 
    const rate = document.getElementById('new-group-rate').value; 
    const shipping = document.getElementById('new-group-shipping').value;
    
    if(name && rate && shipping) { 
      const newId = 'GRP_' + Date.now();
      
      // 1. INSTANT LOCAL UPDATE: Add to memory and refresh UI instantly
      state.groups.push({ id: newId, name: name, exchangerate: rate, shippingfee: shipping });
      renderGroups(); 
      
      // 2. SILENT SYNC & REFRESH: Send to Sheets and fetch fresh data in the background
      (async function backgroundSync() {
          await silentPostData('saveGroup', { id: newId, name: name, exchangeRate: rate, shippingFee: shipping });
          fetchData(); 
      })();
      
      // 3. CLEAN UP UI
      document.getElementById('new-group-name').value = ''; 
      document.getElementById('new-group-rate').value = ''; 
      document.getElementById('new-group-shipping').value = ''; 
      closeModal(); 
    } else { 
      alert("Please fill out all fields before saving."); 
    }
  });
}

const addRowBtn = document.getElementById('btn-add-row'); if (addRowBtn) addRowBtn.addEventListener('click', () => addMultipleRows(1));
const add10RowsBtn = document.getElementById('btn-add-10-rows'); if (add10RowsBtn) add10RowsBtn.addEventListener('click', () => addMultipleRows(10));
function addMultipleRows(count) { for(let i = 0; i < count; i++) addEmptyCardRow(); }


  function addEmptyCardRow() {
  if (!addCardsBody) return;
  const tr = document.createElement('tr');
  const count = addCardsBody.children.length + 1;
  
  tr.setAttribute('data-front-img', '');
  tr.setAttribute('data-back-img', '');

  tr.innerHTML = `
    <td data-label="#">${count}</td>
    <td data-label="Card Name"><input type="text" class="c-name" placeholder="Name" style="width: 100%; box-sizing: border-box;"></td>
    <td data-label="Set Code"><input type="text" class="c-set" placeholder="Set Code" list="pokemon-set-list" style="width: 100%; box-sizing: border-box;"></td>
    <td data-label="Card No."><input type="text" class="c-number" placeholder="038/090" style="width: 100%; box-sizing: border-box;"></td>
    <td data-label="Rarity"><select class="c-rarity" style="width: 100%; box-sizing: border-box;"><option value="" selected>—</option><option value="Promo">Promo</option><option value="C">C</option><option value="U">U</option><option value="R">R</option><option value="S">S</option><option value="RR">RR</option><option value="RRR">RRR</option><option value="AR">AR</option><option value="CHR">CHR</option><option value="SR">SR</option><option value="SSR">SSR</option><option value="SAR">SAR</option><option value="UR">UR</option><option value="MUR">MUR</option></select></td>
    <td data-label="Language"><select class="c-lang" style="width: 100%; box-sizing: border-box;"><option value="Japanese" selected>Japanese</option><option value="English">English</option><option value="Indonesian">Indonesian</option></select></td>
    <td data-label="Yen Price"><input type="text" class="c-yen" placeholder="0" inputmode="numeric" style="width: 100%; box-sizing: border-box;"></td>
    <td data-label="Qty"><input type="number" class="c-qty" value="1" min="1" max="999" style="width: 100%; box-sizing: border-box;"></td>
    <td data-label="Condition">
      <div style="display: flex; gap: 4px; justify-content: center;">
          <button type="button" class="btn-outline btn-set-cond" data-cond="{}" style="padding: 6px 10px; font-size: 12px;">Set</button>
          <button type="button" class="btn-outline btn-manage-media" data-media="{}" style="padding: 6px 10px; font-size: 12px;" title="Condition Media"><i class="fas fa-photo-video"></i></button>
      </div>
    </td>
    <td data-label="Notes"><input type="text" class="c-notes" placeholder="Notes" style="width: 100%; box-sizing: border-box;"></td>
    <td data-label="Action">
      <div style="display: flex; gap: 4px; justify-content: center;">
          <button type="button" class="btn-outline btn-row-scan" style="padding: 6px 10px; font-size: 12px; flex: 1;" title="Scan Card Photos"><i class="fas fa-camera"></i></button>
          <button type="button" class="btn-outline del-row" style="padding: 6px 10px; font-size: 12px; flex: 1; color: #ef4444;"><i class="fas fa-trash"></i></button>
      </div>
    </td>
  `;
  // Attach camera click target
  tr.querySelector('.btn-row-scan').addEventListener('click', () => {
      activeScanTarget = { type: 'new_row', element: tr };
      openCameraModal();
  });
  tr.addEventListener('click', (e) => {
    const isInteractive = ['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName) || e.target.closest('button');
    if (isInteractive) return;
    if (tr.classList.contains('expanded') && (e.target.getAttribute('contenteditable') === 'true' || e.target.closest('[contenteditable="true"]'))) return;
    if (window.innerWidth <= 768) tr.classList.toggle('expanded');
  });
  
  tr.querySelector('.btn-set-cond').addEventListener('click', (e) => {
     openConditionModal(e.currentTarget);
  });
  tr.querySelector('.btn-manage-media').addEventListener('click', (e) => {
     e.preventDefault();
     e.stopPropagation();
     openMediaModal(e.currentTarget);
  });
  
  const nameInput = tr.querySelector('.c-name');
  const applyTranslation = (e) => { if (e.isComposing) return; let originalText = e.target.value; let translatedText = translatePokemonName(originalText); if (originalText !== translatedText) { e.target.value = translatedText; e.target.style.transition = 'background-color 0.3s'; e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.2)'; setTimeout(() => e.target.style.backgroundColor = 'transparent', 300); } };
  nameInput.addEventListener('blur', applyTranslation); nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyTranslation(e); }); nameInput.addEventListener('compositionend', (e) => { setTimeout(() => applyTranslation(e), 50); });
  
  // Auto-format Yen Input with dots (e.g., 1.000.000)
  const yenInput = tr.querySelector('.c-yen');
  yenInput.addEventListener('input', function() {
      let rawValue = this.value.replace(/[^0-9]/g, '');
      if (rawValue !== '') {
          this.value = parseInt(rawValue, 10).toLocaleString('id-ID'); 
      } else {
          this.value = '';
      }
  });

  tr.querySelector('.del-row').addEventListener('click', () => { tr.remove(); reindexRows(); });
  addCardsBody.appendChild(tr);
}
function reindexRows() { if (!addCardsBody) return; const rows = addCardsBody.querySelectorAll('tr'); rows.forEach((row, idx) => { row.children[0].textContent = idx + 1; }); }

const saveCardsBtn = document.getElementById('btn-save-cards');
if (saveCardsBtn) {
  saveCardsBtn.addEventListener('click', () => {
    const group = document.getElementById('group-select').value; if(!group) return alert("Please select or create a group first.");
    const rows = addCardsBody.querySelectorAll('tr'); let cardsToSave = [];
    rows.forEach((row, index) => {
      const name = row.querySelector('.c-name').value.trim(); const yen = row.querySelector('.c-yen').value;
      const notesField = row.querySelector('.c-notes').value.trim();
      
      const condRaw = row.querySelector('.btn-set-cond').getAttribute('data-cond');
      const condParsed = JSON.parse(condRaw || '{}');
      const mediaBtn = row.querySelector('.btn-manage-media');
      const mediaRaw = mediaBtn ? mediaBtn.getAttribute('data-media') : '{}';
      let conditionString = '';
      if (condParsed.grade) conditionString += `[Grade: ${condParsed.grade}] `;
      if (condParsed.front && condParsed.front.length) conditionString += `Front: ${condParsed.front.join(', ')}. `;
      if (condParsed.back && condParsed.back.length) conditionString += `Back: ${condParsed.back.join(', ')}.`;
      
      const storageVal = document.getElementById('global-storage-input') ? document.getElementById('global-storage-input').value.trim() : '';
      if(name) { 
        cardsToSave.push({ 
            id: 'CARD_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 5), 
            group: group, 
            name: name, 
            set: row.querySelector('.c-set').value, 
            cardNo: row.querySelector('.c-number').value.trim(),
            rarity: row.querySelector('.c-rarity').value, 
            language: row.querySelector('.c-lang').value, 
            yenPrice: Number(yen.replace(/[^0-9]/g, '')) || 0, 
            quantity: row.querySelector('.c-qty').value || 1,
            condition: conditionString.trim(),
            conditionMedia: mediaRaw,
            storage: storageVal,
            notes: notesField,
            frontImage: row.getAttribute('data-front-img') || '',
            backImage: row.getAttribute('data-back-img') || ''
        }); 
      }
    });
    if(cardsToSave.length > 0) { 
        postData('saveCards', { cards: cardsToSave }); 
        addCardsBody.innerHTML = ''; 
        addMultipleRows(10); 
        localStorage.removeItem('unsavedCardsDraft'); // ✅ Clear draft after successful save
    } else { 
        alert("All rows are empty! Please enter at least one card name to save."); 
    }
  });
}

function getDirectImageUrl(url, size = 'w800') {
    if (!url) return '';
    // Extract the ID from either /view URLs or direct id= URLs
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        // Use the Google Drive thumbnail endpoint with a dynamic size parameter
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=${size}`;
    }
    return url;
}

function renderInventory() {
  const body = document.getElementById('inventory-body'); if(!body) return; body.innerHTML = '';
  const calc = getCalculatedData(); let filteredList = calc.mergedList;
  const searchInput = document.getElementById('search-inventory');
  if (searchInput) {
    const query = searchInput.value.toLowerCase().trim();
    if (query) { filteredList = filteredList.filter(card => { const cardName = String(card.name || '').toLowerCase().trim(); const cardSet = String(card.set || '').toLowerCase().trim(); const cardRarity = String(card.rarity || '').toLowerCase().trim(); const cardLoc = String(card.storage || '').toLowerCase().trim(); if (query.length <= 2) return cardName.startsWith(query) || cardLoc.startsWith(query); else return cardName.includes(query) || cardSet.includes(query) || cardRarity.includes(query) || cardLoc.includes(query); }); }
  }

  const groupVal = document.getElementById('filter-group').value; const langVal = document.getElementById('filter-lang').value;
  if (groupVal && !groupVal.toLowerCase().includes('all')) filteredList = filteredList.filter(c => c.group && String(c.group).toLowerCase().includes(groupVal.toLowerCase()));
  if (langVal && !langVal.toLowerCase().includes('all')) filteredList = filteredList.filter(c => c.language && String(c.language).toLowerCase() === langVal.toLowerCase());

  const sortVal = document.getElementById('sort-inventory') ? document.getElementById('sort-inventory').value : 'default';
  if (sortVal === 'az') filteredList.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))); 
  else if (sortVal === 'za') filteredList.sort((a, b) => String(b.name || '').localeCompare(String(a.name || ''))); 
  else if (sortVal === 'price-high') filteredList.sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0)); 
  else if (sortVal === 'price-low') filteredList.sort((a, b) => Number(a.totalCost || 0) - Number(b.totalCost || 0));
  else if (sortVal === 'num-asc') filteredList.sort((a, b) => String(a.cardNo || '').localeCompare(String(b.cardNo || ''), undefined, { numeric: true, sensitivity: 'base' }));
  else if (sortVal === 'num-desc') filteredList.sort((a, b) => String(b.cardNo || '').localeCompare(String(a.cardNo || ''), undefined, { numeric: true, sensitivity: 'base' }));

  const filteredQty = filteredList.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  const subtitle = document.getElementById('inventory-subtitle');
  if (subtitle) subtitle.textContent = `${filteredList.filter(c => c.quantity > 0).length} unique card(s) • ${filteredQty} total in stock`;

  if(filteredList.length === 0) { body.innerHTML = `<tr><td colspan="14" style="text-align:center; color: var(--text-secondary);">No matching cards found.</td></tr>`; return; }
  
  const rarityList = ['Promo', 'C', 'U', 'R', 'S', 'RR', 'RRR', 'AR', 'CHR', 'SR', 'SSR', 'SAR', 'UR', 'MUR'];
  const langList = ['Japanese', 'English', 'Indonesian'];
  
  const fragment = document.createDocumentFragment(); 
  const gridFragment = document.createDocumentFragment(); 
  const gridBody = document.getElementById('inventory-grid-container'); 
  if (gridBody) gridBody.innerHTML = ''; 

  // --- NEW: GRID "SELECT ALL" BAR ---
  if (inventoryViewMode === 'grid' && filteredList.length > 0) {
      const selectAllBar = document.createElement('div');
      selectAllBar.style.cssText = 'grid-column: 1 / -1; display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px;';
      selectAllBar.innerHTML = `
          <input type="checkbox" id="check-all-grid" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-yellow);">
          <label for="check-all-grid" style="cursor: pointer; font-weight: 600; color: var(--text-primary); font-size: 14px; user-select: none;">Select All ${filteredList.length} Cards</label>
      `;
      gridFragment.appendChild(selectAllBar);
  }
  // ----------------------------------

  filteredList.forEach(card => {    
    const qty = Number(card.quantity || 0); const isOutOfStock = qty <= 0; 
    const rowBg = isOutOfStock ? 'rgba(239, 68, 68, 0.12)' : 'transparent'; const textColor = isOutOfStock ? '#ef4444' : 'inherit';
    const qtyBg = isOutOfStock ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234,179,8,0.15)'; const qtyColor = isOutOfStock ? '#ef4444' : 'var(--accent-yellow)';
    const iconColor = isOutOfStock ? '#ef4444' : 'var(--text-secondary)';

    // ✅ NEW: Restore checked state if previously selected
    const cardKey = `${(card.name || '').trim().toLowerCase()}_${(card.set || '').trim().toLowerCase()}_${(card.rarity || '').trim().toLowerCase()}`;
    const isChecked = selectedInventoryKeys.has(cardKey) ? 'checked' : '';

    // ✅ GRID VIEW LOGIC
    if (inventoryViewMode === 'grid') {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        
        // Fetch a much smaller 300px thumbnail for the grid
        const frontImgUrl = getDirectImageUrl(card.frontImage || card.frontimage, 'w300') || 'https://via.placeholder.com/180x250/1e1e24/94a3b8?text=No+Image'; 
        
        // Dynamic Bottom-Right Badge
        let bottomRightBadge = '';
        if (Object.keys(card.variants || {}).length > 1) {
            bottomRightBadge = `<div class="btn-grid-variants" style="background:rgba(234,179,8,0.9); color:#000; font-size:10px; font-weight:bold; padding:4px 6px; border-radius:4px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 4px; white-space: nowrap; line-height: 1;"><i class="fas fa-layer-group"></i> ${Object.keys(card.variants).length} Vars</div>`;
        } else {
            let mediaCount = 0;
            try {
                const pMedia = JSON.parse(card.conditionMedia || '{}');
                mediaCount = (pMedia.video ? 1 : 0) + (pMedia.flaws?.length || 0);
            } catch(e) {}
            
            const rawMediaData = (card.conditionMedia || '{}').replace(/'/g, "&apos;").replace(/"/g, "&quot;");
            const badgeBg = mediaCount > 0 ? 'rgba(234,179,8,0.9)' : 'rgba(0,0,0,0.7)';
            const badgeColor = mediaCount > 0 ? '#000' : '#fff';
            
            bottomRightBadge = `<div class="btn-grid-media" data-id="${card.id}" data-media="${rawMediaData}" style="background:${badgeBg}; color:${badgeColor}; font-size:10px; font-weight:bold; padding:4px 6px; border-radius:4px; cursor:pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); transition: background 0.2s; display: flex; align-items: center; gap: 4px; white-space: nowrap; line-height: 1;"><i class="fas fa-photo-video"></i> ${mediaCount > 0 ? mediaCount : '+ Media'}</div>`;
        }
        
        gridItem.innerHTML = `
            <div style="position: relative; width: 100%; aspect-ratio: 0.72; background: #18181b; border-radius: 8px; overflow: hidden; margin-bottom: 10px; display: flex; align-items: center; justify-content: center;">
                
                <!-- Quick Scan Overlay Button -->
                <button type="button" class="btn-grid-scan" title="Scan / Update Card Photos" style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.65); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 3; transition: background 0.2s;">
                    <i class="fas fa-camera" style="font-size: 13px;"></i>
                </button>

                <!-- Checkbox for bulk actions -->
                <input type="checkbox" class="inv-check" data-name="${(card.name || '').replace(/"/g, '&quot;')}" data-set="${(card.set || '').replace(/"/g, '&quot;')}" data-rarity="${(card.rarity || '').replace(/"/g, '&quot;')}" style="position: absolute; top: 12px; right: 12px; z-index: 4; cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-yellow); box-shadow: 0 0 6px rgba(0,0,0,0.8); border-radius: 3px; outline: none;" ${isChecked}>
                
                <!-- ✅ FIXED: SOLD on bottom-left, Media on bottom-right -->
                ${isOutOfStock ? '<div style="position: absolute; bottom: 8px; left: 8px; background:#ef4444; color:white; font-size:9px; font-weight:bold; padding:4px 6px; border-radius:4px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 4; white-space: nowrap; line-height: 1;">SOLD</div>' : ''}
                
                <div style="position: absolute; bottom: 8px; right: 8px; z-index: 4;">
                    ${bottomRightBadge}
                </div>
                
                <img src="${frontImgUrl}" alt="${card.name}" class="grid-img" loading="lazy" decoding="async" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.src='https://placehold.co/180x250/1e1e24/94a3b8?text=No+Image'">
            </div>
            <div class="grid-title" style="color: ${textColor};">${card.name}</div>
            <div class="grid-set-rarity">${card.set || '—'} • ${card.rarity || '—'}</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:auto;">
                <div style="font-size:11px; color:var(--text-secondary);">Qty: <span style="background: ${qtyBg}; color: ${qtyColor}; padding: 2px 6px; border-radius: 4px; font-weight:600;">${qty}</span></div>
                <div class="grid-price">Rp ${Math.round(card.totalCost).toLocaleString('id-ID')}</div>
            </div>
        `;
        
        gridItem.querySelector('.btn-grid-scan').addEventListener('click', (e) => {
            e.stopPropagation();
            activeScanTarget = { type: 'inventory', card: card };
            openCameraModal();
        });

        const gridCheckbox = gridItem.querySelector('.inv-check');
        if (gridCheckbox) {
            gridCheckbox.addEventListener('click', (e) => e.stopPropagation());
        }

        const btnVariants = gridItem.querySelector('.btn-grid-variants');
        if (btnVariants) {
            btnVariants.addEventListener('click', (e) => {
                e.stopPropagation(); 
                openVariantModal(card.name, card.variants);
            });
        }
        
        const btnMedia = gridItem.querySelector('.btn-grid-media');
        if (btnMedia) {
            btnMedia.addEventListener('click', (e) => {
                e.stopPropagation();
                const overlay = document.getElementById('modal-overlay');
                const mediaModal = document.getElementById('modal-media-manager');
                const camModal = document.getElementById('modal-camera');
                
                if(overlay) overlay.style.zIndex = '10005';
                if(mediaModal) mediaModal.style.zIndex = '10010';
                if(camModal) camModal.style.zIndex = '10020';
                
                openMediaModal(e.currentTarget);
            });
        }

        gridItem.onclick = () => {
            if (typeof window.openImagePreview === 'function') {
                window.openImagePreview(card);
            }
        };
        
        gridFragment.appendChild(gridItem);
        return; 
    }

    // ✅ TABLE VIEW LOGIC
    const tr = document.createElement('tr');
    tr.style.backgroundColor = rowBg; tr.style.color = textColor;

    tr.addEventListener('click', (e) => {
      const isInteractive = ['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName) || e.target.closest('button');
      if (isInteractive) return;
      if (tr.classList.contains('expanded') && (e.target.getAttribute('contenteditable') === 'true' || e.target.closest('[contenteditable="true"]'))) return;
      if (window.innerWidth <= 768) tr.classList.toggle('expanded');
    });

    const rarityOpts = rarityList.map(r => `<option value="${r}">${r}</option>`).join('');
    const langOpts = langList.map(l => `<option value="${l}">${l}</option>`).join('');

    tr.innerHTML = `
      <td data-label="Select"><input type="checkbox" class="inv-check" data-name="${(card.name || '').replace(/"/g, '&quot;')}" data-set="${(card.set || '').replace(/"/g, '&quot;')}" data-rarity="${(card.rarity || '').replace(/"/g, '&quot;')}" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);" ${isChecked}></td>
      <td data-label="Card Name"><span class="editable-cell edit-name" contenteditable="true" title="Click to edit"><strong style="color:${textColor}">${card.name || '—'}</strong></span></td>
      <td data-label="Set" title="Click to edit Set"><input type="text" class="inline-edit-input edit-set" list="pokemon-set-list" value="${card.set || ''}" placeholder="—" style="width: 80px; background:transparent; color:inherit; border:1px dashed transparent; outline:none; padding:2px 4px; border-radius:4px; font-size:inherit;"></td>
      <td data-label="Card No."><span class="editable-cell edit-number" contenteditable="true" title="Click to edit">${card.cardNo || '—'}</span></td>
      <td data-label="Rarity" title="Click to change Rarity"><select class="inline-edit-select edit-rarity" style="width: auto; background:transparent; color:inherit; border:1px dashed transparent; outline:none; cursor:pointer; padding:2px 4px; border-radius:4px; font-size:inherit;"><option value="">—</option>${rarityOpts.replace(`value="${card.rarity}"`, `value="${card.rarity}" selected`)}</select></td>
      <td data-label="Language" title="Click to change Language"><select class="inline-edit-select edit-lang" style="width: auto; background:transparent; color:inherit; border:1px dashed transparent; outline:none; cursor:pointer; padding:2px 4px; border-radius:4px; font-size:inherit;"><option value="">—</option>${langOpts.replace(`value="${card.language}"`, `value="${card.language}" selected`)}</select></td>
      <td data-label="Qty"><span class="editable-cell edit-qty" contenteditable="true" title="Click to edit" style="background: ${qtyBg}; color: ${qtyColor}; padding: 2px 8px; border-radius: 4px; font-weight:600; display:inline-block;">${qty}</span></td>
      <td data-label="Condition">
    ${Object.keys(card.variants || {}).length > 1 ? 
      `<button type="button" class="btn-outline btn-table-variants" style="padding:4px 8px; font-size:11px; color:var(--accent-yellow); border-color:var(--accent-yellow); cursor:pointer;"><i class="fas fa-layer-group"></i> ${Object.keys(card.variants).length} Variants</button>` 
      : (() => {
          let mediaCount = 0;
          try {
              const pMedia = JSON.parse(card.conditionMedia || '{}');
              mediaCount = (pMedia.video ? 1 : 0) + (pMedia.flaws?.length || 0);
          } catch(e) {}
          return `
          <div style="display: flex; gap: 4px; align-items: center;">
              <span class="editable-cell edit-cond" contenteditable="true" title="Click to edit">${card.condition || '—'}</span>
              <button type="button" class="btn-outline btn-manage-media-edit" data-id="${card.id}" data-media='${card.conditionMedia || "{}"}' style="padding: 4px 8px; font-size: 11px; ${mediaCount > 0 ? 'color: var(--accent-yellow); border-color: var(--accent-yellow);' : ''}" title="Manage Media"><i class="fas fa-photo-video"></i> ${mediaCount > 0 ? `(${mediaCount})` : ''}</button>
          </div>
          `;
      })()
    }
  </td>
      <td data-label="Location"><span class="editable-cell edit-storage" contenteditable="true" title="Click to edit">${card.storage || '—'}</span></td>
      <td data-label="Base (¥)"><span class="editable-cell edit-yen" contenteditable="true" title="Click to edit">¥${Number(card.yenprice).toLocaleString('ja-JP')}</span></td>
      <td data-label="Base (Rp)">Rp ${Math.round(card.priceRp).toLocaleString('id-ID')}</td>
      <td data-label="Shipping">Rp ${Math.round(card.shippingAllocation).toLocaleString('id-ID')}</td>
      <td data-label="Total Cost"><strong>Rp ${Math.round(card.totalCost).toLocaleString('id-ID')}</strong></td>
      <td data-label="Group"><span style="color: ${iconColor};"><i class="fas fa-folder-open"></i> ${card.group || '—'}</span></td>
      <td data-label="Action"><div style="display: flex; gap: 4px; align-items: center; justify-content: flex-start;"><button class="btn-outline action-trigger" style="padding: 4px 8px; color: ${textColor};"><i class="fas fa-ellipsis-v"></i></button><button class="btn-outline btn-delete-card" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete card"><i class="fas fa-trash"></i></button></div></td>
    `;

    function saveRowData() {
      let rawNameVal = tr.querySelector('.edit-name').textContent.trim(); let translatedName = translatePokemonName(rawNameVal);
      if (rawNameVal !== translatedName) { rawNameVal = translatedName; tr.querySelector('.edit-name').innerHTML = `<strong style="color:${textColor}">${rawNameVal}</strong>`; }
      const nameVal = rawNameVal; const setVal = tr.querySelector('.edit-set').value.trim(); const numberVal = tr.querySelector('.edit-number').textContent.trim(); const rarityVal = tr.querySelector('.edit-rarity').value; const langVal = tr.querySelector('.edit-lang').value; const qtyVal = Number(tr.querySelector('.edit-qty').textContent.trim()) || 0; const yenVal = Number(tr.querySelector('.edit-yen').textContent.replace(/[¥,]/g, '').trim()) || 0;
      const condEl = tr.querySelector('.edit-cond'); const condVal = condEl ? condEl.textContent.trim() : card.condition; const storageVal = tr.querySelector('.edit-storage').textContent.trim();

      const finalName = nameVal === '—' ? '' : nameVal; const finalSet = setVal === '—' ? '' : setVal; const finalNumber = numberVal === '—' ? '' : numberVal; const finalRarity = rarityVal === '—' ? '' : rarityVal; const finalLang = langVal === '—' ? '' : langVal; const finalCond = condVal === '—' ? '' : condVal; const finalStorage = storageVal === '—' ? '' : storageVal;
      const oldQty = Number(card.quantity) || 0; const isQtyChanged = (qtyVal !== oldQty);
      const isDataChanged = (finalName !== (card.name || '') || finalSet !== (card.set || '') || finalNumber !== (card.cardNo || '') || finalRarity !== (card.rarity || '') || finalLang !== (card.language || '') || finalCond !== (card.condition || '') || finalStorage !== (card.storage || '') || yenVal !== card.yenprice);
      if (!isQtyChanged && !isDataChanged) return; 

      const searchName = String(card.name || '').toLowerCase().trim(); const searchSet = String(card.set || '').toLowerCase().trim(); const searchRarity = String(card.rarity || '').toLowerCase().trim(); const searchLang = String(card.language || '').toLowerCase().trim();
      const matchingCards = state.inventory.filter(c => String(c.name || '').toLowerCase().trim() === searchName && String(c.set || '').toLowerCase().trim() === searchSet && String(c.rarity || '').toLowerCase().trim() === searchRarity && String(c.language || '').toLowerCase().trim() === searchLang);
      let remainingQtyDiff = qtyVal - oldQty;

      matchingCards.forEach((item, index) => {
        if (isDataChanged) { item.name = finalName; item.set = finalSet; item.cardNo = finalNumber; item.rarity = finalRarity; item.language = finalLang; item.yenprice = yenVal; item.condition = finalCond; item.storage = finalStorage; }
        if (isQtyChanged) { if (remainingQtyDiff > 0) { if (index === 0) { item.quantity = Number(item.quantity || 0) + remainingQtyDiff; remainingQtyDiff = 0; } } else if (remainingQtyDiff < 0) { const currentItemQty = Number(item.quantity || 0); const deductAmt = Math.min(currentItemQty, Math.abs(remainingQtyDiff)); item.quantity = currentItemQty - deductAmt; remainingQtyDiff += deductAmt; } }
        silentPostData('updateCard', { id: item.id, name: item.name, set: item.set, cardNo: item.cardNo, rarity: item.rarity, language: item.language, group: item.group, yenPrice: item.yenprice, quantity: item.quantity, condition: item.condition, storage: item.storage, frontImage: item.frontImage || item.frontimage, backImage: item.backImage || item.backimage, sellPrice: item.sellPrice || '' });
      });
      updateDashboard(); renderInventory();
    }

    tr.querySelectorAll('.inline-edit-input').forEach(input => { input.addEventListener('mouseenter', () => input.style.border = '1px dashed var(--border-color)'); input.addEventListener('mouseleave', () => input.style.border = '1px dashed transparent'); input.addEventListener('change', saveRowData); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } }); });

    tr.querySelector('.btn-delete-card').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete ${card.name}?`)) {
        const searchName = String(card.name || '').toLowerCase().trim(); const searchSet = String(card.set || '').toLowerCase().trim(); const searchRarity = String(card.rarity || '').toLowerCase().trim();
        const cardsToDelete = state.inventory.filter(c => String(c.name || '').toLowerCase().trim() === searchName && String(c.set || '').toLowerCase().trim() === searchSet && String(c.rarity || '').toLowerCase().trim() === searchRarity);
        let maxGroupStock = JSON.parse(localStorage.getItem('maxGroupStock')) || {};
        cardsToDelete.forEach(cDel => { 
            const delQty = Number(cDel.quantity || 0); const groupName = cDel.group; 
            if (groupName && maxGroupStock[groupName]) { maxGroupStock[groupName] = Math.max(0, maxGroupStock[groupName] - delQty); } 
            state.inventory = state.inventory.filter(item => item.id !== cDel.id); 
            
            // SYNC IN BACKGROUND
            (async function backgroundSync() {
                await silentPostData('deleteCard', { id: cDel.id });
                fetchData();
            })();
        });
        localStorage.setItem('maxGroupStock', JSON.stringify(maxGroupStock)); updateDashboard(); renderInventory();
      }
    });
    const btnTableVariants = tr.querySelector('.btn-table-variants');
    if (btnTableVariants) {
        btnTableVariants.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.openVariantModal(card.name, card.variants);
        });
    }
const btnManageMediaEdit = tr.querySelector('.btn-manage-media-edit');
    if (btnManageMediaEdit) {
        btnManageMediaEdit.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openMediaModal(e.currentTarget);
        });
    }
    const actionBtn = tr.querySelector('.action-trigger');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation(); document.querySelectorAll('.action-dropdown').forEach(d => d.remove());
      const dropdown = document.createElement('div'); dropdown.className = 'action-dropdown'; dropdown.style.cssText = 'position: absolute; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 4px 0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); z-index: 1000; min-width: 140px; color: var(--text-primary);';
      const rect = actionBtn.getBoundingClientRect(); dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`; dropdown.style.left = `${rect.left + window.scrollX - 110}px`;
      dropdown.innerHTML = `<div class="dropdown-item dropdown-sale" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size:13px; font-weight:500;" ${qty <= 0 ? 'style="opacity:0.5; pointer-events:none;"' : ''}><i class="fas fa-money-bill-wave" style="color: #22c55e;"></i> Record Sale</div>`;
      const item = dropdown.querySelector('.dropdown-item'); item.addEventListener('mouseenter', () => item.style.background = 'rgba(128,128,128,0.1)'); item.addEventListener('mouseleave', () => item.style.background = 'transparent'); item.addEventListener('click', () => { dropdown.remove(); openSaleModal(card); }); document.body.appendChild(dropdown);
    });

    fragment.appendChild(tr);
  }); // ✅ THIS IS WHERE THE LOOP ACTUALLY CLOSES!

  // ✅ Append to the correct container based on active view (Safely OUTSIDE the loop)
  if (inventoryViewMode === 'table') {
      body.appendChild(fragment);
  } else if (gridBody) {
      gridBody.appendChild(gridFragment);
  }

  // --- BULK STORAGE MOVER LOGIC ---
  let checkAll = document.getElementById('check-all-inventory');
  let checkAllGrid = document.getElementById('check-all-grid'); // ✅ NEW
  const itemChecks = document.querySelectorAll('.inv-check');
  const bulkDiv = document.getElementById('bulk-storage-div');
  const bulkCountText = document.getElementById('bulk-storage-count');
  const bulkBtn = document.getElementById('btn-bulk-storage');
  const bulkInput = document.getElementById('bulk-storage-input');
  
  const btnExportGrid = document.getElementById('btn-export-grid');
  const btnExportZip = document.getElementById('btn-export-zip');

  // 1. DYNAMICALLY INJECT THE BULK DELETE BUTTON
  let bulkDeleteBtn = document.getElementById('btn-bulk-delete-inventory');
  if (bulkDiv && !bulkDeleteBtn && bulkBtn) {
      bulkDeleteBtn = document.createElement('button');
      bulkDeleteBtn.id = 'btn-bulk-delete-inventory';
      bulkDeleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
      bulkDeleteBtn.style.cssText = 'background: #ef4444; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; margin-left: 8px;';
      
      bulkBtn.parentNode.style.display = 'flex';
      bulkBtn.parentNode.insertBefore(bulkDeleteBtn, bulkBtn.nextSibling);
  }

  if (checkAll) {
      const newCheckAll = checkAll.cloneNode(true);
      checkAll.parentNode.replaceChild(newCheckAll, checkAll);
      checkAll = newCheckAll;
      checkAll.checked = false;
  }

  if (checkAllGrid) {
      checkAllGrid.checked = false;
  }

  if ((checkAll || checkAllGrid) && itemChecks && bulkDiv && bulkBtn) {
          function updateBulkUI() {
              const checkedCount = document.querySelectorAll('.inv-check:checked').length;
              if (checkedCount > 0) { bulkDiv.style.display = 'flex'; bulkCountText.textContent = checkedCount; } else { bulkDiv.style.display = 'none'; }
              const isAllChecked = (checkedCount === itemChecks.length && itemChecks.length > 0);
              if (checkAll) checkAll.checked = isAllChecked;
              if (checkAllGrid) checkAllGrid.checked = isAllChecked; // ✅ NEW
          }
          
          const handleCheckAll = (e) => { 
              itemChecks.forEach(chk => {
                  chk.checked = e.target.checked;
                  const key = `${(chk.getAttribute('data-name')||'').trim().toLowerCase()}_${(chk.getAttribute('data-set')||'').trim().toLowerCase()}_${(chk.getAttribute('data-rarity')||'').trim().toLowerCase()}`;
                  if (e.target.checked) selectedInventoryKeys.add(key);
                  else selectedInventoryKeys.delete(key);
              }); 
              updateBulkUI(); 
          };

          if (checkAll) checkAll.addEventListener('change', handleCheckAll);
          if (checkAllGrid) checkAllGrid.addEventListener('change', handleCheckAll);

          itemChecks.forEach(chk => chk.addEventListener('change', (e) => {
              const key = `${(chk.getAttribute('data-name')||'').trim().toLowerCase()}_${(chk.getAttribute('data-set')||'').trim().toLowerCase()}_${(chk.getAttribute('data-rarity')||'').trim().toLowerCase()}`;
              if (e.target.checked) selectedInventoryKeys.add(key);
              else selectedInventoryKeys.delete(key);
              updateBulkUI();
          }));

          // ✅ Force UI sync on render so the top bar accurately reflects the DOM
          updateBulkUI();
      const newBulkBtn = bulkBtn.cloneNode(true);
      bulkBtn.parentNode.replaceChild(newBulkBtn, bulkBtn);
      newBulkBtn.addEventListener('click', () => {
          const checkedBoxes = document.querySelectorAll('.inv-check:checked');
          const newStorage = bulkInput.value.trim();
          if (checkedBoxes.length === 0 || !newStorage) return alert('Please select cards and enter a new location name (e.g. "Box B").');

          const updates = [];
          checkedBoxes.forEach(chk => {
              const searchName = String(chk.getAttribute('data-name') || '').toLowerCase().trim();
              const searchSet = String(chk.getAttribute('data-set') || '').toLowerCase().trim();
              const searchRarity = String(chk.getAttribute('data-rarity') || '').toLowerCase().trim();

              state.inventory.forEach(c => {
                  if (String(c.name || '').toLowerCase().trim() === searchName && String(c.set || '').toLowerCase().trim() === searchSet && String(c.rarity || '').toLowerCase().trim() === searchRarity) {
                      c.storage = newStorage;
                      updates.push({ id: c.id, storage: newStorage });
                  }
              });
          });

              selectedInventoryKeys.clear(); // ✅ Clear selections after move
              updateDashboard(); renderInventory();
              bulkInput.value = '';

          (async function syncBulkStorage() {
              try {
                  await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'updateStorageBulk', pass: sessionStorage.getItem('appPass'), updates: updates }) });
              } catch(e) {}
          })();
      });

      if (btnExportGrid) {
          const newBtnGrid = btnExportGrid.cloneNode(true);
          btnExportGrid.parentNode.replaceChild(newBtnGrid, btnExportGrid);
          newBtnGrid.addEventListener('click', () => {
              const checkedBoxes = document.querySelectorAll('.inv-check:checked');
              const calc = getCalculatedData();
              const cardsToExport = Array.from(checkedBoxes).map(chk => {
                  const searchName = String(chk.getAttribute('data-name') || '').toLowerCase().trim();
                  const searchSet = String(chk.getAttribute('data-set') || '').toLowerCase().trim();
                  const searchRarity = String(chk.getAttribute('data-rarity') || '').toLowerCase().trim();
                  return calc.mergedList.find(c => 
                      String(c.name || '').toLowerCase().trim() === searchName && 
                      String(c.set || '').toLowerCase().trim() === searchSet && 
                      String(c.rarity || '').toLowerCase().trim() === searchRarity
                  );
              }).filter(c => c);

              const isWatermarked = document.getElementById('chk-watermark') ? document.getElementById('chk-watermark').checked : false;
              const includeBackside = document.getElementById('chk-include-back') ? document.getElementById('chk-include-back').checked : false;
              const stampPrices = document.getElementById('chk-stamp-prices') ? document.getElementById('chk-stamp-prices').checked : false;
              
              const hasMultipleVariants = cardsToExport.some(c => c.variants && Object.keys(c.variants).length > 1);

              if (stampPrices || hasMultipleVariants) {
                  openPricePreviewModal(cardsToExport, isWatermarked, includeBackside, stampPrices);
              } else {
                  generateCatalogExport(cardsToExport, 'grid', isWatermarked, includeBackside, false, false);
              }
          });
      }

      if (btnExportZip) {
          const newBtnZip = btnExportZip.cloneNode(true);
          btnExportZip.parentNode.replaceChild(newBtnZip, btnExportZip);
          newBtnZip.addEventListener('click', () => {
              const checkedBoxes = document.querySelectorAll('.inv-check:checked');
              const calc = getCalculatedData();
              const cardsToExport = Array.from(checkedBoxes).map(chk => {
                  const searchName = String(chk.getAttribute('data-name') || '').toLowerCase().trim();
                  const searchSet = String(chk.getAttribute('data-set') || '').toLowerCase().trim();
                  const searchRarity = String(chk.getAttribute('data-rarity') || '').toLowerCase().trim();
                  return calc.mergedList.find(c => 
                      String(c.name || '').toLowerCase().trim() === searchName && 
                      String(c.set || '').toLowerCase().trim() === searchSet && 
                      String(c.rarity || '').toLowerCase().trim() === searchRarity
                  );
              }).filter(c => c);
              const isWatermarked = document.getElementById('chk-watermark') ? document.getElementById('chk-watermark').checked : false;
              const includeBackside = document.getElementById('chk-include-back') ? document.getElementById('chk-include-back').checked : false;
              const stampPrices = document.getElementById('chk-stamp-prices') ? document.getElementById('chk-stamp-prices').checked : false;
              generateCatalogExport(cardsToExport, 'zip', isWatermarked, includeBackside, stampPrices);
          });
      }

      if (bulkDeleteBtn) {
          const newBulkDeleteBtn = bulkDeleteBtn.cloneNode(true);
          bulkDeleteBtn.parentNode.replaceChild(newBulkDeleteBtn, bulkDeleteBtn);
          
          newBulkDeleteBtn.addEventListener('click', () => {
              const checkedBoxes = document.querySelectorAll('.inv-check:checked');
              if (checkedBoxes.length === 0) return;

              if (confirm(`Are you sure you want to move the ${checkedBoxes.length} selected card group(s) to the Recycle Bin?`)) {
                  let maxGroupStock = JSON.parse(localStorage.getItem('maxGroupStock')) || {};
                  let allCardsToDelete = [];

                  checkedBoxes.forEach(chk => {
                      const searchName = String(chk.getAttribute('data-name') || '').toLowerCase().trim();
                      const searchSet = String(chk.getAttribute('data-set') || '').toLowerCase().trim();
                      const searchRarity = String(chk.getAttribute('data-rarity') || '').toLowerCase().trim();

                      const cardsToDelete = state.inventory.filter(c => 
                          String(c.name || '').toLowerCase().trim() === searchName && 
                          String(c.set || '').toLowerCase().trim() === searchSet && 
                          String(c.rarity || '').toLowerCase().trim() === searchRarity
                      );

                      cardsToDelete.forEach(cDel => {
                          const delQty = Number(cDel.quantity || 0);
                          const groupName = cDel.group;
                          if (groupName && maxGroupStock[groupName]) {
                              maxGroupStock[groupName] = Math.max(0, maxGroupStock[groupName] - delQty);
                          }
                          allCardsToDelete.push(cDel);
                      });
                  });

                  const idsToRemove = allCardsToDelete.map(c => c.id);
                  state.inventory = state.inventory.filter(item => !idsToRemove.includes(item.id));
                  localStorage.setItem('maxGroupStock', JSON.stringify(maxGroupStock));
                  
                  const now = new Date().toISOString();
                  allCardsToDelete.forEach((cDel, index) => {
                      state.trash.unshift({
                          id: 'TRASH_' + Date.now() + Math.floor(Math.random() * 1000) + index,
                          type: 'Card',
                          deletedAt: now,
                          payload: JSON.stringify(cDel)
                      });
                  });

                  selectedInventoryKeys.clear(); // ✅ Clear selections after delete
                  updateDashboard(); 
                  renderInventory();
                  renderTrash(); 

                  (async function syncBulkDelete() {
                      const btnOriginalHTML = newBulkDeleteBtn.innerHTML;
                      newBulkDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Moving...';
                      newBulkDeleteBtn.style.pointerEvents = 'none';

                      await silentPostData('deleteCardsBulk', { cardsToDelete: allCardsToDelete });
                      
                      fetchData(); 
                      
                      newBulkDeleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
                      newBulkDeleteBtn.style.pointerEvents = 'auto';
                  })();
              }
          });
      }
    }
}
function ensureSaleModalExists() {
  if (document.getElementById('modal-sale')) return;
  const modal = document.createElement('div'); modal.id = 'modal-sale'; modal.style.cssText = 'display:none; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);';
  modal.innerHTML = `
    <div style="background: var(--bg-surface); margin: 6% auto; padding: 24px; border: 1px solid var(--border-color); width: 90%; max-width: 680px; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); position:relative; max-height: 85vh; display: flex; flex-direction: column; color: var(--text-primary);">
      <h3 id="sale-modal-title" style="margin-top:0; margin-bottom:16px; font-size:18px;">💰 Record Sale</h3>
      <div id="select-card-section" style="margin-bottom:16px; position:relative !important; z-index: 100;">
        <label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Search & Add Cards to Sale</label>
        <input type="text" id="sale-search-inventory" placeholder="Type card name or set..." autocomplete="off" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box; margin-bottom:0;">
        <div id="sale-inventory-results" style="display:none; position:absolute; top:calc(100% + 4px); left:0; width:100%; max-height:180px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-surface); box-shadow: 0 10px 25px -3px rgba(0,0,0,0.3); z-index: 999999;"></div>
      </div>
      <div id="sale-cart-container" style="flex: 1; overflow-y: auto; margin-bottom: 16px; display: none; flex-direction: column; gap: 12px; padding-right: 4px;"></div>
      <div style="display:flex; gap:12px; margin-bottom:20px; margin-top: auto; flex-wrap:wrap;">
        <div style="flex:1; min-width: 120px;"><label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Date Sold</label><input type="date" id="sale-date" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box; color-scheme: inherit;"></div>
        <div style="flex:1.5; min-width: 150px;"><label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Buyer Name <span style="opacity:0.7;">(Fills Invoice)</span></label><input type="text" id="sale-buyer-name" placeholder="Leave blank for instant sale" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box;"></div>
        <div style="flex:2; min-width: 200px;"><label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Global Notes</label><input type="text" id="sale-notes" placeholder="e.g. Sold via marketplace" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box;"></div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px;"><button type="button" id="btn-close-sale" class="btn-outline" style="padding:10px 16px; border-radius:6px; cursor:pointer;">Cancel</button><button type="button" id="btn-submit-sale" style="padding:10px 16px; background:var(--accent-yellow, #eab308); color:#000; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Confirm Sale</button></div>
    </div>
  `;
  document.body.appendChild(modal);
  const resultsDiv = document.getElementById('sale-inventory-results'); const searchBox = document.getElementById('sale-search-inventory');
  document.getElementById('btn-close-sale').addEventListener('click', () => { modal.style.display = 'none'; if (resultsDiv) resultsDiv.style.display = 'none'; });
  document.getElementById('btn-submit-sale').addEventListener('click', submitSaleRecord);
  
  function handleSearchInput() {
    const q = searchBox.value.toLowerCase().trim();
    if (!q) { if (resultsDiv) { resultsDiv.style.display = 'none'; resultsDiv.innerHTML = ''; } return; }
    
    const availableCards = state.inventory.filter(c => {
        const stock = Number(c.quantity || 0);
        const cartItem = saleCart.find(item => item.id === c.id);
        const cartQty = cartItem ? Number(cartItem.qty) : 0;
        return stock > cartQty;
    });
    
    const matches = availableCards.filter(c => { const cardName = String(c.name || '').toLowerCase().trim(); const cardSet = String(c.set || '').toLowerCase().trim(); const cardRarity = String(c.rarity || '').toLowerCase().trim(); if (q.length <= 2) return cardName.startsWith(q); else return cardName.includes(q) || cardSet.includes(q) || cardRarity.includes(q); });
    if (!resultsDiv) return; if (matches.length === 0) { resultsDiv.innerHTML = '<div style="padding:10px 12px; color:var(--text-secondary); font-size:13px;">No available cards found</div>'; resultsDiv.style.display = 'block'; return; }
    
    resultsDiv.innerHTML = '';
    matches.forEach(card => {
      const calc = getCalculatedData(); const groupInfo = calc.groupsMap[card.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 }; const basePriceRp = (Number(card.yenprice||0) * groupInfo.rate); const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0; const costPerCard = basePriceRp + shippingPerCard;
      const itemEl = document.createElement('div'); itemEl.style.cssText = 'padding:10px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between;';
      itemEl.innerHTML = `<span><strong>${card.name}</strong> (${card.set || 'No Set'})</span> <span style="color:var(--accent-yellow);">Stock: ${card.quantity}</span>`;
      itemEl.addEventListener('mouseenter', () => itemEl.style.background = 'rgba(128,128,128,0.1)'); itemEl.addEventListener('mouseleave', () => itemEl.style.background = 'transparent');
      itemEl.addEventListener('mousedown', (ev) => { ev.preventDefault(); selectCardForSale(card, costPerCard); resultsDiv.style.display = 'none'; searchBox.value = ''; searchBox.focus(); });
      resultsDiv.appendChild(itemEl);
    });
    resultsDiv.style.display = 'block';
  }
  searchBox.addEventListener('input', handleSearchInput); searchBox.addEventListener('keyup', handleSearchInput); searchBox.addEventListener('blur', () => { setTimeout(() => { if (resultsDiv) resultsDiv.style.display = 'none'; }, 150); });
}
function renderSaleCart() {
  const container = document.getElementById('sale-cart-container'); if (!container) return; if (saleCart.length === 0) { container.style.display = 'none'; container.innerHTML = ''; return; }
  container.style.display = 'flex'; container.innerHTML = '';
  saleCart.forEach((item, index) => {
    const itemEl = document.createElement('div'); itemEl.style.cssText = 'padding:14px; border:1px solid var(--border-color); border-radius:8px; background: rgba(128,128,128,0.05); position: relative;'; const displayPrice = item.price ? 'Rp ' + Number(item.price).toLocaleString('id-ID') : '';
    itemEl.innerHTML = `<div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;"><strong style="font-size:14px;">${item.name} <span style="color:var(--text-secondary); font-weight:normal;">(${item.set || 'No Set'})</span></strong><button type="button" class="btn-remove-cart" data-index="${index}" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px;" title="Remove"><i class="fas fa-times"></i></button></div><div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; display:flex; gap:12px;"><span><i class="fas fa-box"></i> Stock: ${item.maxQty} pcs</span><span style="color:var(--accent-yellow);"><i class="fas fa-tag"></i> Base Cost: Rp ${Math.round(item.unitCost).toLocaleString('id-ID')}/pc</span></div><div style="display:flex; gap:12px; flex-wrap:wrap;"><div style="flex:1; min-width: 100px;"><label style="display:block; margin-bottom:6px; font-size:12px; color: var(--text-secondary);">Qty Sold</label><input type="number" class="cart-qty" data-index="${index}" value="${item.qty}" min="1" max="${item.maxQty}" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box;"></div><div style="flex:2; min-width: 180px;"><label style="display:block; margin-bottom:6px; font-size:12px; color: var(--text-secondary);">Total Selling Price</label><input type="text" class="cart-price" data-index="${index}" value="${displayPrice}" placeholder="e.g. Rp 75.000" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box;"></div></div>`; container.appendChild(itemEl);
  });
  container.querySelectorAll('.btn-remove-cart').forEach(btn => { btn.addEventListener('click', (e) => { const idx = e.currentTarget.getAttribute('data-index'); saleCart.splice(idx, 1); renderSaleCart(); }); });
  container.querySelectorAll('.cart-qty').forEach(input => { input.addEventListener('input', (e) => { const idx = e.target.getAttribute('data-index'); let val = Number(e.target.value); if (val > saleCart[idx].maxQty) { val = saleCart[idx].maxQty; e.target.value = val; } saleCart[idx].qty = val; }); });
  container.querySelectorAll('.cart-price').forEach(input => { input.addEventListener('input', (e) => { const idx = e.target.getAttribute('data-index'); let rawValue = e.target.value.replace(/[^0-9]/g, ''); saleCart[idx].price = Number(rawValue) || 0; if (rawValue) e.target.value = 'Rp ' + Number(rawValue).toLocaleString('id-ID'); else e.target.value = ''; }); });
}

function openGlobalSaleSearchModal() {
  ensureSaleModalExists(); saleCart = []; renderSaleCart(); document.getElementById('sale-modal-title').textContent = '💰 Record Bulk Sale'; document.getElementById('select-card-section').style.display = 'block'; document.getElementById('sale-search-inventory').value = ''; document.getElementById('sale-notes').value = '';
  const today = new Date(); const offset = today.getTimezoneOffset() * 60000; document.getElementById('sale-date').value = (new Date(today - offset)).toISOString().split('T')[0]; 
if(document.getElementById('sale-buyer-name')) document.getElementById('sale-buyer-name').value = '';
document.getElementById('modal-sale').style.display = 'block';
}

function openSaleModal(card) {
  ensureSaleModalExists(); saleCart = []; const calc = getCalculatedData(); const groupInfo = calc.groupsMap[card.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 }; const basePriceRp = (Number(card.yenprice||0) * groupInfo.rate); const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0; const costPerCard = basePriceRp + shippingPerCard;
  document.getElementById('sale-modal-title').textContent = `💰 Record Sale`; document.getElementById('select-card-section').style.display = 'block'; document.getElementById('sale-search-inventory').value = ''; document.getElementById('sale-notes').value = '';
  const today = new Date(); const offset = today.getTimezoneOffset() * 60000; document.getElementById('sale-date').value = (new Date(today - offset)).toISOString().split('T')[0];
  selectCardForSale(card, costPerCard); 
if(document.getElementById('sale-buyer-name')) document.getElementById('sale-buyer-name').value = '';
document.getElementById('modal-sale').style.display = 'block';
}

function selectCardForSale(card, costPerCard) { 
    const exists = saleCart.find(c => c.id === card.id); 
    if (!exists) { 
        saleCart.push({ id: card.id, name: card.name, set: card.set, rarity: card.rarity, maxQty: card.quantity, qty: 1, price: '', unitCost: costPerCard }); 
    } else {
        // FIX: Add +1 to the quantity if clicked again from the search menu
        if (exists.qty < exists.maxQty) {
            exists.qty++;
        }
    }
    renderSaleCart(); 
}

function submitSaleRecord() {
  if (saleCart.length === 0) return alert("Please add at least one card to the cart.");
  for (let i = 0; i < saleCart.length; i++) { const item = saleCart[i]; if (!item.price || item.qty <= 0) return alert(`Please enter a valid quantity and selling price for ${item.name}.`); if (item.qty > item.maxQty) return alert(`Insufficient stock for ${item.name}. You only have ${item.maxQty} pcs.`); }
  
  const notes = document.getElementById('sale-notes').value; 
  const dateInput = document.getElementById('sale-date').value; 
  const finalSaleDate = dateInput ? new Date(dateInput + 'T00:00:00').toISOString() : new Date().toISOString();
  const buyerName = document.getElementById('sale-buyer-name') ? document.getElementById('sale-buyer-name').value.trim() : '';

  if (buyerName) {
    // INVOICE ROUTE FOR DIRECT SALES
    let newInvoices = [];
    saleCart.forEach(cartItem => {
      let remainingQtyToSell = cartItem.qty; const searchName = String(cartItem.name || '').toLowerCase().trim(); const searchSet = String(cartItem.set || '').toLowerCase().trim(); const searchRarity = String(cartItem.rarity || '').toLowerCase().trim(); 
      const matchingCards = state.inventory.filter(c => String(c.name || '').toLowerCase().trim() === searchName && String(c.set || '').toLowerCase().trim() === searchSet && String(c.rarity || '').toLowerCase().trim() === searchRarity && Number(c.quantity) > 0);
      
      matchingCards.forEach(targetCard => {
        if (remainingQtyToSell <= 0) return; 
        const cardStock = Number(targetCard.quantity); 
        const qtyToDeduct = Math.min(cardStock, remainingQtyToSell); 
        
        // 1. Deduct stock immediately to reserve it for the invoice
        targetCard.quantity = cardStock - qtyToDeduct; 
        silentPostData('updateCard', { id: targetCard.id, name: targetCard.name, set: targetCard.set, rarity: targetCard.rarity, language: targetCard.language, group: targetCard.group, yenPrice: targetCard.yenprice, quantity: targetCard.quantity, condition: targetCard.condition, storage: targetCard.storage, frontImage: targetCard.frontImage || targetCard.frontimage, backImage: targetCard.backImage || targetCard.backimage });
        
        // 2. Create an invoice row for each piece of quantity so it matches the auction format
        const pricePerUnit = cartItem.price / cartItem.qty;
        for(let i = 0; i < qtyToDeduct; i++) {
           const newInvoice = {
             id: 'INV_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
             batch: 'Direct Sales',
             cardId: targetCard.id, cardName: targetCard.name, set: targetCard.set, cardNo: targetCard.cardNo, rarity: targetCard.rarity,
             winner: buyerName, price: pricePerUnit, evidence: 'Direct Sale', payment: '', courier: '', insurance: 'No', shipFee: 0, toploaderQty: 0, address: '', resi: '', status: 'Unpaid', date: finalSaleDate
           };
           newInvoices.push(newInvoice);
           state.invoices.push(newInvoice);
        }
        remainingQtyToSell -= qtyToDeduct;
      });
    });

    document.getElementById('modal-sale').style.display = 'none'; 
    saleCart = []; 
    renderInventory(); 
    updateDashboard();
    if (typeof updateInvoiceBatchList === 'function') updateInvoiceBatchList();
    if (typeof renderInvoiceHistory === 'function') renderInvoiceHistory();
    
    postData('saveInvoices', { invoices: newInvoices }).then(() => {
        alert(`Invoice draft created!\n\nAdded to Invoice Manager under batch "Direct Sales" for buyer: ${buyerName}`);
    });

  } else {
    // NORMAL INSTANT SALE ROUTE (Leaves Stock Deduction to the Backend)
    saleCart.forEach(cartItem => {
      let remainingQtyToSell = cartItem.qty; const searchName = String(cartItem.name || '').toLowerCase().trim(); const searchSet = String(cartItem.set || '').toLowerCase().trim(); const searchRarity = String(cartItem.rarity || '').toLowerCase().trim(); 
      const matchingCards = state.inventory.filter(c => String(c.name || '').toLowerCase().trim() === searchName && String(c.set || '').toLowerCase().trim() === searchSet && String(c.rarity || '').toLowerCase().trim() === searchRarity && Number(c.quantity) > 0);
      matchingCards.forEach(targetCard => {
        if (remainingQtyToSell <= 0) return; const cardStock = Number(targetCard.quantity); const qtyToDeductFromThisCard = Math.min(cardStock, remainingQtyToSell); targetCard.quantity = cardStock - qtyToDeductFromThisCard; const splitSalePrice = (cartItem.price / cartItem.qty) * qtyToDeductFromThisCard;
        
        const saleRecord = { date: finalSaleDate, cardid: targetCard.id, name: targetCard.name, set: targetCard.set, cardNo: targetCard.cardNo, rarity: targetCard.rarity, quantity: qtyToDeductFromThisCard, price: splitSalePrice, notes: notes };
        state.sales.push(saleRecord);
        remainingQtyToSell -= qtyToDeductFromThisCard;
        
        // SYNC IN BACKGROUND
        (async function backgroundSync() {
            await silentPostData('recordSale', { ...saleRecord, cardId: targetCard.id, deductStock: true });
            fetchData();
        })();
      });
    });
    document.getElementById('modal-sale').style.display = 'none'; saleCart = []; renderInventory(); renderSales(); updateDashboard();
  }
}

function updateSoldCardsStatsAndCharts(filteredSales) {
  let totalRev = 0; let totalProfit = 0; let cardsSold = 0; const calc = getCalculatedData(); let setsData = {}; let cardsVolumeData = {};
  filteredSales.forEach(sale => {
      let rev = Number(sale.price || 0); totalRev += rev; let qty = Number(sale.quantity || 0); cardsSold += qty;
      let setCode = sale.set || 'Unknown Set'; if(!setsData[setCode]) setsData[setCode] = 0; setsData[setCode] += rev;
      let cardKey = `${sale.name || 'Unknown'} (${setCode})`; if(!cardsVolumeData[cardKey]) cardsVolumeData[cardKey] = 0; cardsVolumeData[cardKey] += qty;
      const linkedCard = state.inventory.find(c => c.id === sale.cardid); let cost = 0;
      if (linkedCard) { const groupInfo = calc.groupsMap[linkedCard.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 }; const basePriceRp = Number(linkedCard.yenprice || 0) * groupInfo.rate; const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0; cost = (basePriceRp + shippingPerCard) * qty; }
      totalProfit += (rev - cost);
  });
  const margin = totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) : 0;
  let rankedCards = Object.keys(cardsVolumeData).map(key => ({ cardInfo: key, qty: cardsVolumeData[key] })).sort((a, b) => b.qty - a.qty).slice(0, 3);
  let leaderboardHTML = '';
  if (rankedCards.length > 0) { rankedCards.forEach((item, index) => { const rankMedals = ['🥇', '🥈', '🥉']; leaderboardHTML += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; padding: 4px 0; border-bottom:1px dashed rgba(255,255,255,0.04);"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${rankMedals[index]} <strong>${item.cardInfo}</strong></span><span style="color:var(--accent-yellow); font-weight:700; white-space:nowrap;">${item.qty} sold</span></div>`; }); } else { leaderboardHTML = '<div style="color:var(--text-secondary); font-size:12px; text-align:center; padding:10px 0;">No sales recorded</div>'; }
  let topSets = Object.keys(setsData).map(k => ({ set: k, rev: setsData[k] })).sort((a,b) => b.rev - a.rev).slice(0, 5); let maxSetRev = topSets.length > 0 ? topSets[0].rev : 1;
  let setBarsHTML = '';
  topSets.forEach(t => { let pct = Math.max((t.rev / maxSetRev) * 100, 2); setBarsHTML += `<div style="margin-bottom: 10px;"><div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: var(--text-secondary);"><span>${t.set}</span><span style="font-weight:600; color:var(--text-primary);">Rp ${Math.round(t.rev).toLocaleString('id-ID')}</span></div><div style="width: 100%; background: rgba(128,128,128,0.1); height: 6px; border-radius: 3px; overflow: hidden;"><div style="width: ${pct}%; background: var(--accent-yellow); height: 100%; border-radius: 3px;"></div></div></div>`; });

  let viewSoldCards = document.getElementById('view-sold-cards'); let statsPanel = document.getElementById('sold-cards-stats-panel');
  if (!statsPanel) { statsPanel = document.createElement('div'); statsPanel.id = 'sold-cards-stats-panel'; statsPanel.style.cssText = 'display: grid; gap: 20px; margin-bottom: 24px; align-items: stretch;'; const tablePanel = viewSoldCards.querySelector('.card-panel'); viewSoldCards.insertBefore(statsPanel, tablePanel); }
  const isMobile = window.innerWidth < 1024; if(isMobile) { statsPanel.style.gridTemplateColumns = '1fr'; } else { statsPanel.style.gridTemplateColumns = '1.3fr 1fr 1.2fr'; }
  statsPanel.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 20px; align-content: stretch;">
          <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; box-sizing: border-box; margin: 0;"><h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Filtered Revenue</h4><h2 style="margin: 0; font-size: 20px; color: var(--accent-yellow);">Rp ${Math.round(totalRev).toLocaleString('id-ID')}</h2></div>
          <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; box-sizing: border-box; margin: 0;"><h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Filtered Profit</h4><h2 style="margin: 0; font-size: 20px; color: ${totalProfit >= 0 ? '#22c55e' : '#ef4444'};">Rp ${Math.round(totalProfit).toLocaleString('id-ID')}</h2></div>
          <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; box-sizing: border-box; margin: 0;"><h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Profit Margin</h4><h2 style="margin: 0; font-size: 20px; color: var(--text-primary);">${margin}%</h2></div>
          <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; box-sizing: border-box; margin: 0;"><h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Cards Sold</h4><h2 style="margin: 0; font-size: 20px; color: var(--text-primary);">${cardsSold} pcs</h2></div>
      </div>
      <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: flex-start; height: 100%; box-sizing: border-box; margin: 0; display: flex;"><h4 style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500; width: 100%;"><i class="fas fa-trophy" style="color:var(--accent-yellow); margin-right:4px;"></i> Top Selling Cards</h4><div style="width:100%; display:flex; flex-direction:column; gap:12px; flex: 1; justify-content: center;">${leaderboardHTML}</div></div>
      <div class="card-panel" style="margin-bottom: 0; padding: 20px; display: flex; flex-direction: column; justify-content: flex-start; height: 100%; box-sizing: border-box;"><h4 style="margin: 0 0 16px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;"><i class="fas fa-chart-bar" style="color:var(--accent-yellow); margin-right:4px;"></i> Top Sets (Filtered)</h4><div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">${topSets.length > 0 ? setBarsHTML : '<div style="color:var(--text-secondary); font-size:12px; text-align:center;">No sets data available</div>'}</div></div>
  `;
}

function renderGroups() {
  const grid = document.getElementById('groups-grid'); const addCardsGroupSelect = document.getElementById('group-select'); const calc = getCalculatedData();
  if(addCardsGroupSelect) { addCardsGroupSelect.innerHTML = '<option value="">Select a group...</option>'; state.groups.forEach(g => { addCardsGroupSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`; }); }
  const groupSelect = document.getElementById('filter-group'); const langSelect = document.getElementById('filter-lang');
  if (groupSelect && langSelect) {
    const currentGroup = groupSelect.value || 'All Groups'; const currentLang = langSelect.value || 'All Languages';
    let groupOptions = '<option value="All Groups">All Groups</option>'; state.groups.forEach(g => { groupOptions += `<option value="${g.name}">${g.name}</option>`; }); groupSelect.innerHTML = groupOptions; groupSelect.value = currentGroup;
    langSelect.innerHTML = `<option value="All Languages">All Languages</option><option value="Japanese">Japanese</option><option value="English">English</option><option value="Indonesian">Indonesian</option>`; langSelect.value = currentLang;
  }
  if(!grid) return; grid.innerHTML = '';
  if(!state.groups || state.groups.length === 0) { grid.innerHTML = `<p style="color: var(--text-secondary);">No groups created yet.</p>`; return; }
  state.groups.forEach(g => {
    const groupDetail = calc.groupsMap[g.name] || { totalCardsInGroup: 0 }; const div = document.createElement('div'); div.className = 'group-card';
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><h3 style="margin:0; display:flex; align-items:center;"><i class="fas fa-box" style="color: var(--accent-yellow); margin-right:6px;"></i><span class="editable-group edit-g-name" contenteditable="true" title="Click to edit" style="padding:2px 6px; border-radius:4px;">${g.name}</span></h3><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size:12px; color: var(--text-secondary);">ID: ${String(g.id).substring(4,10)}</span><button class="btn-outline btn-delete-group" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete Group"><i class="fas fa-trash"></i></button></div></div>
      <div class="group-stat-row"><span>Exchange Rate</span><strong>¥1 = Rp <span class="editable-group edit-g-rate" contenteditable="true" title="Click to edit" style="padding:2px 6px; border-radius:4px;">${g.exchangerate || 0}</span></strong></div>
      <div class="group-stat-row"><span>Total Shipping Fee</span><strong>Rp <span class="editable-group edit-g-ship" contenteditable="true" title="Click to edit" style="padding:2px 6px; border-radius:4px;">${Number(g.shippingfee || 0).toLocaleString('id-ID')}</span></strong></div>
      <div class="group-stat-row"><span>Cards Tracked</span><strong>${groupDetail.totalCardsInGroup} pcs</strong></div>
    `;
    div.querySelectorAll('.editable-group').forEach(cell => {
      cell.addEventListener('mouseenter', () => cell.style.background = 'rgba(128,128,128,0.1)'); cell.addEventListener('mouseleave', () => cell.style.background = 'transparent'); cell.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cell.blur(); }});
      cell.addEventListener('blur', () => {
        cell.style.background = 'transparent'; const oldName = g.name; let newName = div.querySelector('.edit-g-name').textContent.trim(); let newRate = Number(div.querySelector('.edit-g-rate').textContent.replace(/[^0-9]/g, '')) || 0; let newShip = Number(div.querySelector('.edit-g-ship').textContent.replace(/[^0-9]/g, '')) || 0;
        if (!newName) newName = oldName; const nameChanged = (oldName !== newName);
        state.groups.forEach(item => { if (item.id === g.id) { item.name = newName; item.exchangerate = newRate; item.shippingfee = newShip; } });
        if (nameChanged) { state.inventory.forEach(card => { if (card.group === oldName) card.group = newName; }); }
        updateDashboard(); renderInventory(); renderGroups(); silentPostData('updateGroup', { id: g.id, oldName: oldName, name: newName, rate: newRate, shipping: newShip, nameChanged: nameChanged });
      });
    });
    div.querySelector('.btn-delete-group').addEventListener('click', () => {
      const groupCards = state.inventory.filter(c => c.group === g.name); const confirmMsg = groupCards.length > 0 ? `Are you sure you want to delete the group "${g.name}" AND the ${groupCards.length} card(s) inside it?\n\nThis will move them to the Recycle Bin.` : `Are you sure you want to delete the empty group "${g.name}"?`;
      if(confirm(confirmMsg)) {
        const payload = { group: { id: g.id, name: g.name, exchangeRate: g.exchangerate, shippingFee: g.shippingfee }, cards: groupCards }; state.trash.unshift({ id: 'TRASH_' + Date.now() + Math.floor(Math.random()*1000), type: 'GroupBundle', deletedAt: new Date().toISOString(), payload: JSON.stringify(payload) });
        state.groups = state.groups.filter(item => item.id !== g.id); state.inventory = state.inventory.filter(item => item.group !== g.name); 
        updateDashboard(); renderInventory(); renderGroups(); renderTrash(); 
        
        // SYNC IN BACKGROUND
        (async function backgroundSync() {
            await silentPostData('deleteGroup', { id: g.id, name: g.name });
            fetchData();
        })();
      }
    });
    grid.appendChild(div);
  });
}

function renderSales() {
  const body = document.getElementById('sales-body'); if(!body) return; body.innerHTML = '';
  const table = body.closest('table');
  if (table) {
    const theadTr = table.querySelector('thead tr');
    if (theadTr && !theadTr.querySelector('.bulk-check-header')) { const th = document.createElement('th'); th.className = 'bulk-check-header'; th.style.width = '40px'; th.innerHTML = '<input type="checkbox" id="check-all-sales" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);">'; theadTr.insertBefore(th, theadTr.firstChild); }
    let controlsDiv = document.getElementById('sales-controls-div');
    if (!controlsDiv) {
      controlsDiv = document.createElement('div'); controlsDiv.id = 'sales-controls-div'; controlsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;';
      const filterBar = document.createElement('div'); filterBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(128,128,128,0.05); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 12px;';
      filterBar.innerHTML = `<div style="color: var(--text-secondary); font-size: 14px; font-weight: 500;" id="sales-count-display"></div><div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;"><label style="font-size: 13px; color: var(--text-secondary); margin: 0;">Sort:</label><select id="sort-sales" style="width: auto; display: inline-block; padding: 6px 12px; border-radius: 6px; background: transparent; color: inherit; border: 1px solid var(--border-color); outline: none; cursor: pointer; font-size: 13px;"><option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="az">Name (A-Z)</option><option value="za">Name (Z-A)</option><option value="price-high">Price (High-Low)</option><option value="price-low">Price (Low-High)</option></select><label style="font-size: 13px; color: var(--text-secondary); margin: 0; margin-left: 8px;">Filter:</label><select id="sales-month-filter" style="width: auto; display: inline-block; padding: 6px 12px; border-radius: 6px; background: transparent; color: inherit; border: 1px solid var(--border-color); outline: none; cursor: pointer; font-size: 13px;"><option value="all">All Months</option><option value="0">Jan</option><option value="1">Feb</option><option value="2">Mar</option><option value="3">Apr</option><option value="4">May</option><option value="5">Jun</option><option value="6">Jul</option><option value="7">Aug</option><option value="8">Sep</option><option value="9">Oct</option><option value="10">Nov</option><option value="11">Dec</option></select><select id="sales-year-filter" style="width: auto; display: inline-block; padding: 6px 12px; border-radius: 6px; background: transparent; color: inherit; border: 1px solid var(--border-color); outline: none; cursor: pointer; font-size: 13px;"><option value="all">All Years</option></select></div>`; controlsDiv.appendChild(filterBar);
      const bulkDiv = document.createElement('div'); bulkDiv.id = 'bulk-delete-div'; bulkDiv.style.cssText = 'display: none; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;';
      bulkDiv.innerHTML = `<span style="color: #ef4444; font-weight: 600; font-size: 14px;"><span id="bulk-delete-count">0</span> sale(s) selected</span><button id="btn-bulk-delete" style="background: #ef4444; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Delete Selected</button>`; controlsDiv.appendChild(bulkDiv); table.parentNode.insertBefore(controlsDiv, table);
      document.getElementById('sort-sales').addEventListener('change', () => { renderSales(); }); document.getElementById('sales-month-filter').addEventListener('change', () => { renderSales(); }); document.getElementById('sales-year-filter').addEventListener('change', () => { renderSales(); });
    } else { document.getElementById('bulk-delete-div').style.display = 'none'; }
    const yearSelect = document.getElementById('sales-year-filter');
    if (yearSelect && state.sales) {
      const currentYearVal = yearSelect.value; const years = [...new Set(state.sales.map(s => new Date(s.date || Date.now()).getFullYear()))].sort((a,b) => b - a); if(years.length === 0) years.push(new Date().getFullYear());
      let yearOpts = '<option value="all">All Years</option>'; years.forEach(y => { yearOpts += `<option value="${y}" ${String(y) === currentYearVal ? 'selected' : ''}>${y}</option>`; }); yearSelect.innerHTML = yearOpts; if (!years.includes(Number(currentYearVal)) && currentYearVal !== 'all') yearSelect.value = 'all'; 
    }
  }

  const monthFilter = document.getElementById('sales-month-filter') ? document.getElementById('sales-month-filter').value : 'all'; const yearFilter = document.getElementById('sales-year-filter') ? document.getElementById('sales-year-filter').value : 'all';
  let filteredSales = [...state.sales]; filteredSales = filteredSales.filter(s => { const sDate = new Date(s.date || Date.now()); const matchMonth = (monthFilter === 'all') || (sDate.getMonth() === Number(monthFilter)); const matchYear = (yearFilter === 'all') || (sDate.getFullYear() === Number(yearFilter)); return matchMonth && matchYear; });

  const sortVal = document.getElementById('sort-sales') ? document.getElementById('sort-sales').value : 'newest';
  if (sortVal === 'newest') filteredSales.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)); else if (sortVal === 'oldest') filteredSales.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)); else if (sortVal === 'az') filteredSales.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))); else if (sortVal === 'za') filteredSales.sort((a, b) => String(b.name || '').localeCompare(String(a.name || ''))); else if (sortVal === 'price-high') filteredSales.sort((a, b) => Number(b.price || 0) - Number(a.price || 0)); else if (sortVal === 'price-low') filteredSales.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));

  const countDisplay = document.getElementById('sales-count-display'); if (countDisplay) countDisplay.textContent = `Showing ${filteredSales.length} record(s)`;
  updateSoldCardsStatsAndCharts(filteredSales);

  if(filteredSales.length === 0) { body.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--text-secondary);">No sales records found for this period.</td></tr>`; return; }

  const calc = getCalculatedData();
  filteredSales.forEach((sale, index) => {
    const linkedCard = state.inventory.find(c => c.id === sale.cardid); let totalCostOfSold = 0;
    if (linkedCard) { const groupInfo = calc.groupsMap[linkedCard.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 }; const basePriceRp = Number(linkedCard.yenprice || 0) * groupInfo.rate; const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0; const totalCostPerCard = basePriceRp + shippingPerCard; totalCostOfSold = totalCostPerCard * Number(sale.quantity || 1); }
    const salePrice = Number(sale.price || 0); const profit = salePrice - totalCostOfSold;
    const isLoss = profit < 0; const profitColor = isLoss ? '#ef4444' : '#22c55e'; const formattedProfit = (isLoss ? '-' : '') + 'Rp ' + Math.abs(Math.round(profit)).toLocaleString('id-ID');
    const saleDateObj = new Date(sale.date || Date.now()); const offset = saleDateObj.getTimezoneOffset() * 60000; const localISOTime = (new Date(saleDateObj.getTime() - offset)).toISOString().split('T')[0];

    const tr = document.createElement('tr');
    
    tr.addEventListener('click', (e) => {
      const isInteractive = ['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName) || e.target.closest('button');
      if (isInteractive) return;
      if (tr.classList.contains('expanded') && (e.target.getAttribute('contenteditable') === 'true' || e.target.closest('[contenteditable="true"]'))) return;
      if (window.innerWidth <= 768) tr.classList.toggle('expanded');
    });

    tr.innerHTML = `
      <td data-label="Select"><input type="checkbox" class="sale-check" data-index="${index}" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);"></td>
      <td data-label="Date" title="Click to edit date"><input type="date" class="inline-edit-date edit-sale-date" value="${localISOTime}" style="background:transparent; color:inherit; border:1px dashed transparent; outline:none; cursor:pointer; padding:2px 4px; border-radius:4px; font-size:inherit; font-family:inherit; color-scheme: inherit;"></td>
      <td data-label="Card Name"><strong>${sale.name || '—'}</strong></td>
      <td data-label="Set">${sale.set || '—'}</td>
      <td data-label="Card No.">${sale.cardNo || '—'}</td>
      <td data-label="Rarity">${sale.rarity || '—'}</td> 
      <td data-label="Qty Sold">${sale.quantity || 1}</td>
      <td data-label="Selling Price">Rp ${salePrice.toLocaleString('id-ID')}</td>
      <td data-label="Profit" style="color: ${profitColor}; font-weight: 600;">${formattedProfit}</td>
      <td data-label="Notes"><span class="editable-cell edit-sale-notes" contenteditable="true" title="Click to edit">${sale.notes || '—'}</span></td>
      <td data-label="Action"><div style="display: flex; gap: 4px; align-items: center; justify-content: flex-start;"><button class="btn-outline btn-delete-sale" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete Sale"><i class="fas fa-trash"></i></button></div></td>
    `;

    const dateInput = tr.querySelector('.edit-sale-date'); dateInput.addEventListener('mouseenter', () => dateInput.style.border = '1px dashed var(--border-color)'); dateInput.addEventListener('mouseleave', () => dateInput.style.border = '1px dashed transparent'); dateInput.addEventListener('change', (e) => { const newDateStr = e.target.value; if(!newDateStr) return; const newSaleDate = new Date(newDateStr + 'T00:00:00').toISOString(); sale.date = newSaleDate; silentPostData('updateSale', { oldDate: sale.date, cardId: sale.cardid, newDate: newSaleDate, notes: sale.notes }); updateDashboard(); renderSales(); });
    const notesCell = tr.querySelector('.edit-sale-notes'); notesCell.addEventListener('mouseenter', () => notesCell.style.background = 'rgba(128,128,128,0.1)'); notesCell.addEventListener('mouseleave', () => notesCell.style.background = 'transparent'); notesCell.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); notesCell.blur(); } }); notesCell.addEventListener('blur', () => { notesCell.style.background = 'transparent'; let newNotes = notesCell.textContent.trim(); if (newNotes === '—') newNotes = ''; if (newNotes !== (sale.notes || '')) { sale.notes = newNotes; silentPostData('updateSale', { oldDate: sale.date, cardId: sale.cardid, newDate: sale.date, notes: newNotes }); } });
    tr.querySelector('.btn-delete-sale').addEventListener('click', () => { 
        if (confirm(`Are you sure you want to delete this sale record for ${sale.name}? This will restore ${sale.quantity} stock back to the inventory.`)) { 
            if (linkedCard) linkedCard.quantity = Number(linkedCard.quantity || 0) + Number(sale.quantity || 1); 
            state.sales = state.sales.filter(s => s !== sale); 
            updateDashboard(); renderSales(); renderInventory(); 
            
            // SYNC IN BACKGROUND
            (async function backgroundSync() {
                await silentPostData('deleteSale', { date: sale.date, cardId: sale.cardid, quantity: sale.quantity });
                fetchData();
            })();
        } 
    });
    body.appendChild(tr);
  });

  let checkAll = document.getElementById('check-all-sales'); const itemChecks = document.querySelectorAll('.sale-check'); const bulkDeleteBtn = document.getElementById('btn-bulk-delete'); const bulkCountText = document.getElementById('bulk-delete-count'); const bulkDiv = document.getElementById('bulk-delete-div');
  if (checkAll) { const newCheckAll = checkAll.cloneNode(true); checkAll.parentNode.replaceChild(newCheckAll, checkAll); checkAll = newCheckAll; checkAll.checked = false; }
  if (checkAll && itemChecks && bulkDeleteBtn && bulkCountText && bulkDiv) {
    function updateBulkUI() { const checkedCount = document.querySelectorAll('.sale-check:checked').length; if (checkedCount > 0) { bulkDiv.style.display = 'flex'; bulkCountText.textContent = checkedCount; } else { bulkDiv.style.display = 'none'; } checkAll.checked = (checkedCount === itemChecks.length && itemChecks.length > 0); }
    checkAll.addEventListener('change', (e) => { itemChecks.forEach(chk => chk.checked = e.target.checked); updateBulkUI(); }); itemChecks.forEach(chk => { chk.addEventListener('change', updateBulkUI); });
    const newBulkBtn = bulkDeleteBtn.cloneNode(true); bulkDeleteBtn.parentNode.replaceChild(newBulkBtn, bulkDeleteBtn);
    newBulkBtn.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.sale-check:checked'); if (checkedBoxes.length === 0) return;
      if (confirm(`Are you sure you want to delete ${checkedBoxes.length} sale record(s)? This will restore their stock back to the inventory.`)) {
        const salesToDelete = Array.from(checkedBoxes).map(chk => filteredSales[chk.getAttribute('data-index')]);
        salesToDelete.forEach(sale => { const linkedCard = state.inventory.find(c => c.id === sale.cardid); if (linkedCard) linkedCard.quantity = Number(linkedCard.quantity || 0) + Number(sale.quantity || 1); state.sales = state.sales.filter(s => s !== sale); });
        updateDashboard(); renderInventory(); renderSales();
        (async function syncBulkDelete() { 
          for (const sale of salesToDelete) { 
            await silentPostData('deleteSale', { date: sale.date, cardId: sale.cardid, quantity: sale.quantity }); 
          } 
        })();
      }
    });
  }
}

function renderTrash() {
  const body = document.getElementById('trash-body'); if(!body) return; body.innerHTML = '';
  const table = body.closest('table');
  if (table) {
    const theadTr = table.querySelector('thead tr');
    if (theadTr && !theadTr.querySelector('.bulk-check-header-trash')) { const th = document.createElement('th'); th.className = 'bulk-check-header-trash'; th.style.width = '40px'; th.innerHTML = '<input type="checkbox" id="check-all-trash" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);">'; theadTr.insertBefore(th, theadTr.firstChild); }
    let controlsDiv = document.getElementById('trash-controls-div');
    if (!controlsDiv) {
      controlsDiv = document.createElement('div'); controlsDiv.id = 'trash-controls-div'; controlsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;';
      const bulkDiv = document.createElement('div'); bulkDiv.id = 'bulk-action-trash-div'; bulkDiv.style.cssText = 'display: none; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px;';
      bulkDiv.innerHTML = `<span style="color: var(--accent-yellow); font-weight: 600; font-size: 14px;"><span id="bulk-trash-count">0</span> item(s) selected</span><div style="display: flex; gap: 10px;"><button id="btn-bulk-restore-trash" style="background: transparent; color: var(--text-primary); border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"><i class="fas fa-undo" style="color: var(--accent-yellow);"></i> Restore Selected</button><button id="btn-bulk-delete-trash" style="background: #ef4444; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Delete Permanently</button></div>`;
      controlsDiv.appendChild(bulkDiv); table.parentNode.insertBefore(controlsDiv, table);
    } else { document.getElementById('bulk-action-trash-div').style.display = 'none'; }
  }

  if(!state.trash || state.trash.length === 0) { body.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-secondary);">Your Recycle Bin is empty.</td></tr>`; return; }

  let sortedTrash = [...state.trash].sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
  sortedTrash.forEach((item, index) => {
    let payloadStr = "Unknown Data";
    try {
      const p = JSON.parse(item.payload);
      if (item.type === 'Card') { payloadStr = `<strong>${p.name || 'Unknown'}</strong> (${p.set || 'No Set'}) - Stock: ${p.quantity} | Yen: ¥${Number(p.yenPrice).toLocaleString('ja-JP')}`; } else if (item.type === 'Sale') { payloadStr = `<strong>${p.name || 'Unknown'}</strong> | Sold: ${p.quantity} pcs | Price: Rp ${Number(p.price).toLocaleString('id-ID')}`; } else if (item.type === 'GroupBundle') { payloadStr = `<strong>Group: ${p.group.name}</strong> | Rate: ¥1 = Rp ${p.group.exchangeRate} | Contains ${p.cards ? p.cards.length : 0} card(s)`; } else if (item.type === 'Invoice') { payloadStr = `<strong>Invoice: ${p.winner}</strong> | Batch: ${p.batch} | Contains ${p.invoices ? p.invoices.length : 0} item(s)`; }
    } catch(e) {}
    const typeBg = item.type === 'Card' ? 'rgba(59, 130, 246, 0.15)' : item.type === 'Sale' ? 'rgba(34, 197, 94, 0.15)' : item.type === 'Invoice' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(168, 85, 247, 0.15)'; const typeColor = item.type === 'Card' ? '#3b82f6' : item.type === 'Sale' ? '#22c55e' : item.type === 'Invoice' ? '#eab308' : '#a855f7'; const displayType = item.type === 'GroupBundle' ? 'Group & Cards' : item.type;

    const tr = document.createElement('tr');
    
    tr.addEventListener('click', (e) => {
      const isInteractive = ['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName) || e.target.closest('button');
      if (isInteractive) return;
      if (tr.classList.contains('expanded') && (e.target.getAttribute('contenteditable') === 'true' || e.target.closest('[contenteditable="true"]'))) return;
      if (window.innerWidth <= 768) tr.classList.toggle('expanded');
    });

    tr.innerHTML = `
      <td data-label="Select"><input type="checkbox" class="trash-check" data-index="${index}" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);"></td>
      <td data-label="Type"><span style="padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600; background: ${typeBg}; color: ${typeColor};">${displayType}</span></td>
      <td data-label="Deleted On">${new Date(item.deletedAt).toLocaleString()}</td>
      <td data-label="Details">${payloadStr}</td>
      <td data-label="Actions"><div style="display:flex; justify-content: flex-start; gap:8px;"><button class="btn-outline btn-restore-trash" style="padding: 6px 12px; font-weight: 500; color: var(--accent-yellow); border-color: rgba(234, 179, 8, 0.3);" title="Restore back to tracker"><i class="fas fa-undo"></i> Restore</button><button class="btn-outline btn-destroy-trash" style="padding: 6px 12px; font-weight: 500; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete Permanently"><i class="fas fa-times"></i> Delete</button></div></td>
    `;
    tr.querySelector('.btn-restore-trash').addEventListener('click', () => { if(confirm(`Are you sure you want to restore this ${displayType} back to the active tracker?`)) restoreSingleTrash(item); });
    tr.querySelector('.btn-destroy-trash').addEventListener('click', () => { if(confirm(`Permanently delete this ${displayType}? This action cannot be undone.`)) deleteSingleTrash(item); });
    body.appendChild(tr);
  });

  let checkAll = document.getElementById('check-all-trash'); const itemChecks = document.querySelectorAll('.trash-check'); const bulkRestoreBtn = document.getElementById('btn-bulk-restore-trash'); const bulkDeleteBtn = document.getElementById('btn-bulk-delete-trash'); const bulkCountText = document.getElementById('bulk-trash-count'); const bulkDiv = document.getElementById('bulk-action-trash-div');
  if (checkAll) { const newCheckAll = checkAll.cloneNode(true); checkAll.parentNode.replaceChild(newCheckAll, checkAll); checkAll = newCheckAll; checkAll.checked = false; }
  if (checkAll && itemChecks && bulkRestoreBtn && bulkDeleteBtn && bulkCountText && bulkDiv) {
    function updateBulkUI() { const checkedCount = document.querySelectorAll('.trash-check:checked').length; if (checkedCount > 0) { bulkDiv.style.display = 'flex'; bulkCountText.textContent = checkedCount; } else { bulkDiv.style.display = 'none'; } checkAll.checked = (checkedCount === itemChecks.length && itemChecks.length > 0); }
    checkAll.addEventListener('change', (e) => { itemChecks.forEach(chk => chk.checked = e.target.checked); updateBulkUI(); }); itemChecks.forEach(chk => { chk.addEventListener('change', updateBulkUI); });
    const newBulkRestore = bulkRestoreBtn.cloneNode(true); bulkRestoreBtn.parentNode.replaceChild(newBulkRestore, bulkRestoreBtn);
    newBulkRestore.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.trash-check:checked'); if (checkedBoxes.length === 0) return;
      if (confirm(`Are you sure you want to restore ${checkedBoxes.length} item(s)?`)) {
        const itemsToRestore = Array.from(checkedBoxes).map(chk => sortedTrash[chk.getAttribute('data-index')]); 
        itemsToRestore.forEach(item => processRestoreState(item)); 
        updateDashboard(); renderInventory(); renderGroups(); renderTrash();
        if (typeof renderInvoiceHistory === 'function') { renderInvoiceHistory(); updateInvoiceBatchList(); }
        
        // ✅ NEW: Bulk fetch instead of loop!
        const idsToRestore = itemsToRestore.map(item => item.id);
        (async function syncBulkRestore() { 
            await silentPostData('restoreTrash', { trashIds: idsToRestore }); 
        })();
      }
    });

    const newBulkDelete = bulkDeleteBtn.cloneNode(true); bulkDeleteBtn.parentNode.replaceChild(newBulkDelete, bulkDeleteBtn);
    newBulkDelete.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.trash-check:checked'); if (checkedBoxes.length === 0) return;
      if (confirm(`Permanently delete ${checkedBoxes.length} item(s)? This cannot be undone.`)) {
        const itemsToDelete = Array.from(checkedBoxes).map(chk => sortedTrash[chk.getAttribute('data-index')]); 
        itemsToDelete.forEach(item => { state.trash = state.trash.filter(t => t.id !== item.id); }); 
        renderTrash();
        
        // FIXED: Send ONE single request with all IDs instead of looping
        const idsToDelete = itemsToDelete.map(item => item.id);
        silentPostData('deleteTrash', { trashIds: idsToDelete });
      }
    });
  }
}

function processRestoreState(item) {
  state.trash = state.trash.filter(t => t.id !== item.id);
  try {
    const p = JSON.parse(item.payload);
    if (item.type === 'GroupBundle') { 
        state.groups.push({ id: p.group.id, name: p.group.name, exchangerate: p.group.exchangeRate, shippingfee: p.group.shippingFee }); 
        if (p.cards) { 
            p.cards.forEach(c => {
                c.yenprice = c.yenPrice !== undefined ? c.yenPrice : (c.yenprice || 0);
                state.inventory.push(c);
            }); 
        } 
    }
    else if (item.type === 'Card') { 
        p.yenprice = p.yenPrice !== undefined ? p.yenPrice : (p.yenprice || 0); // ✅ Fix yen assignment
        state.inventory.push(p); 
    }
    else if (item.type === 'Sale') { 
        state.sales.push({ date: p.date, cardid: p.cardId, name: p.name, set: p.set, rarity: p.rarity, quantity: p.quantity, price: p.price, notes: p.notes }); 
        const linkedCard = state.inventory.find(c => c.id === p.cardId); 
        if (linkedCard) linkedCard.quantity = Number(linkedCard.quantity || 0) - Number(p.quantity || 0); 
    }
    else if (item.type === 'Invoice') { 
        if(p.invoices) { 
            p.invoices.forEach(restoredInv => {
                const existingIdx = state.invoices.findIndex(inv => inv.id === restoredInv.id);
                if (existingIdx > -1) state.invoices[existingIdx] = restoredInv; 
                else state.invoices.push(restoredInv);
            }); 
        } 
    }
  } catch (e) {}
}
function restoreSingleTrash(item) { 
    processRestoreState(item); 
    updateDashboard(); renderInventory(); renderGroups(); renderTrash(); 
    if (typeof renderInvoiceHistory === 'function') { renderInvoiceHistory(); updateInvoiceBatchList(); }
    
    // SYNC IN BACKGROUND
    (async function backgroundSync() {
        await silentPostData('restoreTrash', { trashId: item.id });
        fetchData();
    })();
}
function deleteSingleTrash(item) { state.trash = state.trash.filter(t => t.id !== item.id); renderTrash(); silentPostData('deleteTrash', { trashId: item.id }); }

/* ============================================================== */
/* AUCTION & CLAIM SALE LOGIC                                     */
/* ============================================================== */
let auctionDrafts = [];

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('auction-search');
  const resultsDiv = document.getElementById('auction-search-results');

  // Clear draft button listener
  document.getElementById('btn-clear-draft')?.addEventListener('click', function() {
      auctionDrafts = [];
      document.getElementById('auction-batch-input').value = '';
      document.getElementById('auction-search').value = '';
      const fbOutput = document.getElementById('fb-post-output');
      if (fbOutput) {
          fbOutput.style.display = 'none';
          fbOutput.value = '';
      }
      renderAuctionDrafts();
  });

  // Shipping Recalculation Listener
  const resetMathBtn = document.getElementById('btn-reset-shipping-math');
  if (resetMathBtn) {
      resetMathBtn.addEventListener('click', () => {
          if(confirm("This will reset the historical maximum stock memory for all groups and recalculate shipping fees based purely on your CURRENT active inventory. Proceed?")) {
              // 1. Clear the memory
              localStorage.removeItem('maxGroupStock');
              
              // 2. Alert the user
              alert("Memory cleared! The page will now reload to apply the fresh calculations.");
              
              // 3. Force a full page reload to re-fetch data and re-run the math
              location.reload(); 
          }
      });
  }

  
  
  if(searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) { resultsDiv.innerHTML = ''; return; }
      
      // 1. Flatten all calculated variants into a single searchable array
      const calc = getCalculatedData();
      let allVariants = [];
      Object.values(calc.mergedList).forEach(masterCard => {
          Object.values(masterCard.variants).forEach(v => allVariants.push(v));
      });
      
      // 2. Filter out variants that are already fully drafted
      const availableCards = allVariants.filter(c => {
          const stock = Number(c.quantity || 0);
          const draftedQty = auctionDrafts.filter(draft => draft.id === c.id).length;
          return stock > draftedQty;
      });
      
      // 3. Search using the new displayName (e.g., "Minccino [1]")
      const matches = availableCards.filter(c => {
        const cardName = String(c.displayName || c.name || '').toLowerCase().trim();
        const cardSet = String(c.set || '').toLowerCase().trim();
        const cardRarity = String(c.rarity || '').toLowerCase().trim();
        if (q.length <= 2) return cardName.startsWith(q);
        else return cardName.includes(q) || cardSet.includes(q) || cardRarity.includes(q);
      });
      
      // 4. Pass the displayName safely to the click function
      resultsDiv.innerHTML = matches.map(c => 
        `<div style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border-color);" onclick="addCardToAuctionDraft('${c.id}', '${(c.displayName || c.name).replace(/'/g, "\\'")}')">
          <strong>${c.displayName || c.name}</strong> (${c.rarity}) - Stock: ${c.quantity}
        </div>`
      ).join('');
    });
  }

  document.addEventListener('paste', async (e) => {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.classList.contains('auction-img-paste')) {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.includes('image/')) {
          const blob = item.getAsFile();
          activeEl.value = "Uploading image, please wait...";
          activeEl.disabled = true;
          activeEl.style.borderColor = "var(--border-color)";
          
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64Data = event.target.result.split(',')[1];
            try {
              const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'uploadImage', pass: sessionStorage.getItem('appPass'), filename: `Bid_${Date.now()}.png`, mimeType: item.type, base64: base64Data }) });
              const data = await res.json();
              if (data.success) { activeEl.value = data.downloadUrl; activeEl.style.borderColor = "#22c55e"; } 
              else { activeEl.value = data.error ? `Error: ${data.error}` : "Error uploading."; activeEl.style.borderColor = "#ef4444"; }
            } catch (err) { activeEl.value = "Network error."; activeEl.style.borderColor = "#ef4444"; }
            activeEl.disabled = false;
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  });
  
  const invPayment = document.getElementById('inv-payment');
  const invCourier = document.getElementById('inv-courier');
  const invInsurance = document.getElementById('inv-insurance');
  const invShipFee = document.getElementById('inv-ship-fee');
  const invToploader = document.getElementById('inv-toploader');

  [invPayment, invCourier, invInsurance, invShipFee, invToploader].forEach(el => {
    if(el) el.addEventListener('change', calculateInvoice);
    if(el && el.tagName === 'INPUT') el.addEventListener('input', calculateInvoice);
  });

  document.getElementById('inv-status')?.addEventListener('change', (e) => {
      const trackingContainer = document.getElementById('inv-tracking-container');
      if (trackingContainer) {
          trackingContainer.style.display = ['Ready to Ship', 'Shipped'].includes(e.target.value) ? 'block' : 'none';
      }
  });

  document.getElementById('invoice-batch-select')?.addEventListener('change', updateInvoiceWinnerList);
  document.getElementById('invoice-winner-select')?.addEventListener('change', loadWinnerInvoice);
  document.getElementById('sort-invoices')?.addEventListener('change', renderInvoiceHistory);
  
  document.getElementById('filter-invoice-batch')?.addEventListener('change', renderInvoiceHistory);
  document.getElementById('filter-invoice-courier')?.addEventListener('change', renderInvoiceHistory);
  document.getElementById('filter-invoice-status')?.addEventListener('change', renderInvoiceHistory);
  document.getElementById('btn-copy-invoice')?.addEventListener('click', copyInvoiceText);
  document.getElementById('btn-download-evidence')?.addEventListener('click', downloadWinnerEvidence);
  document.getElementById('btn-save-invoice-db')?.addEventListener('click', saveInvoiceDataToDB);

  if(invShipFee) {
      invShipFee.addEventListener('input', (e) => {
          let raw = e.target.value.replace(/[^0-9]/g, '');
          e.target.value = raw ? 'Rp ' + Number(raw).toLocaleString('id-ID') : '';
      });
  }
});

document.querySelector('[data-target="auction"]').addEventListener('click', () => {
    updateInvoiceBatchList();
    renderInvoiceHistory();
});

window.addCardToAuctionDraft = function(cardId, displayName) {
  const card = state.inventory.find(c => c.id === cardId);
  if (!card) return;
  
  const currentDraftedQty = auctionDrafts.filter(draft => draft.id === cardId).length;
  if (currentDraftedQty < Number(card.quantity || 0)) {
    // Lock the specific variant name into the draft
    const finalName = displayName || card.name;
    
    auctionDrafts.push({ ...card, name: finalName, ob: '', nb: 'Bebas Loncat', bo: '', isSaved: false });
    renderAuctionDrafts();
  }
  document.getElementById('auction-search').value = '';
  document.getElementById('auction-search-results').innerHTML = '';
};
window.removeDraftCard = function(index) {
    const draft = auctionDrafts[index];
    const batchNo = document.getElementById('auction-batch-input').value.trim();

    if (draft.isSaved) {
        if(!confirm(`This card is already saved in the database.\nRemove it and return stock (+1) to inventory?`)) return;
        const invCard = state.inventory.find(c => c.id === draft.id);
        if(invCard) {
            invCard.quantity = Number(invCard.quantity) + 1;
            silentPostData('updateCard', { id: invCard.id, name: invCard.name, set: invCard.set, rarity: invCard.rarity, language: invCard.language, group: invCard.group, yenPrice: invCard.yenprice, quantity: invCard.quantity, condition: invCard.condition });
        }
        
        const existingBatchIndex = state.batches.findIndex(b => String(b.batchNo) === String(batchNo));
        if (existingBatchIndex > -1) {
            const existingBatch = state.batches[existingBatchIndex];
            const dbIndex = existingBatch.cards.findIndex(c => c.id === draft.id && c.cardName === draft.name);
            if (dbIndex > -1) existingBatch.cards.splice(dbIndex, 1);

            // --- NEW: If batch is empty, delete it entirely ---
            if (existingBatch.cards.length === 0) {
                state.batches.splice(existingBatchIndex, 1);
                silentPostData('deleteBatch', { batchNo: batchNo });
            } else {
                silentPostData('saveBatch', { batchNo: batchNo, payload: existingBatch });
            }
        }

        const origLen = state.invoices.length;
        state.invoices = state.invoices.filter(inv => !(String(inv.batch) === String(batchNo) && inv.cardId === draft.id));
        if (state.invoices.length !== origLen) {
            silentPostData('deleteInvoiceByCard', { batchNo: batchNo, cardId: draft.id }).then(() => {
                renderInvoiceHistory();
                updateInvoiceBatchList();
                updateInvoiceWinnerList();
                loadWinnerInvoice(); 
            });
        }
    }
    
    auctionDrafts.splice(index, 1);

    // --- NEW: Auto-reset UI if batch becomes empty ---
    if (auctionDrafts.length === 0) {
        const batchInput = document.getElementById('auction-batch-input');
        if (batchInput) batchInput.value = '';
        
        // NEW: Clear and hide the FB Post box so it doesn't linger
        const fbOutput = document.getElementById('fb-post-output');
        if (fbOutput) { fbOutput.style.display = 'none'; fbOutput.value = ''; }
        
        refreshLoggerDropdown(); // Clear from dropdowns
    }

    renderAuctionDrafts();
    updateDashboard(); renderInventory();
    
    const loggerBatchSelect = document.getElementById('logger-batch-select');
    if (loggerBatchSelect) {
        if (auctionDrafts.length === 0) loggerBatchSelect.value = '';
        loggerBatchSelect.dispatchEvent(new Event('change'));
    }
};function renderAuctionDrafts() {
  const tbody = document.getElementById('auction-draft-body');
  if(!tbody) return;
  
  tbody.innerHTML = auctionDrafts.map((c, i) => `
    <tr>
      <td>${c.name} ${c.isSaved ? '<span style="font-size:10px; color:#22c55e; margin-left:4px;" title="Already saved">💾</span>' : ''}</td>
      <td>${c.rarity}</td>
      <td><input type="text" class="format-rp draft-ob" oninput="auctionDrafts[${i}].ob = this.value.replace(/[^0-9]/g, '')" value="${c.ob ? 'Rp ' + Number(c.ob).toLocaleString('id-ID') : ''}" placeholder="e.g. Rp 50.000" style="width:110px; padding:4px;"></td>
      <td>
        <select class="draft-nb" onchange="auctionDrafts[${i}].nb = this.value" style="padding:4px; background:var(--bg-surface); color:inherit;">
          <option value="Bebas Loncat" ${c.nb==='Bebas Loncat'?'selected':''}>Bebas Loncat</option>
          <option value="Minimal 3, bebas loncat" ${c.nb==='Minimal 3, bebas loncat'?'selected':''}>Minimal 3, bebas loncat</option>
          <option value="Minimal 4, bebas loncat" ${c.nb==='Minimal 4, bebas loncat'?'selected':''}>Minimal 4, bebas loncat</option>
          <option value="Minimal 5, bebas loncat" ${c.nb==='Minimal 5, bebas loncat'?'selected':''}>Minimal 5, bebas loncat</option>
          <option value="Kelipatan 2, bebas loncat" ${c.nb==='Kelipatan 2, bebas loncat'?'selected':''}>Kelipatan 2, bebas loncat</option>
          <option value="Kelipatan 3, bebas loncat" ${c.nb==='Kelipatan 3, bebas loncat'?'selected':''}>Kelipatan 3, bebas loncat</option>
          <option value="Kelipatan 4, bebas loncat" ${c.nb==='Kelipatan 4, bebas loncat'?'selected':''}>Kelipatan 4, bebas loncat</option>
          <option value="Kelipatan 5, bebas loncat" ${c.nb==='Kelipatan 5, bebas loncat'?'selected':''}>Kelipatan 5, bebas loncat</option>
          <option value="Kelipatan 10, bebas loncat" ${c.nb==='Kelipatan 10, bebas loncat'?'selected':''}>Kelipatan 10, bebas loncat</option>
          <option value="Kelipatan 50, bebas loncat" ${c.nb==='Kelipatan 50, bebas loncat'?'selected':''}>Kelipatan 50, bebas loncat</option>
          <option value="Kelipatan 100, bebas loncat" ${c.nb==='Kelipatan 100, bebas loncat'?'selected':''}>Kelipatan 100, bebas loncat</option>
        </select>
      </td>
      <td><input type="text" class="format-rp draft-bo" oninput="auctionDrafts[${i}].bo = this.value.replace(/[^0-9]/g, '')" value="${c.bo ? 'Rp ' + Number(c.bo).toLocaleString('id-ID') : ''}" placeholder="e.g. Rp 250.000" style="width:110px; padding:4px;"></td>
      <td>
                <div style="display: flex; gap: 12px; align-items: center;">
                  <button onclick="copySingleDraftCard(${i})" style="color: ${c.isCopied ? '#22c55e' : 'var(--text-secondary)'}; background:none; border:none; cursor:pointer; font-size: 15px; transition: color 0.2s;" title="Copy FB Post for this card">
                    <i class="fas ${c.isCopied ? 'fa-check-double' : 'fa-copy'}"></i>
                  </button>
                  <button onclick="removeDraftCard(${i})" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size: 15px;" title="Delete Card">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.format-rp').forEach(inp => {
    inp.addEventListener('input', (e) => {
        let raw = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = raw ? 'Rp ' + Number(raw).toLocaleString('id-ID') : '';
    });
  });
}
// Function to copy a single card's text and update its indicator
window.copySingleDraftCard = function(index) {
    const c = auctionDrafts[index];
    if (!c) return;
    
    // Format the specific card text
    const obText = c.ob ? (c.ob / 1000) : '0';
    const boText = c.bo ? (c.bo / 1000) : '-';
    const textToCopy = `#${index + 1} ${c.name} ${c.rarity}\nOB: ${obText}\nNB: ${c.nb}\nBO: ${boText}`;
    
    // Copy to clipboard
    const tempInput = document.createElement("textarea"); 
    tempInput.value = textToCopy; 
    document.body.appendChild(tempInput);
    tempInput.select(); 
    document.execCommand("copy"); 
    document.body.removeChild(tempInput);
    
    // Mark as copied in the local array
    c.isCopied = true;
    
    // Refresh the table to apply the green checkmark
    renderAuctionDrafts();
};

function generateFBPost() {
  const text = auctionDrafts.map((c, i) => {
    const obText = c.ob ? (c.ob / 1000) : '0';
    const boText = c.bo ? (c.bo / 1000) : '-';
    return `#${i+1} ${c.name} ${c.rarity}\nOB: ${obText}\nNB: ${c.nb}\nBO: ${boText}`;
  }).join('\n\n');
  
  const output = document.getElementById('fb-post-output');
  output.value = text; output.style.display = 'block'; output.select(); document.execCommand('copy');
  alert("Facebook Post Copied to Clipboard!");
}

/* ============================================================== */
/* AUCTION & CLAIMSALE LOGIC (STAGE 1 -> STAGE 2 -> STAGE 3)      */
/* ============================================================== */

function refreshLoggerDropdown() {
    const select = document.getElementById('logger-batch-select');
    
    // Create/Update the Select for Stage 1 Batch Input
    let batchInput = document.getElementById('auction-batch-input');
    if (batchInput && batchInput.tagName === 'INPUT') {
        const newSelect = document.createElement('select');
        newSelect.id = 'auction-batch-input';
        newSelect.className = batchInput.className;
        newSelect.style.cssText = batchInput.style.cssText + '; padding: 10px; background: var(--bg-surface); color: inherit; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;';
        batchInput.parentNode.replaceChild(newSelect, batchInput);
        batchInput = newSelect;
        
        // Cleanup the old messy datalist if it exists
        const dl = document.getElementById('batch-list-opts');
        if (dl) dl.remove();
        
        // Auto-load batch data if an existing batch is selected
        batchInput.addEventListener('change', (e) => {
            const val = e.target.value.trim();
            if (val === 'NEW_BATCH') {
                const newBatch = prompt("Enter new Batch Name/Number:");
                if (newBatch) {
                    if (state.batches.find(b => String(b.batchNo) === String(newBatch))) {
                        alert("Batch already exists! Selecting it.");
                        e.target.value = newBatch;
                        e.target.dispatchEvent(new Event('change'));
                    } else {
                        const opt = document.createElement('option');
                        opt.value = newBatch;
                        opt.textContent = `Batch ${newBatch}`;
                        batchInput.insertBefore(opt, batchInput.children[1]); // insert after "Select..."
                        batchInput.value = newBatch;
                        auctionDrafts = [];
                        renderAuctionDrafts();
                    }
                } else {
                    e.target.value = '';
                }
                return;
            }
            
            if (val) {
                const existingBatch = state.batches.find(b => String(b.batchNo) === String(val));
                if (existingBatch) {
                    
                    // FIX: Only show the warning if there is at least one UNSAVED card in the draft
                    const hasUnsavedDrafts = auctionDrafts.some(draft => !draft.isSaved);
                    
                    if (hasUnsavedDrafts && !confirm("Loading this batch will replace your current unsaved drafts. Continue?")) {
                        e.target.value = ''; 
                        return;
                    }
                    
                    auctionDrafts = existingBatch.cards.map(c => ({
                        id: c.id, name: c.cardName, rarity: c.rarity, set: c.set,
                        ob: c.ob, nb: c.nb, bo: c.bo, winner: c.winner, bid: c.bid,
                        evidence: c.evidence, status: c.status, isSaved: true 
                    }));
                    renderAuctionDrafts();
                }
            } else {
                auctionDrafts = [];
                renderAuctionDrafts();
            }
        });
    }
    
    // Populate Stage 1 Dropdown
    if (batchInput && batchInput.tagName === 'SELECT') {
        const currentVal = batchInput.value;
        let opts = '<option value="">Select or Create Batch...</option><option value="NEW_BATCH" style="color:var(--accent-yellow); font-weight:bold;">+ Create New Batch...</option>';
        if (state.batches) {
            opts += state.batches.map(b => `<option value="${b.batchNo}">Batch ${b.batchNo}</option>`).join('');
        }
        batchInput.innerHTML = opts;
        if (currentVal && currentVal !== "NEW_BATCH") batchInput.value = currentVal;
    }

    // Stage 2 Dropdown Update
    if (!select) return; 
    const currentLoggerVal = select.value;
    select.innerHTML = '<option value="">Select Running/Closed Batch...</option>';
    if(state.batches) {
        state.batches.forEach(batch => {
            const opt = document.createElement('option');
            opt.value = batch.batchNo;
            opt.textContent = `${batch.status === 'Running' ? '🟢' : '🔴'} ${batch.batchNo} (${batch.status})`;
            select.appendChild(opt);
        });
    }
    if(currentLoggerVal) select.value = currentLoggerVal;
}

// STAGE 1 -> Generates Post & Sends to Google Sheets Database (INSTANT UI UPDATE)
document.getElementById('btn-generate-fb-post').addEventListener('click', function() {
    const batchInput = document.getElementById('auction-batch-input');
    const batchNo = batchInput.value.trim();
    
    if(!batchNo) {
        alert("Please enter a Batch No. before generating.");
        batchInput.style.borderColor = "#ef4444";
        return;
    }
    batchInput.style.borderColor = "var(--border-color)";

    const draftRows = document.querySelectorAll('#auction-draft-body tr');
    if(draftRows.length === 0) {
        alert("No cards in draft to save!");
        return;
    }

    let cards = [];
    draftRows.forEach((row, index) => {
        const draftItem = auctionDrafts[index];
        const draftedCardId = draftItem?.id;
        
        cards.push({
            id: draftedCardId || ('CARD_' + Date.now() + '_' + index),
            cardName: draftItem?.name || row.cells[0].innerText.replace(' 💾', ''),
            rarity: draftItem?.rarity || row.cells[1].innerText,
            set: draftItem?.set || '',
            ob: draftItem?.ob || '',
            nb: draftItem?.nb || 'Bebas Loncat',
            bo: draftItem?.bo || '',
            winner: draftItem?.winner || '', 
            bid: draftItem?.bid || '',       
            evidence: draftItem?.evidence || '', 
            status: draftItem?.status || 'Running' 
        });

        // DEDUCT STOCK ONLY IF NEWLY ADDED
        if (draftedCardId && !draftItem.isSaved) {
            const invCard = state.inventory.find(c => c.id === draftedCardId);
            if (invCard && Number(invCard.quantity) > 0) {
                invCard.quantity = Number(invCard.quantity) - 1;
                
                // Fire silent stock update
                silentPostData('updateCard', { 
                    id: invCard.id, name: invCard.name, set: invCard.set, 
                    rarity: invCard.rarity, language: invCard.language, 
                    group: invCard.group, yenPrice: invCard.yenprice, 
                    quantity: invCard.quantity, condition: invCard.condition,
                    storage: invCard.storage, 
                    frontImage: invCard.frontImage || invCard.frontimage, 
                    backImage: invCard.backImage || invCard.backimage,
                    conditionMedia: invCard.conditionMedia || invCard.conditionmedia || '{}', // ✅ Safely preserves videos and flaws
                    cardNo: invCard.cardNo || invCard.cardno || '' // ✅ Safely preserves the card number
                });
            }
            draftItem.isSaved = true; // Mark as saved instantly
        }
    });

    // Update existing or push new to memory instantly
    const existingIndex = state.batches.findIndex(b => String(b.batchNo) === String(batchNo));
    let payload;
    if(existingIndex > -1) {
        payload = state.batches[existingIndex];
        payload.cards = cards; 
        payload.status = 'Running'; 
    } else {
        payload = { batchNo: batchNo, status: 'Running', cards: cards };
        state.batches.push(payload);
    }

    // --- INSTANT UI UPDATES ---
    refreshLoggerDropdown();
    renderAuctionDrafts(); 
    
    const loggerSelect = document.getElementById('logger-batch-select');
    if (loggerSelect) {
        loggerSelect.value = batchNo; 
        loggerSelect.dispatchEvent(new Event('change')); 
    }
    
    generateFBPost(); // Copies FB post and alerts user
    
    // --- SILENT BACKGROUND SYNC ---
    (async function backgroundSync() {
        await silentPostData('saveBatch', { batchNo: batchNo, payload: payload });
        fetchData(); // Sync up fully when done
    })();
});

// STAGE 2 -> Dropdown loader (5 columns exactly)
document.getElementById('logger-batch-select').addEventListener('change', function() {
    const batchNo = this.value;
    const tbody = document.getElementById('auction-logger-body');
    
    if(!batchNo) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Select a batch to log winners.</td></tr>`;
        return;
    }

    const batch = state.batches.find(b => String(b.batchNo) === String(batchNo));
    tbody.innerHTML = ''; 

// Ensure Action Column Header exists
    const theadTr = tbody.closest('table').querySelector('thead tr');
    if (theadTr && !theadTr.querySelector('.batch-action-header')) {
        const th = document.createElement('th'); th.className = 'batch-action-header'; th.textContent = 'Action';
        theadTr.appendChild(th);
    }

    batch.cards.forEach((card, index) => {
        const tr = document.createElement('tr');
        const selectBorder = card.status === 'Closed' ? '#ef4444' : 'var(--accent-yellow)';
        
        tr.innerHTML = `
            <td style="font-weight: 500;">
                ${card.cardName}
                <div style="font-size:10px; color:var(--text-secondary); margin-top:2px;">
                    OB: ${card.ob ? (card.ob/1000)+'k' : '0'} | NB: ${card.nb || '-'} | BO: ${card.bo ? (card.bo/1000)+'k' : '-'}
                </div>
            </td>
            <td><input type="text" class="log-winner" value="${card.winner || ''}" placeholder="Enter Name..." style="min-width: 150px;"></td>
            <td><input type="number" class="log-bid" value="${card.bid || ''}" placeholder="Rp 0" style="min-width: 120px;"></td>
            <td><input type="text" class="log-img auction-img-paste" value="${card.evidence || ''}" placeholder="Paste screenshot" style="min-width: 150px;"></td>
            <td>
                <select class="log-status" style="border-color: ${selectBorder}; min-width: 120px; color: ${selectBorder};">
                    <option value="Running" ${card.status === 'Running' ? 'selected' : ''}>Running</option>
                    <option value="Closed" ${card.status === 'Closed' ? 'selected' : ''}>Closed</option>
                </select>
            </td>
            <td>
                ${card.status === 'Running' ? `
                <div style="display:flex; gap:6px;">
                    <button class="btn-outline btn-edit-batch-card" data-index="${index}" style="padding: 4px; color: var(--accent-yellow); border-color: var(--accent-yellow);" title="Edit OB/NB/BO"><i class="fas fa-edit"></i></button>
                    <button class="btn-outline btn-del-batch-card" data-index="${index}" style="padding: 4px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete Card"><i class="fas fa-trash"></i></button>
                </div>
                ` : `<span style="color:var(--text-secondary); font-size:12px;">Closed</span>`}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Handle Edit
    document.querySelectorAll('.btn-edit-batch-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            const targetCard = batch.cards[idx];
            
            const newOB = prompt(`Edit OB for ${targetCard.cardName} (Numbers only):`, targetCard.ob || '');
            if (newOB === null) return;
            const newNB = prompt(`Edit NB for ${targetCard.cardName} (e.g. Kelipatan 10, Bebas Loncat):`, targetCard.nb || 'Bebas Loncat');
            if (newNB === null) return;
            const newBO = prompt(`Edit BO for ${targetCard.cardName} (Numbers only):`, targetCard.bo || '');
            if (newBO === null) return;

            targetCard.ob = newOB.replace(/[^0-9]/g, ''); targetCard.nb = newNB; targetCard.bo = newBO.replace(/[^0-9]/g, '');
            postData('saveBatch', { batchNo: batchNo, payload: batch });
            document.getElementById('logger-batch-select').dispatchEvent(new Event('change')); 
        });
    });

   // Handle Delete
    document.querySelectorAll('.btn-del-batch-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            const targetCard = batch.cards[idx];
            
            if(confirm(`Are you sure you want to delete ${targetCard.cardName} from this batch?\n\nIts stock will be returned (+1) to your inventory.`)) {
                const invCard = state.inventory.find(c => c.id === targetCard.id);
                if(invCard) {
                    invCard.quantity = Number(invCard.quantity) + 1;
                    silentPostData('updateCard', { id: invCard.id, name: invCard.name, set: invCard.set, rarity: invCard.rarity, language: invCard.language, group: invCard.group, yenPrice: invCard.yenprice, quantity: invCard.quantity, condition: invCard.condition, storage: invCard.storage, frontImage: invCard.frontImage || invCard.frontimage, backImage: invCard.backImage || invCard.backimage });
                }
                batch.cards.splice(idx, 1);
                
                /// FIX: Remove from saved invoices automatically to prevent ghost data
                const origLen = state.invoices.length;
                state.invoices = state.invoices.filter(inv => !(String(inv.batch) === String(batchNo) && inv.cardId === targetCard.id));
                if (state.invoices.length !== origLen) {
                    silentPostData('deleteInvoiceByCard', { batchNo: batchNo, cardId: targetCard.id }).then(() => {
                        renderInvoiceHistory(); updateInvoiceBatchList();
                        updateInvoiceWinnerList(); loadWinnerInvoice(); 
                    });
                }

                // --- NEW: If batch is empty, delete it entirely ---
                if (batch.cards.length === 0) {
                    state.batches = state.batches.filter(b => String(b.batchNo) !== String(batchNo));
                    postData('deleteBatch', { batchNo: batchNo }).then(() => {
                        updateDashboard(); renderInventory();
                        refreshLoggerDropdown();
                        
                        // Clear Stage 2 Dropdown
                        const loggerSelect = document.getElementById('logger-batch-select');
                        if (loggerSelect) {
                            loggerSelect.value = '';
                            loggerSelect.dispatchEvent(new Event('change'));
                        }
                        
                        // Clear Stage 1 Dropdown and FB View
                        const stage1Select = document.getElementById('auction-batch-input');
                        if (stage1Select && stage1Select.value === String(batchNo)) {
                            stage1Select.value = '';
                            auctionDrafts = [];
                            const fbOutput = document.getElementById('fb-post-output');
                            if (fbOutput) { fbOutput.style.display = 'none'; fbOutput.value = ''; }
                            renderAuctionDrafts();
                        }
                    });
                } else {
                    postData('saveBatch', { batchNo: batchNo, payload: batch }).then(() => {
                        updateDashboard(); renderInventory();
                        document.getElementById('logger-batch-select').dispatchEvent(new Event('change'));
                    });
                }
            }
        });
    });
    document.querySelectorAll('.log-status').forEach(select => {
        select.addEventListener('change', function() {
            const isClosed = this.value === 'Closed';
            this.style.borderColor = isClosed ? '#ef4444' : 'var(--accent-yellow)';
            this.style.color = isClosed ? '#ef4444' : 'var(--accent-yellow)';
        });
    });
});

// STAGE 2 -> Saving Winners (INSTANT UI UPDATE & BACKGROUND SYNC)
document.getElementById('btn-save-winners').addEventListener('click', function() {
  const batchNo = document.getElementById('logger-batch-select').value;
  if(!batchNo) {
      alert('Please select a running batch first!');
      return;
  }
  
  const batch = state.batches.find(b => String(b.batchNo) === String(batchNo));
  if(!batch) return;

  const winners = document.querySelectorAll('.log-winner');
  const bids = document.querySelectorAll('.log-bid');
  const imgs = document.querySelectorAll('.log-img');
  const statuses = document.querySelectorAll('.log-status');
  
  let newInvoices = [];
  let allClosed = true;

  winners.forEach((winInput, i) => {
    const winnerName = winInput.value.trim();
    const bidPrice = Number(bids[i].value.replace(/[^0-9]/g, ''));
    const imgUrl = imgs[i].value.trim();
    const status = statuses[i].value;

    batch.cards[i].winner = winnerName;
    batch.cards[i].bid = bids[i].value;
    batch.cards[i].evidence = imgUrl;
    batch.cards[i].status = status;

    if (status === 'Running') allClosed = false;
    
    if (status === 'Closed' && winnerName && bidPrice > 0) {
      const cardId = batch.cards[i].id || ('CARD_TEMP_' + i); 
      const existingInvoice = state.invoices.find(inv => String(inv.batch) === String(batchNo) && inv.cardName === batch.cards[i].cardName && inv.winner === winnerName);
      
      if (!existingInvoice) {
         const newInvoice = {
           id: 'INV_' + Date.now() + '_' + i, batch: batchNo, cardId: cardId, cardName: batch.cards[i].cardName,
           set: batch.cards[i].set || 'Unknown', rarity: batch.cards[i].rarity || 'Promo', winner: winnerName, price: bidPrice, evidence: imgUrl || 'No image',
           payment: '', courier: '', insurance: 'No', 
           shipFee: 0, toploaderQty: 0, address: '', resi: '', status: 'Unpaid',
           date: new Date().toISOString()
         };
         newInvoices.push(newInvoice); 
         state.invoices.push(newInvoice); // Add to local memory immediately
      }
    }
  });
  
  batch.status = allClosed ? 'Closed' : 'Running';

  // --- INSTANT UI UPDATES ---
  if (newInvoices.length > 0) {
    updateInvoiceBatchList(); 
    renderInvoiceHistory();
    const invBatchSelect = document.getElementById('invoice-batch-select');
    if (invBatchSelect) {
        invBatchSelect.value = batchNo;
        updateInvoiceWinnerList();
        invBatchSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    alert(`Progress saved! ${newInvoices.length} winners logged.\n\nPlease input shipping details in Stage 3 (Invoice Manager) before saving the final invoice.`);
  } else if (allClosed) {
    alert(`🔴 All cards closed! Batch status updated to Closed.`);
  } else {
    alert(`💾 Progress saved for ${batchNo}.`);
  }
  
  refreshLoggerDropdown(); 
  if(allClosed) {
    document.getElementById('auction-logger-body').innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Batch closed.</td></tr>`;
  }

  // --- SILENT BACKGROUND SYNC ---
  (async function backgroundSync() {
    await silentPostData('saveBatch', { batchNo: batchNo, payload: batch });
    if (newInvoices.length > 0) {
        await silentPostData('saveInvoices', { invoices: newInvoices });
    }
    fetchData(); // Pull fresh data to verify parity silently
  })();
});

// STAGE 2 -> Close Entire Batch
document.getElementById('btn-close-batch')?.addEventListener('click', function() {
    const batchNo = document.getElementById('logger-batch-select').value;
    if(!batchNo) {
        alert('Please select a running batch first!');
        return;
    }

    if(!confirm(`Are you sure you want to close Batch ${batchNo}?\n\nThis will mark all items as closed. Items without a winner/bid will remain unsold.`)) {
        return;
    }

    // 1. Visually change all dropdowns in the table to 'Closed'
    const statuses = document.querySelectorAll('.log-status');
    statuses.forEach(select => {
        select.value = 'Closed';
        select.dispatchEvent(new Event('change')); // Triggers the red border color update
    });

    // 2. Programmatically click the Save button to reuse your robust saving logic
    document.getElementById('btn-save-winners').click();
});

// STAGE 3: Managing the Invoice
function updateInvoiceBatchList() {
  const select = document.getElementById('invoice-batch-select');
  const uniqueBatches = [...new Set(state.invoices.map(i => i.batch))];
  select.innerHTML = '<option value="">1. Select Auction Batch...</option>' + uniqueBatches.map(b => `<option value="${b}">${b}</option>`).join('');
}

function updateInvoiceWinnerList() {
  const batch = document.getElementById('invoice-batch-select').value;
  const select = document.getElementById('invoice-winner-select');
  if(!batch) { select.innerHTML = '<option value="">2. Select a Winner...</option>'; return; }
  const uniqueWinners = [...new Set(state.invoices.filter(i => String(i.batch) === String(batch)).map(w => w.winner))];
  select.innerHTML = '<option value="">2. Select a Winner...</option>' + uniqueWinners.map(w => `<option value="${w}">${w}</option>`).join('');
}

let currentInvoiceData = [];

function loadWinnerInvoice() {
  const batch = document.getElementById('invoice-batch-select').value;
  const winner = document.getElementById('invoice-winner-select').value;
  const details = document.getElementById('invoice-details');
  if (!batch || !winner) { details.style.display = 'none'; return; }
  
  currentInvoiceData = state.invoices.filter(w => String(w.batch) === String(batch) && w.winner === winner);
  
  document.getElementById('invoice-cards-body').innerHTML = currentInvoiceData.map(c => `
    <tr><td>${c.cardName} ${c.rarity}</td><td>Rp ${c.price.toLocaleString('id-ID')}</td>
    <td>${c.evidence.includes('http') ? `<a href="${c.evidence}" target="_blank">View</a>` : c.evidence}</td></tr>
  `).join('');
  
  if(currentInvoiceData.length > 0) {
      const t = currentInvoiceData[0];
      document.getElementById('inv-payment').value = t.payment || '';
      document.getElementById('inv-courier').value = t.courier || '';
      document.getElementById('inv-insurance').value = t.insurance || 'No';
      document.getElementById('inv-ship-fee').value = t.shipFee ? 'Rp ' + Number(t.shipFee).toLocaleString('id-ID') : '';
      document.getElementById('inv-toploader').value = t.toploaderQty || 0;
      document.getElementById('inv-address').value = t.address || '';
      
      if(document.getElementById('inv-phone')) document.getElementById('inv-phone').value = t.phone || '';
      document.getElementById('inv-resi').value = t.resi || '';
      if(document.getElementById('inv-tracking')) document.getElementById('inv-tracking').value = t.tracking || '';
      
      document.getElementById('inv-status').value = t.status || 'Unpaid';

      const trackingContainer = document.getElementById('inv-tracking-container');
      if (trackingContainer) {
          trackingContainer.style.display = ['Ready to Ship', 'Shipped'].includes(t.status) ? 'block' : 'none';
      }
  }
  
  details.style.display = 'block'; calculateInvoice();
}

window.calculateInvoice = calculateInvoice; 
function calculateInvoice() {
  const payment = document.getElementById('inv-payment').value;
  const courier = document.getElementById('inv-courier').value;
  const useInsurance = document.getElementById('inv-insurance').value === 'Yes';
  const baseShipping = Number(document.getElementById('inv-ship-fee').value.replace(/[^0-9]/g, '')) || 0;
  const toploaderQty = Number(document.getElementById('inv-toploader').value) || 0;
  const shipSection = document.getElementById('inv-shipping-section');
  
  let subtotal = currentInvoiceData.reduce((sum, c) => sum + c.price, 0);
  
  let toploaderFee = toploaderQty * 1300;
  let packingFee = subtotal < 30000 ? 2500 : 0;
  let extraFee = 0;
  let insuranceFee = 0;
  let displayedShipping = baseShipping;

  if (payment === 'Shopee') {
    shipSection.style.display = 'none';
    extraFee = Math.round(subtotal * 0.14) + toploaderFee + packingFee; 
    displayedShipping = 0;
  } else {
    shipSection.style.display = 'block';
    extraFee = toploaderFee + packingFee;
    if (useInsurance) {
      if (courier.includes("Lion Parcel")) insuranceFee = Math.max(950, Math.round(subtotal * 0.004));
      else if (courier.includes("J&T")) insuranceFee = Math.round(subtotal * 0.002);
    }
  }
  
  document.getElementById('inv-subtotal').textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
  document.getElementById('inv-ship-display').textContent = `Rp ${displayedShipping.toLocaleString('id-ID')}`;
  document.getElementById('inv-insurance-display').textContent = `Rp ${insuranceFee.toLocaleString('id-ID')}`;
  document.getElementById('inv-extra-fee').textContent = `Rp ${extraFee.toLocaleString('id-ID')}`;
  document.getElementById('inv-grand-total').textContent = `Rp ${(subtotal + displayedShipping + insuranceFee + extraFee).toLocaleString('id-ID')}`;
}

// STAGE 3 -> Save Invoice Data (INSTANT UI UPDATE & BACKGROUND SYNC)
function saveInvoiceDataToDB() {
    const batch = document.getElementById('invoice-batch-select').value;
    const winner = document.getElementById('invoice-winner-select').value;
    if(!batch || !winner) return alert("Select a batch and winner first!");

    if (!document.getElementById('inv-payment').value) {
        return alert("Please select a Payment Method before saving.");
    }

    if (!currentInvoiceData || currentInvoiceData.length === 0) {
        return alert("No invoice data loaded. Please reselect the winner.");
    }
    
    const shipFee = document.getElementById('inv-ship-fee').value.replace(/[^0-9]/g, '');
    const toploaderQty = document.getElementById('inv-toploader').value;
    let newlyShippedCards = [];
    let revertedFromShippedCards = [];

    // 1. Update memory instantly
    currentInvoiceData.forEach(inv => {
        const wasShipped = inv.status === 'Shipped';
        const newStatus = document.getElementById('inv-status').value;

        inv.payment = document.getElementById('inv-payment').value;
        inv.courier = document.getElementById('inv-courier').value;
        inv.insurance = document.getElementById('inv-insurance').value;
        inv.shipFee = shipFee;
        inv.toploaderQty = toploaderQty;
        inv.address = document.getElementById('inv-address').value;
        
        inv.phone = document.getElementById('inv-phone') ? document.getElementById('inv-phone').value : '';
        inv.resi = document.getElementById('inv-resi').value;
        inv.tracking = document.getElementById('inv-tracking') ? document.getElementById('inv-tracking').value : '';
        
        inv.status = newStatus;

        // Track changes
        if (newStatus === 'Shipped' && !wasShipped) newlyShippedCards.push(inv);
        if (wasShipped && newStatus !== 'Shipped') revertedFromShippedCards.push(inv);
    });

    // 2. Perform UI Updates and Sync Reverted Sales
    if (revertedFromShippedCards.length > 0) {
        revertedFromShippedCards.forEach(inv => {
            const saleToDelete = state.sales.find(s => s.cardid === inv.cardId && String(s.notes).includes(batch));
            if (saleToDelete) {
                state.sales = state.sales.filter(s => s !== saleToDelete);
                silentPostData('deleteSale', { date: saleToDelete.date, cardId: saleToDelete.cardid, quantity: saleToDelete.quantity });
            }
        });
    }

    if (newlyShippedCards.length > 0) {
        newlyShippedCards.forEach(inv => {
            const saleData = { date: new Date().toISOString(), cardid: inv.cardId, name: inv.cardName, set: inv.set, rarity: inv.rarity, quantity: 1, price: inv.price, notes: `Auction Batch: ${batch}` };
            state.sales.push(saleData); 
            silentPostData('recordSale', { ...saleData, cardId: inv.cardId, deductStock: false });
        });
        alert(`Invoice saved as Shipped!\n${newlyShippedCards.length} cards have been moved to Sold Cards.`);
    } else if (revertedFromShippedCards.length > 0) {
        alert(`Invoice status reverted.\n${revertedFromShippedCards.length} cards removed from Sold Cards.`);
    } else {
        alert('Invoice saved successfully!');
    }
    
    renderInventory(); 
    renderSales(); 
    updateDashboard();
    renderInvoiceHistory();

    // 3. Send Payload silently in the background
    (async function backgroundSync() {
        await silentPostData('updateInvoicesBulk', { invoices: currentInvoiceData });
        // fetchData() is removed here intentionally to prevent race conditions wiping the screen
    })();
}

// ============================================================== 
// EXPORT INVOICES TO EXCEL (CSV) ENGINE
// ============================================================== 
window.exportInvoicesToCSV = function() {
    if (!window.currentFilteredInvoices || window.currentFilteredInvoices.length === 0) {
        return alert("No invoices to export! Please adjust your filters.");
    }

    const headers = [
        "Batch", "Winner Name", "Phone Number", "Address", "Payment Method", "Courier", 
        "Resi / Pickup Code", "Tracking", "Invoice Status", "Date Sold", 
        "Card Name", "Set Code", "Rarity", "Bid Price (Rp)", "Shipping Fee (Rp)", 
        "Insurance", "Toploader Qty"
    ];
    
    let csvArray = [headers.join(",")];

    window.currentFilteredInvoices.forEach(group => {
        group.invoices.forEach(inv => {
            // Clean strings to prevent commas in addresses from breaking the Excel columns
            const clean = (str) => '"' + String(str || '').replace(/"/g, '""') + '"';
            
            const row = [
                clean(inv.batch), clean(inv.winner), clean(inv.phone), clean(inv.address),
                clean(inv.payment), clean(inv.courier), clean(inv.resi), clean(inv.tracking),
                clean(inv.status), clean(new Date(inv.date || Date.now()).toLocaleDateString()),
                clean(inv.cardName), clean(inv.set), clean(inv.rarity),
                inv.price || 0, inv.shipFee || 0, clean(inv.insurance), inv.toploaderQty || 0
            ];
            csvArray.push(row.join(","));
        });
    });

    const csvString = csvArray.join("\r\n");
    // The \uFEFF forces Excel to read the file in UTF-8, protecting Japanese/Indonesian characters
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Invoices_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// STAGE 4: Viewing & Editing History
function renderInvoiceHistory() {
  const tbody = document.getElementById('saved-invoices-body');
  if(!tbody) return;
  
  // 1. DYNAMICALLY INJECT TABLE HEADER & BULK MENU (FIXED ALIGNMENT)
  const table = tbody.closest('table');
  if (table) {
    const theadTr = table.querySelector('thead tr');
    // Inject the checkbox into the EXISTING first column to prevent misalignment
    if (theadTr) {
      const firstTh = theadTr.querySelector('th');
      if (firstTh && !firstTh.querySelector('#check-all-invoices')) {
        firstTh.innerHTML = '<input type="checkbox" id="check-all-invoices" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);">';
        firstTh.style.width = '40px';
      }
    }

    let controlsDiv = document.getElementById('invoice-controls-div');
        if (!controlsDiv) {
          controlsDiv = document.createElement('div');
          controlsDiv.id = 'invoice-controls-div';
          controlsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;';
          
          // ✅ NEW: Export to Excel Button
          const exportDiv = document.createElement('div');
          exportDiv.style.cssText = 'display: flex; justify-content: flex-end; width: 100%;';
          exportDiv.innerHTML = `<button id="btn-export-invoices-csv" class="btn-outline" style="padding: 6px 14px; font-size: 13px; color: #22c55e; border-color: rgba(34, 197, 94, 0.4); cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600;"><i class="fas fa-file-excel"></i> Export to Excel (CSV)</button>`;
          controlsDiv.appendChild(exportDiv);

          // Attach listener to fire the export function
          exportDiv.querySelector('#btn-export-invoices-csv').addEventListener('click', window.exportInvoicesToCSV);

          const bulkDiv = document.createElement('div');
          bulkDiv.id = 'bulk-action-invoice-div';
      bulkDiv.style.cssText = 'display: none; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px;';
      
      bulkDiv.innerHTML = `
        <span style="color: var(--accent-yellow); font-weight: 600; font-size: 14px;">
            <span id="bulk-invoice-count">0</span> invoice(s) selected
        </span>
        <div style="display: flex; gap: 10px; align-items: center;">
            <select id="bulk-invoice-status" style="padding: 8px; border-radius: 6px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); outline: none; font-size: 13px; font-weight: 600;">
                <option value="">🔄 Change Status...</option>
                <option value="Paid">Paid</option>
                <option value="Ready to Ship">Ready to Ship</option>
                <option value="Shipped">Shipped</option>
                <option value="Unpaid">Unpaid</option>
            </select>
            <button id="btn-bulk-delete-invoices" style="background: #ef4444; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-trash"></i> Delete Selected
            </button>
        </div>
      `;
      controlsDiv.appendChild(bulkDiv);
      table.parentNode.insertBefore(controlsDiv, table);
    } else {
      document.getElementById('bulk-action-invoice-div').style.display = 'none';
    }
  }

  // 2. GROUP AND PREPARE DATA
  let grouped = {};
  state.invoices.filter(inv => inv.payment && String(inv.payment).trim() !== '').forEach(inv => {
    const key = inv.batch + '___' + inv.winner;
    if(!grouped[key]) {
      grouped[key] = {
        batch: inv.batch, winner: inv.winner, totalPrice: 0, 
        courier: inv.payment === 'Shopee' ? 'Shopee' : (inv.courier || '—'), 
        phone: inv.phone || '—', resi: inv.resi || '—', tracking: inv.tracking || '—',
        status: inv.status || 'Unpaid',
        shipFee: Number(inv.shipFee) || 0, toploaderQty: Number(inv.toploaderQty) || 0,
        invoices: []
      };
    }
    grouped[key].totalPrice += Number(inv.price);
    grouped[key].invoices.push(inv);
  });

  let sortedData = Object.values(grouped);

  // 3. POPULATE FILTERS
  const batchFilterEl = document.getElementById('filter-invoice-batch');
  if (batchFilterEl) {
      const currentFilter = batchFilterEl.value;
      const uniqueBatches = [...new Set(sortedData.map(g => String(g.batch)))];
      batchFilterEl.innerHTML = '<option value="All">All Batches</option>' + uniqueBatches.map(b => `<option value="${b}">${b}</option>`).join('');
      if (uniqueBatches.includes(currentFilter) || currentFilter === 'All') batchFilterEl.value = currentFilter;
  }

  const courierFilterEl = document.getElementById('filter-invoice-courier');
  if (courierFilterEl) {
      const currentCourier = courierFilterEl.value;
      const uniqueCouriers = [...new Set(sortedData.map(g => g.courier))].filter(c => c && c !== '—');
      courierFilterEl.innerHTML = '<option value="All">All Couriers</option>' + uniqueCouriers.map(c => `<option value="${c}">${c}</option>`).join('') + '<option value="—">Unassigned</option>';
      if (uniqueCouriers.includes(currentCourier) || currentCourier === 'All' || currentCourier === '—') courierFilterEl.value = currentCourier;
  }

  // 4. APPLY FILTERS & SORT
  const selectedBatch = batchFilterEl ? batchFilterEl.value : 'All';
  const selectedCourier = courierFilterEl ? courierFilterEl.value : 'All';
  const statusFilterEl = document.getElementById('filter-invoice-status');
  const selectedStatus = statusFilterEl ? statusFilterEl.value : 'All';

  if (selectedBatch !== 'All') sortedData = sortedData.filter(g => String(g.batch) === String(selectedBatch));
  if (selectedCourier !== 'All') sortedData = sortedData.filter(g => g.courier === selectedCourier);
  if (selectedStatus !== 'All') sortedData = sortedData.filter(g => g.status === selectedStatus);

  const sortElement = document.getElementById('sort-invoices');
  const sortVal = sortElement ? sortElement.value : 'batch-desc';
  if (sortVal === 'batch-desc') sortedData.sort((a,b) => String(b.batch).localeCompare(String(a.batch)));
  if (sortVal === 'batch-asc') sortedData.sort((a,b) => String(a.batch).localeCompare(String(b.batch)));

  // ✅ NEW: Save the active dataset so the Excel Exporter can grab exactly what is on screen
  window.currentFilteredInvoices = sortedData;

  // 5. RENDER ROWS
  if (sortedData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: var(--text-secondary);">No invoices match the current filters.</td></tr>`;
      return;
  }

  tbody.innerHTML = sortedData.map((g, index) => {
      let packingFee = g.totalPrice < 30000 ? 2500 : 0;
      let extraFee = (g.toploaderQty * 1300) + packingFee;
      let finalTotal = g.totalPrice + g.shipFee + extraFee; 

      let statusColor = g.status === 'Shipped' ? '#22c55e' : g.status === 'Ready to Ship' ? '#38bdf8' : g.status === 'Paid' ? '#8b5cf6' : '#ef4444';
      let statusBg = g.status === 'Shipped' ? 'rgba(34, 197, 94, 0.15)' : g.status === 'Ready to Ship' ? 'rgba(56, 189, 248, 0.15)' : g.status === 'Paid' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)';

      return `
        <tr>
          <td><input type="checkbox" class="invoice-check" data-batch="${g.batch}" data-winner="${g.winner}" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);"></td>
          <td><span style="background: rgba(234, 179, 8, 0.15); color: var(--accent-yellow); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">${g.batch}</span></td>
          <td><strong>${g.winner}</strong></td>
          <td>Rp ${finalTotal.toLocaleString('id-ID')}</td>
          <td>${g.courier}</td>
          <td><span class="editable-cell edit-phone" data-batch="${g.batch}" data-winner="${g.winner}" contenteditable="true" title="Click to edit">${g.phone}</span></td>
          <td><span class="editable-cell edit-resi" data-batch="${g.batch}" data-winner="${g.winner}" contenteditable="true" title="Click to edit">${g.resi}</span></td>
          <td>
             ${['Ready to Ship', 'Shipped'].includes(g.status) ? `<span class="editable-cell edit-tracking" data-batch="${g.batch}" data-winner="${g.winner}" contenteditable="true" title="Click to edit" style="border-bottom:1px dashed var(--accent-yellow);">${g.tracking}</span>` : `<span style="color:var(--text-secondary); font-size:11px;">N/A</span>`}
          </td>
          <td style="position:relative;">
            <span class="hover-status-btn" data-batch="${g.batch}" data-winner="${g.winner}" style="cursor:pointer; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600; background: ${statusBg}; color: ${statusColor}; border: 1px dashed transparent; display:inline-flex; align-items:center; gap:6px;" title="Click to change status">
              ${g.status} <i class="fas fa-caret-down" style="font-size:10px; opacity:0.6;"></i>
            </span>
          </td>
          <td>
            <div style="display:flex; gap:6px;">
                <button class="btn-outline btn-view-invoice" data-batch="${g.batch}" data-winner="${g.winner}" style="padding: 4px 10px; font-size: 12px;">View</button>
                <button class="btn-outline btn-del-invoice" data-batch="${g.batch}" data-winner="${g.winner}" style="padding: 4px 10px; font-size: 12px; color:#ef4444; border-color: rgba(239, 68, 68, 0.3);"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
  }).join('');

  // Row Event Listeners
  tbody.querySelectorAll('.editable-cell').forEach(cell => {
      if(!cell.hasAttribute('data-batch')) return; 
      cell.addEventListener('mouseenter', () => cell.style.background = 'rgba(128,128,128,0.1)');
      cell.addEventListener('mouseleave', () => cell.style.background = 'transparent');
      cell.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cell.blur(); }});
      cell.addEventListener('blur', () => {
          cell.style.background = 'transparent';
          const batch = cell.getAttribute('data-batch'); const winner = cell.getAttribute('data-winner');
          let newVal = cell.textContent.trim(); if (newVal === '—') newVal = '';

          let isChanged = false;
          const targetInvoices = state.invoices.filter(i => String(i.batch) === String(batch) && i.winner === winner);
          
          targetInvoices.forEach(inv => {
              if (cell.classList.contains('edit-phone') && inv.phone !== newVal) { inv.phone = newVal; isChanged = true; }
              if (cell.classList.contains('edit-resi') && inv.resi !== newVal) { inv.resi = newVal; isChanged = true; }
              if (cell.classList.contains('edit-tracking') && inv.tracking !== newVal) { inv.tracking = newVal; isChanged = true; }
          });
          if (isChanged) silentPostData('updateInvoicesBulk', { invoices: targetInvoices });
      });
  });

  tbody.querySelectorAll('.btn-view-invoice').forEach(btn => {
      btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const batch = btn.getAttribute('data-batch'); const winner = btn.getAttribute('data-winner');
          document.getElementById('invoice-batch-select').value = batch; updateInvoiceWinnerList();
          document.getElementById('invoice-winner-select').value = winner; loadWinnerInvoice();
          document.getElementById('invoice-details').scrollIntoView({ behavior: 'smooth' });
      });
  });

  tbody.querySelectorAll('.btn-del-invoice').forEach(btn => {
      btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const batch = btn.getAttribute('data-batch'); const winner = btn.getAttribute('data-winner');
          if(confirm(`Move the invoice for ${winner} to the Recycle Bin?\n\nThis will reset the fulfillment data and return the invoice to Stage 3.`)) {
              btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.style.pointerEvents = 'none';
              const targetInvoices = state.invoices.filter(i => String(i.batch) === String(batch) && String(i.winner) === String(winner));
              const trashItem = { id: 'TRASH_INV_' + Date.now() + Math.floor(Math.random()*1000), type: 'Invoice', deletedAt: new Date().toISOString(), payload: JSON.stringify({ batch: batch, winner: winner, invoices: JSON.parse(JSON.stringify(targetInvoices)) }) };
              
              await silentPostData('addTrash', { trashItem: trashItem });
              state.trash.unshift(trashItem);

              state.invoices.forEach(inv => {
                  if (String(inv.batch) === String(batch) && String(inv.winner) === String(winner)) {
                      inv.payment = ''; inv.courier = ''; inv.insurance = 'No'; 
                      inv.shipFee = 0; inv.toploaderQty = 0; inv.address = ''; inv.phone = '';
                      inv.resi = ''; inv.tracking = ''; inv.status = 'Unpaid';
                  }
              });

              postData('updateInvoicesBulk', { invoices: state.invoices }).then(() => {
                  renderInvoiceHistory(); updateInvoiceBatchList(); renderTrash();
                  const batchSelect = document.getElementById('invoice-batch-select');
                  if (batchSelect) {
                      batchSelect.value = batch; updateInvoiceWinnerList();
                      const winnerSelect = document.getElementById('invoice-winner-select');
                      if (winnerSelect) { winnerSelect.value = winner; loadWinnerInvoice(); }
                  }
              });
          }
      });
  });

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', (e) => {
      const isInteractive = ['INPUT', 'SELECT', 'BUTTON', 'SPAN'].includes(e.target.tagName) || e.target.closest('button') || e.target.closest('.hover-status-btn') || e.target.closest('.editable-cell');
      if (isInteractive) return;
      if (window.innerWidth <= 768) tr.classList.toggle('expanded');
    });
  });

  // 6. BULK LOGIC (Checkbox Sync, Delete, and Status Change)
  let checkAll = document.getElementById('check-all-invoices');
  const itemChecks = document.querySelectorAll('.invoice-check');
  const bulkDiv = document.getElementById('bulk-action-invoice-div');
  const bulkCountText = document.getElementById('bulk-invoice-count');
  const bulkDeleteBtn = document.getElementById('btn-bulk-delete-invoices');
  const bulkStatusSelect = document.getElementById('bulk-invoice-status');

  if (checkAll) { 
      const newCheckAll = checkAll.cloneNode(true); 
      checkAll.parentNode.replaceChild(newCheckAll, checkAll); 
      checkAll = newCheckAll; 
      checkAll.checked = false; 
  }

  if (checkAll && itemChecks && bulkDiv && bulkCountText) {
      function updateBulkUI() {
          const checkedCount = document.querySelectorAll('.invoice-check:checked').length;
          if (bulkDiv) bulkDiv.style.display = checkedCount > 0 ? 'flex' : 'none';
          if (bulkCountText) bulkCountText.textContent = checkedCount;
          if (checkAll) checkAll.checked = (checkedCount === itemChecks.length && itemChecks.length > 0);
      }
      
      checkAll.addEventListener('change', (e) => { itemChecks.forEach(chk => chk.checked = e.target.checked); updateBulkUI(); }); 
      itemChecks.forEach(chk => chk.addEventListener('change', updateBulkUI));

      // BULK DELETE
      if (bulkDeleteBtn) {
          const newBulkBtn = bulkDeleteBtn.cloneNode(true);
          bulkDeleteBtn.parentNode.replaceChild(newBulkBtn, bulkDeleteBtn);
          
          newBulkBtn.addEventListener('click', async () => {
              const checkedBoxes = document.querySelectorAll('.invoice-check:checked');
              if (checkedBoxes.length === 0) return;

              if(confirm(`Move ${checkedBoxes.length} invoice group(s) to the Recycle Bin?\n\nThis will reset their fulfillment data and return them to Stage 3.`)) {
                  newBulkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Moving...';
                  newBulkBtn.style.pointerEvents = 'none';

                  for (const chk of checkedBoxes) {
                      const b = chk.getAttribute('data-batch'); const w = chk.getAttribute('data-winner');
                      const targetInvoices = state.invoices.filter(i => String(i.batch) === String(b) && String(i.winner) === String(w));
                      const trashItem = { id: 'TRASH_INV_' + Date.now() + Math.random(), type: 'Invoice', deletedAt: new Date().toISOString(), payload: JSON.stringify({ batch: b, winner: w, invoices: JSON.parse(JSON.stringify(targetInvoices)) }) };
                      
                      await silentPostData('addTrash', { trashItem: trashItem });
                      state.trash.unshift(trashItem);

                      state.invoices.forEach(inv => {
                          if (String(inv.batch) === String(b) && String(inv.winner) === String(w)) {
                              inv.payment = ''; inv.courier = ''; inv.insurance = 'No'; 
                              inv.shipFee = 0; inv.toploaderQty = 0; inv.address = ''; inv.phone = '';
                              inv.resi = ''; inv.tracking = ''; inv.status = 'Unpaid';
                          }
                      });
                  }
                  
                  if(checkAll) checkAll.checked = false;

                  postData('updateInvoicesBulk', { invoices: state.invoices }).then(() => {
                      renderInvoiceHistory(); updateInvoiceBatchList(); renderTrash();
                      const batchSelect = document.getElementById('invoice-batch-select');
                      if (batchSelect) batchSelect.value = '';
                      const winnerSelect = document.getElementById('invoice-winner-select');
                      if (winnerSelect) winnerSelect.innerHTML = '<option value="">2. Select a Winner...</option>';
                      document.getElementById('invoice-details').style.display = 'none';
                  });
              }
          });
      }

      // BULK STATUS CHANGE
      if (bulkStatusSelect) {
          const newBulkStatus = bulkStatusSelect.cloneNode(true);
          bulkStatusSelect.parentNode.replaceChild(newBulkStatus, bulkStatusSelect);

          newBulkStatus.addEventListener('change', (e) => {
              const newStatus = e.target.value;
              if (!newStatus) return;

              const checkedBoxes = document.querySelectorAll('.invoice-check:checked');
              if (checkedBoxes.length === 0) { e.target.value = ''; return; }

              if (confirm(`Change status of ${checkedBoxes.length} invoice(s) to "${newStatus}"?`)) {
                  let newlyShipped = [];
                  let revertedFromShipped = [];
                  let invoicesToUpdate = [];

                  checkedBoxes.forEach(chk => {
                      const b = chk.getAttribute('data-batch'); const w = chk.getAttribute('data-winner');
                      state.invoices.forEach(inv => {
                          if (String(inv.batch) === String(b) && String(inv.winner) === String(w)) {
                              if (newStatus === 'Shipped' && inv.status !== 'Shipped') newlyShipped.push(inv);
                              if (inv.status === 'Shipped' && newStatus !== 'Shipped') revertedFromShipped.push(inv);
                              inv.status = newStatus;
                              invoicesToUpdate.push(inv);
                          }
                      });
                  });

                  e.target.value = '';
                  renderInvoiceHistory(); // Update UI instantly

                  silentPostData('updateInvoicesBulk', { invoices: invoicesToUpdate });

                  if (revertedFromShipped.length > 0) {
                      revertedFromShipped.forEach(inv => {
                          const saleToDelete = state.sales.find(s => s.cardid === inv.cardId && String(s.notes).includes(inv.batch));
                          if (saleToDelete) {
                              state.sales = state.sales.filter(s => s !== saleToDelete);
                              silentPostData('deleteSale', { date: saleToDelete.date, cardId: saleToDelete.cardid, quantity: saleToDelete.quantity });
                          }
                      });
                  }

                  if (newlyShipped.length > 0) {
                      newlyShipped.forEach(inv => {
                          const saleData = { date: new Date().toISOString(), cardid: inv.cardId, name: inv.cardName, set: inv.set, rarity: inv.rarity, quantity: 1, price: inv.price, notes: `Auction Batch: ${inv.batch}` };
                          state.sales.push(saleData); 
                          silentPostData('recordSale', { ...saleData, cardId: inv.cardId, deductStock: false });
                      });
                  }

                  if (newlyShipped.length > 0 || revertedFromShipped.length > 0) {
                      setTimeout(() => {
                          alert(`Status updated. Sales records synced!`);
                          renderInventory(); renderSales(); updateDashboard();
                      }, 500); 
                  }
              } else {
                  e.target.value = ''; // Reset dropdown if cancelled
              }
          });
      }
  }

  // 7. INLINE STATUS DROPDOWN (Clicking the status badge)
  document.querySelectorAll('.hover-status-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.border = '1px dashed var(--accent-yellow)');
      btn.addEventListener('mouseleave', () => btn.style.border = '1px dashed transparent');
      btn.addEventListener('click', (e) => {
          document.querySelectorAll('.status-dropdown').forEach(d => d.remove());
          const dropdown = document.createElement('div');
          dropdown.className = 'status-dropdown';
          dropdown.style.cssText = 'position:absolute; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; padding:4px 0; z-index:1000; font-size:12px;';
          
          ['Unpaid', 'Paid', 'Ready to Ship', 'Shipped'].forEach(status => {
              const item = document.createElement('div');
              item.textContent = status;
              item.style.cssText = 'padding:8px 16px; cursor:pointer; color:var(--text-primary);';
              item.addEventListener('mouseenter', () => item.style.background = 'rgba(128,128,128,0.1)');
              item.addEventListener('mouseleave', () => item.style.background = 'transparent');
              item.addEventListener('click', () => {
                  const b = btn.getAttribute('data-batch'); const w = btn.getAttribute('data-winner');
                  const targetInvoices = state.invoices.filter(i => String(i.batch) === String(b) && i.winner === w);
                  
                  let newlyShipped = [];
                  let revertedFromShipped = [];
                  
                  targetInvoices.forEach(inv => {
                      if(status === 'Shipped' && inv.status !== 'Shipped') newlyShipped.push(inv);
                      if(inv.status === 'Shipped' && status !== 'Shipped') revertedFromShipped.push(inv);
                      inv.status = status; 
                  });
                  
                  dropdown.remove();
                  renderInvoiceHistory();
                  silentPostData('updateInvoicesBulk', { invoices: targetInvoices });

                  if (revertedFromShipped.length > 0) {
                      revertedFromShipped.forEach(inv => {
                          const saleToDelete = state.sales.find(s => s.cardid === inv.cardId && String(s.notes).includes(b));
                          if (saleToDelete) {
                              state.sales = state.sales.filter(s => s !== saleToDelete);
                              silentPostData('deleteSale', { date: saleToDelete.date, cardId: saleToDelete.cardid, quantity: saleToDelete.quantity });
                          }
                      });
                  }
                  
                  if (newlyShipped.length > 0) {
                    newlyShipped.forEach(inv => {
                        const saleData = { date: new Date().toISOString(), cardid: inv.cardId, name: inv.cardName, set: inv.set, rarity: inv.rarity, quantity: 1, price: inv.price, notes: `Auction Batch: ${b}` };
                        state.sales.push(saleData); 
                        silentPostData('recordSale', { ...saleData, cardId: inv.cardId, deductStock: false });
                    });
                    setTimeout(() => {
                        alert(`Cards successfully moved to Sold Cards!`);
                        renderInventory(); renderSales(); updateDashboard();
                    }, 500); 
                  } else if (revertedFromShipped.length > 0) {
                      setTimeout(() => {
                          alert(`Cards removed from Sold Cards!`);
                          renderInventory(); renderSales(); updateDashboard();
                      }, 500);
                  }
              });
              dropdown.appendChild(item);
          });
          
          const rect = btn.getBoundingClientRect();
          dropdown.style.top = `${rect.bottom + window.scrollY}px`;
          dropdown.style.left = `${rect.left + window.scrollX}px`;
          document.body.appendChild(dropdown);
          
          setTimeout(() => { document.addEventListener('click', function closeDropdown(ev) {
              if(!dropdown.contains(ev.target)) { dropdown.remove(); document.removeEventListener('click', closeDropdown); }
          }); }, 10);
      });
  });
}function copyInvoiceText() {
  const winner = document.getElementById('invoice-winner-select').value;
  const address = document.getElementById('inv-address').value || 'Not provided';
  const phone = document.getElementById('inv-phone') ? document.getElementById('inv-phone').value : 'Not provided';
  const resi = document.getElementById('inv-resi').value || 'Pending';
  const tracking = document.getElementById('inv-tracking') ? document.getElementById('inv-tracking').value : 'N/A';
  
  let itemsText = currentInvoiceData.map(c => `- ${c.cardName} ${c.rarity}: Rp ${c.price.toLocaleString('id-ID')}`).join('\n');
  
  const subtotalText = document.getElementById('inv-subtotal').textContent;
  const shipText = document.getElementById('inv-ship-display').textContent;
  const insText = document.getElementById('inv-insurance-display').textContent;
  const extraFeeText = document.getElementById('inv-extra-fee').textContent;
  const grandTotalText = document.getElementById('inv-grand-total').textContent;
  
  const finalString = `*INVOICE FOR ${winner.toUpperCase()}*\n\n*Items Won:*\n${itemsText}\n\nSubtotal: ${subtotalText}\nShipping Fee: ${shipText}\nInsurance: ${insText}\nPacking & Toploader: ${extraFeeText}\n*Grand Total: ${grandTotalText}*\n\n*Shipping Info:*\nAddress: ${address}\nPhone: ${phone}\nPickup/Dropoff Code: ${resi}\nTracking Number: ${tracking}\n\nThank you for participating!`;
  
  const tempInput = document.createElement("textarea"); tempInput.value = finalString; document.body.appendChild(tempInput);
  tempInput.select(); document.execCommand("copy"); document.body.removeChild(tempInput); alert("Invoice copied to clipboard!");
}

async function downloadWinnerEvidence() {
  if (!currentInvoiceData || currentInvoiceData.length === 0) return;

  const btn = document.getElementById('btn-download-evidence');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Grid...';
  btn.disabled = true;

  try {
      const winnerName = currentInvoiceData[0].winner || 'Winner';
      const safeWinnerName = winnerName.replace(/[^a-z0-9]/gi, '_');

      // Filter out empty cards or direct sales
      const validItems = currentInvoiceData.filter(item => item.evidence && item.evidence !== 'No image' && item.evidence !== 'Direct Sale');
      
      if (validItems.length === 0) {
          alert('No valid evidence screenshots found for this invoice.');
          return;
      }

      // 🛑 NEW: Fetch the batch data to find the original hashtag numbers
      const batchNo = validItems[0].batch;
      const currentBatch = state.batches.find(b => String(b.batchNo) === String(batchNo));

      // Load all images cleanly
      const loadedImages = await Promise.all(validItems.map(async (item) => {
          try {
              let rawUrl = item.evidence;
              let objUrl = null;
              
              if (rawUrl.startsWith('data:image')) {
                  objUrl = rawUrl;
              } else {
                  // Fetch through proxy to safely handle CORS and convert to Blob
                  const directUrl = typeof getDirectImageUrl === 'function' ? getDirectImageUrl(rawUrl, 'w1600') : rawUrl;
                  const res = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(directUrl)}&q=100`);
                  const blob = await res.blob();
                  objUrl = URL.createObjectURL(blob);
              }

              return new Promise((resolve) => {
                  const img = new Image();
                  img.crossOrigin = "anonymous";
                  img.onload = () => resolve({ img, item, objUrl });
                  img.onerror = () => resolve(null);
                  img.src = objUrl;
              });
          } catch (e) {
              console.error("Failed to load evidence for", item.cardName, e);
              return null;
          }
      }));

      // Drop any failed image loads
      const validLoaded = loadedImages.filter(x => x && x.img);
      if (validLoaded.length === 0) throw new Error("Could not load any images for the grid.");

      // Grid Math (Wider aspect ratio for FB comments)
      const CELL_WIDTH = 800;
      const CELL_HEIGHT = 450; 
      const cols = Math.ceil(Math.sqrt(validLoaded.length));
      const rows = Math.ceil(validLoaded.length / cols);

      const PADDING = 40;
      const HEADER_HEIGHT = 100;

      const canvas = document.createElement('canvas');
      canvas.width = (cols * CELL_WIDTH) + (PADDING * 2);
      canvas.height = (rows * CELL_HEIGHT) + HEADER_HEIGHT + (PADDING * 2);
      const ctx = canvas.getContext('2d');

      // 1. Draw Canvas Background
      ctx.fillStyle = '#0f172a'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. 🛑 NEW: Draw Main Title ("List Kartu")
      ctx.fillStyle = '#eab308'; 
      ctx.font = 'bold 42px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`List Kartu: ${winnerName}`, canvas.width / 2, PADDING + 50);

      // 3. Draw each screenshot into the grid
      validLoaded.forEach((data, index) => {
          const x = PADDING + (index % cols) * CELL_WIDTH;
          const y = PADDING + HEADER_HEIGHT + Math.floor(index / cols) * CELL_HEIGHT;

          // 🛑 NEW: Find the original hashtag number from the batch data
          let cardNumber = '';
          if (currentBatch) {
              const batchCardIndex = currentBatch.cards.findIndex(c => c.id === data.item.cardId || c.cardName === data.item.cardName);
              if (batchCardIndex !== -1) {
                  cardNumber = `#${batchCardIndex + 1} `;
              }
          }

          // Draw Card Info Text
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 22px Inter, sans-serif';
          ctx.textAlign = 'center';
          const label = `${cardNumber}${data.item.cardName} (${data.item.rarity}) - Rp ${Number(data.item.price).toLocaleString('id-ID')}`;
          ctx.fillText(label, x + CELL_WIDTH / 2, y + 30);

          // Calculate Image Constraints (Object-Fit Contain)
          const imgAreaWidth = CELL_WIDTH - 40;
          const imgAreaHeight = CELL_HEIGHT - 60;
          const imgRatio = data.img.width / data.img.height;
          const areaRatio = imgAreaWidth / imgAreaHeight;
          
          let drawWidth, drawHeight;
          if (imgRatio > areaRatio) {
              drawWidth = imgAreaWidth;
              drawHeight = imgAreaWidth / imgRatio;
          } else {
              drawHeight = imgAreaHeight;
              drawWidth = imgAreaHeight * imgRatio;
          }

          const drawX = x + 20 + (imgAreaWidth - drawWidth) / 2;
          const drawY = y + 50 + (imgAreaHeight - drawHeight) / 2;

          // Apply a drop shadow to the evidence pictures
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 6;
          ctx.drawImage(data.img, drawX, drawY, drawWidth, drawHeight);
          
          ctx.shadowColor = 'transparent'; // Reset shadow for next text loop

          // 🛑 NEW: STAMP THE PRICE BADGE IF REQUESTED
          let sellPrice = Number(data.item.card.sellPrice || 0);
          if (stampPrices && sellPrice > 0 && !data.item.label.includes('(Back)')) {
              let priceText = (sellPrice >= 1000) ? (sellPrice / 1000) + 'k' : sellPrice;
              ctx.font = 'bold 32px Inter, sans-serif';
              let tWidth = ctx.measureText(priceText).width;
              
              let padX = 14; let padY = 8;
              let bWidth = tWidth + (padX * 2); let bHeight = 46;
              
              // Position at Bottom-Right of the image area
              let bX = drawX + drawWidth - bWidth - 15;
              let bY = drawY + drawHeight - bHeight - 15;

              ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
              ctx.beginPath(); ctx.roundRect(bX, bY, bWidth, bHeight, 8); ctx.fill();

              ctx.fillStyle = '#eab308';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(priceText, bX + (bWidth / 2), bY + (bHeight / 2) + 2);
          }

          if (data.objUrl && !data.objUrl.startsWith('data:image')) {
              URL.revokeObjectURL(data.objUrl); // Free up browser memory
          }
      });

      // 4. Download directly as a JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `List_Kartu_${safeWinnerName}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

  } catch (e) {
      console.error(e);
      alert("Error generating evidence grid: " + e.message);
  } finally {
      // Restore the button UI
      btn.innerHTML = originalText;
      btn.disabled = false;
  }
}

/* ============================================================== */
/* CAMERA, IMAGE UPLOAD & AUTO-SCAN ENGINE (PHASE 3)              */
/* ============================================================== */
const IMGBB_API_KEY = '03e49015aa1285249f3d5556a5149879';
let videoStream = null;
let scannedImages = { front: '', back: '' };
let activeScanTarget = null;
let mobilePollingInterval = null;      // NEW
let currentMobileSessionId = null;     // NEW 

// Promises to track background uploads seamlessly
let frontUploadPromise = null;
let backUploadPromise = null;

// Auto-Scan State Variables
let autoScanInterval = null;
let previousFrameData = [];
let stableFrames = 0;
let isWaitingForMotion = false; 
let autoScanPhase = 'FRONT'; // 'FRONT' or 'BACK'
let autoFrontBase64 = null;
const MOTION_THRESHOLD = 15; // Higher = less sensitive to motion
const STABLE_FRAME_TARGET = 8; // ~800ms of holding still

// New Control Variables
let isAutoScanPaused = false;
let isCooldown = false;
let scanCooldownTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    const btnScan = document.getElementById('btn-scan-card');
    const btnCloseCam = document.getElementById('cancel-camera');
    const btnCapFront = document.getElementById('btn-cap-front');
    const btnCapBack = document.getElementById('btn-cap-back');
    const captureModeSelect = document.getElementById('capture-mode-select');
    const batchInput = document.getElementById('batchFileInput');

    if (btnScan) {
        btnScan.addEventListener('click', () => { 
            const mode = captureModeSelect ? captureModeSelect.value : 'webcam';
            
            if (mode === 'batch') {
                // Open standard file explorer for batch uploads
                if (batchInput) batchInput.click();
            } else {
                // Open the standard Add Cards camera mode
                activeScanTarget = null; 
                openCameraModal(); 
            }
        });
    }
    
    if (batchInput) {
        batchInput.addEventListener('change', async (event) => {
            const files = Array.from(event.target.files);
            if (!files || files.length === 0) return;

            const originalBtnHtml = btnScan.innerHTML;
            
            // --- SMART CHRONOLOGICAL GROUPING ALGORITHM ---
            // Groups files naturally based on the physical time you took them
            files.sort((a, b) => a.lastModified - b.lastModified);
            
            let cardGroups = [];
            let currentGroup = { images: [], video: null };
            
            for (let file of files) {
                if (file.type.startsWith('video/')) {
                    if (currentGroup.video) {
                        cardGroups.push(currentGroup);
                        currentGroup = { images: [], video: file };
                    } else {
                        currentGroup.video = file;
                    }
                } else if (file.type.startsWith('image/')) {
                    if (currentGroup.images.length >= 2) {
                        cardGroups.push(currentGroup);
                        currentGroup = { images: [file], video: null };
                    } else {
                        currentGroup.images.push(file);
                    }
                }
            }
            if (currentGroup.images.length > 0 || currentGroup.video) {
                cardGroups.push(currentGroup);
            }

            // --- PROCESS EXTRACTED GROUPS ---
            for (let i = 0; i < cardGroups.length; i++) {
                btnScan.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing Card ${i + 1}...`;
                
                try {
                    const group = cardGroups[i];
                    const frontFile = group.images[0];
                    const backFile = group.images[1]; 
                    const videoFile = group.video;

                    let frontBase64 = null;
                    let frontUploadPromise = Promise.resolve(null);
                    if (frontFile) {
                        frontBase64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result.split(',')[1]);
                            reader.readAsDataURL(frontFile);
                        });
                        frontUploadPromise = processImageUpload(frontBase64, 'front');
                    }

                    let backBase64 = null;
                    let backUploadPromise = Promise.resolve(null);
                    if (backFile) {
                        backBase64 = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result.split(',')[1]);
                            reader.readAsDataURL(backFile);
                        });
                        backUploadPromise = processImageUpload(backBase64, 'back');
                    }
                    
                    let videoUploadPromise = Promise.resolve(null);
                    if (videoFile) {
                        // Bypasses the modal and feeds the video directly to Cloudinary -> Drive
                        videoUploadPromise = processVideoPipeline(videoFile, btnScan, null);
                    }
                    
                    // Attach all media promises to the row builder
                    processAutoRowCreation(frontBase64, backBase64, frontUploadPromise, backUploadPromise, true, videoUploadPromise);
                    
                    // Throttle sequentially to prevent ImgBB / Cloudinary rate limiting
                    await Promise.all([frontUploadPromise, backUploadPromise, videoUploadPromise]);
                } catch (error) {
                    console.error("Batch processing error:", error);
                }
            }
            btnScan.innerHTML = originalBtnHtml;
            event.target.value = ''; // Reset input
        });
    }

    if(btnCloseCam) btnCloseCam.addEventListener('click', closeCameraModal);
    if(btnCapFront) btnCapFront.addEventListener('click', () => captureAndUpload('front'));
    if(btnCapBack) btnCapBack.addEventListener('click', () => captureAndUpload('back'));
});

// Dynamically injects the Auto-Scan UI into the modal
function injectAutoScanUI() {
    let controlsContainer = document.getElementById('auto-scan-controls');
    if (!controlsContainer) {
        const btnCapFront = document.getElementById('btn-cap-front');
        if (!btnCapFront) return;
        const camActions = btnCapFront.parentNode;
        
        controlsContainer = document.createElement('div');
        controlsContainer.id = 'auto-scan-controls';
        controlsContainer.style.cssText = 'width: 100%; margin-top: 16px; padding: 12px; background: rgba(128,128,128,0.1); border-radius: 8px; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;';
        
        controlsContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-weight: 600; font-size: 14px; color: var(--accent-yellow); display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-robot"></i> Auto-Scan Mode
                </label>
                <label class="switch" style="position: relative; display: inline-block; width: 44px; height: 24px;">
                    <input type="checkbox" id="toggle-auto-scan" style="opacity: 0; width: 0; height: 0;">
                    <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #3f3f46; transition: .4s; border-radius: 24px;"></span>
                </label>
            </div>
            <div id="auto-scan-settings" style="display: none; flex-direction: column; gap: 12px; border-top: 1px dashed var(--border-color); padding-top: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Capture Mode:</span>
                    <select id="auto-scan-mode" style="background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 6px; font-size: 13px; outline: none; cursor: pointer;">
                        <option value="frontAndBack">Front + Backside</option>
                        <option value="frontOnly">Front Only</option>
                    </select>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 4px;">
                    <button id="btn-start-auto" style="flex: 1; background: #22c55e; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-play"></i> Start Engine
                    </button>
                    <button id="btn-pause-auto" style="display: none; flex: 1; background: #f59e0b; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-pause"></i> Pause
                    </button>
                    <button id="btn-resume-auto" style="display: none; flex: 1; background: #3b82f6; color: #fff; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; align-items: center; justify-content: center; gap: 8px;">
                        <i class="fas fa-play"></i> Resume
                    </button>
                </div>
            </div>
        `;
        camActions.parentNode.insertBefore(controlsContainer, camActions);

        const style = document.createElement('style');
        style.innerHTML = `
            #toggle-auto-scan:checked + .slider { background-color: var(--accent-yellow); }
            #toggle-auto-scan:checked + .slider:before { transform: translateX(20px); }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
        `;
        document.head.appendChild(style);

        // Toggle Switch Logic
        document.getElementById('toggle-auto-scan').addEventListener('change', (e) => {
            const settings = document.getElementById('auto-scan-settings');
            const manualBtns = btnCapFront.parentNode;
            if (e.target.checked) {
                settings.style.display = 'flex';
                manualBtns.style.display = 'none';
                document.getElementById('camera-status').textContent = "Select mode and click Start Engine.";
            } else {
                settings.style.display = 'none';
                manualBtns.style.display = 'flex';
                fullStopAutoScan();
                document.getElementById('camera-status').textContent = "Line up the card and capture.";
            }
        });

        // Start Button Logic
        document.getElementById('btn-start-auto').addEventListener('click', () => {
            document.getElementById('btn-start-auto').style.display = 'none';
            document.getElementById('btn-pause-auto').style.display = 'flex';
            document.getElementById('auto-scan-mode').disabled = true; 
            document.getElementById('auto-scan-mode').style.opacity = '0.6';
            startAutoScanEngine();
        });

        // Pause Button Logic
        document.getElementById('btn-pause-auto').addEventListener('click', () => {
            isAutoScanPaused = true;
            document.getElementById('btn-pause-auto').style.display = 'none';
            document.getElementById('btn-resume-auto').style.display = 'flex';
            document.getElementById('camera-status').innerHTML = `<i class="fas fa-pause-circle" style="color:#f59e0b;"></i> Auto-Scan Paused`;
        });

        // Resume Button Logic
        document.getElementById('btn-resume-auto').addEventListener('click', () => {
            isAutoScanPaused = false;
            previousFrameData = [];
            stableFrames = 0;
            document.getElementById('btn-resume-auto').style.display = 'none';
            document.getElementById('btn-pause-auto').style.display = 'flex';
            document.getElementById('camera-status').innerHTML = `<i class="fas fa-spinner fa-spin"></i> Hold card steady in frame...`;
        });
    }
}

// Resets all auto-scan controls when modal closes or toggle turns off
function fullStopAutoScan() {
    stopAutoScanEngine();
    isAutoScanPaused = false;
    isCooldown = false;
    if (scanCooldownTimer) clearTimeout(scanCooldownTimer);
    
    const btnStart = document.getElementById('btn-start-auto');
    const btnPause = document.getElementById('btn-pause-auto');
    const btnResume = document.getElementById('btn-resume-auto');
    const modeSelect = document.getElementById('auto-scan-mode');
    
    if(btnStart) btnStart.style.display = 'flex';
    if(btnPause) btnPause.style.display = 'none';
    if(btnResume) btnResume.style.display = 'none';
    if(modeSelect) {
        modeSelect.disabled = false;
        modeSelect.style.opacity = '1';
    }
}

function playBeep(type = 'success') {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'success') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, ctx.currentTime); gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'done') {
        osc.type = 'square'; osc.frequency.setValueAtTime(1200, ctx.currentTime); gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
    }
}

async function openCameraModal() {
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('modal-camera').style.display = 'flex';
    
    const video = document.getElementById('camera-stream');
    const status = document.getElementById('camera-status');
    const toggleBtn = document.getElementById('btn-toggle-mobile-scan');
    
    // Hard reset Mobile UI & Polling state
    document.getElementById('mobile-hd-container').style.display = 'none';
    document.getElementById('qr-code-img').style.display = 'none';
    if (mobilePollingInterval) clearInterval(mobilePollingInterval);
    
    // Always show the Mobile Toggle
    if (toggleBtn) toggleBtn.style.display = 'block';
    
    injectAutoScanUI();
    const autoScanToggle = document.getElementById('toggle-auto-scan');
    if (autoScanToggle) autoScanToggle.checked = false;
    document.getElementById('auto-scan-settings').style.display = 'none';
    
    const manualBtns = document.getElementById('btn-cap-front');
    if (manualBtns) {
        manualBtns.parentNode.style.display = 'flex';
        video.parentNode.style.display = 'block'; // Ensure video wrapper is visible
    }
    
    fullStopAutoScan();
    
    try {
        status.textContent = "Requesting camera access...";
        videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        video.srcObject = videoStream;
        status.textContent = "Line up the card and capture.";
        
        scannedImages = { front: '', back: '' };
        frontUploadPromise = null;
        backUploadPromise = null;
        
        document.getElementById('btn-cap-front').style.display = 'flex';
        document.getElementById('btn-cap-front').innerHTML = 'Capture Front';
        document.getElementById('btn-cap-front').disabled = false;
        document.getElementById('btn-cap-back').style.display = 'none';
    } catch (err) {
        status.textContent = "Camera access denied. Check browser permissions.";
    }
}

function closeCameraModal() {
    fullStopAutoScan();
    if (mobilePollingInterval) clearInterval(mobilePollingInterval);
    
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    const video = document.getElementById('camera-stream');
    if (video) video.srcObject = null;
    
    document.getElementById('modal-camera').style.display = 'none';
    
    const mediaModal = document.getElementById('modal-media-manager');
    if (!mediaModal || mediaModal.style.display === 'none') {
        document.getElementById('modal-overlay').style.display = 'none';
    }
}

/* ============================================================== */
/* THE AUTO-SCAN PIXEL DIFFERENCING ENGINE                        */
/* ============================================================== */
function startAutoScanEngine() {
    const video = document.getElementById('camera-stream');
    const status = document.getElementById('camera-status');
    const mCanvas = document.createElement('canvas');
    mCanvas.width = 64; mCanvas.height = 64;
    const mCtx = mCanvas.getContext('2d', {willReadFrequently: true});
    
    previousFrameData = [];
    stableFrames = 0;
    isWaitingForMotion = false;
    isCooldown = false;
    isAutoScanPaused = false;
    autoScanPhase = 'FRONT';
    autoFrontBase64 = null;
    status.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Hold card steady in frame...`;

    autoScanInterval = setInterval(() => {
        // Block processing if paused, in cooldown, or video isn't ready
        if (!video.videoWidth || isAutoScanPaused || isCooldown) return; 
        
        mCtx.drawImage(video, 0, 0, 64, 64);
        const currentFrame = mCtx.getImageData(0, 0, 64, 64).data;
        let diff = 0;

        if (previousFrameData.length > 0) {
            for (let i = 0; i < currentFrame.length; i += 4) {
                diff += Math.abs(currentFrame[i] - previousFrameData[i]) + 
                        Math.abs(currentFrame[i+1] - previousFrameData[i+1]) + 
                        Math.abs(currentFrame[i+2] - previousFrameData[i+2]);
            }
        }
        previousFrameData = new Uint8ClampedArray(currentFrame);
        const avgDiff = diff / (64 * 64);

        if (avgDiff > MOTION_THRESHOLD) {
            stableFrames = 0;
            if (isWaitingForMotion) {
                isWaitingForMotion = false; 
                status.innerHTML = autoScanPhase === 'FRONT' ? `<i class="fas fa-search"></i> Motion detected. Show next card...` : `<i class="fas fa-sync"></i> Motion detected. Show backside...`;
            }
        } else if (!isWaitingForMotion) {
            stableFrames++;
            if (stableFrames > STABLE_FRAME_TARGET) {
                triggerAutoCapture();
            }
        }
    }, 100);
}

function stopAutoScanEngine() {
    if (autoScanInterval) {
        clearInterval(autoScanInterval);
        autoScanInterval = null;
    }
}

function startScanCooldown() {
    isCooldown = true;
    const status = document.getElementById('camera-status');
    status.innerHTML = `<i class="fas fa-clock" style="color:#38bdf8;"></i> Readying next scan...`;
    
    scanCooldownTimer = setTimeout(() => {
        isCooldown = false;
        stableFrames = 0; 
        previousFrameData = []; 
        status.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Hold card steady in frame...`;
    }, 1500); // 1.5 seconds foreground capture cooldown
}

function getCroppedBase64(video, canvas) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    
    // 1. Calculate the exact 3:4 area that is visually rendered on screen
    let visibleWidth, visibleHeight;
    if (vw / vh > 3 / 4) {
        visibleHeight = vh;
        visibleWidth = vh * (3 / 4);
    } else {
        visibleWidth = vw;
        visibleHeight = vw * (4 / 3);
    }
    
    // 2. Find the top-left corner of that visible 3:4 area
    const containerX = (vw - visibleWidth) / 2;
    const containerY = (vh - visibleHeight) / 2;

    // 3. Apply the 15% margin (capturing the center 70%) to match your yellow brackets
    const finalWidth = visibleWidth * 0.70;
    const finalHeight = visibleHeight * 0.70;
    const finalX = containerX + (visibleWidth * 0.15);
    const finalY = containerY + (visibleHeight * 0.15);

    // 4. Force the canvas to be the size of the smaller tight crop
    canvas.width = finalWidth;
    canvas.height = finalHeight;

    // 5. Draw ONLY the area inside the yellow brackets
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
        video, 
        finalX, finalY, finalWidth, finalHeight, // Grab exactly inside the brackets
        0, 0, finalWidth, finalHeight            // Place onto the tight canvas
    );
    
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
}

function triggerAutoCapture() {
    isWaitingForMotion = true; 
    stableFrames = 0;
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('camera-canvas');
    const scanMode = document.getElementById('auto-scan-mode').value;
    const aiToggle = document.getElementById('ai-scan-toggle');
    const useAI = aiToggle ? aiToggle.checked : false;

    // Apply High-Res Center Crop instead of full frame
    const base64Image = getCroppedBase64(video, canvas);

    if (autoScanPhase === 'FRONT') {
        playBeep('success');
        autoFrontBase64 = base64Image;
        frontUploadPromise = processImageUpload(base64Image, 'front');

        if (scanMode === 'frontOnly') {
            processAutoRowCreation(autoFrontBase64, null, frontUploadPromise, null, useAI);
            autoScanPhase = 'FRONT'; 
            startScanCooldown(); // Wait 3 seconds before next card
        } else {
            autoScanPhase = 'BACK';
            startScanCooldown(); // Wait 3 seconds for user to flip card
        }
    } else if (autoScanPhase === 'BACK') {
        playBeep('done');
        backUploadPromise = processImageUpload(base64Image, 'back');
        
        processAutoRowCreation(autoFrontBase64, base64Image, frontUploadPromise, backUploadPromise, useAI);
        
        autoScanPhase = 'FRONT'; 
        autoFrontBase64 = null;
        startScanCooldown(); // Wait 3 seconds before next card
    }
}

// SMART ROW FINDER: Looks for the first top empty row, creates one if full.
function getNextAvailableRow() {
    if (!addCardsBody) return null;
    const rows = addCardsBody.querySelectorAll('tr');
    
    for (let row of rows) {
        const nameInput = row.querySelector('.c-name');
        const frontImg = row.getAttribute('data-front-img');
        const backImg = row.getAttribute('data-back-img');
        
        // ✅ NEW: Check if this row has already been claimed by a background upload
        const batchId = row.getAttribute('data-batch-id'); 
        
        // A row is considered "empty" if there is no name, no photos, AND no active batch ID
        if (!batchId && nameInput && nameInput.value.trim() === '' && (!frontImg || frontImg === '') && (!backImg || backImg === '')) {
            return row; 
        }
    }
    
    // If all rows are full, spawn a new one and return it
    addEmptyCardRow();
    return addCardsBody.lastElementChild;
}

// Dynamically populates row in the background
function processAutoRowCreation(frontBase64, backBase64, frontPromise, backPromise, useAI, videoPromise = Promise.resolve(null)) {
    const targetRow = getNextAvailableRow();
    if (!targetRow) return;

    const scanBtn = targetRow.querySelector('.btn-row-scan');
    if (scanBtn) {
        scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        scanBtn.style.color = '#38bdf8';
        scanBtn.style.borderColor = '#38bdf8';
    }

    // Wait for photos AND video to finish uploading FIRST
    Promise.all([frontPromise, backPromise, videoPromise]).then(([frontUrl, backUrl, videoUrl]) => {
        if(frontUrl) targetRow.setAttribute('data-front-img', frontUrl);
        if(backUrl) targetRow.setAttribute('data-back-img', backUrl);
        
        // 🚀 NEW: Trigger AI using the Cloud URL instead of raw base64 to prevent server crashes
        if (useAI && frontUrl) {
            processAICognition(frontUrl, targetRow);
        }
        
        // Push the video silently into the row's condition media memory
        if(videoUrl) {
            const mediaBtn = targetRow.querySelector('.btn-manage-media');
            if (mediaBtn) {
                let mediaData = { video: '', flaws: [] };
                try { mediaData = JSON.parse(mediaBtn.getAttribute('data-media') || '{"video":"","flaws":[]}'); } catch(e) {}
                
                mediaData.video = videoUrl;
                mediaBtn.setAttribute('data-media', JSON.stringify(mediaData));
                
                const mediaCount = (mediaData.video ? 1 : 0) + (mediaData.flaws?.length || 0);
                mediaBtn.innerHTML = `<i class="fas fa-photo-video"></i> (${mediaCount})`;
                mediaBtn.style.color = 'var(--accent-yellow)';
                mediaBtn.style.borderColor = 'var(--accent-yellow)';
            }
        }
        
        if (scanBtn) {
            scanBtn.innerHTML = '✅ Auto-Saved';
            scanBtn.style.color = 'var(--accent-yellow)';
            scanBtn.style.borderColor = 'var(--accent-yellow)';
        }
    });
}

/* ============================================================== */
/* BACKGROUND UPLOAD & AI COGNITION WORKERS                       */
/* ============================================================== */

async function processImageUpload(base64Image, side) {
    try {
        // --- 1. DETERMINE FOLDER ROUTING (GROUP) ---
        const groupSelect = document.getElementById('group-select');
        const groupName = (groupSelect && groupSelect.value) ? groupSelect.value : 'Unassigned';

        let rarityName = 'Unassigned_Rarity';

        // --- 2. GENERATE SHARED ID & EXTRACT RARITY ---
        let sharedId = 'SCAN_' + Date.now();
        if (typeof activeScanTarget !== 'undefined' && activeScanTarget) {
            if (activeScanTarget.card) {
                if (activeScanTarget.card.id) sharedId = activeScanTarget.card.id;
                if (activeScanTarget.card.rarity) rarityName = activeScanTarget.card.rarity;
            } 
            else if (activeScanTarget.element) {
                let existingId = activeScanTarget.element.getAttribute('data-scan-id');
                if (!existingId) {
                    existingId = 'ROW_' + Date.now();
                    activeScanTarget.element.setAttribute('data-scan-id', existingId);
                }
                sharedId = existingId;
                
                const raritySelect = activeScanTarget.element.querySelector('.c-rarity');
                if (raritySelect && raritySelect.value) {
                    rarityName = raritySelect.value;
                }
            }
        }

        rarityName = rarityName.replace(/[^a-zA-Z0-9_-]/g, '') || 'Unassigned_Rarity';

        let sidePrefix = "00-Unknown";
        if (side === 'front') sidePrefix = "01-Front";
        else if (side === 'back') sidePrefix = "02-Back";
        else if (side === 'flaw') sidePrefix = "03-Flaw";

        const smartFilename = `${sharedId}_${sidePrefix}.jpg`;

        // --- 4. UPLOAD TO IMGBB ---
        const formData = new FormData();
        formData.append('image', base64Image);
        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const imgbbData = await imgbbRes.json();
        
        // ✅ NEW: Strict error reporting for ImgBB limits
        if (!imgbbData.success) {
            alert(`ImgBB Error: Image rejected. It likely exceeds their 32MB uncompressed file size limit.`);
            return null;
        }
        
        const tempUrl = imgbbData.data.url;

        // --- 5. SEND TO GOOGLE DRIVE WITH NESTED ROUTING METADATA ---
        const gasRes = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'uploadCameraImage', 
                pass: sessionStorage.getItem('appPass'), 
                imageUrl: tempUrl, 
                filename: smartFilename,
                folderName: groupName,
                rarityName: rarityName 
            })
        });
        
        // ✅ NEW: Strict error reporting for Google Apps Script connection drops
        const text = await gasRes.text();
        if (text.trim().startsWith('<') || gasRes.status !== 200) {
            alert(`Google Server Blocked the Upload.\n\n1. Ensure your Apps Script is deployed with "Who has access: Anyone".\n2. Do NOT use "Anyone with a Google Account".\n3. Try uploading in an Incognito window to bypass Google's multi-account login bug.`);
            return null;
        }

        const gasData = JSON.parse(text);
        if (!gasData.success) {
            alert(`Google Drive Error: ${gasData.error}`);
            return null;
        }
        
        return gasData.downloadUrl; 
    } catch (err) {
        alert("Network Error: Could not reach the server to upload the image. Check console for details.");
        console.error("Upload routing failed:", err);
        return null;
    }
}

/* ============================================================== */
/* AI COGNITION GLOBAL THROTTLE QUEUE                             */
/* ============================================================== */
let aiRequestQueue = [];
let isProcessingAI = false;

document.addEventListener('DOMContentLoaded', () => {
    const killButtons = document.querySelectorAll('.btn-kill-queue');
    
    killButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if(confirm("Halt all pending AI scans and clear the queue?")) {
                aiRequestQueue = [];
                isProcessingAI = false;
                
                // Hide all kill switch buttons
                killButtons.forEach(b => b.style.display = 'none');
                
                // Clear UI indicators
                document.querySelectorAll('.c-name').forEach(inp => {
                    if (inp.value.includes('Analyzing...') || inp.value.includes('In Queue')) {
                        inp.value = '';
                        inp.style.color = 'inherit';
                    }
                });
                alert("AI Queue Reset.");
            }
        });
    });
});

function processAICognition(imageUrl, rowElement) {
    const inputs = rowElement.querySelectorAll('input, select');
    let nameInput = null;
    let setInput = null;
    
    inputs.forEach(input => {
        const identifier = (input.name || input.className || input.placeholder || '').toLowerCase();
        if (identifier.includes('name')) nameInput = input;
        if (identifier.includes('set')) setInput = input;
    });

    if (nameInput) {
        const statusText = isProcessingAI ? `🤖 In Queue (${aiRequestQueue.length + 1})...` : "🤖 AI analyzing...";
        nameInput.value = statusText;
        nameInput.style.color = isProcessingAI ? "#38bdf8" : "inherit";
    }

    aiRequestQueue.push({ imageUrl, rowElement, inputs, nameInput, setInput });
    
    const killButtons = document.querySelectorAll('.btn-kill-queue');
    if (aiRequestQueue.length > 0) {
        killButtons.forEach(b => b.style.display = 'inline-flex');
    }

    if (!isProcessingAI) {
        processNextInAIQueue();
    }
}

// --- UPDATED QUEUE LIMITS ---
// 4300 milliseconds (4.3 seconds) guarantees a maximum of ~14 requests per minute
const DELAY_BETWEEN_REQUESTS = 4300; 

async function processNextInAIQueue() {
    if (aiRequestQueue.length === 0) {
        isProcessingAI = false;
        return;
    }

    isProcessingAI = true;
    const task = aiRequestQueue.shift();
    const row = task.rowElement;

    if (row) {
        const nameInput = row.querySelector('.c-name');
        const setInput = row.querySelector('.c-set');
        const raritySelect = row.querySelector('.c-rarity');
        const languageSelect = row.querySelector('.c-lang');
        const numberInput = row.querySelector('.c-number'); 

        if (nameInput) nameInput.value = `⏳ Analyzing...`;

        try {
            const pass = sessionStorage.getItem('appPass');
            
            const response = await fetch(API_URL, {
                method: 'POST',
                // 🚀 NEW: Send the short URL instead of the massive base64 payload
                body: JSON.stringify({ action: 'analyzeCardAI', imageUrl: task.imageUrl, pass: pass })
            });

            const res = await response.json();

            if (res.success && res.data) {
                const returnedName = typeof res.data === 'string' ? res.data : (res.data.name || '');
                
                if (returnedName.includes("API 429") || returnedName.includes("RESOURCE_EXHAUSTED") || returnedName.includes("high demand") || returnedName.includes("ERROR")) {
                    if (nameInput) {
                        nameInput.value = "⚠️ High Demand. Retrying in 5s...";
                        nameInput.style.color = "#f59e0b"; 
                    }
                    aiRequestQueue.unshift(task); 
                    await new Promise(resolve => setTimeout(resolve, 5000)); 
                } else {
                    if (nameInput && returnedName.trim() !== '') {
                        nameInput.value = returnedName;
                        nameInput.style.color = ''; 
                    } else if (nameInput) {
                        nameInput.value = "⚠️ AI Failed (Check Image)";
                        nameInput.style.color = "#ef4444";
                    }
                    
                    if (setInput && res.data.set) setInput.value = res.data.set;
                    if (numberInput && (res.data.cardNo || res.data.cardNumber)) numberInput.value = res.data.cardNo || res.data.cardNumber;
                    if (raritySelect && res.data.rarity) raritySelect.value = res.data.rarity;
                    if (languageSelect && res.data.language) languageSelect.value = res.data.language;
                }
            } else {
                if (nameInput) {
                    nameInput.value = "❌ AI Error";
                    nameInput.style.color = "#ef4444";
                }
            }
        } catch (error) {
            console.error("AI Analysis Error:", error);
            if (nameInput) nameInput.value = "❌ Network Error";
        }
    }

    if (aiRequestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        processNextInAIQueue();
    } else {
        isProcessingAI = false;
        const killButtons = document.querySelectorAll('.btn-kill-queue');
        killButtons.forEach(b => b.style.display = 'none');
    }
}
/* MANUAL CAPTURE HANDLER (Modified for Multi-Scan Routing) */
/* ============================================================== */
// Add the async keyword
function captureAndUpload(side, directBase64 = null) {
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('camera-canvas');
    const status = document.getElementById('camera-status');
    const btn = document.getElementById(side === 'front' ? 'btn-cap-front' : 'btn-cap-back');
    const target = activeScanTarget;

    let base64Image;

    if (directBase64) {
        base64Image = directBase64;
    } else {
        base64Image = getCroppedBase64(video, canvas);
    }

    if (side === 'front') {
        frontUploadPromise = processImageUpload(base64Image, 'front');
        if (target && target.type === 'update_side') {
            closeCameraModal();
            frontUploadPromise.then(url => { if (url) updateSpecificCardSide(target, 'front', url); });
            return;
        }

        const aiToggle = document.getElementById('ai-scan-toggle');
        const useAI = aiToggle ? aiToggle.checked : false;
        if (useAI && target && target.type === 'new_row') {
            // 🚀 NEW: Wait for URL before sending to AI
            frontUploadPromise.then(url => {
                if (url) processAICognition(url, target.element);
            });
        }
        
        btn.style.display = 'none';
        const backBtn = document.getElementById('btn-cap-back');
        backBtn.style.display = 'flex';
        backBtn.disabled = false;
        backBtn.innerHTML = 'Capture Back';
        status.textContent = "Front captured! Now flip the card.";
    } else {
        backUploadPromise = processImageUpload(base64Image, 'back');
        activeScanTarget = null;
        closeCameraModal();

        if (target && target.type === 'update_side') {
            backUploadPromise.then(url => { if (url) updateSpecificCardSide(target, 'back', url); });
            return;
        }

        Promise.all([frontUploadPromise, backUploadPromise]).then(([frontUrl, backUrl]) => {
            if (!frontUrl && !backUrl) {
                if (target && target.type === 'new_row') target.element.querySelector('.btn-row-scan').innerHTML = 'Scan Failed';
                return;
            }
            
            scannedImages.front = frontUrl || '';
            scannedImages.back = backUrl || '';

            let trElement = null;
            if (!target || target.type === 'add_new') {
                trElement = getNextAvailableRow();
            } else if (target.type === 'new_row') {
                trElement = target.element;
            }

            if (trElement) {
                trElement.setAttribute('data-front-img', scannedImages.front);
                trElement.setAttribute('data-back-img', scannedImages.back);
                const scanBtn = trElement.querySelector('.btn-row-scan');
                if (scanBtn) {
                    scanBtn.innerHTML = '✅ Saved';
                    scanBtn.style.color = 'var(--accent-yellow)';
                    scanBtn.style.borderColor = 'var(--accent-yellow)';
                }
            } else if (target && target.type === 'inventory') {
                const targetCard = target.card;
                state.inventory.forEach(item => {
                    if (item.id === targetCard.id || (item.name === targetCard.name && item.set === targetCard.set && item.rarity === targetCard.rarity)) {
                        item.frontImage = scannedImages.front || item.frontImage;
                        item.backImage = scannedImages.back || item.backImage;
                        silentPostData('updateCard', {
                            id: item.id, name: item.name, set: item.set, rarity: item.rarity, language: item.language, group: item.group, yenPrice: item.yenprice, quantity: item.quantity, condition: item.condition, storage: item.storage, frontImage: item.frontImage, backImage: item.backImage
                        });
                    }
                });
                renderInventory();
            } else if (target && target.type === 'global' && typeof globalSelectedId !== 'undefined') {
                const targetCard = state.inventory.find(item => item.id == globalSelectedId);
                if (targetCard) {
                    targetCard.frontImage = scannedImages.front || targetCard.frontImage;
                    targetCard.backImage = scannedImages.back || targetCard.backImage;
                    silentPostData('updateCard', {
                        id: targetCard.id, name: targetCard.name, set: targetCard.set, rarity: targetCard.rarity, language: targetCard.language, group: targetCard.group, yenPrice: targetCard.yenprice, quantity: targetCard.quantity, condition: targetCard.condition, storage: targetCard.storage, frontImage: targetCard.frontImage, backImage: targetCard.backImage
                    });
                    renderInventory(); 
                }
            }
        });
    }
}



document.addEventListener('DOMContentLoaded', () => {
    const btnCloseZoom = document.getElementById('close-image-zoom');
    const modalZoom = document.getElementById('modal-image-zoom');
    
    if (btnCloseZoom) btnCloseZoom.addEventListener('click', () => modalZoom.style.display = 'none');
    if (modalZoom) {
        modalZoom.addEventListener('click', (e) => {
            if (e.target === modalZoom) modalZoom.style.display = 'none';
        });
    }

    // Phase 1 Auction Export Hooks
    document.getElementById('btn-export-auction-grid')?.addEventListener('click', () => {
        if (auctionDrafts.length === 0) return alert("No cards in draft! Add cards to the draft first.");
        const isWatermarked = document.getElementById('chk-watermark-auction') ? document.getElementById('chk-watermark-auction').checked : false;
        const includeBackside = document.getElementById('chk-include-back-auction') ? document.getElementById('chk-include-back-auction').checked : false;
        generateCatalogExport(auctionDrafts, 'grid', isWatermarked, includeBackside, true);
    });

    document.getElementById('btn-export-auction-zip')?.addEventListener('click', () => {
        if (auctionDrafts.length === 0) return alert("No cards in draft! Add cards to the draft first.");
        const isWatermarked = document.getElementById('chk-watermark-auction') ? document.getElementById('chk-watermark-auction').checked : false;
        const includeBackside = document.getElementById('chk-include-back-auction') ? document.getElementById('chk-include-back-auction').checked : false;
        generateCatalogExport(auctionDrafts, 'zip', isWatermarked, includeBackside, true);
    });
});

/* ============================================================== */
/* CATALOG EXPORT & BATCH DOWNLOAD (HYBRID JSZIP)                 */
/* ============================================================== */
async function generateCatalogExport(cards, mode, useWatermark, includeBackside = false, isAuction = false, stampPrices = false) {
    if (cards.length === 0) return alert("No cards selected!");
    
    const targetRatio = 400 / 560; 

    // Store original text by button ID to prevent getting stuck on "Processing..."
    const originalTexts = new Map();
    document.querySelectorAll('#btn-export-auction-grid, #btn-export-grid, #btn-export-auction-zip, #btn-export-zip').forEach(btn => {
        if (btn.id) originalTexts.set(btn.id, btn.innerHTML);
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        btn.style.pointerEvents = 'none';
    });

    try {
        // 1. Expand Variants & Build Image Processing List
        let imagesToProcess = [];
        let itemIndex = 1;
        
        cards.forEach((card) => {
            let subCards = [];
            if (!isAuction && !card._isSingleVariant && card.variants && Object.keys(card.variants).length > 0) {
                subCards = Object.values(card.variants);
            } else {
                subCards = [card];
            }
            
            subCards.forEach(subCard => {
                let fUrl = subCard.frontImage || subCard.frontimage || '';
                let bUrl = subCard.backImage || subCard.backimage || '';
                
                if (!fUrl || !bUrl) {
                    const master = state.inventory.find(c => c.id === subCard.id);
                    if (master) {
                        if (!fUrl) fUrl = master.frontImage || master.frontimage;
                        if (!bUrl) bUrl = master.backImage || master.backimage;
                    }
                }
                if (!fUrl && subCard.evidence) fUrl = subCard.evidence;

                if (!fUrl || fUrl.length < 5) return; // Skip if no front image

                const safeName = (subCard.displayName || subCard.name || subCard.cardName || `card`).replace(/[^a-zA-Z0-9 \[\]]/g, '').trim();
                const safeRarity = (subCard.rarity || 'Promo').replace(/[^a-zA-Z0-9]/g, '');
                const prefix = isAuction ? `#${itemIndex} ` : '';

                imagesToProcess.push({
                    card: subCard,
                    url: fUrl,
                    filename: `${prefix}(F) ${safeName}_${safeRarity}`,
                    label: `${prefix}${safeName} (Front)`
                });

                if (includeBackside && bUrl && bUrl.length > 5) {
                    imagesToProcess.push({
                        card: subCard,
                        url: bUrl,
                        filename: `${prefix}(B) ${safeName}_${safeRarity}`,
                        label: `${prefix}${safeName} (Back)`
                    });
                }
            });
            itemIndex++;
        });

        if (imagesToProcess.length === 0) throw new Error("No valid images found for export.");

        // --- 100% UNCOMPRESSED HYBRID ZIP ROUTE ---
        if (mode === 'zip' && !useWatermark) {
            if (typeof JSZip === 'undefined') throw new Error("JSZip library not loaded.");
            const zip = new JSZip();
            const folder = zip.folder("Pokemon_Cards_Raw");
            let addedCount = 0; 
            
            for (let i = 0; i < imagesToProcess.length; i++) {
                const item = imagesToProcess[i];
                let rawUrl = item.url;
                const safeName = item.filename;
                
                try {
                    const driveMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/id=([a-zA-Z0-9_-]+)/);
                    if (driveMatch && driveMatch[1]) {
                        const driveId = driveMatch[1];
                        const gasRes = await fetch(API_URL, {
                            method: 'POST',
                            body: JSON.stringify({
                                action: 'getDriveFileBase64', pass: sessionStorage.getItem('appPass'), fileId: driveId
                            })
                        });
                        const gasData = await gasRes.json();
                        
                        if (gasData.success && gasData.base64) {
                            let ext = gasData.mimeType === 'image/png' ? 'png' : 'jpg';
                            folder.file(`${safeName}.${ext}`, gasData.base64, { base64: true });
                            addedCount++;
                        }
                    } else if (rawUrl.startsWith('data:image')) {
                        const base64Data = rawUrl.split(',')[1];
                        let ext = rawUrl.includes('image/png') ? 'png' : 'jpg';
                        folder.file(`${safeName}.${ext}`, base64Data, { base64: true });
                        addedCount++;
                    } else {
                        let blob = null;
                        try {
                            const res = await fetch(rawUrl, { mode: 'cors' });
                            if (!res.ok) throw new Error("Native fetch blocked");
                            blob = await res.blob();
                        } catch (err) {
                            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&q=100`;
                            const res2 = await fetch(proxyUrl);
                            if (res2.ok) blob = await res2.blob();
                        }
                        if (blob && blob.size > 0) {
                            let ext = blob.type === 'image/png' ? 'png' : 'jpg';
                            folder.file(`${safeName}.${ext}`, blob);
                            addedCount++;
                        }
                    }
                } catch (err) {
                    console.error("Failed completely for:", safeName, err);
                }
            }
            
            if (addedCount === 0) {
                alert("No valid images were found to download.");
            } else {
                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `Pokemon_Export_Raw_${Date.now()}.zip`);
            }
            
            document.querySelectorAll('#btn-export-auction-grid, #btn-export-grid, #btn-export-auction-zip, #btn-export-zip').forEach(btn => {
                if (btn.id && originalTexts.has(btn.id)) btn.innerHTML = originalTexts.get(btn.id);
                btn.style.pointerEvents = 'auto';
            });
            return;
        }

        // --- GRID STITCHING & WATERMARK LOGIC ---
        const loadedImages = await Promise.all(imagesToProcess.map(async (item, index) => {
            const resolution = mode === 'zip' ? 's0' : 'w1600'; 
            const baseImgUrl = typeof getDirectImageUrl === 'function' ? getDirectImageUrl(item.url, resolution) : item.url;
            return new Promise(async (resolve) => {
                if (!baseImgUrl) return resolve({ item, img: null, objectUrl: null });
                try {
                    let blob;
                    if (baseImgUrl.startsWith('data:image')) {
                        const res = await fetch(baseImgUrl);
                        blob = await res.blob();
                    } else {
                        try {
                            const directRes = await fetch(baseImgUrl, { mode: 'cors' });
                            if (!directRes.ok) throw new Error('Direct fetch HTTP error');
                            blob = await directRes.blob();
                        } catch (directErr) {
                            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(baseImgUrl)}&q=100&nocache=${Date.now()}${index}`;
                            const proxyRes = await fetch(proxyUrl);
                            if (!proxyRes.ok) throw new Error('Proxy fetch HTTP error');
                            blob = await proxyRes.blob();
                        }
                    }
                    const objectUrl = URL.createObjectURL(blob);
                    const img = new Image();
                    img.onload = () => resolve({ item, img, objectUrl, rawBlob: blob });
                    img.onerror = () => resolve({ item, img: null, objectUrl, rawBlob: blob });
                    img.src = objectUrl;
                } catch (err) {
                    console.error("Image failed to load:", item.filename, err);
                    resolve({ item, img: null, objectUrl: null });
                }
            });
        }));

       if (mode === 'grid') {
            const scaleMultiplier = 2; 
            const gridCardWidth = 800 * scaleMultiplier;  
            const gridCardHeight = 1120 * scaleMultiplier; 
            let cols = Math.ceil(Math.sqrt(loadedImages.length));
            let rows = Math.ceil(loadedImages.length / cols);

            let compressOutput = false; 

            // --- NEW: DRAG & DROP PREVIEW MODAL WITH CROP & ROTATE EDITOR ---
            try {
                compressOutput = await new Promise((resolve, reject) => {
                    const overlay = document.createElement('div');
                    overlay.id = 'grid-preview-overlay';
                    // FIXED SQUASHING: Using align-items: stretch so side trash zones fill vertically
                    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); z-index: 100000; display: flex; flex-direction: row; align-items: stretch; justify-content: space-between;';

                    overlay.innerHTML = `
                        <div class="trash-zone" style="flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(239, 68, 68, 0.15); font-size: 64px; transition: all 0.2s; border-right: 4px dashed transparent; box-sizing: border-box;"><i class="fas fa-trash-alt"></i></div>
                        
                        <div style="background: var(--bg-surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); width: 85vw; max-width: 1200px; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); box-sizing: border-box; z-index: 2; align-self: center;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-shrink: 0; flex-wrap: wrap; gap: 12px;">
                                <h3 style="margin: 0; color: var(--accent-yellow); font-size: 20px;"><i class="fas fa-th"></i> Arrange Grid Layout</h3>
                                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                                    <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: var(--text-primary); background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                                        <input type="checkbox" id="chk-compress-grid" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent-yellow);">
                                        <i class="fas fa-compress-arrows-alt" style="color: var(--text-secondary);"></i> Compress Image Size
                                    </label>
                                    <div style="display: flex; gap: 10px;">
                                        <button id="btn-cancel-grid" class="btn-outline" style="padding: 8px 16px; border-radius: 6px; cursor: pointer;">Cancel</button>
                                        <button id="btn-confirm-grid" style="padding: 8px 16px; background: #22c55e; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;"><i class="fas fa-download"></i> Generate Image</button>
                                    </div>
                                </div>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 13px; margin-top: 0; margin-bottom: 16px; flex-shrink: 0;">Drag and drop cards to reorder them. <strong>Drag a card to the dark empty spaces on the far left or right to delete it.</strong></p>
                            <div id="dnd-grid-container" style="flex: 1; overflow-y: auto; background: #000000; padding: 20px; border-radius: 8px; display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start; gap: 10px;"></div>
                        </div>

                        <div class="trash-zone" style="flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(239, 68, 68, 0.15); font-size: 64px; transition: all 0.2s; border-left: 4px dashed transparent; box-sizing: border-box;"><i class="fas fa-trash-alt"></i></div>
                    `;

                    document.body.appendChild(overlay);

                    let currentOrder = [...loadedImages];
                    const dndContainer = document.getElementById('dnd-grid-container');
                    
                    let draggedIndex = null;

                    const openImageEditor = (index) => {
                        const itemData = currentOrder[index];
                        const origImg = itemData.img;
                        if (!origImg) return;

                        const editOverlay = document.createElement('div');
                        editOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.98); z-index: 100005; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff;';

                        editOverlay.innerHTML = `
                            <div style="background: var(--bg-surface); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; border: 1px solid var(--border-color); box-shadow: 0 25px 50px rgba(0,0,0,0.8);">
                                <h3 style="margin-top: 0; color: var(--accent-yellow);"><i class="fas fa-crop-alt"></i> Adjust Image</h3>
                                <div style="overflow: hidden; border: 2px dashed var(--text-secondary); border-radius: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                                    <canvas id="edit-canvas" style="cursor: move; background: #000; max-height: 55vh; display: block;"></canvas>
                                </div>
                                
                                <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 20px; width: 100%; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); width: 280px; justify-content: space-between;">
                                        <i class="fas fa-search-minus" style="font-size: 12px; color: var(--text-secondary);"></i>
                                        <input type="range" id="edit-zoom" min="0.5" max="3" step="0.05" value="1" style="flex: 1; accent-color: var(--accent-yellow);">
                                        <i class="fas fa-search-plus" style="font-size: 12px; color: var(--text-secondary);"></i>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); padding: 8px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); width: 280px; justify-content: space-between;">
                                        <i class="fas fa-undo" style="font-size: 12px; color: var(--text-secondary);"></i>
                                        <input type="range" id="edit-rotate" min="-180" max="180" step="1" value="0" style="flex: 1; accent-color: var(--accent-yellow);">
                                        <i class="fas fa-redo" style="font-size: 12px; color: var(--text-secondary);"></i>
                                    </div>
                                </div>
                                <p style="font-size: 12px; color: var(--text-secondary); margin-top: 12px; margin-bottom: 24px;"><i class="fas fa-mouse-pointer"></i> Click & Drag the image to reposition it.</p>

                                <div style="display: flex; gap: 10px; width: 100%; justify-content: space-between;">
                                    <button id="btn-cancel-edit" class="btn-outline" style="padding: 10px 20px; border-radius: 6px; font-weight: bold;">Cancel</button>
                                    <button id="btn-save-edit" style="padding: 10px 20px; background: #22c55e; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Save Edit</button>
                                </div>
                            </div>
                        `;
                        document.body.appendChild(editOverlay);

                        const canvas = document.getElementById('edit-canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Force canvas to perfectly match export grid ratio
                        const cw = 400; 
                        const ch = 560;
                        canvas.width = cw;
                        canvas.height = ch;

                        let scale = 1;
                        let rotation = 0;
                        let panX = 0;
                        let panY = 0;
                        
                        const imgRatio = origImg.width / origImg.height;
                        const canvasRatio = cw / ch;
                        let baseDrawW = cw;
                        let baseDrawH = ch;

                        if (imgRatio > canvasRatio) {
                            baseDrawH = cw / imgRatio;
                        } else {
                            baseDrawW = ch * imgRatio;
                        }

                        const renderEdit = () => {
                            ctx.fillStyle = '#000';
                            ctx.fillRect(0, 0, cw, ch);
                            ctx.save();
                            ctx.translate(cw/2 + panX, ch/2 + panY);
                            ctx.rotate(rotation * Math.PI / 180);
                            ctx.scale(scale, scale);
                            ctx.drawImage(origImg, -baseDrawW/2, -baseDrawH/2, baseDrawW, baseDrawH);
                            ctx.restore();
                        };

                        renderEdit();

                        const zoomSlider = document.getElementById('edit-zoom');
                        const rotateSlider = document.getElementById('edit-rotate');
                        let activeSlider = zoomSlider; // Default to zoom

                        zoomSlider.onmousedown = () => { activeSlider = zoomSlider; };
                        rotateSlider.onmousedown = () => { activeSlider = rotateSlider; };

                        zoomSlider.oninput = (e) => { scale = parseFloat(e.target.value); activeSlider = zoomSlider; renderEdit(); };
                        rotateSlider.oninput = (e) => { rotation = parseFloat(e.target.value); activeSlider = rotateSlider; renderEdit(); };

                        // Global Arrow Key Listener for the active slider
                        const handleModalKeys = (e) => {
                            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                                e.preventDefault(); 
                                const step = parseFloat(activeSlider.step) || 1;
                                const direction = e.key === 'ArrowRight' ? 1 : -1;
                                let newVal = parseFloat(activeSlider.value) + (step * direction);
                                
                                newVal = Math.max(parseFloat(activeSlider.min), Math.min(parseFloat(activeSlider.max), newVal));
                                activeSlider.value = newVal;
                                
                                if (activeSlider === zoomSlider) scale = newVal;
                                else rotation = newVal;
                                
                                renderEdit();
                            }
                        };
                        window.addEventListener('keydown', handleModalKeys);

                        let isDragging = false;
                        let startX, startY;

                        canvas.onmousedown = (e) => { isDragging = true; startX = e.clientX - panX; startY = e.clientY - panY; };
                        canvas.onmousemove = (e) => { if(isDragging) { panX = e.clientX - startX; panY = e.clientY - startY; renderEdit(); } };
                        
                        const handleMouseUp = () => { isDragging = false; };
                        window.addEventListener('mouseup', handleMouseUp);

                        document.getElementById('btn-cancel-edit').onclick = () => {
                            window.removeEventListener('keydown', handleModalKeys);
                            window.removeEventListener('mouseup', handleMouseUp);
                            document.body.removeChild(editOverlay);
                        };
                        
                        document.getElementById('btn-save-edit').onclick = () => {
                            window.removeEventListener('keydown', handleModalKeys);
                            window.removeEventListener('mouseup', handleMouseUp);
                            
                            const btnSave = document.getElementById('btn-save-edit');
                            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
                            btnSave.style.pointerEvents = 'none';

                            const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
                            const newImg = new Image();
                            newImg.onload = () => {
                                currentOrder[index].img = newImg;
                                currentOrder[index].objectUrl = dataUrl;
                                renderDndGrid(); // Refresh layout to show edit
                                document.body.removeChild(editOverlay);
                            };
                            newImg.src = dataUrl;
                        };
                    };

                    const renderDndGrid = () => {
                        const currentCols = Math.ceil(Math.sqrt(currentOrder.length)) || 1;
                        const itemWidth = `calc((100% / ${currentCols}) - 10px)`;

                        dndContainer.innerHTML = '';
                        currentOrder.forEach((data, index) => {
                            const itemDiv = document.createElement('div');
                            itemDiv.draggable = true;
                            itemDiv.dataset.index = index;
                            itemDiv.style.cssText = `flex: 0 0 ${itemWidth}; max-width: ${itemWidth}; aspect-ratio: ${gridCardWidth} / ${gridCardHeight}; background: #1e1e24; border: 2px solid transparent; border-radius: 6px; overflow: hidden; cursor: grab; position: relative; transition: transform 0.2s, border 0.2s; box-sizing: border-box; box-shadow: 0 4px 10px rgba(0,0,0,0.5);`;

                            const imgSrc = data.objectUrl || data.item.url;
                            if (imgSrc) {
                                itemDiv.innerHTML = `
                                    <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;">
                                    <button class="btn-edit-item" style="position: absolute; top: 4px; left: 4px; background: rgba(0,0,0,0.85); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 6px; cursor: pointer; z-index: 10; font-size: 14px; pointer-events: auto; transition: 0.2s;" title="Crop & Rotate Image"><i class="fas fa-crop-alt"></i></button>
                                `;
                            }

                            const editBtn = itemDiv.querySelector('.btn-edit-item');
                            if (editBtn) {
                                editBtn.addEventListener('mouseenter', () => editBtn.style.background = 'var(--accent-yellow)');
                                editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'rgba(0,0,0,0.85)');
                                editBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    openImageEditor(index);
                                });
                            }

                            itemDiv.addEventListener('dragstart', (e) => {
                                draggedIndex = index;
                                e.dataTransfer.effectAllowed = 'move';
                                setTimeout(() => itemDiv.style.opacity = '0.5', 0);
                            });

                            itemDiv.addEventListener('dragend', () => {
                                itemDiv.style.opacity = '1';
                                draggedIndex = null;
                                document.querySelectorAll('#dnd-grid-container > div').forEach(d => {
                                    d.style.border = '2px solid transparent';
                                    d.style.transform = 'scale(1)';
                                });
                            });

                            itemDiv.addEventListener('dragover', (e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (draggedIndex !== null && draggedIndex !== index) {
                                    itemDiv.style.border = '2px dashed var(--accent-yellow)';
                                    itemDiv.style.transform = 'scale(1.02)';
                                }
                            });

                            itemDiv.addEventListener('dragleave', () => {
                                itemDiv.style.border = '2px solid transparent';
                                itemDiv.style.transform = 'scale(1)';
                            });

                            itemDiv.addEventListener('drop', (e) => {
                                e.preventDefault();
                                if (draggedIndex !== null && draggedIndex !== index) {
                                    const draggedItem = currentOrder[draggedIndex];
                                    currentOrder.splice(draggedIndex, 1);
                                    currentOrder.splice(index, 0, draggedItem);
                                    renderDndGrid();
                                }
                            });

                            dndContainer.appendChild(itemDiv);
                        });
                    };

                    renderDndGrid();

                    // --- TRASH ZONES ---
                    document.querySelectorAll('.trash-zone').forEach(zone => {
                        zone.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            zone.style.background = 'rgba(239, 68, 68, 0.2)';
                            zone.style.borderColor = 'rgba(239, 68, 68, 0.8)';
                            zone.style.color = 'rgba(239, 68, 68, 1)';
                        });
                        zone.addEventListener('dragleave', () => {
                            zone.style.background = 'transparent';
                            zone.style.borderColor = 'transparent';
                            zone.style.color = 'rgba(239, 68, 68, 0.15)';
                        });
                        zone.addEventListener('drop', (e) => {
                            e.preventDefault();
                            zone.style.background = 'transparent';
                            zone.style.borderColor = 'transparent';
                            zone.style.color = 'rgba(239, 68, 68, 0.15)';
                            if (draggedIndex !== null) {
                                currentOrder.splice(draggedIndex, 1);
                                draggedIndex = null;
                                renderDndGrid();
                            }
                        });
                    });

                    document.getElementById('btn-cancel-grid').addEventListener('click', () => {
                        document.body.removeChild(overlay);
                        reject(new Error('Cancelled'));
                    });

                    document.getElementById('btn-confirm-grid').addEventListener('click', () => {
                        if (currentOrder.length === 0) {
                            alert("Cannot generate an empty grid.");
                            return;
                        }
                        const isCompressed = document.getElementById('chk-compress-grid').checked;
                        loadedImages.splice(0, loadedImages.length, ...currentOrder);
                        document.body.removeChild(overlay);
                        resolve(isCompressed);
                    });
                });
            } catch (err) {
                document.querySelectorAll('#btn-export-auction-grid, #btn-export-grid, #btn-export-auction-zip, #btn-export-zip').forEach(btn => {
                    if (btn.id && originalTexts.has(btn.id)) btn.innerHTML = originalTexts.get(btn.id);
                    btn.style.pointerEvents = 'auto';
                });
                return;
            }
            // --- END DRAG & DROP MODAL ---

            // RECALCULATE COLS/ROWS in case items were deleted!
            cols = Math.ceil(Math.sqrt(loadedImages.length));
            rows = Math.ceil(loadedImages.length / cols);
            
            const canvas = document.createElement('canvas');
            canvas.width = cols * gridCardWidth;
            canvas.height = rows * gridCardHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Calculate offset for centering the last row
            const itemsInLastRow = loadedImages.length % cols === 0 ? cols : loadedImages.length % cols;
            const offsetX = ((cols - itemsInLastRow) * gridCardWidth) / 2;

            loadedImages.forEach((data, index) => {
                const currentRow = Math.floor(index / cols);
                let x = (index % cols) * gridCardWidth;
                
                // Shift the x-coordinate if it's the last row
                if (currentRow === rows - 1 && itemsInLastRow < cols) {
                    x += offsetX;
                }
                
                const y = currentRow * gridCardHeight;
                
                if (data.img) {
                    const imgRatio = data.img.width / data.img.height;
                    let sWidth = data.img.width;
                    let sHeight = data.img.height;

                    if (imgRatio > targetRatio) {
                        sWidth = data.img.height * targetRatio;
                    } else {
                        sHeight = data.img.width / targetRatio;
                    }

                    const sx = (data.img.width - sWidth) / 2;
                    const sy = (data.img.height - sHeight) / 2;

                    ctx.drawImage(data.img, sx, sy, sWidth, sHeight, x, y, gridCardWidth, gridCardHeight);
                } else {
                    ctx.fillStyle = '#333';
                    ctx.fillRect(x, y, gridCardWidth, gridCardHeight);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 36px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(data.item.label || 'No Image', x + gridCardWidth/2, y + gridCardHeight/2);
                }

                if (useWatermark) {
                    ctx.save();
                    ctx.translate(x + gridCardWidth / 2, y + gridCardHeight / 2);
                    ctx.rotate(-Math.PI / 6); 
                    ctx.globalAlpha = 0.55; 
                    ctx.font = 'bold 90px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    
                    ctx.shadowColor = 'rgba(0,0,0,0.9)';
                    ctx.shadowBlur = 12;
                    ctx.shadowOffsetX = 3;
                    ctx.shadowOffsetY = 3;

                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                    ctx.lineWidth = 4;
                    ctx.strokeText('Said Rafif R', 0, 0);

                    ctx.fillStyle = '#ffffff';
                    ctx.fillText('Said Rafif R', 0, 0);
                    ctx.restore();
                }

                if (stampPrices) {
                    let sellPrice = Number(data.item.card.sellPrice || data.item.card.sellprice || 0);
                    if (sellPrice > 0 && !(data.item.label || '').includes('(Back)')) {
                        let priceFormatted = (sellPrice >= 1000) ? (sellPrice / 1000).toLocaleString('id-ID') + 'k' : sellPrice.toLocaleString('id-ID');
                        
                        let fontSize = Math.floor(gridCardWidth * 0.08);
                        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                        let tWidth = ctx.measureText(priceFormatted).width;
                        
                        let padX = Math.floor(gridCardWidth * 0.03);
                        let padY = Math.floor(gridCardWidth * 0.015);
                        let bWidth = tWidth + (padX * 2);
                        let bHeight = fontSize * 1.4;
                        
                        let bX = x + gridCardWidth - bWidth - Math.floor(gridCardWidth * 0.04);
                        let bY = y + gridCardHeight - bHeight - Math.floor(gridCardWidth * 0.04);

                        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                        ctx.beginPath(); 
                        ctx.roundRect(bX, bY, bWidth, bHeight, Math.floor(gridCardWidth * 0.02)); 
                        ctx.fill();

                        ctx.fillStyle = '#eab308';
                        ctx.textAlign = 'center'; 
                        ctx.textBaseline = 'middle';
                        ctx.fillText(priceFormatted, bX + (bWidth / 2), bY + (bHeight / 2) + (fontSize * 0.05));
                    }
                }
            });

            // ✅ FINAL EXPORT: Dynamically set quality to 65% if compressed
            const finalQuality = compressOutput ? 0.65 : 1.0;
            const dataUrl = canvas.toDataURL('image/jpeg', finalQuality); 
            
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `Catalog_Grid_${Date.now()}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else if (mode === 'zip' && useWatermark) {
            if (typeof JSZip === 'undefined') throw new Error("JSZip library not loaded.");
            const zip = new JSZip();
            const folder = zip.folder("Pokemon_Cards_Watermarked");
            
            for (let i = 0; i < loadedImages.length; i++) {
                const data = loadedImages[i];
                if (!data.img) continue; 

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = data.img.width;
                tempCanvas.height = data.img.height;
                const tCtx = tempCanvas.getContext('2d');
                
                tCtx.imageSmoothingEnabled = true;
                tCtx.imageSmoothingQuality = 'high';
                
                tCtx.drawImage(data.img, 0, 0, tempCanvas.width, tempCanvas.height);
                
                tCtx.save();
                tCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
                tCtx.rotate(-Math.PI / 6);
                tCtx.globalAlpha = 0.55; 
                
                tCtx.font = `bold ${tempCanvas.width * 0.15}px Inter, sans-serif`;
                tCtx.textAlign = 'center';
                
                tCtx.shadowColor = 'rgba(0,0,0,0.9)';
                tCtx.shadowBlur = 15;
                tCtx.shadowOffsetX = 4;
                tCtx.shadowOffsetY = 4;

                tCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
                tCtx.lineWidth = tempCanvas.width * 0.006; 
                tCtx.strokeText('Said Rafif R', 0, 0);

                tCtx.fillStyle = '#ffffff';
                tCtx.fillText('Said Rafif R', 0, 0);
                tCtx.restore();

                const blob = await new Promise(res => tempCanvas.toBlob(res, 'image/jpeg', 1.0));
                folder.file(`${data.item.filename}.jpg`, blob);
            }

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `Pokemon_Export_Watermarked_${Date.now()}.zip`);
        }

        loadedImages.forEach(data => {
            if (data.objectUrl) URL.revokeObjectURL(data.objectUrl);
        });

    } catch (e) {
        console.error(e);
        alert("Export failed: " + e.message);
    } finally {
        document.querySelectorAll('#btn-export-auction-grid, #btn-export-grid, #btn-export-auction-zip, #btn-export-zip').forEach(btn => {
            if (btn.id && originalTexts.has(btn.id)) btn.innerHTML = originalTexts.get(btn.id);
            btn.style.pointerEvents = 'auto';
        });
    }
}

// ============================================================== 
// 1. GLOBAL SINGLE CARD MODAL (FRONT & BACK WITH CLICK-ZOOM)
// ============================================================== 
window.openImagePreview = function(card) {
    let modal = document.getElementById('singleImageModal');
    if (modal) modal.remove();
    
    let frontUrl = card.frontImage || card.frontimage || '';
    let backUrl = card.backImage || card.backimage || '';
    let cardName = card.displayName || card.name || 'Card Preview';

    // GUARANTEE RAW DRIVE LINKS ARE CONVERTED TO RENDERABLE IMAGES
    let displayFront = frontUrl ? (typeof getDirectImageUrl === 'function' ? getDirectImageUrl(frontUrl, 'w1600') : frontUrl) : '';
    let displayBack = backUrl ? (typeof getDirectImageUrl === 'function' ? getDirectImageUrl(backUrl, 'w1600') : backUrl) : '';
    
    modal = document.createElement('div');
    modal.id = 'singleImageModal';
    modal.style.cssText = 'display: none; position: fixed; z-index: 999999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;';
    
    modal.innerHTML = `
      <div style="background-color: var(--bg-surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); width: 100%; max-width: 1400px; max-height: 100%; display: flex; flex-direction: column; color: var(--text-primary); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); box-sizing: border-box;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px; flex-shrink: 0; width: 100%; box-sizing: border-box;">
          <h3 style="margin: 0; color: var(--accent-yellow); font-size: 20px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${cardName}</h3>
          <span class="close-single-modal" style="font-size: 28px; font-weight: bold; cursor: pointer; color: var(--text-secondary); line-height: 1; transition: color 0.2s;">&times;</span>
        </div>
        
        <div style="flex: 1; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-bottom: 10px; gap: 24px; width: 100%; box-sizing: border-box;">
            <span style="font-size: 13px; color: var(--text-secondary); margin-bottom: 0px; display: block; flex-shrink: 0; text-align: center; width: 100%;">Hover to magnify. Left-Click image to cycle zoom levels.</span>
            
            <div style="width: 100%; max-width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; box-sizing: border-box;">
                <span style="font-size: 12px; color: var(--accent-yellow); margin-bottom: 8px; display: block; font-weight: 700; text-transform: uppercase;">Front Side</span>
                ${displayFront ? `
                <div id="mag-single-front" style="overflow: hidden; border-radius: 8px; display: inline-flex; justify-content: center; box-shadow: 0 8px 25px rgba(0,0,0,0.4); max-width: 100%;">
                    <img id="img-single-front" src="${displayFront}" style="display: block; max-height: 65vh; max-width: 100%; width: auto; height: auto; object-fit: contain; cursor: zoom-in; user-select: none; -webkit-user-drag: none;">
                </div>
                ` : '<div id="mag-single-front" style="display:none;"><img id="img-single-front"></div><div id="missing-single-front" style="color: var(--text-secondary); font-style: italic; margin-bottom: 12px;">No Front Image Available</div>'}
                <button class="btn-outline" onclick="triggerUpdateSide('${card.id}', 'front')" style="margin-top: 12px; font-size: 12px; padding: 6px 12px;"><i class="fas fa-camera"></i> ${displayFront ? 'Update' : 'Scan'} Front</button>
            </div>

            <div style="width: 100%; max-width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; padding-bottom: 20px; box-sizing: border-box;">
                <span style="font-size: 12px; color: var(--accent-yellow); margin-bottom: 8px; display: block; font-weight: 700; text-transform: uppercase;">Back Side</span>
                ${displayBack ? `
                <div id="mag-single-back" style="overflow: hidden; border-radius: 8px; display: inline-flex; justify-content: center; box-shadow: 0 8px 25px rgba(0,0,0,0.4); max-width: 100%;">
                    <img id="img-single-back" src="${displayBack}" style="display: block; max-height: 65vh; max-width: 100%; width: auto; height: auto; object-fit: contain; cursor: zoom-in; user-select: none; -webkit-user-drag: none;">
                </div>
                ` : '<div id="mag-single-back" style="display:none;"><img id="img-single-back"></div><div id="missing-single-back" style="color: var(--text-secondary); font-style: italic; margin-bottom: 12px;">No Back Image Available</div>'}
                <button class="btn-outline" onclick="triggerUpdateSide('${card.id}', 'back')" style="margin-top: 12px; font-size: 12px; padding: 6px 12px;"><i class="fas fa-camera"></i> ${displayBack ? 'Update' : 'Scan'} Back</button>
            </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = modal.querySelector('.close-single-modal');
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#fff');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = 'var(--text-secondary)');
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    
    // THE FLAWLESS PAN-ON-HOVER ENGINE
    const setupMagnifier = (imgId) => {
        const img = document.getElementById(imgId);
        if(!img) return;
        
        let zoomStage = 0;
        const zoomLevels = [2.5, 4, 6];
        
        img.addEventListener('mouseenter', () => {
            img.style.transition = 'transform 0.15s ease-out';
            img.style.transform = `scale(${zoomLevels[zoomStage]})`;
        });
        
        img.addEventListener('mousemove', (e) => {
            // Calculates coordinates purely based on the rendered image surface
            const xPercent = (e.offsetX / img.offsetWidth) * 100;
            const yPercent = (e.offsetY / img.offsetHeight) * 100;
            img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        });
        
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            zoomStage = (zoomStage + 1) % zoomLevels.length;
            img.style.transition = 'transform 0.15s ease-out';
            img.style.transform = `scale(${zoomLevels[zoomStage]})`;
        });
        
        img.addEventListener('mouseleave', () => {
            zoomStage = 0;
            img.style.transition = 'transform 0.25s ease-out, transform-origin 0.25s ease-out';
            img.style.transformOrigin = 'center center';
            img.style.transform = 'scale(1)';
        });
    };

    setupMagnifier('img-single-front');
    setupMagnifier('img-single-back');
    
    modal.style.display = 'flex';
};

// ============================================================== 
// NEW: DEDICATED VIDEO PREVIEW OVERLAY
// ============================================================== 
window.previewConditionVideo = function(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); z-index: 99999; display: flex; align-items: center; justify-content: center;';
    
    // Click background to close
    overlay.onclick = (e) => { if(e.target === overlay) document.body.removeChild(overlay); };
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; width: 85vw; max-width: 1000px; aspect-ratio: 16/9;';
    
    const vidContainer = document.createElement('div');
    vidContainer.style.cssText = 'width: 100%; height: 100%; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.9); overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center;';

    // Handle Google Drive Links vs Standard MP4
    if (url.includes('drive.google.com')) {
        const match = url.match(/id=([^&]+)/);
        if (match && match[1]) {
            const iframe = document.createElement('iframe');
            iframe.src = `https://drive.google.com/file/d/${match[1]}/preview`;
            iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
            iframe.setAttribute('allow', 'autoplay; fullscreen');
            vidContainer.appendChild(iframe);
        }
    } else {
        const vid = document.createElement('video');
        vid.src = url;
        vid.controls = true;
        vid.autoplay = true;
        vid.style.cssText = 'width: 100%; max-height: 100%; object-fit: contain;';
        vidContainer.appendChild(vid);
    }

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position: absolute; top: -40px; right: -10px; background: none; border: none; color: #fff; font-size: 36px; cursor: pointer; line-height: 1; z-index: 10;';
    closeBtn.onclick = (e) => { e.stopPropagation(); document.body.removeChild(overlay); };
    
    wrapper.appendChild(vidContainer);
    wrapper.appendChild(closeBtn);
    overlay.appendChild(wrapper);
    document.body.appendChild(overlay);
};

// ============================================================== 
// 2. VARIANT MASTER-DETAIL MODAL LOGIC (DYNAMIC MEDIA BUTTONS)
// ============================================================== 
window.openVariantModal = function(cardName, variantsObj) {
  let modal = document.getElementById('variantModal');
  if (modal) modal.remove(); 
  
  modal = document.createElement('div');
  modal.id = 'variantModal';
  // FIXED: Set to 9990 so Media Modal shows above it
  modal.style.cssText = 'display: none; position: fixed; z-index: 9990; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(5px); align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;';
  
  modal.innerHTML = `
    <div style="background-color: var(--bg-surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); width: 100%; max-width: 1400px; height: 100%; max-height: 95vh; display: flex; flex-direction: column; color: var(--text-primary); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); box-sizing: border-box;">
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px; flex-shrink: 0; width: 100%; box-sizing: border-box;">
        <h3 id="variantModalTitle" style="margin: 0; color: var(--accent-yellow); font-size: 20px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"><i class="fas fa-layer-group"></i> ${cardName || 'Card'} Variants</h3>
        <span class="close-variant-modal" style="font-size: 28px; font-weight: bold; cursor: pointer; color: var(--text-secondary); line-height: 1; transition: color 0.2s;">&times;</span>
      </div>
      
      <!-- Split Body Layout -->
      <div style="display: flex; flex-wrap: wrap; gap: 20px; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; width: 100%; box-sizing: border-box; align-content: flex-start;">
        
        <div id="variantListContainer" style="flex: 1 1 280px; max-width: 100%; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; padding-right: 8px; box-sizing: border-box;"></div>
        
        <div style="flex: 3 1 300px; max-width: 100%; min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; overflow-y: auto; box-sizing: border-box;">
            
            <div id="variant-preview-placeholder" style="color: var(--text-secondary); font-size: 16px; text-align: center; margin-top: auto; margin-bottom: auto;">
                <i class="fas fa-search-plus" style="font-size: 48px; margin-bottom: 12px; opacity: 0.5;"></i><br>Select a variant to inspect
            </div>
            
            <div id="variant-preview-content" style="display: none; width: 100%; max-width: 100%; text-align: center; box-sizing: border-box;">
                <h4 id="variant-preview-title" style="margin: 0 0 16px 0; color: var(--text-primary); font-size: 18px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"></h4>
                
                <div style="display: flex; flex-direction: column; gap: 24px; align-items: center; width: 100%; max-width: 100%; box-sizing: border-box;">
                    
                    <div style="width: 100%; max-width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center;">
                        <span style="font-size: 12px; color: var(--accent-yellow); margin-bottom: 8px; display: block; font-weight: 700; text-transform: uppercase;">Front Side (Left-Click to cycle zoom)</span>
                        <div id="v-front-box" style="display:none; overflow: hidden; border-radius: 8px; justify-content: center; box-shadow: 0 8px 25px rgba(0,0,0,0.4); max-width: 100%;">
                            <img id="v-front-img" src="" style="display: block; max-height: 65vh; max-width: 100%; width: auto; height: auto; object-fit: contain; cursor: zoom-in; user-select: none; -webkit-user-drag: none;">
                        </div>
                        <div id="v-front-missing" style="color: var(--text-secondary); font-style: italic; margin-bottom: 12px; display:none;">No Front Image Available</div>
                        <button id="btn-var-update-front" class="btn-outline" style="margin-top: 12px; font-size: 12px; padding: 6px 12px;"><i class="fas fa-camera"></i> Scan/Update Front</button>
                    </div>
                    
                    <div style="width: 100%; max-width: 100%; text-align: center; padding-bottom: 20px; display: flex; flex-direction: column; align-items: center;">
                        <span style="font-size: 12px; color: var(--accent-yellow); margin-bottom: 8px; display: block; font-weight: 700; text-transform: uppercase;">Back Side (Left-Click to cycle zoom)</span>
                        <div id="v-back-box" style="display:none; overflow: hidden; border-radius: 8px; justify-content: center; box-shadow: 0 8px 25px rgba(0,0,0,0.4); max-width: 100%;">
                            <img id="v-back-img" src="" style="display: block; max-height: 65vh; max-width: 100%; width: auto; height: auto; object-fit: contain; cursor: zoom-in; user-select: none; -webkit-user-drag: none;">
                        </div>
                        <div id="v-back-missing" style="color: var(--text-secondary); font-style: italic; margin-bottom: 12px; display:none;">No Back Image Available</div>
                        <button id="btn-var-update-back" class="btn-outline" style="margin-top: 12px; font-size: 12px; padding: 6px 12px;"><i class="fas fa-camera"></i> Scan/Update Back</button>
                    </div>
                    </div>

                </div>
            </div>

        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('.close-variant-modal');
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#fff');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = 'var(--text-secondary)');
  closeBtn.addEventListener('click', () => modal.style.display = 'none');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
  
  // THE FLAWLESS PAN-ON-HOVER ENGINE
  const setupMagnifier = (imgId) => {
      const img = document.getElementById(imgId);
      if(!img) return;
      
      let zoomStage = 0;
      const zoomLevels = [2.5, 4, 6];
      
      img.addEventListener('mouseenter', () => {
          img.style.transition = 'transform 0.15s ease-out';
          img.style.transform = `scale(${zoomLevels[zoomStage]})`;
      });
      
      img.addEventListener('mousemove', (e) => {
          // Calculates coordinates purely based on the rendered image surface
          const xPercent = (e.offsetX / img.offsetWidth) * 100;
          const yPercent = (e.offsetY / img.offsetHeight) * 100;
          img.style.transformOrigin = `${xPercent}% ${yPercent}%`;
      });
      
      img.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          zoomStage = (zoomStage + 1) % zoomLevels.length;
          img.style.transition = 'transform 0.15s ease-out';
          img.style.transform = `scale(${zoomLevels[zoomStage]})`;
      });
      
      img.addEventListener('mouseleave', () => {
          zoomStage = 0; 
          img.style.transition = 'transform 0.25s ease-out, transform-origin 0.25s ease-out';
          img.style.transformOrigin = 'center center';
          img.style.transform = 'scale(1)';
      });
  };

  setupMagnifier('v-front-img');
  setupMagnifier('v-back-img');

  const container = document.getElementById('variantListContainer');
  const placeholder = document.getElementById('variant-preview-placeholder');
  const previewContent = document.getElementById('variant-preview-content');
  const previewTitle = document.getElementById('variant-preview-title');
  const frontBox = document.getElementById('v-front-box');
  const backBox = document.getElementById('v-back-box');
  const frontImg = document.getElementById('v-front-img');
  const backImg = document.getElementById('v-back-img');

  const variantsArray = Object.values(variantsObj || {});
  let activeRow = null;
  
  variantsArray.forEach(variant => {
    const hasPhoto = (variant.frontImage?.length > 5 || variant.frontimage?.length > 5);
    const photoBadge = hasPhoto ? `<span style="background: #22c55e; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;"><i class="fas fa-camera"></i> Photo</span>` : '';

    // Live Data Fetch for Media
    const liveCard = state.inventory.find(c => c.id === variant.id) || variant;
    let pMedia = {};
    try { pMedia = JSON.parse(liveCard.conditionMedia || '{}'); } catch(e) {}
    const rawMediaData = (liveCard.conditionMedia || '{}').replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    // ✅ NEW: Dynamically build specific buttons based on existing flaws/video
    let dynamicMediaButtons = `
        <button class="btn-outline btn-row-manage-media" data-id="${liveCard.id}" data-media="${rawMediaData}" style="padding: 4px 8px; font-size: 11px; color: var(--text-secondary); border-color: rgba(255,255,255,0.15);" title="Manage Media">
            <i class="fas fa-cog"></i>
        </button>
    `;

    if (pMedia.video) {
        dynamicMediaButtons += `
            <button class="btn-outline btn-preview-vid" data-vid="${pMedia.video}" style="padding: 4px 8px; font-size: 11px; color: #38bdf8; border-color: rgba(56,189,248,0.4);">
                <i class="fas fa-video"></i> Video
            </button>
        `;
    }

    if (pMedia.flaws && pMedia.flaws.length > 0) {
        pMedia.flaws.forEach(flaw => {
            if (flaw.url) {
                // Determine the side indicator (F or B). If old data has no side, leave it blank.
                let sideIndicator = '';
                if (flaw.side === 'Front') sideIndicator = 'F: ';
                if (flaw.side === 'Back') sideIndicator = 'B: ';

                dynamicMediaButtons += `
                    <button class="btn-outline btn-preview-flaw" data-url="${flaw.url}" style="padding: 4px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.4);">
                        <i class="fas fa-search-minus"></i> ${sideIndicator}${flaw.type}
                    </button>
                `;
            }
        });
    }

    const row = document.createElement('div');
    row.style = "display: flex; flex-direction: column; gap: 8px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); transition: all 0.2s; flex-shrink: 0;";
    
    // Insert the dynamically built buttons
    row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <strong style="color: var(--text-primary); font-size: 14px;">${variant.displayName || variant.name}</strong><br>
                <span style="font-size: 11px; color: var(--text-secondary);">Cond: ${variant.condition || 'N/A'} • Lang: ${variant.language || 'N/A'}</span>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                ${photoBadge}
                <div style="font-size: 12px; color: var(--accent-yellow);"><strong>Qty: ${variant.quantity}</strong></div>
            </div>
        </div>
        <div style="margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap;">
            ${dynamicMediaButtons}
        </div>
    `;
    
    // Manage Media Click Listener
    const mediaBtn = row.querySelector('.btn-row-manage-media');
    if(mediaBtn) {
        mediaBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const overlay = document.getElementById('modal-overlay');
            const mediaModal = document.getElementById('modal-media-manager');
            const camModal = document.getElementById('modal-camera');
            
            if(overlay) overlay.style.zIndex = '10005';
            if(mediaModal) mediaModal.style.zIndex = '10010';
            if(camModal) camModal.style.zIndex = '10020';
            
            openMediaModal(e.currentTarget);
        });
    }

    // Direct Video Player Click Listener
    row.querySelectorAll('.btn-preview-vid').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.previewConditionVideo(e.currentTarget.getAttribute('data-vid'));
        });
    });

    // Direct Flaw Image Viewer Click Listener
    row.querySelectorAll('.btn-preview-flaw').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            let url = e.currentTarget.getAttribute('data-url');
            
            // Reconstruct Drive links into high-res thumbnail previews
            if(url.includes('drive.google.com')) {
                const match = url.match(/id=([^&]+)/);
                if(match && match[1]) url = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
            }
            window.previewConditionImage(url);
        });
    });

    // Click anywhere else on the row to inspect main front/back photos
    if (hasPhoto) {
        row.style.cursor = 'pointer';
        
        row.addEventListener('mouseenter', () => { if (activeRow !== row) row.style.background = 'rgba(255,255,255,0.1)'; });
        row.addEventListener('mouseleave', () => { if (activeRow !== row) row.style.background = 'rgba(255,255,255,0.05)'; });
        
        row.addEventListener('click', () => {
            if (activeRow) {
                activeRow.style.background = 'rgba(255,255,255,0.05)';
                activeRow.style.borderColor = 'var(--border-color)';
            }
            
            activeRow = row;
            row.style.background = 'rgba(234, 179, 8, 0.1)'; 
            row.style.borderColor = 'var(--accent-yellow)';
            
            placeholder.style.display = 'none';
            previewContent.style.display = 'block';
            previewTitle.textContent = variant.displayName || variant.name;
            
            frontImg.style.transform = 'scale(1)';
            backImg.style.transform = 'scale(1)';
            
            const fUrl = variant.frontImage || variant.frontimage;
            const bUrl = variant.backImage || variant.backimage;
            
            document.getElementById('btn-var-update-front').onclick = () => triggerUpdateSide(variant.id, 'front');
            document.getElementById('btn-var-update-back').onclick = () => triggerUpdateSide(variant.id, 'back');

            if (fUrl && fUrl.length > 5) {
                frontImg.src = typeof getDirectImageUrl === 'function' ? getDirectImageUrl(fUrl, 'w1600') : fUrl;
                frontBox.style.display = 'inline-flex';
                document.getElementById('v-front-missing').style.display = 'none';
            } else {
                frontBox.style.display = 'none';
                document.getElementById('v-front-missing').style.display = 'block';
            }
            
            if (bUrl && bUrl.length > 5) {
                backImg.src = typeof getDirectImageUrl === 'function' ? getDirectImageUrl(bUrl, 'w1600') : bUrl;
                backBox.style.display = 'inline-flex';
                document.getElementById('v-back-missing').style.display = 'none';
            } else {
                backBox.style.display = 'none';
                document.getElementById('v-back-missing').style.display = 'block';
            }
        });
    }
    
    container.appendChild(row);
  });
  
  modal.style.display = 'flex';
};

/* ============================================================== */
/* CONDITION MEDIA MANAGER & WEBCAM LOGIC                         */
/* ============================================================== */

const CLOUDINARY_UPLOAD_PRESET = 'cyq4v7mt'; 
const CLOUDINARY_CLOUD_NAME = 'gebypebl';

let currentMediaBtn = null;
let tempMediaData = { video: '', flaws: [] };
let mediaRecorder = null;
let recordedChunks = [];

async function uploadVideoToCloudinary(file, btnElement) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading to Cloud...';
    btnElement.disabled = true;

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
            method: 'POST', body: formData
        });
        const data = await res.json();
        
        if(data.secure_url) return data.secure_url;
        alert("Cloudinary Error: " + (data.error?.message || "Unknown error"));
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
        return null;
    } catch(e) {
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
        return null;
    }
}

async function processVideoPipeline(file, uploadBtn, cardId) {
    // 1. Upload to Cloudinary buffer
    const cloudUrl = await uploadVideoToCloudinary(file, uploadBtn);
    if(!cloudUrl) return null;
    
    // 2. Pass to Google Drive with Routing Data
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Moving to G-Drive...';
    
    let groupName = 'Unassigned';
    let rarityName = 'Unassigned_Rarity';
    
    // Extract routing info based on the specific card opened in the modal
    if (cardId) {
        const card = state.inventory.find(c => c.id === cardId);
        if (card) {
            groupName = card.group || 'Unassigned';
            rarityName = card.rarity || 'Unassigned_Rarity';
        }
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'uploadConditionVideo', 
                pass: sessionStorage.getItem('appPass'), 
                videoUrl: cloudUrl,
                folderName: groupName,
                rarityName: rarityName
            })
        });
        const data = await res.json();
        if(data.success && data.downloadUrl) return data.downloadUrl;
        
        alert("Drive move failed. Falling back to Cloudinary URL.");
        return cloudUrl; 
    } catch(e) {
        return cloudUrl; 
    }
}

function openMediaModal(btn) {
    currentMediaBtn = btn;
    try { tempMediaData = JSON.parse(btn.getAttribute('data-media') || '{"video":"","flaws":[]}'); } 
    catch(e) { tempMediaData = { video: '', flaws: [] }; }
    
    if(!tempMediaData.flaws) tempMediaData.flaws = [];

    const videoUpload = document.getElementById('media-video-upload');
    if (videoUpload) videoUpload.value = '';

    const inputGroup = document.getElementById('video-input-group');
    const uploadBtn = document.getElementById('btn-upload-video');
    if (inputGroup) inputGroup.style.display = 'flex';
    if (uploadBtn) uploadBtn.style.display = 'none';

    renderMediaModalUI();
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('modal-media-manager').style.display = 'flex';
}

function renderMediaModalUI() {
    const vidContainer = document.getElementById('video-preview-container');
    
    // Clean up old elements to prevent duplicates
    const oldVideo = document.getElementById('media-video-preview');
    if (oldVideo) oldVideo.remove();
    const oldIframe = document.getElementById('media-iframe-preview');
    if (oldIframe) oldIframe.remove();
    const oldDriveBtn = document.getElementById('drive-preview-btn');
    if (oldDriveBtn) oldDriveBtn.remove();

    if(tempMediaData.video) {
        if (tempMediaData.video.includes('drive.google.com')) {
            // Extract the Drive ID and create an embedded preview player
            const match = tempMediaData.video.match(/id=([^&]+)/);
            if (match && match[1]) {
                const iframe = document.createElement('iframe');
                iframe.id = 'media-iframe-preview';
                iframe.src = `https://drive.google.com/file/d/${match[1]}/preview`;
                iframe.style.cssText = 'width: 100%; height: 220px; border: none; border-radius: 6px; margin-bottom: 8px; background: #000;';
                // ✅ ADDED: Fullscreen permissions for the iframe
                iframe.setAttribute('allow', 'autoplay; fullscreen');
                iframe.setAttribute('allowfullscreen', 'true');
                iframe.setAttribute('webkitallowfullscreen', 'true');
                iframe.setAttribute('mozallowfullscreen', 'true');
                vidContainer.insertBefore(iframe, document.getElementById('btn-remove-video'));
            }
        } else {
            // Direct Cloudinary MP4 Player
            const vid = document.createElement('video');
            vid.id = 'media-video-preview';
            vid.src = tempMediaData.video;
            vid.controls = true;
            vid.style.cssText = 'width: 100%; max-height: 200px; border-radius: 6px; background: #000; margin-bottom: 8px;';
            vidContainer.insertBefore(vid, document.getElementById('btn-remove-video'));
        }
        vidContainer.style.display = 'block';
    } else {
        vidContainer.style.display = 'none';
    }

    const flawContainer = document.getElementById('flaw-list-container');
    flawContainer.innerHTML = '';
    tempMediaData.flaws.forEach((flaw, index) => flawContainer.appendChild(createFlawRow(flaw, index)));
    renderMediaGallery();

    // ✅ NEW: Instantly sync media to the table row so autosave catches it immediately
    if (currentMediaBtn) {
        currentMediaBtn.setAttribute('data-media', JSON.stringify(tempMediaData));
        const validFlaws = tempMediaData.flaws.filter(f => f.url !== '');
        const mediaCount = (tempMediaData.video ? 1 : 0) + validFlaws.length;
        if(mediaCount > 0) {
            currentMediaBtn.innerHTML = `<i class="fas fa-photo-video"></i> (${mediaCount})`;
            currentMediaBtn.style.color = 'var(--accent-yellow)';
            currentMediaBtn.style.borderColor = 'var(--accent-yellow)';
        } else {
            currentMediaBtn.innerHTML = `<i class="fas fa-photo-video"></i>`;
            currentMediaBtn.style.color = '';
            currentMediaBtn.style.borderColor = '';
        }
    }
}

function createFlawRow(flaw, index) {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 8px; align-items: center; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);';
    const flawTypes = ['Whitening', 'Scratch', 'Dent', 'Print Line', 'Edge Wear', 'Crease', 'Foil Shift'];
    let options = flawTypes.map(t => `<option value="${t}" ${flaw.type === t ? 'selected' : ''}>${t}</option>`).join('');

    // Extract ID for a raw image thumbnail
    let viewUrl = flaw.url;
    if(viewUrl && viewUrl.includes('drive.google.com')) {
        const match = viewUrl.match(/id=([^&]+)/);
        if(match && match[1]) viewUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }

    div.innerHTML = `
        <select class="flaw-side-select" style="padding: 6px; font-size: 12px; width: 75px; border-radius: 6px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); outline: none;">
            <option value="Front" ${flaw.side === 'Front' ? 'selected' : ''}>Front</option>
            <option value="Back" ${flaw.side === 'Back' ? 'selected' : ''}>Back</option>
        </select>
        <select class="flaw-type-select" style="flex: 1; padding: 6px; font-size: 12px; border-radius: 6px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-color); outline: none;">${options}</select>
        ${flaw.url ? 
            // ✅ FIXED: Using the raw image URL so it renders inside the popup
            `<a href="#" onclick="previewConditionImage('${viewUrl}'); return false;" style="color: #22c55e; font-size: 12px; white-space: nowrap;" title="View Image"><i class="fas fa-search-plus"></i> View</a>` : 
            `<div class="flaw-upload-group" style="display: flex; gap: 4px;">
                <button type="button" class="btn-outline btn-media-flaw-cam" style="padding: 4px 8px; font-size: 11px;" title="Webcam Photo"><i class="fas fa-camera"></i></button>
                <label class="btn-outline" style="cursor: pointer; padding: 4px 8px; font-size: 11px;" title="Upload File">
                    <i class="fas fa-folder-open"></i><input type="file" class="flaw-file" accept="image/*" style="display: none;">
                </label>
             </div>
             <button class="btn-outline btn-upload-indicator" style="padding: 4px 8px; font-size: 11px; display: none; pointer-events: none;"><i class="fas fa-spinner fa-spin"></i></button>`
        }
        <button class="btn-outline btn-remove-flaw" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239,68,68,0.3);"><i class="fas fa-trash"></i></button>
    `;

    div.querySelector('.flaw-side-select').addEventListener('change', (e) => { tempMediaData.flaws[index].side = e.target.value; renderMediaGallery(); });

    if(!flaw.url) {
        div.querySelector('.btn-media-flaw-cam').addEventListener('click', () => {
            activeScanTarget = { type: 'media_flaw', index: index };
            openCameraModal();
        });

        div.querySelector('.flaw-file').addEventListener('change', async (e) => {
            if(!e.target.files[0]) return;
            const btnGroup = div.querySelector('.flaw-upload-group');
            const indicator = div.querySelector('.btn-upload-indicator');
            btnGroup.style.display = 'none'; indicator.style.display = 'block';

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Data = event.target.result.split(',')[1];
                const driveUrl = await processImageUpload(base64Data, 'flaw'); // ImgBB -> Drive
                if(driveUrl) {
                    tempMediaData.flaws[index].url = driveUrl;
                    renderMediaModalUI();
                } else {
                    alert("Upload Failed.");
                    btnGroup.style.display = 'flex'; indicator.style.display = 'none';
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        });
    }

    div.querySelector('.btn-remove-flaw').addEventListener('click', () => { tempMediaData.flaws.splice(index, 1); renderMediaModalUI(); });
    return div;
}

function renderMediaGallery() {
    const gallery = document.getElementById('media-gallery-preview');
    gallery.innerHTML = '';
    
    if(!tempMediaData.video && tempMediaData.flaws.length === 0) {
        gallery.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">No media uploaded yet.</span>';
        return;
    }

    if(tempMediaData.video) {
        gallery.innerHTML += `
            <div style="display: flex; flex-direction: column; align-items: center; margin-right: 12px; margin-bottom: 12px; gap: 6px;">
                <div style="position: relative; width: 60px; height: 60px; border-radius: 6px; background: #000; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color);">
                    <i class="fas fa-video" style="color: #38bdf8; font-size: 24px;"></i>
                </div>
                <!-- ✅ FIXED: Back to Save/Download using the raw URL -->
                <a href="${tempMediaData.video}" target="_blank" class="btn-primary" style="font-size: 11px; padding: 4px 8px; text-decoration: none; background: #38bdf8; color: #fff; border-radius: 4px; width: 100%; justify-content: center;"><i class="fas fa-download"></i> Save</a>
            </div>
        `;
    }

    tempMediaData.flaws.forEach(flaw => {
        if(flaw.url) {
            // Convert Drive links to RAW image endpoints so the CSS background can render them
            let displayUrl = flaw.url;
            if(displayUrl.includes('drive.google.com')) {
                const match = displayUrl.match(/id=([^&]+)/);
                if(match && match[1]) displayUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
            }

            gallery.innerHTML += `
                <div style="display: flex; flex-direction: column; align-items: center; margin-right: 12px; margin-bottom: 12px; gap: 6px;">
                    <!-- ✅ FIXED: Using the new previewConditionImage logic for forced z-index -->
                    <div onclick="previewConditionImage('${displayUrl}')" title="Click to enlarge" style="cursor: zoom-in; position: relative; width: 60px; height: 60px; border-radius: 6px; overflow: visible; border: 1px solid var(--border-color); background-image: url('${displayUrl}'); background-size: cover; background-position: center;">
                        <span style="position: absolute; top: -6px; right: -8px; background: #ef4444; color: #fff; font-size: 9px; padding: 2px 4px; border-radius: 4px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">${flaw.side === 'Front' ? 'F: ' : flaw.side === 'Back' ? 'B: ' : ''}${flaw.type}</span>
                    </div>
                    <a href="${flaw.url}" target="_blank" class="btn-primary" style="font-size: 11px; padding: 4px 8px; text-decoration: none; background: #22c55e; color: #fff; border-radius: 4px; width: 100%; justify-content: center;"><i class="fas fa-download"></i> Save</a>
                </div>
            `;
        }
    });
}

// ✅ UPDATED: 3-Tier Click Zoom WITH Smooth Mouse Tracking (Pan-on-Hover)
window.previewConditionImage = function(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.9); z-index: 99999; display: flex; align-items: center; justify-content: center; cursor: zoom-out;';
    
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = 'position: relative; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.9); overflow: hidden; display: flex; max-width: 95vw; max-height: 95vh;';

    const img = document.createElement('img');
    img.src = url;
    // Faster transition applied so the mouse tracking feels highly responsive
    img.style.cssText = 'display: block; max-width: 95vw; max-height: 95vh; min-height: 60vh; object-fit: contain; cursor: zoom-in; transition: transform 0.15s ease-out; transform-origin: center center;';
    
    let zoomLevel = 0; // 0 = Default, 1 = Zoom 2.5x, 2 = Zoom 4x
    
    img.onclick = function(e) {
        e.stopPropagation(); 
        
        zoomLevel = (zoomLevel + 1) % 3;
        
        if (zoomLevel === 0) {
            // Reset to default
            img.style.transform = 'scale(1)';
            img.style.cursor = 'zoom-in';
            setTimeout(() => {
                if (zoomLevel === 0) img.style.transformOrigin = 'center center';
            }, 150); 
        } else {
            // Set zoom origin to cursor on click
            const x = (e.offsetX / img.offsetWidth) * 100;
            const y = (e.offsetY / img.offsetHeight) * 100;
            img.style.transformOrigin = `${x}% ${y}%`;
            
            if (zoomLevel === 1) {
                img.style.transform = 'scale(2.5)';
                img.style.cursor = 'zoom-in'; 
            } else if (zoomLevel === 2) {
                img.style.transform = 'scale(4)';
                img.style.cursor = 'zoom-out'; 
            }
        }
    };

    // The pan-on-hover feature: tracks mouse movement ONLY when zoomed in
    img.addEventListener('mousemove', function(e) {
        if (zoomLevel > 0) {
            const x = (e.offsetX / img.offsetWidth) * 100;
            const y = (e.offsetY / img.offsetHeight) * 100;
            img.style.transformOrigin = `${x}% ${y}%`;
        }
    });

    overlay.onclick = () => document.body.removeChild(overlay); 
    
    imgContainer.appendChild(img);
    overlay.appendChild(imgContainer);
    document.body.appendChild(overlay);
};

// Ensure the old openCameraModal logic is overridden for Video/Media/Updates
const originalOpenCameraModal = window.openCameraModal;
window.openCameraModal = async function() {
    await originalOpenCameraModal(); 
    
    // Elevate the overlay to protect the background from clicks
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.zIndex = '9999998';
    
    const btnRecord = document.getElementById('btn-record-vid');
    const btnFront = document.getElementById('btn-cap-front');
    const btnBack = document.getElementById('btn-cap-back');
    const status = document.getElementById('camera-status');
    const aiToggle = document.getElementById('ai-toggle-container');
    const fileUploadContainer = document.getElementById('camera-file-upload-container');

    // FORCE RESET ALL BUTTON STATES
    btnRecord.disabled = false;
    btnRecord.innerHTML = '<i class="fas fa-circle" style="margin-right:6px;"></i> Start Recording';
    btnRecord.style.background = '#ef4444';
    btnFront.disabled = false;
    btnBack.disabled = false;

    if (activeScanTarget && activeScanTarget.type === 'update_side') {
        btnFront.style.display = activeScanTarget.side === 'front' ? 'flex' : 'none'; 
        btnBack.style.display = activeScanTarget.side === 'back' ? 'flex' : 'none';
        if (activeScanTarget.side === 'front') btnFront.innerHTML = 'Capture New Front';
        if (activeScanTarget.side === 'back') btnBack.innerHTML = 'Capture New Back';
        if(aiToggle) aiToggle.style.display = 'none';
        btnRecord.style.display = 'none';
        if(fileUploadContainer) fileUploadContainer.style.display = 'block';
        status.textContent = `Line up the card and capture ${activeScanTarget.side} photo.`;
    } else if (activeScanTarget && activeScanTarget.type === 'media_video') {
        btnFront.style.display = 'none'; 
        btnBack.style.display = 'none';
        if(aiToggle) aiToggle.style.display = 'none';
        btnRecord.style.display = 'flex';
        if(fileUploadContainer) fileUploadContainer.style.display = 'none';
        status.textContent = "Webcam ready. Click record.";
    } else if (activeScanTarget && activeScanTarget.type === 'media_flaw') {
        if(aiToggle) aiToggle.style.display = 'none';
        btnRecord.style.display = 'none'; 
        btnFront.style.display = 'flex';  
        btnBack.style.display = 'none';
        btnFront.innerHTML = "Capture Flaw Photo";
        if(fileUploadContainer) fileUploadContainer.style.display = 'none';
        status.textContent = "Line up the flaw and capture.";
    } else {
        if(aiToggle) aiToggle.style.display = 'block';
        btnRecord.style.display = 'none';
        if(fileUploadContainer) fileUploadContainer.style.display = 'block';
    }
};

// Reset Z-Index when the camera closes
const originalCloseCameraModal = window.closeCameraModal;
window.closeCameraModal = function() {
    originalCloseCameraModal();
    const overlay = document.getElementById('modal-overlay');
    const camModal = document.getElementById('modal-camera');
    if (overlay) overlay.style.zIndex = '1000';
    if (camModal) camModal.style.zIndex = '9999999';
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-add-flaw-row')?.addEventListener('click', () => {
        tempMediaData.flaws.push({ side: 'Front', type: 'Whitening', url: '' });
        renderMediaModalUI();
        const container = document.getElementById('media-manager-content');
        container.scrollTop = container.scrollHeight;
    });

    document.getElementById('btn-media-video-cam')?.addEventListener('click', () => {
        activeScanTarget = { type: 'media_video' };
        openCameraModal();
    });

    // File Upload for Video
    document.getElementById('media-video-upload')?.addEventListener('change', async (e) => {
        if(!e.target.files[0]) return;
        const inputGroup = document.getElementById('video-input-group');
        const uploadBtn = document.getElementById('btn-upload-video');
        inputGroup.style.display = 'none'; uploadBtn.style.display = 'block';
        
        // Grab the card ID from the currently open modal
        const cardId = currentMediaBtn ? currentMediaBtn.getAttribute('data-id') : null;
        
        // Process and route the video
        const driveUrl = await processVideoPipeline(e.target.files[0], uploadBtn, cardId);
        if(driveUrl) tempMediaData.video = driveUrl;
        
        inputGroup.style.display = 'flex'; uploadBtn.style.display = 'none';
        renderMediaModalUI(); e.target.value = ''; 
    });

    // Webcam Recorder Logic
    document.getElementById('btn-record-vid')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-record-vid');
        const status = document.getElementById('camera-status');
        
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            btn.style.background = '#f59e0b';
            btn.disabled = true;
            status.textContent = "Uploading video to cloud... Please wait.";
        } else {
            recordedChunks = [];
            mediaRecorder = new MediaRecorder(videoStream);
            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
            mediaRecorder.onstop = async () => {
                closeCameraModal();
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const file = new File([blob], "webcam_video.webm", { type: 'video/webm' });
                
                document.getElementById('modal-overlay').style.display = 'block';
                document.getElementById('modal-media-manager').style.display = 'flex';
                
                const inputGroup = document.getElementById('video-input-group');
                const uploadBtn = document.getElementById('btn-upload-video');
                inputGroup.style.display = 'none'; uploadBtn.style.display = 'block';
                
                const driveUrl = await processVideoPipeline(file, uploadBtn);
                if(driveUrl) tempMediaData.video = driveUrl;
                
                inputGroup.style.display = 'flex'; uploadBtn.style.display = 'none';
                btn.disabled = false;
                renderMediaModalUI();
            };
            mediaRecorder.start();
            btn.innerHTML = '<i class="fas fa-stop" style="margin-right:6px;"></i> Stop Recording';
            btn.style.background = '#3f3f46';
            status.textContent = "🔴 Recording in progress...";
        }
    });

    document.getElementById('btn-remove-video')?.addEventListener('click', () => {
        tempMediaData.video = ''; renderMediaModalUI();
    });

    document.getElementById('cancel-media')?.addEventListener('click', () => {
        const overlay = document.getElementById('modal-overlay');
        const camModal = document.getElementById('modal-camera');
        document.getElementById('modal-media-manager').style.display = 'none';
        
        // Reset layering so the camera doesn't get stuck behind the grey wall later
        if(overlay) { overlay.style.display = 'none'; overlay.style.zIndex = '1000'; }
        if(camModal) camModal.style.zIndex = '9999999';
    });

    document.getElementById('save-media-btn')?.addEventListener('click', () => {
        if(currentMediaBtn) {
            tempMediaData.flaws = tempMediaData.flaws.filter(f => f.url !== '');
            currentMediaBtn.setAttribute('data-media', JSON.stringify(tempMediaData));
            
            const mediaCount = (tempMediaData.video ? 1 : 0) + tempMediaData.flaws.length;
            if(mediaCount > 0) {
                currentMediaBtn.innerHTML = `<i class="fas fa-photo-video"></i> (${mediaCount})`;
                currentMediaBtn.style.color = 'var(--accent-yellow)';
                currentMediaBtn.style.borderColor = 'var(--accent-yellow)';
            } else {
                currentMediaBtn.innerHTML = `<i class="fas fa-photo-video"></i>`;
                currentMediaBtn.style.color = '';
                currentMediaBtn.style.borderColor = '';
            }

            const cardId = currentMediaBtn.getAttribute('data-id');
            if(cardId) {
                const card = state.inventory.find(c => c.id === cardId);
                if(card) {
                    card.conditionMedia = JSON.stringify(tempMediaData);
                    silentPostData('updateCard', { ...card }); 
                }
            }
        }
        
        const overlay = document.getElementById('modal-overlay');
        const camModal = document.getElementById('modal-camera');
        document.getElementById('modal-media-manager').style.display = 'none';
        
        // Reset layering
        if(overlay) { overlay.style.display = 'none'; overlay.style.zIndex = '1000'; }
        if(camModal) camModal.style.zIndex = '9999999';
    });
    
    // Inject logic to handle webcam Flaw photos returning to the Modal
    const originalCaptureAndUpload = window.captureAndUpload;
    window.captureAndUpload = function(side) {
        if (activeScanTarget && activeScanTarget.type === 'media_flaw') {
            const flawIndex = activeScanTarget.index;
            const video = document.getElementById('camera-stream');
            const canvas = document.getElementById('camera-canvas');
            const base64Image = getCroppedBase64(video, canvas);
            
            closeCameraModal();
            document.getElementById('modal-overlay').style.display = 'block';
            document.getElementById('modal-media-manager').style.display = 'flex';
            
            const containers = document.querySelectorAll('.flaw-upload-group');
            const indicators = document.querySelectorAll('.btn-upload-indicator');
            if (containers[flawIndex]) containers[flawIndex].style.display = 'none';
            if (indicators[flawIndex]) indicators[flawIndex].style.display = 'block';

            processImageUpload(base64Image, 'flaw').then(driveUrl => {
                if(driveUrl) {
                    tempMediaData.flaws[flawIndex].url = driveUrl;
                    renderMediaModalUI();
                } else {
                    alert("Upload Failed.");
                    if (containers[flawIndex]) containers[flawIndex].style.display = 'flex';
                    if (indicators[flawIndex]) indicators[flawIndex].style.display = 'none';
                }
            });
        } else {
            originalCaptureAndUpload(side); // Proceed normally for main scans
        }
    };
});

// ==========================================
// CARD CONDITION: SINGLE SELECTION ENFORCER & INSTANT SYNC
// ==========================================
document.getElementById('condition-content').addEventListener('change', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
        if (e.target.checked) {
            const groupContainer = e.target.closest('.condition-grid');
            if (groupContainer) {
                const allCheckboxesInGroup = groupContainer.querySelectorAll('input[type="checkbox"]');
                allCheckboxesInGroup.forEach(cb => {
                    if (cb !== e.target) cb.checked = false;
                });
            }
        }
    }

    // ✅ NEW: Instantly sync condition data to the table row so autosave catches it
    if (currentConditionBtn) {
        const data = { front: [], back: [], grade: '' };
        
        document.querySelectorAll('#modal-condition input[type="checkbox"]:checked').forEach(chk => {
            if(chk.getAttribute('data-side') === 'Frontside') data.front.push(chk.value);
            if(chk.getAttribute('data-side') === 'Backside') data.back.push(chk.value);
        });
        
        const grade = document.querySelector('#modal-condition input[name="overall-grade"]:checked');
        if(grade) data.grade = grade.value;
        
        currentConditionBtn.setAttribute('data-cond', JSON.stringify(data));
        
        const count = data.front.length + data.back.length + (data.grade ? 1 : 0);
        if(count > 0) {
            currentConditionBtn.innerHTML = `✅ Set (${count})`;
            currentConditionBtn.style.color = 'var(--accent-yellow)';
            currentConditionBtn.style.borderColor = 'var(--accent-yellow)';
        } else {
            currentConditionBtn.innerHTML = `Set`;
            currentConditionBtn.style.color = '';
            currentConditionBtn.style.borderColor = '';
        }
    }
});

/* ============================================================== */
/* FB CLIPBOARD QUEUE & MEDIA DOWNLOADER ENGINE                   */
/* ============================================================== */
const FBQueue = {
    items: [],
    currentIndex: 0,
    isActive: false,
    statusTracker: [],
    activeDoc: document, 
    activeWin: window, 

    start() {
        if (typeof auctionDrafts === 'undefined' || auctionDrafts.length === 0) {
            alert("No cards in draft! Please add cards to the auction draft first.");
            return;
        }
        this.items = auctionDrafts;
        this.currentIndex = 0;
        this.isActive = true;
        
        this.statusTracker = this.items.map(() => ({ text: false, front: false, back: false, zipDL: false, video: false }));
        
        this.updateUI();
        this.activeDoc.getElementById('clipboard-queue-drawer').style.display = 'flex';
    },

    close() {
        this.isActive = false;
        this.activeDoc.getElementById('clipboard-queue-drawer').style.display = 'none';
    },

    resetCurrent() {
        if (!this.isActive || this.items.length === 0) return;
        this.statusTracker[this.currentIndex] = { text: false, front: false, back: false, zipDL: false, video: false };
        this.renderStatus();
    },

    generateText(index) {
        const c = this.items[index];
        if (!c) return '';
        const obText = c.ob ? (c.ob / 1000) : '0';
        const boText = c.bo ? (c.bo / 1000) : '-';
        return `#${index + 1} ${c.name} ${c.rarity}\nOB: ${obText}\nNB: ${c.nb}\nBO: ${boText}`;
    },

    async copyText() {
        if (!this.isActive || this.items.length === 0) return;
        
        const btn = this.activeDoc.getElementById('btn-queue-copy');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Text Copied!';
        
        const text = this.generateText(this.currentIndex);
        
        try {
            await this.activeWin.navigator.clipboard.writeText(text);
            btn.style.background = '#22c55e';
            
            if (typeof copySingleDraftCard === 'function') copySingleDraftCard(this.currentIndex);
            
            this.statusTracker[this.currentIndex].text = true;
            this.renderStatus();

            setTimeout(() => {
                btn.innerHTML = orig;
                btn.style.background = '';
            }, 1000);
        } catch (err) {
            console.error('Text clipboard copy failed:', err);
            btn.innerHTML = 'Failed!';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        }
    },

    async copyImage(side) {
        if (!this.isActive || this.items.length === 0) return;

        const currentCard = this.items[this.currentIndex];
        const masterCard = state.inventory.find(c => c.id === currentCard.id) || currentCard;
        
        // ✅ LIVE PRIORITY: Always check MasterCard first
        let targetUrl = side === 'front' 
            ? (masterCard.frontImage || masterCard.frontimage || currentCard.frontImage || currentCard.frontimage || currentCard.evidence)
            : (masterCard.backImage || masterCard.backimage || currentCard.backImage || currentCard.backimage);
        
        if (!targetUrl || targetUrl.length < 5) return;

        const btnId = side === 'front' ? 'btn-queue-front-copy' : 'btn-queue-back-copy';
        const btn = this.activeDoc.getElementById(btnId);
        if(!btn) return;

        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching Original...';

        try {
            const clipboardPromise = new Promise(async (resolve, reject) => {
                try {
                    let base64Data = null;
                    const driveMatch = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || targetUrl.match(/id=([a-zA-Z0-9_-]+)/);
                    
                    if (driveMatch && driveMatch[1]) {
                        const gasRes = await fetch(API_URL, {
                            method: 'POST',
                            body: JSON.stringify({ action: 'getDriveFileBase64', pass: sessionStorage.getItem('appPass'), fileId: driveMatch[1] })
                        });
                        const gasData = await gasRes.json();
                        if (gasData.success && gasData.base64) {
                            base64Data = `data:${gasData.mimeType};base64,${gasData.base64}`;
                        }
                    }

                    if (!base64Data) {
                        const directUrl = typeof getDirectImageUrl === 'function' ? getDirectImageUrl(targetUrl, 's0') : targetUrl;
                        base64Data = `https://wsrv.nl/?url=${encodeURIComponent(directUrl)}&output=png`;
                    }

                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = base64Data;
                    
                    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingEnabled = false; 
                    ctx.drawImage(img, 0, 0);
                    
                    canvas.toBlob(blob => resolve(blob), 'image/png', 1.0);
                } catch (e) {
                    reject(e);
                }
            });

            await this.activeWin.navigator.clipboard.write([
                new this.activeWin.ClipboardItem({ 'image/png': clipboardPromise })
            ]);
            
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            if (side === 'front') this.statusTracker[this.currentIndex].front = true;
            if (side === 'back') this.statusTracker[this.currentIndex].back = true;
            this.renderStatus();

            setTimeout(() => { btn.innerHTML = orig; }, 1500);

        } catch (err) {
            console.error('Image clipboard copy failed:', err);
            btn.innerHTML = 'Failed!';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
            this.activeWin.alert("Clipboard Error: Browser blocked the action. Try the ZIP download instead.");
        }
    },

    async downloadAllMediaAsZip() {
        if (!this.isActive || this.items.length === 0) return;
        
        const btn = this.activeDoc.getElementById('btn-queue-zip-dl');
        if(!btn) return;
        
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching Raw Files...';
        btn.disabled = true;

        try {
            if (typeof JSZip === 'undefined') throw new Error("JSZip not loaded");
            const zip = new JSZip();
            
            const currentCard = this.items[this.currentIndex];
            const masterCard = state.inventory.find(c => c.id === currentCard.id) || currentCard;
            const safeName = (currentCard.name || 'Card').replace(/[^a-z0-9]/gi, '_');
            const folder = zip.folder(`Card_${this.currentIndex + 1}_${safeName}`);
            
            let urlsToFetch = [];
            
            // ✅ LIVE PRIORITY: Always check MasterCard first
            const fUrl = masterCard.frontImage || masterCard.frontimage || currentCard.frontImage || currentCard.frontimage || currentCard.evidence;
            if (fUrl && fUrl.length > 5) urlsToFetch.push({ url: fUrl, name: 'Front' });
            
            const bUrl = masterCard.backImage || masterCard.backimage || currentCard.backImage || currentCard.backimage;
            if (bUrl && bUrl.length > 5) urlsToFetch.push({ url: bUrl, name: 'Back' });
            
            let pMedia = {};
            // ✅ LIVE PRIORITY: Always parse MasterCard media first
            try { pMedia = JSON.parse(masterCard.conditionMedia || currentCard.conditionMedia || '{}'); } catch(e) {}
            if (pMedia.flaws && pMedia.flaws.length > 0) {
                pMedia.flaws.forEach((flaw, idx) => {
                    if (flaw.url) urlsToFetch.push({ url: flaw.url, name: `Flaw_${idx+1}` });
                });
            }

            if (urlsToFetch.length === 0) throw new Error("No media to download");

            await Promise.all(urlsToFetch.map(async (item) => {
                let rawUrl = item.url;
                try {
                    const driveMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/id=([a-zA-Z0-9_-]+)/);
                    if (driveMatch && driveMatch[1]) {
                        const gasRes = await fetch(API_URL, {
                            method: 'POST',
                            body: JSON.stringify({ action: 'getDriveFileBase64', pass: sessionStorage.getItem('appPass'), fileId: driveMatch[1] })
                        });
                        const gasData = await gasRes.json();
                        
                        if (gasData.success && gasData.base64) {
                            let ext = gasData.mimeType === 'image/png' ? 'png' : 'jpg';
                            folder.file(`${item.name}.${ext}`, gasData.base64, { base64: true });
                            return;
                        }
                    }
                    
                    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(typeof getDirectImageUrl === 'function' ? getDirectImageUrl(rawUrl, 's0') : rawUrl)}`;
                    const res = await fetch(proxyUrl);
                    if (res.ok) {
                        const blob = await res.blob();
                        let ext = blob.type === 'image/png' ? 'png' : 'jpg';
                        folder.file(`${item.name}.${ext}`, blob);
                    }
                } catch(e) { console.warn("Failed to fetch:", item.name); }
            }));

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `#${this.currentIndex + 1}_${safeName}_Media.zip`);

            this.statusTracker[this.currentIndex].zipDL = true;
            this.renderStatus();
            btn.innerHTML = '<i class="fas fa-check"></i> Downloaded';
        } catch (err) {
            console.error("Zip failed:", err);
            btn.innerHTML = 'Failed!';
            this.activeWin.alert("ZIP Export Failed: " + err.message);
        }

        setTimeout(() => { 
            btn.innerHTML = orig; 
            btn.disabled = false; 
        }, 2000);
    },

    openVideo() {
        const currentCard = this.items[this.currentIndex];
        const masterCard = state.inventory.find(c => c.id === currentCard.id) || currentCard;
        let pMedia = {};
        // ✅ LIVE PRIORITY
        try { pMedia = JSON.parse(masterCard.conditionMedia || currentCard.conditionMedia || '{}'); } catch(e) {}
        
        if (pMedia.video) {
            let viewUrl = pMedia.video;
            if (viewUrl.includes('drive.google.com')) {
                const match = viewUrl.match(/id=([a-zA-Z0-9_-]+)/) || viewUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    viewUrl = `https://drive.google.com/file/d/${match[1]}/view`;
                }
            }
            this.activeWin.open(viewUrl, '_blank');
            this.statusTracker[this.currentIndex].video = true;
            this.renderStatus();
        }
    },

    async downloadVideo() {
        if (!this.isActive || this.items.length === 0) return;
        
        const currentCard = this.items[this.currentIndex];
        const masterCard = state.inventory.find(c => c.id === currentCard.id) || currentCard;
        let pMedia = {};
        // ✅ LIVE PRIORITY
        try { pMedia = JSON.parse(masterCard.conditionMedia || currentCard.conditionMedia || '{}'); } catch(e) {}
        
        if (!pMedia.video) return;

        const btn = this.activeDoc.getElementById('btn-queue-vid-dl');
        if (!btn) return;
        
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting Video...';
        btn.disabled = true;

        try {
            const rawUrl = pMedia.video;
            const safeName = (currentCard.displayName || currentCard.name || 'Card').replace(/[^a-zA-Z0-9 \[\]]/g, '').trim();
            const customFileName = `#${this.currentIndex + 1}_${safeName}_Video.mp4`;

            let blob = null;

            if (rawUrl.includes('drive.google.com')) {
                const match = rawUrl.match(/id=([^&]+)/);
                if (match && match[1]) {
                    const gasRes = await fetch(API_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'getDriveFileBase64', pass: sessionStorage.getItem('appPass'), fileId: match[1] })
                    });
                    const gasData = await gasRes.json();
                    
                    if (gasData.success && gasData.base64) {
                        const dataUrl = `data:${gasData.mimeType || 'video/mp4'};base64,${gasData.base64}`;
                        const res = await fetch(dataUrl);
                        blob = await res.blob();
                    } else {
                        throw new Error("Failed to fetch video from Drive");
                    }
                }
            } else {
                const res = await fetch(rawUrl);
                blob = await res.blob();
            }

            if (blob) {
                const url = window.URL.createObjectURL(blob);
                const a = this.activeDoc.createElement('a');
                a.href = url;
                a.download = customFileName;
                this.activeDoc.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                this.activeDoc.body.removeChild(a);
                
                btn.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
                this.statusTracker[this.currentIndex].video = true;
                this.renderStatus();
            }
        } catch (err) {
            console.error("Video Download Error:", err);
            btn.innerHTML = 'Failed!';
            this.activeWin.alert("Download failed. The video might be too large. Use the ZIP downloader instead.");
        }

        setTimeout(() => {
            if(btn) { btn.innerHTML = orig; btn.disabled = false; }
        }, 2500);
    },

    next() {
        if (this.currentIndex < this.items.length - 1) {
            this.currentIndex++;
            this.updateUI();
        }
    },

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateUI();
        }
    },

    renderStatus() {
        const container = this.activeDoc.getElementById('queue-status-tracker');
        if(!container) return;
        
        let badges = [];
        const currentTracker = this.statusTracker[this.currentIndex];

        if (currentTracker.text) badges.push(`<span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 6px; border-radius: 4px;">✅ Text</span>`);
        if (currentTracker.front) badges.push(`<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px;">✅ Front Copied</span>`);
        if (currentTracker.back) badges.push(`<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 2px 6px; border-radius: 4px;">✅ Back Copied</span>`);
        if (currentTracker.zipDL) badges.push(`<span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 6px; border-radius: 4px;">✅ Extracted (ZIP)</span>`);
        if (currentTracker.video) badges.push(`<span style="background: rgba(168, 85, 247, 0.2); color: #a855f7; padding: 2px 6px; border-radius: 4px;">✅ Video Opened</span>`);
        
        container.innerHTML = badges.length > 0 ? badges.join('') : '<span style="opacity: 0.5;">No actions taken yet...</span>';
    },

    updateUI() {
        const total = this.items.length;
        const current = total > 0 ? this.currentIndex + 1 : 0;
        const currentCard = this.items[this.currentIndex];
        const masterCard = state.inventory.find(c => c.id === currentCard?.id) || currentCard;
        
        this.activeDoc.getElementById('queue-count').innerText = `${current}/${total}`;
        this.activeDoc.getElementById('queue-text-preview').value = this.generateText(this.currentIndex);
        
        this.activeDoc.getElementById('btn-queue-prev').disabled = this.currentIndex === 0;
        this.activeDoc.getElementById('btn-queue-next').disabled = this.currentIndex === total - 1;

        this.renderStatus();

        const dynamicContainer = this.activeDoc.getElementById('dynamic-media-buttons');
        if (dynamicContainer && currentCard) {
            dynamicContainer.innerHTML = '';
            
            // Check media availability
            const frontUrl = masterCard.frontImage || masterCard.frontimage || currentCard.frontImage || currentCard.frontimage || currentCard.evidence;
            const hasFront = frontUrl && frontUrl.length > 5;

            const backUrl = masterCard.backImage || masterCard.backimage || currentCard.backImage || currentCard.backimage;
            const hasBack = backUrl && backUrl.length > 5;

            let pMedia = {};
            try { pMedia = JSON.parse(masterCard.conditionMedia || currentCard.conditionMedia || '{}'); } catch(e) {}
            
            const hasFlaws = (pMedia.flaws && pMedia.flaws.length > 0);
            const hasAnyMedia = hasFront || hasBack || hasFlaws;
            const hasVideo = !!pMedia.video;

            // 1. Copy Front Button
            const btnFront = this.activeDoc.createElement('button');
            btnFront.id = 'btn-queue-front-copy';
            btnFront.className = 'btn-outline';
            btnFront.innerHTML = '<i class="fas fa-image"></i> Copy Front (Alt+V)';
            if (hasFront) {
                btnFront.style.cssText = 'width: 100%; margin-bottom: 8px; font-size: 12px; border-color: #38bdf8; color: #38bdf8; padding: 8px; cursor: pointer;';
                btnFront.addEventListener('click', () => this.copyImage('front'));
            } else {
                btnFront.style.cssText = 'width: 100%; margin-bottom: 8px; font-size: 12px; border-color: #3f3f46; color: #71717a; padding: 8px; cursor: not-allowed;';
                btnFront.disabled = true;
            }
            dynamicContainer.appendChild(btnFront);

            // 2. Copy Back Button
            const btnBack = this.activeDoc.createElement('button');
            btnBack.id = 'btn-queue-back-copy';
            btnBack.className = 'btn-outline';
            btnBack.innerHTML = '<i class="fas fa-image"></i> Copy Back (Alt+B)';
            if (hasBack) {
                btnBack.style.cssText = 'width: 100%; margin-bottom: 8px; font-size: 12px; border-color: #38bdf8; color: #38bdf8; padding: 8px; cursor: pointer;';
                btnBack.addEventListener('click', () => this.copyImage('back'));
            } else {
                btnBack.style.cssText = 'width: 100%; margin-bottom: 8px; font-size: 12px; border-color: #3f3f46; color: #71717a; padding: 8px; cursor: not-allowed;';
                btnBack.disabled = true;
            }
            dynamicContainer.appendChild(btnBack);

            // 3. Download All Media (ZIP)
            const btnZip = this.activeDoc.createElement('button');
            btnZip.id = 'btn-queue-zip-dl';
            btnZip.className = 'btn-outline';
            btnZip.innerHTML = '<i class="fas fa-file-archive"></i> Download All Media (ZIP)';
            if (hasAnyMedia) {
                btnZip.style.cssText = 'width: 100%; margin-bottom: 8px; font-size: 12px; border-color: #22c55e; color: #22c55e; padding: 8px; cursor: pointer;';
                btnZip.addEventListener('click', () => this.downloadAllMediaAsZip());
            } else {
                btnZip.style.cssText = 'width: 100%; margin-bottom: 8px; font-size: 12px; border-color: #3f3f46; color: #71717a; padding: 8px; cursor: not-allowed;';
                btnZip.disabled = true;
            }
            dynamicContainer.appendChild(btnZip);

            // 4. Video Buttons Wrapper
            const vidWrapper = this.activeDoc.createElement('div');
            vidWrapper.style.cssText = 'display: flex; gap: 8px; width: 100%;';

            const btnVid = this.activeDoc.createElement('button');
            btnVid.id = 'btn-queue-vid';
            btnVid.className = 'btn-outline';
            btnVid.innerHTML = '<i class="fas fa-external-link-alt"></i> Open Link';
            if (hasVideo) {
                btnVid.style.cssText = 'flex: 1; font-size: 12px; border-color: #eab308; color: #eab308; padding: 8px; cursor: pointer;';
                btnVid.addEventListener('click', () => this.openVideo());
            } else {
                btnVid.style.cssText = 'flex: 1; font-size: 12px; border-color: #3f3f46; color: #71717a; padding: 8px; cursor: not-allowed;';
                btnVid.disabled = true;
            }
            vidWrapper.appendChild(btnVid);

            const btnVidDl = this.activeDoc.createElement('button');
            btnVidDl.id = 'btn-queue-vid-dl';
            btnVidDl.className = 'btn-outline';
            btnVidDl.innerHTML = '<i class="fas fa-download"></i> Download Video';
            if (hasVideo) {
                btnVidDl.style.cssText = 'flex: 1; font-size: 12px; border-color: #eab308; color: #eab308; padding: 8px; cursor: pointer;';
                btnVidDl.addEventListener('click', () => this.downloadVideo());
            } else {
                btnVidDl.style.cssText = 'flex: 1; font-size: 12px; border-color: #3f3f46; color: #71717a; padding: 8px; cursor: not-allowed;';
                btnVidDl.disabled = true;
            }
            vidWrapper.appendChild(btnVidDl);

            dynamicContainer.appendChild(vidWrapper);
        }
    },

    async popOutToPiP() {
        if (!('documentPictureInPicture' in window)) {
            alert("Your browser does not support the Document Picture-in-Picture API. Please use a modern Chromium browser like Chrome or Edge.");
            return;
        }

        const queueDrawer = this.activeDoc.getElementById('clipboard-queue-drawer');
        
        try {
            const pipWindow = await documentPictureInPicture.requestWindow({
                width: 360,
                height: 480
            });

            const stylesheets = Array.from(document.styleSheets);
            stylesheets.forEach((stylesheet) => {
                try {
                    const newStyle = pipWindow.document.createElement('style');
                    const cssRules = Array.from(stylesheet.cssRules).map(rule => rule.cssText).join('');
                    newStyle.appendChild(pipWindow.document.createTextNode(cssRules));
                    pipWindow.document.head.appendChild(newStyle);
                } catch (e) {
                     if(stylesheet.href) {
                         const link = pipWindow.document.createElement('link');
                         link.rel = 'stylesheet';
                         link.href = stylesheet.href;
                         pipWindow.document.head.appendChild(link);
                     }
                }
            });
            
            const faLink = pipWindow.document.createElement('link');
            faLink.rel = 'stylesheet';
            faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            pipWindow.document.head.appendChild(faLink);

            // Shift Context to PiP Window
            this.activeDoc = pipWindow.document;
            this.activeWin = pipWindow;

            const pipWrapper = pipWindow.document.createElement('div');
            pipWrapper.style.cssText = 'background: #0f1219; height: 100vh; overflow: hidden; display: flex; flex-direction: column;';
            
            queueDrawer.style.position = 'relative';
            queueDrawer.style.top = '0';
            queueDrawer.style.right = '0';
            queueDrawer.style.width = '100%';
            queueDrawer.style.height = '100%';
            queueDrawer.style.border = 'none';
            queueDrawer.style.boxShadow = 'none';
            queueDrawer.style.borderRadius = '0';

            const popOutBtn = queueDrawer.querySelector('#btn-pop-out-queue');
            if(popOutBtn) popOutBtn.style.display = 'none';
            
            const closeBtn = queueDrawer.querySelector('#close-queue-btn');
            if(closeBtn) closeBtn.style.display = 'none';

            pipWrapper.appendChild(queueDrawer);
            pipWindow.document.body.appendChild(pipWrapper);

           pipWindow.document.addEventListener('keydown', (e) => {
                if (!this.isActive) return;
                
                const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

                if (e.key === 'ArrowLeft' && !isTyping) { e.preventDefault(); this.prev(); }
                if (e.key === 'ArrowRight' && !isTyping) { e.preventDefault(); this.next(); }

                if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); this.copyText(); }
                if (e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); this.copyImage('front'); }
                if (e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); this.copyImage('back'); }
            });

            // Revert Styling and Context on Close
            pipWindow.addEventListener('pagehide', () => {
                this.activeDoc = document; 
                this.activeWin = window;

                queueDrawer.style.position = 'fixed';
                queueDrawer.style.top = '20px';
                queueDrawer.style.right = '20px';
                queueDrawer.style.width = '340px';
                queueDrawer.style.height = ''; 
                queueDrawer.style.background = 'var(--bg-sidebar)'; 
                queueDrawer.style.border = '1px solid var(--border-color)';
                queueDrawer.style.borderRadius = '12px';
                queueDrawer.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.5)';
                queueDrawer.style.zIndex = '10000';
                
                if(popOutBtn) popOutBtn.style.display = 'block';
                if(closeBtn) closeBtn.style.display = 'block';

                document.body.appendChild(queueDrawer);
            });

        } catch (error) {
            console.error("Failed to open PiP window:", error);
        }
    }
};

// UI Triggers
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-start-fb-queue')?.addEventListener('click', () => FBQueue.start());
    document.getElementById('close-queue-btn')?.addEventListener('click', () => FBQueue.close());
    document.getElementById('btn-queue-reset')?.addEventListener('click', () => FBQueue.resetCurrent());
    document.getElementById('btn-queue-copy')?.addEventListener('click', () => FBQueue.copyText());
    document.getElementById('btn-queue-next')?.addEventListener('click', () => FBQueue.next());
    document.getElementById('btn-queue-prev')?.addEventListener('click', () => FBQueue.prev());
    // Add this line where you have your other FBQueue event listeners:
document.getElementById('btn-pop-out-queue')?.addEventListener('click', () => FBQueue.popOutToPiP());
});

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (!FBQueue.isActive) return;
    
    // Safety check: Don't trigger if you are actively typing inside a text box
    const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    
    // Left Arrow: Previous Card
    if (e.key === 'ArrowLeft' && !isTyping) {
        e.preventDefault();
        FBQueue.prev();
    }
    
    // Right Arrow: Next Card
    if (e.key === 'ArrowRight' && !isTyping) {
        e.preventDefault();
        FBQueue.next();
    }
    
    // Alt + C: Copy Text
    if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        FBQueue.copyText();
    }
    
    // Alt + V: Trigger Front Image Copy
    if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const frontBtn = document.getElementById('btn-queue-front-copy');
        if (frontBtn && !frontBtn.disabled) FBQueue.copyImage('front');
    }
    
    // Alt + B: Trigger Back Image Copy
    if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const backBtn = document.getElementById('btn-queue-back-copy');
        if (backBtn && !backBtn.disabled) FBQueue.copyImage('back');
    }
});

// --- MOBILE HD SCANNER LOGIC (QR Companion) ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-toggle-mobile-scan')?.addEventListener('click', () => {
        const video = document.getElementById('camera-stream');
        const qrContainer = document.getElementById('mobile-hd-container');
        const toggleBtn = document.getElementById('btn-toggle-mobile-scan');
        const manualBtns = document.getElementById('btn-cap-front').parentNode;

        // Kill the webcam stream entirely to free up bandwidth and battery
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
            video.srcObject = null;
        }
        
        fullStopAutoScan();

        // Reveal the QR Telemetry Interface
        video.parentNode.style.display = 'none';
        manualBtns.style.display = 'none';
        toggleBtn.style.display = 'none';
        qrContainer.style.display = 'flex';
        document.getElementById('btn-finish-mobile-scan').style.display = 'none';

        // Generate isolated Session ID
        currentMobileSessionId = 'SESS_' + Date.now() + Math.floor(Math.random() * 1000);
        
        // Build direct Apps Script payload
        const mobileLink = `${API_URL}?mode=mobile_cam&sessionId=${currentMobileSessionId}&pass=${sessionStorage.getItem('appPass')}&v=${Date.now()}`;
        
        document.getElementById('qr-code-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mobileLink)}`;
        document.getElementById('qr-code-img').style.display = 'block';
        document.getElementById('mobile-hd-status').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Polling buffer state...';

        // Establish background ping
        if (mobilePollingInterval) clearInterval(mobilePollingInterval);
        mobilePollingInterval = setInterval(pollMobileBuffer, 2500); // Polling every 2.5 seconds
    });

    document.getElementById('btn-cancel-mobile-scan')?.addEventListener('click', () => {
        closeCameraModal();
        setTimeout(openCameraModal, 300); // Relaunch native webcam protocol safely
    });

    document.getElementById('btn-finish-mobile-scan')?.addEventListener('click', finalizeMobileScan);
});

let lastPolledSessionId = null;
let nextMobileReadIndex = 0;

let isPollingMain = false;
async function pollMobileBuffer() {
    if (!currentMobileSessionId || isPollingMain) return;
    isPollingMain = true;
    
    // Reset the ticket index if a new session starts
    if (currentMobileSessionId !== lastPolledSessionId) {
        lastPolledSessionId = currentMobileSessionId;
        nextMobileReadIndex = 0;
    }
    
    try {
        let statusEl = document.getElementById('mobile-hd-status') || 
                       document.getElementById('qr-status') || 
                       document.querySelector('.modal-content p.text-info') ||
                       document.querySelector('p[style*="color: #00d2ff"]'); 
        
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'pollMobileScan', 
                pass: sessionStorage.getItem('appPass'), 
                sessionId: currentMobileSessionId,
                nextReadIndex: nextMobileReadIndex
            })
        });
        const data = await res.json();
        
        if (data.success) {
            if (data.streamData && data.streamData.length > 0) {
                processMobileBatchArray(data.streamData);
                try { playBeep('success'); } catch(e){} 
            }
            if (data.latestVideo) {
                attachMobileVideoToRow(data.latestVideo);
            }
            
            // ✅ CRITICAL FIX: ALWAYS update the index to prevent deadlocks on dropped tickets
            if (data.nextReadIndex !== undefined) {
                nextMobileReadIndex = data.nextReadIndex; 
            }

            if (statusEl) {
                if (data.status === 'completed') {
                    clearInterval(mobilePollingInterval);
                    statusEl.innerHTML = '✅ PC Connection Closed.';
                    statusEl.style.color = '#22c55e';
                    setTimeout(() => closeCameraModal(), 2000);
                } else {
                    statusEl.innerHTML = `📡 Live Sync Active... (${data.streamCount || 0} Cards Synced)`;
                }
            }
        }
    } catch (e) {
        console.error("Polling loop error bypassed:", e);
    } finally {
        isPollingMain = false;
    }
}

function processMobileBatchArray(batchArray) {
    const modalAiCheck = document.querySelector('.modal-content input[type="checkbox"], input[type="checkbox"]:checked');
    const useAI = modalAiCheck ? modalAiCheck.checked : true;
    
    batchArray.forEach((card) => {
        try {
            // 1. Look for a row we already started building for this exact card
            let trElement = document.querySelector(`tr[data-batch-id="${card.id}"]`);
            
            // 2. Fallbacks if this is the Front image arriving for the first time
            if (!trElement && typeof activeScanTarget !== 'undefined' && activeScanTarget && activeScanTarget.type === 'new_row') {
                trElement = activeScanTarget.element;
                activeScanTarget = null;
            } 
            
            if (!trElement) {
                if (typeof getNextAvailableRow === 'function') {
                    trElement = getNextAvailableRow();
                }
                if (!trElement) {
                    const allRows = document.querySelectorAll('#add-cards-body tr');
                    for (let row of allRows) {
                        const firstInput = row.querySelector('.c-name');
                        if (firstInput && firstInput.value === '') {
                            trElement = row;
                            break;
                        }
                    }
                }
            }

            // 3. Inject Data & Trigger AI
            if (trElement) {
                trElement.setAttribute('data-batch-id', card.id);
                
                if (card.frontDrive) trElement.setAttribute('data-front-img', card.frontDrive);
                if (card.backDrive) trElement.setAttribute('data-back-img', card.backDrive);
                // ✅ NEW: Catch Mobile Video and inject it into the Condition Media JSON
                if (card.videoDrive) {
                    const mediaBtn = trElement.querySelector('.btn-manage-media');
                    if (mediaBtn) {
                        let mediaData = { video: '', flaws: [] };
                        try { mediaData = JSON.parse(mediaBtn.getAttribute('data-media') || '{"video":"","flaws":[]}'); } catch(e) {}
                        
                        if (mediaData.video !== card.videoDrive) {
                            mediaData.video = card.videoDrive;
                            mediaBtn.setAttribute('data-media', JSON.stringify(mediaData));
                            const mediaCount = (mediaData.video ? 1 : 0) + (mediaData.flaws?.length || 0);
                            mediaBtn.innerHTML = `<i class="fas fa-photo-video"></i> (${mediaCount})`;
                            mediaBtn.style.color = 'var(--accent-yellow)';
                            mediaBtn.style.borderColor = 'var(--accent-yellow)';
                        }
                    }
                }
                
                const scanBtn = trElement.querySelector('.btn-row-scan, .scan-btn, button i.fa-camera');
                if (scanBtn) {
                    const btnWrapper = scanBtn.closest('button') || scanBtn;
                    btnWrapper.innerHTML = '✅';
                    btnWrapper.style.color = '#22c55e';
                    btnWrapper.style.borderColor = '#22c55e';
                }
                
                // Fire AI ONLY once per card, requiring the front image
                const isAIPending = trElement.getAttribute('data-ai-started') !== 'true';
                
                if (useAI && card.frontDrive && isAIPending && typeof processAICognition === 'function') {
                    trElement.setAttribute('data-ai-started', 'true');
                    
                    const fileIdMatch = card.frontDrive.match(/id=([a-zA-Z0-9_-]+)/);
                    if (fileIdMatch && fileIdMatch[1]) {
                        const fileId = fileIdMatch[1];
                        fetch(API_URL, {
                            method: 'POST',
                            body: JSON.stringify({ 
                                action: 'getDriveFileBase64', 
                                pass: sessionStorage.getItem('appPass'), 
                                fileId: fileId 
                            })
                        })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && data.base64) {
                                processAICognition(data.base64, trElement);
                            }
                        }).catch(err => console.error("AI Network Fetch Error:", err));
                    }
                }
            }
        } catch (error) {
            console.error("Handled streaming error for a card, bypassing...", error);
        }
    });
}

window.triggerUpdateSide = function(cardId, side) {
    const card = state.inventory.find(c => c.id === cardId);
    if (!card) return alert("Card not found.");
    activeScanTarget = { type: 'update_side', card: card, side: side };
    openCameraModal();
};

window.updateSpecificCardSide = function(target, side, url) {
    let realCard = state.inventory.find(c => c.id === target.card.id);
    if (realCard) {
        if (side === 'front') realCard.frontImage = url;
        if (side === 'back') realCard.backImage = url;
        silentPostData('updateCard', { ...realCard });
    }
    
    renderInventory();

    const frontImg = document.getElementById('img-single-front') || document.getElementById('v-front-img');
    const backImg = document.getElementById('img-single-back') || document.getElementById('v-back-img');
    
    if (side === 'front' && frontImg) {
        frontImg.src = getDirectImageUrl(url, 'w1600');
        const box = frontImg.closest('div[id*="front-box"]') || frontImg.closest('div[style*="flex-direction: column"]');
        const mag = document.getElementById('mag-single-front') || document.getElementById('v-front-box');
        const missing = document.getElementById('v-front-missing');
        if (mag) mag.style.display = 'inline-flex';
        if (missing) missing.style.display = 'none';
    }
    if (side === 'back' && backImg) {
        backImg.src = getDirectImageUrl(url, 'w1600');
        const box = backImg.closest('div[id*="back-box"]') || backImg.closest('div[style*="flex-direction: column"]');
        const mag = document.getElementById('mag-single-back') || document.getElementById('v-back-box');
        const missing = document.getElementById('v-back-missing');
        if (mag) mag.style.display = 'inline-flex';
        if (missing) missing.style.display = 'none';
    }
};

document.getElementById('camera-file-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const label = e.target.parentElement;
    const origHTML = label.innerHTML;
    label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    label.style.pointerEvents = 'none';

    try {
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
        
        let targetSide = 'front';
        if (activeScanTarget && activeScanTarget.type === 'update_side') {
            targetSide = activeScanTarget.side;
        } else if (document.getElementById('btn-cap-back').style.display === 'flex') {
            targetSide = 'back';
        }
        
        await captureAndUpload(targetSide, base64Data); // <-- AWAIT ADDED HERE
    } catch (err) {
        alert("File Upload failed.");
    } finally {
        label.innerHTML = origHTML;
        label.style.pointerEvents = 'auto';
        e.target.value = '';
    }
});

function attachMobileVideoToRow(videoUrl) {
    const targetRow = getNextAvailableRow();
    if (!targetRow) return;

    const mediaBtn = targetRow.querySelector('.btn-manage-media');
    if (mediaBtn) {
        let mediaData = { video: '', flaws: [] };
        try {
            mediaData = JSON.parse(mediaBtn.getAttribute('data-media') || '{"video":"","flaws":[]}');
        } catch(e) {}

        // Prevent duplicate updates if the same video URL comes back
        if (mediaData.video !== videoUrl) {
            mediaData.video = videoUrl;
            mediaBtn.setAttribute('data-media', JSON.stringify(mediaData));
            
            const mediaCount = (mediaData.video ? 1 : 0) + (mediaData.flaws?.length || 0);
            mediaBtn.innerHTML = `<i class="fas fa-photo-video"></i> (${mediaCount})`;
            mediaBtn.style.color = 'var(--accent-yellow)';
            mediaBtn.style.borderColor = 'var(--accent-yellow)';
            
            try { playBeep('done'); } catch(e){}
        }
    }
}

// ============================================================== 
// NEW: DEDICATED REMOTE MEDIA SYNC LOGIC
// ============================================================== 
let currentMediaSessionId = null;
let mediaPollingInterval = null;
let nextMediaReadIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-toggle-media-mobile')?.addEventListener('click', () => {
        const qrContainer = document.getElementById('media-mobile-qr-container');
        const toggleBtn = document.getElementById('btn-toggle-media-mobile');

        toggleBtn.style.display = 'none';
        qrContainer.style.display = 'flex';

        currentMediaSessionId = 'MEDIA_SESS_' + Date.now() + Math.floor(Math.random() * 1000);
        nextMediaReadIndex = 0;

        const mobileLink = `${API_URL}?mode=mobile_media&sessionId=${currentMediaSessionId}&pass=${sessionStorage.getItem('appPass')}`;
        document.getElementById('media-qr-code-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mobileLink)}`;
        document.getElementById('media-mobile-status').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Polling media state...';

        if (mediaPollingInterval) clearInterval(mediaPollingInterval);
        mediaPollingInterval = setInterval(pollMobileMediaBuffer, 2000);
    });

    document.getElementById('btn-close-media-mobile')?.addEventListener('click', () => {
        document.getElementById('media-mobile-qr-container').style.display = 'none';
        document.getElementById('btn-toggle-media-mobile').style.display = 'block';
        if (mediaPollingInterval) clearInterval(mediaPollingInterval);
    });

    // Automatically close polling when modal closes
    document.getElementById('cancel-media')?.addEventListener('click', () => {
        if (mediaPollingInterval) clearInterval(mediaPollingInterval);
        document.getElementById('media-mobile-qr-container').style.display = 'none';
        document.getElementById('btn-toggle-media-mobile').style.display = 'block';
    });
    document.getElementById('save-media-btn')?.addEventListener('click', () => {
        if (mediaPollingInterval) clearInterval(mediaPollingInterval);
        document.getElementById('media-mobile-qr-container').style.display = 'none';
        document.getElementById('btn-toggle-media-mobile').style.display = 'block';
    });
});

let isPollingMedia = false;
async function pollMobileMediaBuffer() {
    if (!currentMediaSessionId || isPollingMedia) return;
    isPollingMedia = true;
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'pollMobileMedia',
                pass: sessionStorage.getItem('appPass'),
                sessionId: currentMediaSessionId,
                nextReadIndex: nextMediaReadIndex
            })
        });
        const data = await res.json();

        if (data.success && data.streamData && data.streamData.length > 0) {
            data.streamData.forEach(payload => {
                if (payload.type === 'video') {
                    tempMediaData.video = payload.url;
                } else if (payload.type === 'flaw') {
                    tempMediaData.flaws.push({
                        side: payload.side,
                        type: payload.flawType,
                        url: payload.url
                    });
                }
            });
            nextMediaReadIndex = data.nextReadIndex;
            renderMediaModalUI(); // Visually update the PC modal instantly
            try { playBeep('success'); } catch(e){}
        }

        const statusEl = document.getElementById('media-mobile-status');
        if (statusEl) {
            if (data.status === 'completed') {
                clearInterval(mediaPollingInterval);
                statusEl.innerHTML = '✅ Remote Device Disconnected.';
                statusEl.style.color = '#22c55e';
                setTimeout(() => document.getElementById('btn-close-media-mobile').click(), 2000);
            } else {
                statusEl.innerHTML = `📡 Live Sync Active... (${data.streamCount || 0} items received)`;
            }
        }
    } catch (e) {
        console.error("Media polling error:", e);
    } finally {
        isPollingMedia = false;
    }
}

// ============================================================== 
// PRICE & VARIANT PREVIEW MODAL LOGIC
// ============================================================== 
function openPricePreviewModal(cardsToExport, isWatermarked, includeBackside, stampPrices = true) {
    const listContainer = document.getElementById('price-preview-list');
    listContainer.innerHTML = '';

    // Update Modal Title Dynamically
    const modalTitle = document.querySelector('#modal-price-preview h3');
    if (modalTitle) {
        modalTitle.innerHTML = stampPrices 
            ? '<i class="fas fa-tags"></i> Review Selling Prices' 
            : '<i class="fas fa-layer-group"></i> Select Variants to Export';
    }

    const saveBtn = document.getElementById('btn-confirm-grid-prices');
    saveBtn.innerHTML = stampPrices ? '✅ Save & Generate Grid' : '✅ Generate Grid';

    // Flatten master cards into individual variant items
    let allVariantItems = [];
    cardsToExport.forEach(card => {
        if (card.variants && Object.keys(card.variants).length > 0) {
            Object.values(card.variants).forEach(v => {
                allVariantItems.push({ ...v, _isSingleVariant: true });
            });
        } else {
            allVariantItems.push({ ...card, _isSingleVariant: true });
        }
    });

    allVariantItems.forEach((variant, index) => {
        let costIdr = Number(variant.totalCost || 0);
        let sellPrice = Number(variant.sellPrice || variant.sellprice || 0);
        let imgUrl = variant.frontImage || variant.frontimage || '';

        // Only render price inputs if the user actually wants to stamp prices
        let priceInputsHtml = stampPrices ? `
            <div style="display: flex; flex-direction: column; gap: 4px; text-align: right; width: 140px;">
                <label style="font-size: 10px; color: var(--text-secondary);">Sell Price (IDR)</label>
                <input type="text" id="preview-price-${index}" value="${sellPrice > 0 ? sellPrice.toLocaleString('id-ID') : ''}" placeholder="e.g. 150.000" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: #000; color: var(--accent-yellow); font-weight: bold; text-align: right;" oninput="let raw = this.value.replace(/[^0-9]/g, ''); this.value = raw ? Number(raw).toLocaleString('id-ID') : ''; updateLiveProfitUI(${index}, ${costIdr}, raw);">
                <div id="preview-profit-${index}" style="font-size: 12px; font-weight: bold; margin-top: 4px;"></div>
            </div>
        ` : `<input type="hidden" id="preview-price-${index}" value="${sellPrice > 0 ? sellPrice : ''}">`;

        let rowHtml = `
            <div style="display: flex; gap: 12px; align-items: center; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
                <input type="checkbox" id="preview-chk-${index}" class="preview-variant-chk" checked style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--accent-yellow);" title="Include in Grid export">
                
                <img src="${typeof getDirectImageUrl === 'function' ? getDirectImageUrl(imgUrl, 'w300') : imgUrl}" style="width: 50px; height: 70px; object-fit: cover; border-radius: 4px;" onerror="this.onerror=null; this.src='https://placehold.co/50x70/1e1e24/94a3b8?text=No+Img'">
                
                <div style="flex: 1; color: var(--text-primary);">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${variant.displayName || variant.name} (${variant.set || '—'})</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        Cond: ${variant.condition || '—'} • Rarity: ${variant.rarity || '—'} • Total Cost: <span style="color: #cbd5e1;">Rp ${Math.round(costIdr).toLocaleString('id-ID')}</span>
                    </div>
                </div>

                ${priceInputsHtml}
            </div>
        `;
        listContainer.innerHTML += rowHtml;
        if (stampPrices) setTimeout(() => updateLiveProfitUI(index, costIdr, sellPrice), 50);
    });

    saveBtn.onclick = async function() {
        const btn = this;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        btn.style.pointerEvents = 'none';

        let selectedVariantsToExport = [];
        let apiUpdates = [];

        allVariantItems.forEach((variant, index) => {
            const chk = document.getElementById(`preview-chk-${index}`);
            const isIncluded = chk ? chk.checked : true;

            // Only process price updates if the user is in Stamp Prices mode
            if (stampPrices) {
                let rawInput = document.getElementById(`preview-price-${index}`).value.replace(/[^0-9]/g, '');
                let newPrice = Number(rawInput) || 0;
                if (newPrice !== Number(variant.sellPrice || variant.sellprice || 0)) {
                    variant.sellPrice = newPrice;
                    variant.sellprice = newPrice;
                    
                    let rawItem = state.inventory.find(i => i.id === variant.id);
                    if (rawItem) {
                        rawItem.sellPrice = newPrice;
                        rawItem.sellprice = newPrice;
                    }
                    apiUpdates.push(variant);
                }
            }

            if (isIncluded) {
                selectedVariantsToExport.push(variant);
            }
        });

        if (apiUpdates.length > 0) {
            Promise.all(apiUpdates.map(v => {
                return fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'updateCard', pass: sessionStorage.getItem('appPass'),
                        id: v.id, name: v.name, set: v.set, rarity: v.rarity, language: v.language, 
                        group: v.group, yenPrice: (v.yenPrice !== undefined ? v.yenPrice : v.yenprice), 
                        quantity: v.quantity, condition: v.condition, storage: v.storage, 
                        frontImage: v.frontImage || v.frontimage, backImage: v.backImage || v.backimage, 
                        conditionMedia: v.conditionMedia || v.conditionmedia, cardNo: v.cardNo || v.cardno, 
                        sellPrice: v.sellPrice
                    })
                });
            })).then(() => fetchData()); 
        }

        document.getElementById('modal-price-preview').style.display = 'none';
        btn.style.pointerEvents = 'auto';
        
        generateCatalogExport(selectedVariantsToExport, 'grid', isWatermarked, includeBackside, false, stampPrices);
    };

    document.getElementById('modal-price-preview').style.display = 'flex';
}

window.updateLiveProfitUI = function(index, costIdr, sellPriceInput) {
    const profitDiv = document.getElementById(`preview-profit-${index}`);
    if (!profitDiv) return;
    
    const sellPrice = Number(sellPriceInput) || 0;

    if (sellPrice === 0) {
        profitDiv.innerHTML = `<span style="color: var(--text-secondary);">--</span>`;
        return;
    }

    const profitIdr = sellPrice - costIdr;
    const profitPercent = costIdr > 0 ? (profitIdr / costIdr) * 100 : 100;
    
    const color = profitPercent < 0 ? '#ef4444' : '#22c55e';
    const arrow = profitPercent < 0 ? '▼' : '▲';

    profitDiv.innerHTML = `<span style="color: ${color};">${arrow} ${profitPercent.toFixed(1)}% (Rp ${Math.abs(Math.round(profitIdr)).toLocaleString('id-ID')})</span>`;
};

// ============================================================== 
// CHANGE PASSWORD ENGINE
// ============================================================== 
document.addEventListener('DOMContentLoaded', () => {
    const btnChangePass = document.getElementById('btn-change-password');
    if (btnChangePass) {
        btnChangePass.addEventListener('click', async () => {
            const oldPass = prompt("Enter your CURRENT password:");
            if (!oldPass) return;
            
            // Validate locally against the active session before hitting the server
            const currentSessionPass = sessionStorage.getItem('appPass');
            if (oldPass !== currentSessionPass) {
                alert("Incorrect current password!");
                return;
            }

            const newPass = prompt("Enter your NEW password:");
            if (!newPass) return;

            const confirmPass = prompt("Confirm your NEW password:");
            if (newPass !== confirmPass) {
                alert("New passwords do not match!");
                return;
            }

            const originalHtml = btnChangePass.innerHTML;
            btnChangePass.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            btnChangePass.style.pointerEvents = 'none';

            try {
                const res = await fetch(API_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'changePassword',
                        pass: oldPass, 
                        oldPass: oldPass,
                        newPass: newPass
                    })
                });
                const data = await res.json();
                
                if (data.success) {
                    alert("Password successfully changed!");
                    sessionStorage.setItem('appPass', newPass); // Instantly log in with new pass
                } else {
                    alert("Failed to change password: " + data.error);
                }
            } catch (e) {
                alert("Network error while changing password.");
            } finally {
                btnChangePass.innerHTML = originalHtml;
                btnChangePass.style.pointerEvents = 'auto';
            }
        });
    }
});

// ============================================================== 
// ADD CARDS AUTOSAVE DRAFT ENGINE
// ============================================================== 
function saveAddCardsDraft() {
    if (!addCardsBody) return;
    const rows = addCardsBody.querySelectorAll('tr');
    if (rows.length === 0) return;

    let draftData = [];
    let hasAnyData = false;

    rows.forEach(row => {
        const nameInput = row.querySelector('.c-name');
        if (!nameInput) return;

        const name = nameInput.value;
        const set = row.querySelector('.c-set') ? row.querySelector('.c-set').value : '';
        const number = row.querySelector('.c-number') ? row.querySelector('.c-number').value : '';
        const rarity = row.querySelector('.c-rarity') ? row.querySelector('.c-rarity').value : '';
        const lang = row.querySelector('.c-lang') ? row.querySelector('.c-lang').value : '';
        const yen = row.querySelector('.c-yen') ? row.querySelector('.c-yen').value : '';
        const qty = row.querySelector('.c-qty') ? row.querySelector('.c-qty').value : '1';
        const notes = row.querySelector('.c-notes') ? row.querySelector('.c-notes').value : '';
        
        const condBtn = row.querySelector('.btn-set-cond');
        const cond = condBtn ? condBtn.getAttribute('data-cond') : '{}';
        
        const mediaBtn = row.querySelector('.btn-manage-media');
        const media = mediaBtn ? mediaBtn.getAttribute('data-media') : '{}';

        const frontImg = row.getAttribute('data-front-img') || '';
        const backImg = row.getAttribute('data-back-img') || '';
        const scanId = row.getAttribute('data-scan-id') || '';
        const batchId = row.getAttribute('data-batch-id') || '';
        const aiStarted = row.getAttribute('data-ai-started') || '';
        
        const scanBtn = row.querySelector('.btn-row-scan');
        const isScanning = scanBtn ? scanBtn.innerHTML : '';

        // Only mark as having data if actual information was typed or an image was attached
        if ((name && !name.includes('⏳') && !name.includes('🤖')) || set || number || frontImg || backImg || yen || notes) {
            hasAnyData = true;
        }

        draftData.push({
            name, set, number, rarity, lang, yen, qty, notes, cond, media, frontImg, backImg, scanId, batchId, aiStarted, isScanning
        });
    });

    if (hasAnyData) {
        localStorage.setItem('unsavedCardsDraft', JSON.stringify(draftData));
    } else {
        localStorage.removeItem('unsavedCardsDraft');
    }
}

function loadAddCardsDraft() {
    if (!addCardsBody) return false;
    const draftStr = localStorage.getItem('unsavedCardsDraft');
    
    if (draftStr) {
        try {
            const draftData = JSON.parse(draftStr);
            if (draftData && draftData.length > 0) {
                addCardsBody.innerHTML = ''; 
                
                draftData.forEach((d) => {
                    addEmptyCardRow();
                    const row = addCardsBody.lastElementChild;
                    
                    // Reset dead AI requests if the page was refreshed mid-scan
                    if (d.name && (d.name.includes('⏳') || d.name.includes('🤖'))) {
                        row.querySelector('.c-name').value = '';
                    } else {
                        row.querySelector('.c-name').value = d.name || '';
                        row.querySelector('.c-name').style.color = (d.name && (d.name.includes('⚠️') || d.name.includes('❌'))) ? '#ef4444' : 'inherit';
                    }
                    
                    if (d.set) row.querySelector('.c-set').value = d.set;
                    if (d.number) row.querySelector('.c-number').value = d.number;
                    if(d.rarity) row.querySelector('.c-rarity').value = d.rarity;
                    if(d.lang) row.querySelector('.c-lang').value = d.lang;
                    if (d.yen) row.querySelector('.c-yen').value = d.yen;
                    if (d.qty) row.querySelector('.c-qty').value = d.qty;
                    if (d.notes) row.querySelector('.c-notes').value = d.notes;

                    if (d.frontImg) row.setAttribute('data-front-img', d.frontImg);
                    if (d.backImg) row.setAttribute('data-back-img', d.backImg);
                    if (d.scanId) row.setAttribute('data-scan-id', d.scanId);
                    if (d.batchId) row.setAttribute('data-batch-id', d.batchId);
                    if (d.aiStarted) row.setAttribute('data-ai-started', d.aiStarted);
                    
                    const scanBtn = row.querySelector('.btn-row-scan');
                    if (scanBtn && d.isScanning) {
                        if (d.isScanning.includes('✅')) {
                            scanBtn.innerHTML = d.isScanning;
                            scanBtn.style.color = 'var(--accent-yellow)';
                            scanBtn.style.borderColor = 'var(--accent-yellow)';
                        } else {
                            // Reset stuck "Uploading..." buttons if refreshed mid-scan
                            scanBtn.innerHTML = '<i class="fas fa-camera"></i>';
                        }
                    }

                    const condBtn = row.querySelector('.btn-set-cond');
                    if (condBtn && d.cond && d.cond !== '{}') {
                        condBtn.setAttribute('data-cond', d.cond);
                        const parsedCond = JSON.parse(d.cond);
                        const count = (parsedCond.front?.length || 0) + (parsedCond.back?.length || 0) + (parsedCond.grade ? 1 : 0);
                        if (count > 0) {
                            condBtn.innerHTML = `✅ Set (${count})`;
                            condBtn.style.color = 'var(--accent-yellow)';
                            condBtn.style.borderColor = 'var(--accent-yellow)';
                        }
                    }

                    const mediaBtn = row.querySelector('.btn-manage-media');
                    if (mediaBtn && d.media && d.media !== '{}') {
                        mediaBtn.setAttribute('data-media', d.media);
                        const parsedMedia = JSON.parse(d.media);
                        const mediaCount = (parsedMedia.video ? 1 : 0) + (parsedMedia.flaws?.length || 0);
                        if (mediaCount > 0) {
                            mediaBtn.innerHTML = `<i class="fas fa-photo-video"></i> (${mediaCount})`;
                            mediaBtn.style.color = 'var(--accent-yellow)';
                            mediaBtn.style.borderColor = 'var(--accent-yellow)';
                        }
                    }
                });
                return true;
            }
        } catch(e) { 
            console.error("Draft load error", e); 
        }
    }
    return false;
}
