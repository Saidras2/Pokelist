// ALWAYS Use Actual Target App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbymA0CfeEuSx7_yetVi8gSxNDL9Zvbse30dHa9FsVPoa5zDZkipTwVlsHpKL7hooozvvg/exec'; 

let state = { inventory: [], groups: [], sales: [], trash: [] };
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

document.addEventListener('DOMContentLoaded', () => {
  views = document.querySelectorAll('.view');
  navItems = document.querySelectorAll('.nav-item');
  addCardsBody = document.getElementById('add-cards-body');
  modalOverlay = document.getElementById('modal-overlay');
  groupModal = document.getElementById('modal-group');
  
  setupThemeToggle();
  setupNavigation();
  setupModals();
  setupSearchFilters(); 
  addMultipleRows(10); 

  // --- Mobile Hamburger Menu Logic ---
  const mobileToggle = document.getElementById('mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Close sidebar if clicking anywhere outside of it on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });

  // --- SECURE BACKEND AUTHENTICATION ---
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
        authErr.style.display = 'block';
        authInput.value = '';
        authBtn.textContent = "Unlock Database";
        authBtn.style.opacity = "1";
        authBtn.style.pointerEvents = "auto";
      } else {
        sessionStorage.setItem('appPass', attemptedPass);
        state.inventory = data.inventory || [];
        state.groups = data.groups || [];
        state.sales = data.sales || [];
        state.trash = data.trash || [];
        updateDashboard();
        renderInventory();
        renderGroups();
        renderSales();
        renderTrash();
        loadMasterDictionary();
        authScreen.style.opacity = '0';
        setTimeout(() => authScreen.style.display = 'none', 400);
      }
    } catch(err) {
      authErr.textContent = "Network error. Try again.";
      authErr.style.display = 'block';
      authBtn.textContent = "Unlock Database";
      authBtn.style.opacity = "1";
      authBtn.style.pointerEvents = "auto";
    }
  }

  if (sessionStorage.getItem('appPass')) {
    authScreen.style.display = 'none';
    fetchData(); 
    loadMasterDictionary();
  } else {
    authBtn.addEventListener('click', unlockDatabase);
    authInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlockDatabase(); });
  }

  const recordSaleBtn = document.getElementById('btn-record-sale');
  if (recordSaleBtn) recordSaleBtn.addEventListener('click', openGlobalSaleSearchModal);
  document.addEventListener('click', () => {
    document.querySelectorAll('.action-dropdown').forEach(d => d.remove());
  });
});

function setupNavigation() {
  if (!navItems) return;
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      views.forEach(v => v.classList.remove('active'));
      const targetView = document.getElementById(`view-${target}`);
      if (targetView) targetView.classList.add('active');
      refreshCurrentView(target);
      
      // Auto-close sidebar on mobile after clicking a link
      if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('open');
      }
    });
  });
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle') || document.querySelector('.theme-toggle');
  if (!themeToggle) return;
  const savedTheme = localStorage.getItem('theme') || 'dark';

  if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.body.classList.remove('light');
    document.body.classList.add('dark');
    themeToggle.innerHTML = '<i class="fas fa-moon"></i> Night';
  } else {
    document.body.setAttribute('data-theme', 'light');
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i> Day';
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark');
    if (isDark) {
      document.body.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
      document.body.classList.add('light');
      themeToggle.innerHTML = '<i class="fas fa-sun"></i> Day';
      localStorage.setItem('theme', 'light'); 
    } else {
      document.body.setAttribute('data-theme', 'dark');
      document.body.classList.remove('light');
      document.body.classList.add('dark');
      themeToggle.innerHTML = '<i class="fas fa-moon"></i> Night';
      localStorage.setItem('theme', 'dark');
    }
  });
}

function setupSearchFilters() {
  const searchInput = document.getElementById('search-inventory');
  if (searchInput) searchInput.addEventListener('input', renderInventory);
  const filterGroup = document.getElementById('filter-group');
  const filterLang = document.getElementById('filter-lang');
  const sortInventory = document.getElementById('sort-inventory');
  if (filterGroup) filterGroup.addEventListener('change', renderInventory);
  if (filterLang) filterLang.addEventListener('change', renderInventory);
  if (sortInventory) sortInventory.addEventListener('change', renderInventory);
}

// --- SECURE DATA FETCHING & SYNC ---
async function fetchData() {
  const pass = sessionStorage.getItem('appPass');
  if(!pass) return;
  try {
    const res = await fetch(`${API_URL}?pass=${encodeURIComponent(pass)}`);
    const data = await res.json();
    if(data.error) return; 
    
    state.inventory = data.inventory || [];
    state.groups = data.groups || [];
    state.sales = data.sales || [];
    state.trash = data.trash || [];
    
    updateDashboard();
    renderInventory();
    renderGroups();
    renderSales();
    renderTrash();
  } catch(err) {
    console.error("Failed to fetch data from Google Sheets", err);
  }
}

async function postData(action, payload) {
  const pass = sessionStorage.getItem('appPass');
  if(!pass) return;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, pass, ...payload })
    });
    const data = await res.json();
    if(data.success) {
      await fetchData(); 
    } else {
      alert("Google Sheets Error: " + data.error);
    }
  } catch(err) {
    console.error("Failed to save data to Google Sheets", err);
  }
}

async function silentPostData(action, payload) {
  const pass = sessionStorage.getItem('appPass');
  if(!pass) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, pass, ...payload })
    });
  } catch(err) {
    console.error("Failed to sync inline edit", err);
  }
}

function refreshCurrentView(view) {
  if (view === 'dashboard') updateDashboard();
  if (view === 'inventory') renderInventory();
  if (view === 'groups') renderGroups();
  if (view === 'sold-cards') renderSales();
  if (view === 'trash') renderTrash();
}

function getCalculatedData() {
  let groupsMap = {};
  state.groups.forEach(g => {
    groupsMap[g.name] = { rate: Number(g.exchangerate || 0), shippingFee: Number(g.shippingfee || 0), totalCardsInGroup: 0, shippingDivider: 1 };
  });

  let currentGroupStock = {};
  state.inventory.forEach(item => {
    if (groupsMap[item.group]) currentGroupStock[item.group] = (currentGroupStock[item.group] || 0) + Number(item.quantity || 0);
  });

  let maxGroupStock = JSON.parse(localStorage.getItem('maxGroupStock')) || {};
  Object.keys(groupsMap).forEach(group => {
    const currentStock = currentGroupStock[group] || 0;
    const historicalMax = maxGroupStock[group] || 0;
    if (currentStock > historicalMax) maxGroupStock[group] = currentStock;
    groupsMap[group].totalCardsInGroup = currentStock;
    groupsMap[group].shippingDivider = maxGroupStock[group] > 0 ? maxGroupStock[group] : 1;
  });
  localStorage.setItem('maxGroupStock', JSON.stringify(maxGroupStock));

  let mergedInventory = {};
  let totalValueRp = 0;
  let totalValueYen = 0;

  state.inventory.forEach(item => {
    const key = `${item.name || ''}_${item.set || ''}_${item.rarity || ''}_${item.language || ''}`.toLowerCase().trim();
    const qty = Number(item.quantity || 0);
    const yenPrice = Number(item.yenprice || 0);
    const groupInfo = groupsMap[item.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 };
    const basePriceRp = yenPrice * groupInfo.rate;
    const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0;
    const totalCostPerCard = basePriceRp + shippingPerCard;

    if (qty > 0) { 
      totalValueYen += (yenPrice * qty);
      totalValueRp += (totalCostPerCard * qty);
    }

    if (!mergedInventory[key]) {
      mergedInventory[key] = {
        id: item.id, name: item.name, set: item.set, rarity: item.rarity, language: item.language, quantity: 0, yenprice: 0, priceRp: 0, shippingAllocation: 0, totalCost: 0, group: item.group, _rawItems: []
      };
    }
    mergedInventory[key].quantity += qty;
    mergedInventory[key]._rawItems.push({ qty, yenPrice, basePriceRp, shippingPerCard, totalCostPerCard, group: item.group });
  });

  Object.values(mergedInventory).forEach(mergedItem => {
    let totalYen = 0, totalBaseRp = 0, totalShipping = 0, totalCost = 0;
    let activeGroups = new Set();
    let qtyToAverage = mergedItem.quantity;
    
    if (qtyToAverage === 0) {
      mergedItem._rawItems.forEach(raw => {
         totalYen += raw.yenPrice; totalBaseRp += raw.basePriceRp; totalShipping += raw.shippingPerCard; totalCost += raw.totalCostPerCard;
         if(raw.group) activeGroups.add(raw.group);
      });
      qtyToAverage = mergedItem._rawItems.length || 1;
    } else {
      mergedItem._rawItems.forEach(raw => {
        if (raw.qty > 0) {
           totalYen += (raw.yenPrice * raw.qty); totalBaseRp += (raw.basePriceRp * raw.qty); totalShipping += (raw.shippingPerCard * raw.qty); totalCost += (raw.totalCostPerCard * raw.qty);
           if(raw.group) activeGroups.add(raw.group);
        }
      });
    }
    
    mergedItem.yenprice = totalYen / qtyToAverage;
    mergedItem.priceRp = totalBaseRp / qtyToAverage;
    mergedItem.shippingAllocation = totalShipping / qtyToAverage;
    mergedItem.totalCost = totalCost / qtyToAverage;
    if (activeGroups.size > 1) mergedItem.group = Array.from(activeGroups).join(', ');
    else if (activeGroups.size === 1) mergedItem.group = Array.from(activeGroups)[0];
  });

  return { mergedList: Object.values(mergedInventory), totalValueRp, totalValueYen, groupsMap };
}

function updateDashboard() {
  const calc = getCalculatedData();
  const totalQty = state.inventory.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  let totalSalesRevenue = 0;
  let totalCostOfSold = 0;

  state.sales.forEach(sale => {
    totalSalesRevenue += Number(sale.price || 0);
    const linkedCard = state.inventory.find(c => c.id === sale.cardid);
    if (linkedCard) {
      const groupInfo = calc.groupsMap[linkedCard.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 };
      const basePriceRp = Number(linkedCard.yenprice || 0) * groupInfo.rate;
      const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0;
      totalCostOfSold += (basePriceRp + shippingPerCard) * Number(sale.quantity || 1);
    }
  });

  const netProfit = totalSalesRevenue - totalCostOfSold;
  
  const uniqueEl = document.getElementById('stat-unique');
  const totalEl = document.getElementById('stat-total');
  const rpEl = document.getElementById('stat-val-rp');
  const yenEl = document.getElementById('stat-val-yen');
  const soldEl = document.getElementById('stat-sold');
  const profitEl = document.getElementById('stat-profit');

  if (uniqueEl) uniqueEl.textContent = calc.mergedList.filter(c => c.quantity > 0).length;
  if (totalEl) totalEl.textContent = totalQty;
  if (rpEl) rpEl.textContent = "Rp " + Math.round(calc.totalValueRp).toLocaleString('id-ID');
  if (yenEl) yenEl.textContent = "¥" + calc.totalValueYen.toLocaleString('ja-JP');
  if (soldEl) soldEl.textContent = state.sales.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  if (profitEl) profitEl.textContent = "Rp " + Math.round(netProfit).toLocaleString('id-ID');

  renderSalesMetricsChart();
}

function renderSalesMetricsChart() {
  let viewDashboard = document.getElementById('view-dashboard');
  if (!viewDashboard) return;

  let chartPanel = document.getElementById('dashboard-analytics-chart-panel');
  if (!chartPanel) {
    chartPanel = document.createElement('div');
    chartPanel.id = 'dashboard-analytics-chart-panel';
    chartPanel.className = 'card-panel';
    chartPanel.style.cssText = 'margin-top: 24px; padding: 24px; position: relative; border-radius: 12px; box-sizing: border-box; overflow: hidden; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);';
    viewDashboard.appendChild(chartPanel);
  }

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let operationalDistribution = {};

  for (let i = 11; i >= 0; i--) {
    let d = new Date();
    d.setMonth(d.getMonth() - i);
    let key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
    operationalDistribution[key] = { label: `${monthLabels[d.getMonth()]} '${String(d.getFullYear()).substring(2,4)}`, revenue: 0, cards: 0 };
  }

  if (state.sales && state.sales.length > 0) {
    state.sales.forEach(sale => {
      let sDate = new Date(sale.date || Date.now());
      let key = `${sDate.getFullYear()}-${String(sDate.getMonth()).padStart(2, '0')}`;
      if (operationalDistribution[key]) {
        operationalDistribution[key].revenue += Number(sale.price || 0);
        operationalDistribution[key].cards += Number(sale.quantity || 0);
      }
    });
  }

  const dataset = Object.values(operationalDistribution);
  let maxDataValue = Math.max(...dataset.map(item => item.revenue));
  const maxRevenue = maxDataValue > 0 ? maxDataValue * 1.1 : 100000; 

  const formatCurrency = (val) => val >= 1000000 ? (val/1000000).toFixed(1).replace('.0','') + 'm' : (val/1000).toFixed(0) + 'k';

  let gridHTML = `
    <div style="position:absolute; top:0; left:55px; right:0; height:100%; display:flex; flex-direction:column; justify-content:space-between; z-index:0; pointer-events:none; padding-bottom: 24px; box-sizing: border-box;">
      <div style="border-top:1px dashed rgba(150,150,150,0.25); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">${formatCurrency(maxRevenue)}</span></div>
      <div style="border-top:1px dashed rgba(150,150,150,0.25); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">${formatCurrency(maxRevenue * 0.75)}</span></div>
      <div style="border-top:1px dashed rgba(150,150,150,0.25); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">${formatCurrency(maxRevenue * 0.5)}</span></div>
      <div style="border-top:1px dashed rgba(150,150,150,0.25); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">${formatCurrency(maxRevenue * 0.25)}</span></div>
      <div style="border-top:1px solid rgba(150,150,150,0.4); width:100%; position:relative;"><span style="position:absolute; top:-8px; left:-50px; font-size:10px; color:inherit; opacity:0.6; width: 45px; text-align: right;">0</span></div>
    </div>
  `;

  let barElementsHTML = '';
  dataset.forEach(point => {
    const proportionalHeight = (point.revenue / maxRevenue) * 100;
    const hasData = point.revenue > 0;
    barElementsHTML += `
      <div class="chart-column-node" style="flex:1; display:flex; flex-direction:column; align-items:center; position:relative; z-index:1; height: 100%; justify-content: flex-end;">
        <div class="chart-tooltip-bubble" style="opacity:0; pointer-events:none; position:absolute; bottom:calc(${proportionalHeight}% + 16px); background:var(--bg-surface); color:var(--text-primary); padding:8px 12px; border-radius:8px; font-size:12px; white-space:nowrap; box-shadow:0 10px 25px rgba(0,0,0,0.15); border:1px solid var(--border-color); text-align:center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); z-index:10; transform: translateY(10px);">
          <div style="font-weight:700; color:var(--accent-yellow); margin-bottom: 2px;">Rp ${Math.round(point.revenue).toLocaleString('id-ID')}</div>
          <div style="color:inherit; opacity:0.7; font-size:11px;">${point.cards} Card(s) Sold</div>
        </div>
        <div class="chart-bar-fill" style="width:70%; max-width:40px; height:${Math.max(proportionalHeight, 1)}%; background:${hasData ? 'linear-gradient(to top, #ca8a04, #fde047)' : 'rgba(150,150,150,0.15)'}; border-radius:4px 4px 0 0; cursor:pointer; transition: all 0.2s ease; box-shadow: ${hasData ? '0 0 12px rgba(253,224,71,0.15)' : 'none'}; border: 1px solid ${hasData ? '#fef08a' : 'transparent'}; border-bottom: none;"></div>
        <div style="margin-top:8px; font-size:11px; color:inherit; opacity:${hasData ? '0.9' : '0.5'}; font-weight:500; height: 16px;">${point.label}</div>
      </div>
    `;
  });

  chartPanel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
      <div>
        <h3 style="margin-top:0; margin-bottom:4px; font-size:16px; color:inherit; opacity:0.9; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-chart-line" style="color:var(--accent-yellow, #eab308);"></i> Revenue History (Last 12 Months)
        </h3>
        <p style="color:inherit; opacity:0.6; font-size:12px; margin:0;">Hover over the columns to see detailed monthly metrics.</p>
      </div>
    </div>
    <div style="position:relative; display:flex; height:240px; padding-left: 55px; align-items:flex-end;">
      ${gridHTML}
      <div style="display:flex; width: 100%; height: calc(100% - 24px); position: relative; z-index: 1;">
        ${barElementsHTML}
      </div>
    </div>
  `;

  chartPanel.querySelectorAll('.chart-column-node').forEach(node => {
    const bubble = node.querySelector('.chart-tooltip-bubble');
    const bar = node.querySelector('.chart-bar-fill');
    node.addEventListener('mouseenter', () => {
      bubble.style.opacity = '1';
      bubble.style.transform = 'translateY(0px)';
      if (bar.style.height !== '1%') {
        bar.style.filter = 'brightness(1.15)';
        bar.style.transform = 'scaleY(1.02)';
        bar.style.transformOrigin = 'bottom';
      }
    });
    node.addEventListener('mouseleave', () => {
      bubble.style.opacity = '0';
      bubble.style.transform = 'translateY(10px)';
      if (bar.style.height !== '1%') {
        bar.style.filter = 'brightness(1)';
        bar.style.transform = 'scaleY(1)';
      }
    });
  });
}

function setupModals() {
  const newGroupBtn1 = document.getElementById('btn-new-group');
  const newGroupBtn2 = document.getElementById('btn-create-group-page');
  if (newGroupBtn1) newGroupBtn1.addEventListener('click', openGroupModal);
  if (newGroupBtn2) newGroupBtn2.addEventListener('click', openGroupModal);
  document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModal));
}

function openGroupModal() {
  if (modalOverlay && groupModal) {
    modalOverlay.style.display = 'block';
    groupModal.style.display = 'block';
  }
}

function closeModal() {
  if (modalOverlay && groupModal) {
    modalOverlay.style.display = 'none';
    groupModal.style.display = 'none';
  }
  const saleModal = document.getElementById('modal-sale');
  if (saleModal) saleModal.style.display = 'none';
}

const saveGroupBtn = document.getElementById('save-new-group');
if (saveGroupBtn) {
  saveGroupBtn.addEventListener('click', () => {
    const name = document.getElementById('new-group-name').value;
    const rate = document.getElementById('new-group-rate').value;
    const shipping = document.getElementById('new-group-shipping').value;
    
    if(name && rate && shipping) {
      postData('saveGroup', { id: 'GRP_' + Date.now(), name, exchangeRate: rate, shippingFee: shipping });
      document.getElementById('new-group-name').value = '';
      document.getElementById('new-group-rate').value = '';
      document.getElementById('new-group-shipping').value = '';
      closeModal();
    } else {
      alert("Please fill out all fields before saving.");
    }
  });
}

const addRowBtn = document.getElementById('btn-add-row');
if (addRowBtn) addRowBtn.addEventListener('click', () => addMultipleRows(1));

const add10RowsBtn = document.getElementById('btn-add-10-rows');
if (add10RowsBtn) add10RowsBtn.addEventListener('click', () => addMultipleRows(10));

function addMultipleRows(count) {
  for(let i = 0; i < count; i++) addEmptyCardRow();
}

function addEmptyCardRow() {
  if (!addCardsBody) return;
  const tr = document.createElement('tr');
  const count = addCardsBody.children.length + 1;
  tr.innerHTML = `
    <td>${count}</td>
    <td><input type="text" class="c-name" placeholder="Name"></td>
    <td><input type="text" class="c-set" placeholder="Set Code"></td>
    <td>
      <select class="c-rarity">
        <option value="Promo">Promo</option>
        <option value="C" selected>C</option>
        <option value="U">U</option>
        <option value="S">S</option>
        <option value="RR">RR</option>
        <option value="RRR">RRR</option>
        <option value="AR">AR</option>
        <option value="CHR">CHR</option>
        <option value="SR">SR</option>
        <option value="SAR">SAR</option>
        <option value="UR">UR</option>
        <option value="MUR">MUR</option>
      </select>
    </td>
    <td>
      <select class="c-lang">
        <option>Japanese</option>
        <option>English</option>
        <option>Indonesian</option>
      </select>
    </td>
    <td><input type="number" class="c-yen" placeholder="0"></td>
    <td><input type="number" class="c-qty" value="1" min="1"></td>
    <td><input type="text" class="c-notes" placeholder="Notes"></td>
    <td><button class="btn-outline del-row"><i class="fas fa-trash"></i></button></td>
  `;
  
  const nameInput = tr.querySelector('.c-name');
  const applyTranslation = (e) => {
    if (e.isComposing) return; 
    let originalText = e.target.value;
    let translatedText = translatePokemonName(originalText);
    if (originalText !== translatedText) {
      e.target.value = translatedText;
      e.target.style.transition = 'background-color 0.3s';
      e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
      setTimeout(() => e.target.style.backgroundColor = 'transparent', 300);
    }
  };

  nameInput.addEventListener('blur', applyTranslation);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyTranslation(e); });
  nameInput.addEventListener('compositionend', (e) => { setTimeout(() => applyTranslation(e), 50); });

  tr.querySelector('.del-row').addEventListener('click', () => {
    tr.remove();
    reindexRows();
  });
  addCardsBody.appendChild(tr);
}

function reindexRows() {
  if (!addCardsBody) return;
  const rows = addCardsBody.querySelectorAll('tr');
  rows.forEach((row, idx) => { row.children[0].textContent = idx + 1; });
}

const saveCardsBtn = document.getElementById('btn-save-cards');
if (saveCardsBtn) {
  saveCardsBtn.addEventListener('click', () => {
    const group = document.getElementById('group-select').value;
    if(!group) return alert("Please select or create a group first.");
    
    const rows = addCardsBody.querySelectorAll('tr');
    let cardsToSave = [];
    
    rows.forEach((row, index) => {
      const name = row.querySelector('.c-name').value.trim();
      const yen = row.querySelector('.c-yen').value;
      
      if(name) {
        cardsToSave.push({
          id: 'CARD_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 5),
          group: group,
          name: name,
          set: row.querySelector('.c-set').value,
          rarity: row.querySelector('.c-rarity').value, 
          language: row.querySelector('.c-lang').value,
          yenPrice: yen || 0,
          quantity: row.querySelector('.c-qty').value || 1
        });
      }
    });

    if(cardsToSave.length > 0) {
      postData('saveCards', { cards: cardsToSave });
      addCardsBody.innerHTML = '';
      addMultipleRows(10); 
    } else {
      alert("All rows are empty! Please enter at least one card name to save.");
    }
  });
}

function renderInventory() {
  const body = document.getElementById('inventory-body');
  if(!body) return;
  body.innerHTML = '';
  
  const calc = getCalculatedData();
  let filteredList = calc.mergedList;

  const searchInput = document.getElementById('search-inventory');
  if (searchInput) {
    const query = searchInput.value.toLowerCase().trim();
    if (query) {
      filteredList = filteredList.filter(card => {
        const cardName = String(card.name || '').toLowerCase().trim();
        const cardSet = String(card.set || '').toLowerCase().trim();
        const cardRarity = String(card.rarity || '').toLowerCase().trim();
        
        if (query.length <= 2) return cardName.startsWith(query);
        else return cardName.includes(query) || cardSet.includes(query) || cardRarity.includes(query);
      });
    }
  }

  const groupVal = document.getElementById('filter-group').value;
  const langVal = document.getElementById('filter-lang').value;

  if (groupVal && !groupVal.toLowerCase().includes('all')) {
    filteredList = filteredList.filter(c => c.group && String(c.group).toLowerCase() === groupVal.toLowerCase());
  }
  if (langVal && !langVal.toLowerCase().includes('all')) {
    filteredList = filteredList.filter(c => c.language && String(c.language).toLowerCase() === langVal.toLowerCase());
  }

  const sortVal = document.getElementById('sort-inventory') ? document.getElementById('sort-inventory').value : 'default';
  if (sortVal === 'az') filteredList.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  else if (sortVal === 'za') filteredList.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
  else if (sortVal === 'price-high') filteredList.sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
  else if (sortVal === 'price-low') filteredList.sort((a, b) => Number(a.totalCost || 0) - Number(b.totalCost || 0));

  const filteredQty = filteredList.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  const subtitle = document.getElementById('inventory-subtitle');
  if (subtitle) subtitle.textContent = `${filteredList.filter(c => c.quantity > 0).length} unique card(s) • ${filteredQty} total in stock`;

  if(filteredList.length === 0) {
    body.innerHTML = `<tr><td colspan="11" style="text-align:center; color: var(--text-secondary);">No matching cards found.</td></tr>`;
    return;
  }
  
  const rarityList = ['Promo', 'C', 'U', 'S', 'RR', 'RRR', 'AR', 'CHR', 'SR', 'SAR', 'UR', 'MUR'];
  const langList = ['Japanese', 'English', 'Indonesian'];

  filteredList.forEach(card => {
    const qty = Number(card.quantity || 0);
    const isOutOfStock = qty <= 0;
    const tr = document.createElement('tr');
    
    const rowBg = isOutOfStock ? 'rgba(239, 68, 68, 0.12)' : 'transparent';
    const textColor = isOutOfStock ? '#ef4444' : 'inherit';
    const qtyBg = isOutOfStock ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234,179,8,0.15)';
    const qtyColor = isOutOfStock ? '#ef4444' : 'var(--accent-yellow)';
    const iconColor = isOutOfStock ? '#ef4444' : 'var(--text-secondary)';

    tr.style.backgroundColor = rowBg;
    tr.style.color = textColor;

    const rarityOpts = rarityList.map(r => `<option value="${r}">${r}</option>`).join('');
    const langOpts = langList.map(l => `<option value="${l}">${l}</option>`).join('');

    tr.innerHTML = `
      <td class="editable-cell edit-name" contenteditable="true" title="Click to edit"><strong style="color:${textColor}">${card.name || '—'}</strong></td>
      <td class="editable-cell edit-set" contenteditable="true" title="Click to edit">${card.set || '—'}</td>
      <td title="Click to change Rarity">
        <select class="inline-edit-select edit-rarity" style="width: auto; background:transparent; color:inherit; border:1px dashed transparent; outline:none; cursor:pointer; padding:2px 4px; border-radius:4px; font-size:inherit;">
          <option value="">—</option>
          ${rarityOpts.replace(`value="${card.rarity}"`, `value="${card.rarity}" selected`)}
        </select>
      </td>
      <td title="Click to change Language">
        <select class="inline-edit-select edit-lang" style="width: auto; background:transparent; color:inherit; border:1px dashed transparent; outline:none; cursor:pointer; padding:2px 4px; border-radius:4px; font-size:inherit;">
          <option value="">—</option>
          ${langOpts.replace(`value="${card.language}"`, `value="${card.language}" selected`)}
        </select>
      </td>
      <td><span class="editable-cell edit-qty" contenteditable="true" title="Click to edit" style="background: ${qtyBg}; color: ${qtyColor}; padding: 2px 8px; border-radius: 4px; font-weight:600; display:inline-block;">${qty}</span></td>
      <td class="editable-cell edit-yen" contenteditable="true" title="Click to edit">¥${Number(card.yenprice).toLocaleString('ja-JP')}</td>
      <td>Rp ${Math.round(card.priceRp).toLocaleString('id-ID')}</td>
      <td>Rp ${Math.round(card.shippingAllocation).toLocaleString('id-ID')}</td>
      <td><strong>Rp ${Math.round(card.totalCost).toLocaleString('id-ID')}</strong></td>
      <td><span style="color: ${iconColor};"><i class="fas fa-folder-open"></i> ${card.group || '—'}</span></td>
      <td>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button class="btn-outline action-trigger" style="padding: 4px 8px; color: ${textColor};"><i class="fas fa-ellipsis-v"></i></button>
          <button class="btn-outline btn-delete-card" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete card"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;

    function saveRowData() {
      let rawNameVal = tr.querySelector('.edit-name').textContent.trim();
      let translatedName = translatePokemonName(rawNameVal);
      if (rawNameVal !== translatedName) {
         rawNameVal = translatedName;
         tr.querySelector('.edit-name').innerHTML = `<strong style="color:${textColor}">${rawNameVal}</strong>`;
      }
      
      const nameVal = rawNameVal;
      const setVal = tr.querySelector('.edit-set').textContent.trim();
      const rarityVal = tr.querySelector('.edit-rarity').value; 
      const langVal = tr.querySelector('.edit-lang').value;     
      const qtyVal = Number(tr.querySelector('.edit-qty').textContent.trim()) || 0;
      const yenVal = Number(tr.querySelector('.edit-yen').textContent.replace(/[¥,]/g, '').trim()) || 0;

      const finalName = nameVal === '—' ? '' : nameVal;
      const finalSet = setVal === '—' ? '' : setVal;
      const finalRarity = rarityVal === '—' ? '' : rarityVal;
      const finalLang = langVal === '—' ? '' : langVal;

      const oldQty = Number(card.quantity) || 0;
      const isQtyChanged = (qtyVal !== oldQty);
      const isDataChanged = (
        finalName !== (card.name || '') ||
        finalSet !== (card.set || '') ||
        finalRarity !== (card.rarity || '') ||
        finalLang !== (card.language || '') ||
        yenVal !== card.yenprice
      );

      if (!isQtyChanged && !isDataChanged) return; 

      const searchName = String(card.name || '').toLowerCase().trim();
      const searchSet = String(card.set || '').toLowerCase().trim();
      const searchRarity = String(card.rarity || '').toLowerCase().trim();
      const searchLang = String(card.language || '').toLowerCase().trim();

      const matchingCards = state.inventory.filter(c => 
        String(c.name || '').toLowerCase().trim() === searchName &&
        String(c.set || '').toLowerCase().trim() === searchSet &&
        String(c.rarity || '').toLowerCase().trim() === searchRarity &&
        String(c.language || '').toLowerCase().trim() === searchLang
      );

      let remainingQtyDiff = qtyVal - oldQty;

      matchingCards.forEach((item, index) => {
        if (isDataChanged) {
          item.name = finalName; item.set = finalSet; item.rarity = finalRarity; item.language = finalLang; item.yenprice = yenVal;
        }

        if (isQtyChanged) {
           if (remainingQtyDiff > 0) {
             if (index === 0) { item.quantity = Number(item.quantity || 0) + remainingQtyDiff; remainingQtyDiff = 0; }
           } else if (remainingQtyDiff < 0) {
             const currentItemQty = Number(item.quantity || 0);
             const deductAmt = Math.min(currentItemQty, Math.abs(remainingQtyDiff));
             item.quantity = currentItemQty - deductAmt;
             remainingQtyDiff += deductAmt;
           }
        }

        silentPostData('updateCard', {
          id: item.id, name: item.name, set: item.set, rarity: item.rarity, language: item.language, group: item.group, yenPrice: item.yenprice, quantity: item.quantity
        });
      });

      updateDashboard();
      renderInventory();
    }

    tr.querySelectorAll('.editable-cell').forEach(cell => {
      cell.addEventListener('mouseenter', () => cell.style.background = 'rgba(128,128,128,0.1)');
      cell.addEventListener('mouseleave', () => cell.style.background = 'transparent');
      cell.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cell.blur(); } });
      cell.addEventListener('blur', () => { cell.style.background = 'transparent'; saveRowData(); });
    });

    tr.querySelectorAll('.inline-edit-select').forEach(select => {
      select.addEventListener('mouseenter', () => select.style.border = '1px dashed var(--border-color)');
      select.addEventListener('mouseleave', () => select.style.border = '1px dashed transparent');
      select.addEventListener('change', saveRowData); 
    });

    tr.querySelector('.btn-delete-card').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete ${card.name}?`)) {
        const searchName = String(card.name || '').toLowerCase().trim();
        const searchSet = String(card.set || '').toLowerCase().trim();
        const searchRarity = String(card.rarity || '').toLowerCase().trim();
        
        const cardsToDelete = state.inventory.filter(c => 
          String(c.name || '').toLowerCase().trim() === searchName &&
          String(c.set || '').toLowerCase().trim() === searchSet &&
          String(c.rarity || '').toLowerCase().trim() === searchRarity
        );
        
        let maxGroupStock = JSON.parse(localStorage.getItem('maxGroupStock')) || {};
        cardsToDelete.forEach(cDel => {
          const delQty = Number(cDel.quantity || 0);
          const groupName = cDel.group;
          if (groupName && maxGroupStock[groupName]) {
            maxGroupStock[groupName] = Math.max(0, maxGroupStock[groupName] - delQty);
          }
          state.inventory = state.inventory.filter(item => item.id !== cDel.id);
          postData('deleteCard', { id: cDel.id });
        });
        localStorage.setItem('maxGroupStock', JSON.stringify(maxGroupStock));
        updateDashboard();
        renderInventory();
      }
    });

    const actionBtn = tr.querySelector('.action-trigger');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      document.querySelectorAll('.action-dropdown').forEach(d => d.remove());
      const dropdown = document.createElement('div');
      dropdown.className = 'action-dropdown';
      dropdown.style.cssText = 'position: absolute; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 4px 0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2); z-index: 1000; min-width: 140px; color: var(--text-primary);';
      const rect = actionBtn.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
      dropdown.style.left = `${rect.left + window.scrollX - 110}px`;
      dropdown.innerHTML = `
        <div class="dropdown-item dropdown-sale" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size:13px; font-weight:500;" ${qty <= 0 ? 'style="opacity:0.5; pointer-events:none;"' : ''}>
          <i class="fas fa-money-bill-wave" style="color: #22c55e;"></i> Record Sale
        </div>
      `;
      const item = dropdown.querySelector('.dropdown-item');
      item.addEventListener('mouseenter', () => item.style.background = 'rgba(128,128,128,0.1)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
      item.addEventListener('click', () => { dropdown.remove(); openSaleModal(card); });
      document.body.appendChild(dropdown);
    });

    body.appendChild(tr);
  });
}

function ensureSaleModalExists() {
  if (document.getElementById('modal-sale')) return;
  const modal = document.createElement('div');
  modal.id = 'modal-sale';
  modal.style.cssText = 'display:none; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);';
  modal.innerHTML = `
    <div style="background: var(--bg-surface); margin: 6% auto; padding: 24px; border: 1px solid var(--border-color); width: 90%; max-width: 580px; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); position:relative; max-height: 85vh; display: flex; flex-direction: column; color: var(--text-primary);">
      <h3 id="sale-modal-title" style="margin-top:0; margin-bottom:16px; font-size:18px;">💰 Record Sale</h3>
      <div id="select-card-section" style="margin-bottom:16px; position:relative !important; z-index: 100;">
        <label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Search & Add Cards to Sale</label>
        <input type="text" id="sale-search-inventory" placeholder="Type card name or set..." autocomplete="off" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box; margin-bottom:0;">
        <div id="sale-inventory-results" style="display:none; position:absolute; top:calc(100% + 4px); left:0; width:100%; max-height:180px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-surface); box-shadow: 0 10px 25px -3px rgba(0,0,0,0.3); z-index: 999999;"></div>
      </div>
      <div id="sale-cart-container" style="flex: 1; overflow-y: auto; margin-bottom: 16px; display: none; flex-direction: column; gap: 12px; padding-right: 4px;"></div>
      <div style="display:flex; gap:12px; margin-bottom:20px; margin-top: auto;">
        <div style="flex:1;">
          <label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Date Sold</label>
          <input type="date" id="sale-date" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box; color-scheme: inherit;">
        </div>
        <div style="flex:2;">
          <label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Global Notes</label>
          <input type="text" id="sale-notes" placeholder="e.g. Sold via marketplace" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box;">
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" id="btn-close-sale" class="btn-outline" style="padding:10px 16px; border-radius:6px; cursor:pointer;">Cancel</button>
        <button type="button" id="btn-submit-sale" style="padding:10px 16px; background:var(--accent-yellow, #eab308); color:#000; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Confirm Sale</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const resultsDiv = document.getElementById('sale-inventory-results');
  const searchBox = document.getElementById('sale-search-inventory');
  document.getElementById('btn-close-sale').addEventListener('click', () => { modal.style.display = 'none'; if (resultsDiv) resultsDiv.style.display = 'none'; });
  document.getElementById('btn-submit-sale').addEventListener('click', submitSaleRecord);
  
  function handleSearchInput() {
    const q = searchBox.value.toLowerCase().trim();
    if (!q) { if (resultsDiv) { resultsDiv.style.display = 'none'; resultsDiv.innerHTML = ''; } return; }
    const availableCards = state.inventory.filter(c => Number(c.quantity || 0) > 0);
    const matches = availableCards.filter(c => {
      const cardName = String(c.name || '').toLowerCase().trim();
      const cardSet = String(c.set || '').toLowerCase().trim();
      const cardRarity = String(c.rarity || '').toLowerCase().trim(); 
      if (q.length <= 2) return cardName.startsWith(q);
      else return cardName.includes(q) || cardSet.includes(q) || cardRarity.includes(q);
    });
    
    if (!resultsDiv) return;
    if (matches.length === 0) {
      resultsDiv.innerHTML = '<div style="padding:10px 12px; color:var(--text-secondary); font-size:13px;">No available cards found</div>';
      resultsDiv.style.display = 'block';
      return;
    }
    
    resultsDiv.innerHTML = '';
    matches.forEach(card => {
      const calc = getCalculatedData();
      const groupInfo = calc.groupsMap[card.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 };
      const basePriceRp = (Number(card.yenprice||0) * groupInfo.rate);
      const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0;
      const costPerCard = basePriceRp + shippingPerCard;
      
      const itemEl = document.createElement('div');
      itemEl.style.cssText = 'padding:10px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between;';
      itemEl.innerHTML = `<span><strong>${card.name}</strong> (${card.set || 'No Set'})</span> <span style="color:var(--accent-yellow);">Stock: ${card.quantity}</span>`;
      itemEl.addEventListener('mouseenter', () => itemEl.style.background = 'rgba(128,128,128,0.1)');
      itemEl.addEventListener('mouseleave', () => itemEl.style.background = 'transparent');
      itemEl.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        selectCardForSale(card, costPerCard);
        resultsDiv.style.display = 'none'; searchBox.value = ''; searchBox.focus();
      });
      resultsDiv.appendChild(itemEl);
    });
    resultsDiv.style.display = 'block';
  }

  searchBox.addEventListener('input', handleSearchInput);
  searchBox.addEventListener('keyup', handleSearchInput);
  searchBox.addEventListener('blur', () => { setTimeout(() => { if (resultsDiv) resultsDiv.style.display = 'none'; }, 150); });
}

function renderSaleCart() {
  const container = document.getElementById('sale-cart-container');
  if (!container) return;
  if (saleCart.length === 0) { container.style.display = 'none'; container.innerHTML = ''; return; }
  
  container.style.display = 'flex';
  container.innerHTML = '';
  
  saleCart.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.style.cssText = 'padding:14px; border:1px solid var(--border-color); border-radius:8px; background: rgba(128,128,128,0.05); position: relative;';
    const displayPrice = item.price ? 'Rp ' + Number(item.price).toLocaleString('id-ID') : '';
    itemEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
        <strong style="font-size:14px;">${item.name} <span style="color:var(--text-secondary); font-weight:normal;">(${item.set || 'No Set'})</span></strong>
        <button type="button" class="btn-remove-cart" data-index="${index}" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px;" title="Remove"><i class="fas fa-times"></i></button>
      </div>
      <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; display:flex; gap:12px;">
        <span><i class="fas fa-box"></i> Stock: ${item.maxQty} pcs</span>
        <span style="color:var(--accent-yellow);"><i class="fas fa-tag"></i> Base Cost: Rp ${Math.round(item.unitCost).toLocaleString('id-ID')}/pc</span>
      </div>
      <div style="display:flex; gap:12px;">
        <div style="flex:1;">
          <label style="display:block; margin-bottom:6px; font-size:12px; color: var(--text-secondary);">Qty Sold</label>
          <input type="number" class="cart-qty" data-index="${index}" value="${item.qty}" min="1" max="${item.maxQty}" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box;">
        </div>
        <div style="flex:2;">
          <label style="display:block; margin-bottom:6px; font-size:12px; color: var(--text-secondary);">Total Selling Price</label>
          <input type="text" class="cart-price" data-index="${index}" value="${displayPrice}" placeholder="e.g. Rp 75.000" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background: transparent; color: inherit; box-sizing: border-box;">
        </div>
      </div>
    `;
    container.appendChild(itemEl);
  });
  
  container.querySelectorAll('.btn-remove-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-index');
      saleCart.splice(idx, 1);
      renderSaleCart();
    });
  });
  container.querySelectorAll('.cart-qty').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = e.target.getAttribute('data-index');
      let val = Number(e.target.value);
      if (val > saleCart[idx].maxQty) { val = saleCart[idx].maxQty; e.target.value = val; }
      saleCart[idx].qty = val;
    });
  });
  container.querySelectorAll('.cart-price').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = e.target.getAttribute('data-index');
      let rawValue = e.target.value.replace(/[^0-9]/g, '');
      saleCart[idx].price = Number(rawValue) || 0;
      if (rawValue) e.target.value = 'Rp ' + Number(rawValue).toLocaleString('id-ID');
      else e.target.value = '';
    });
  });
}

function openGlobalSaleSearchModal() {
  ensureSaleModalExists();
  saleCart = []; 
  renderSaleCart();
  document.getElementById('sale-modal-title').textContent = '💰 Record Bulk Sale';
  document.getElementById('select-card-section').style.display = 'block';
  document.getElementById('sale-search-inventory').value = '';
  document.getElementById('sale-notes').value = '';
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  document.getElementById('sale-date').value = (new Date(today - offset)).toISOString().split('T')[0];
  document.getElementById('modal-sale').style.display = 'block';
}

function openSaleModal(card) {
  ensureSaleModalExists();
  saleCart = []; 
  const calc = getCalculatedData();
  const groupInfo = calc.groupsMap[card.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 };
  const basePriceRp = (Number(card.yenprice||0) * groupInfo.rate);
  const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0;
  const costPerCard = basePriceRp + shippingPerCard;

  document.getElementById('sale-modal-title').textContent = `💰 Record Sale`;
  document.getElementById('select-card-section').style.display = 'block'; 
  document.getElementById('sale-search-inventory').value = '';
  document.getElementById('sale-notes').value = '';

  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  document.getElementById('sale-date').value = (new Date(today - offset)).toISOString().split('T')[0];
  
  selectCardForSale(card, costPerCard);
  document.getElementById('modal-sale').style.display = 'block';
}

function selectCardForSale(card, costPerCard) {
  const exists = saleCart.find(c => c.id === card.id);
  if (!exists) {
    saleCart.push({ id: card.id, name: card.name, set: card.set, rarity: card.rarity, maxQty: card.quantity, qty: 1, price: '', unitCost: costPerCard });
  }
  renderSaleCart();
}

function submitSaleRecord() {
  if (saleCart.length === 0) return alert("Please add at least one card to the cart.");
  for (let i = 0; i < saleCart.length; i++) {
    const item = saleCart[i];
    if (!item.price || item.qty <= 0) return alert(`Please enter a valid quantity and selling price for ${item.name}.`);
    if (item.qty > item.maxQty) return alert(`Insufficient stock for ${item.name}. You only have ${item.maxQty} pcs.`);
  }

  const notes = document.getElementById('sale-notes').value;
  const dateInput = document.getElementById('sale-date').value;
  const finalSaleDate = dateInput ? new Date(dateInput + 'T00:00:00').toISOString() : new Date().toISOString();
  
  saleCart.forEach(cartItem => {
    let remainingQtyToSell = cartItem.qty;
    const searchName = String(cartItem.name || '').toLowerCase().trim();
    const searchSet = String(cartItem.set || '').toLowerCase().trim();
    const searchRarity = String(cartItem.rarity || '').toLowerCase().trim(); 

    const matchingCards = state.inventory.filter(c => 
      String(c.name || '').toLowerCase().trim() === searchName &&
      String(c.set || '').toLowerCase().trim() === searchSet &&
      String(c.rarity || '').toLowerCase().trim() === searchRarity &&
      Number(c.quantity) > 0
    );

    matchingCards.forEach(targetCard => {
      if (remainingQtyToSell <= 0) return;
      const cardStock = Number(targetCard.quantity);
      const qtyToDeductFromThisCard = Math.min(cardStock, remainingQtyToSell);
      targetCard.quantity = cardStock - qtyToDeductFromThisCard;
      const splitSalePrice = (cartItem.price / cartItem.qty) * qtyToDeductFromThisCard;
      
      state.sales.push({
        date: finalSaleDate, cardid: targetCard.id, name: targetCard.name, set: targetCard.set, rarity: targetCard.rarity, quantity: qtyToDeductFromThisCard, price: splitSalePrice, notes: notes
      });

      silentPostData('recordSale', {
        date: finalSaleDate, cardId: targetCard.id, name: targetCard.name, set: targetCard.set, rarity: targetCard.rarity, quantity: qtyToDeductFromThisCard, price: splitSalePrice, notes: notes
      });
      remainingQtyToSell -= qtyToDeductFromThisCard;
    });
  });
  
  document.getElementById('modal-sale').style.display = 'none';
  saleCart = []; 
  renderInventory();
  renderSales();
  updateDashboard();
}

function updateSoldCardsStatsAndCharts(filteredSales) {
  let totalRev = 0;
  let totalProfit = 0;
  let cardsSold = 0;
  const calc = getCalculatedData();

  let setsData = {};
  let cardsVolumeData = {};

  filteredSales.forEach(sale => {
      let rev = Number(sale.price || 0);
      totalRev += rev;
      let qty = Number(sale.quantity || 0);
      cardsSold += qty;

      let setCode = sale.set || 'Unknown Set';
      if(!setsData[setCode]) setsData[setCode] = 0;
      setsData[setCode] += rev;

      let cardKey = `${sale.name || 'Unknown'} (${setCode})`;
      if(!cardsVolumeData[cardKey]) cardsVolumeData[cardKey] = 0;
      cardsVolumeData[cardKey] += qty;

      const linkedCard = state.inventory.find(c => c.id === sale.cardid);
      let cost = 0;
      if (linkedCard) {
          const groupInfo = calc.groupsMap[linkedCard.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 };
          const basePriceRp = Number(linkedCard.yenprice || 0) * groupInfo.rate;
          const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0;
          cost = (basePriceRp + shippingPerCard) * qty;
      }
      totalProfit += (rev - cost);
  });

  const margin = totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) : 0;

  let rankedCards = Object.keys(cardsVolumeData)
    .map(key => ({ cardInfo: key, qty: cardsVolumeData[key] }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3);

  let leaderboardHTML = '';
  if (rankedCards.length > 0) {
      rankedCards.forEach((item, index) => {
          const rankMedals = ['🥇', '🥈', '🥉'];
          leaderboardHTML += `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; padding: 4px 0; border-bottom:1px dashed rgba(255,255,255,0.04);">
                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${rankMedals[index]} <strong>${item.cardInfo}</strong></span>
                  <span style="color:var(--accent-yellow); font-weight:700; white-space:nowrap;">${item.qty} sold</span>
              </div>`;
      });
  } else {
      leaderboardHTML = '<div style="color:var(--text-secondary); font-size:12px; text-align:center; padding:10px 0;">No sales recorded</div>';
  }

  let topSets = Object.keys(setsData).map(k => ({ set: k, rev: setsData[k] })).sort((a,b) => b.rev - a.rev).slice(0, 5);
  let maxSetRev = topSets.length > 0 ? topSets[0].rev : 1;

  let setBarsHTML = '';
  topSets.forEach(t => {
      let pct = Math.max((t.rev / maxSetRev) * 100, 2);
      setBarsHTML += `
          <div style="margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: var(--text-secondary);">
                  <span>${t.set}</span>
                  <span style="font-weight:600; color:var(--text-primary);">Rp ${Math.round(t.rev).toLocaleString('id-ID')}</span>
              </div>
              <div style="width: 100%; background: rgba(128,128,128,0.1); height: 6px; border-radius: 3px; overflow: hidden;">
                  <div style="width: ${pct}%; background: var(--accent-yellow); height: 100%; border-radius: 3px;"></div>
              </div>
          </div>
      `;
  });

  let viewSoldCards = document.getElementById('view-sold-cards');
  let statsPanel = document.getElementById('sold-cards-stats-panel');
  if (!statsPanel) {
      statsPanel = document.createElement('div');
      statsPanel.id = 'sold-cards-stats-panel';
      statsPanel.style.cssText = 'display: grid; gap: 20px; margin-bottom: 24px; align-items: stretch;';
      const tablePanel = viewSoldCards.querySelector('.card-panel');
      viewSoldCards.insertBefore(statsPanel, tablePanel);
  }

  const isMobile = window.innerWidth < 1024;
  if(isMobile) {
    statsPanel.style.gridTemplateColumns = '1fr';
  } else {
    statsPanel.style.gridTemplateColumns = '1.3fr 1fr 1.2fr';
  }

  statsPanel.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 20px; align-content: stretch;">
          <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; box-sizing: border-box; margin: 0;">
              <h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Filtered Revenue</h4>
              <h2 style="margin: 0; font-size: 20px; color: var(--accent-yellow);">Rp ${Math.round(totalRev).toLocaleString('id-ID')}</h2>
          </div>
          <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; box-sizing: border-box; margin: 0;">
              <h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Filtered Profit</h4>
              <h2 style="margin: 0; font-size: 20px; color: ${totalProfit >= 0 ? '#22c55e' : '#ef4444'};">Rp ${Math.round(totalProfit).toLocaleString('id-ID')}</h2>
          </div>
          <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; box-sizing: border-box; margin: 0;">
              <h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Profit Margin</h4>
              <h2 style="margin: 0; font-size: 20px; color: var(--text-primary);">${margin}%</h2>
          </div>
          <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: center; height: 100%; box-sizing: border-box; margin: 0;">
              <h4 style="margin: 0 0 8px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">Cards Sold</h4>
              <h2 style="margin: 0; font-size: 20px; color: var(--text-primary);">${cardsSold} pcs</h2>
          </div>
      </div>
      
      <div class="stat-card" style="padding: 20px; flex-direction: column; align-items: flex-start; justify-content: flex-start; height: 100%; box-sizing: border-box; margin: 0; display: flex;">
          <h4 style="margin: 0 0 12px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500; width: 100%;">
            <i class="fas fa-trophy" style="color:var(--accent-yellow); margin-right:4px;"></i> Top Selling Cards
          </h4>
          <div style="width:100%; display:flex; flex-direction:column; gap:12px; flex: 1; justify-content: center;">
            ${leaderboardHTML}
          </div>
      </div>
      
      <div class="card-panel" style="margin-bottom: 0; padding: 20px; display: flex; flex-direction: column; justify-content: flex-start; height: 100%; box-sizing: border-box;">
          <h4 style="margin: 0 0 16px 0; color: var(--text-secondary); font-size: 13px; font-weight: 500;">
              <i class="fas fa-chart-bar" style="color:var(--accent-yellow); margin-right:4px;"></i> Top Sets (Filtered)
          </h4>
          <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
              ${topSets.length > 0 ? setBarsHTML : '<div style="color:var(--text-secondary); font-size:12px; text-align:center;">No sets data available</div>'}
          </div>
      </div>
  `;
}

function renderGroups() {
  const grid = document.getElementById('groups-grid');
  const addCardsGroupSelect = document.getElementById('group-select');
  const calc = getCalculatedData();
  
  if(addCardsGroupSelect) {
    addCardsGroupSelect.innerHTML = '<option value="">Select a group...</option>';
    state.groups.forEach(g => { addCardsGroupSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`; });
  }

  const groupSelect = document.getElementById('filter-group');
  const langSelect = document.getElementById('filter-lang');
  if (groupSelect && langSelect) {
    const currentGroup = groupSelect.value || 'All Groups';
    const currentLang = langSelect.value || 'All Languages';

    let groupOptions = '<option value="All Groups">All Groups</option>';
    state.groups.forEach(g => { groupOptions += `<option value="${g.name}">${g.name}</option>`; });
    groupSelect.innerHTML = groupOptions;
    groupSelect.value = currentGroup;

    langSelect.innerHTML = `
      <option value="All Languages">All Languages</option>
      <option value="Japanese">Japanese</option>
      <option value="English">English</option>
      <option value="Indonesian">Indonesian</option>
    `;
    langSelect.value = currentLang;
  }

  if(!grid) return;
  grid.innerHTML = '';

  if(!state.groups || state.groups.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-secondary);">No groups created yet.</p>`;
    return;
  }

  state.groups.forEach(g => {
    const groupDetail = calc.groupsMap[g.name] || { totalCardsInGroup: 0 };
    const div = document.createElement('div');
    div.className = 'group-card';
    
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; display:flex; align-items:center;">
          <i class="fas fa-box" style="color: var(--accent-yellow); margin-right:6px;"></i>
          <span class="editable-group edit-g-name" contenteditable="true" title="Click to edit" style="padding:2px 6px; border-radius:4px;">${g.name}</span>
        </h3>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size:12px; color: var(--text-secondary);">ID: ${String(g.id).substring(4,10)}</span>
          <button class="btn-outline btn-delete-group" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete Group and all cards inside it"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="group-stat-row">
        <span>Exchange Rate</span>
        <strong>¥1 = Rp <span class="editable-group edit-g-rate" contenteditable="true" title="Click to edit" style="padding:2px 6px; border-radius:4px;">${g.exchangerate || 0}</span></strong>
      </div>
      <div class="group-stat-row">
        <span>Total Shipping Fee</span>
        <strong>Rp <span class="editable-group edit-g-ship" contenteditable="true" title="Click to edit" style="padding:2px 6px; border-radius:4px;">${Number(g.shippingfee || 0).toLocaleString('id-ID')}</span></strong>
      </div>
      <div class="group-stat-row"><span>Cards Tracked</span><strong>${groupDetail.totalCardsInGroup} pcs</strong></div>
    `;

    div.querySelectorAll('.editable-group').forEach(cell => {
      cell.addEventListener('mouseenter', () => cell.style.background = 'rgba(128,128,128,0.1)');
      cell.addEventListener('mouseleave', () => cell.style.background = 'transparent');
      cell.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cell.blur(); }});
      cell.addEventListener('blur', () => {
        cell.style.background = 'transparent';
        const oldName = g.name;
        let newName = div.querySelector('.edit-g-name').textContent.trim();
        let newRate = Number(div.querySelector('.edit-g-rate').textContent.replace(/[^0-9]/g, '')) || 0;
        let newShip = Number(div.querySelector('.edit-g-ship').textContent.replace(/[^0-9]/g, '')) || 0;
        if (!newName) newName = oldName; 
        const nameChanged = (oldName !== newName);

        state.groups.forEach(item => { if (item.id === g.id) { item.name = newName; item.exchangerate = newRate; item.shippingfee = newShip; } });
        if (nameChanged) { state.inventory.forEach(card => { if (card.group === oldName) card.group = newName; }); }
        updateDashboard(); renderInventory(); renderGroups();
        silentPostData('updateGroup', { id: g.id, oldName: oldName, name: newName, rate: newRate, shipping: newShip, nameChanged: nameChanged });
      });
    });

    div.querySelector('.btn-delete-group').addEventListener('click', () => {
      const groupCards = state.inventory.filter(c => c.group === g.name);
      const confirmMsg = groupCards.length > 0 ? `Are you sure you want to delete the group "${g.name}" AND the ${groupCards.length} card(s) inside it?\n\nThis will move them to the Recycle Bin.` : `Are you sure you want to delete the empty group "${g.name}"?`;
      if(confirm(confirmMsg)) {
        const payload = { group: { id: g.id, name: g.name, exchangeRate: g.exchangerate, shippingFee: g.shippingfee }, cards: groupCards };
        state.trash.unshift({ id: 'TRASH_' + Date.now() + Math.floor(Math.random()*1000), type: 'GroupBundle', deletedAt: new Date().toISOString(), payload: JSON.stringify(payload) });
        state.groups = state.groups.filter(item => item.id !== g.id);
        state.inventory = state.inventory.filter(item => item.group !== g.name);
        updateDashboard(); renderInventory(); renderGroups(); renderTrash();
        postData('deleteGroup', { id: g.id, name: g.name });
      }
    });
    grid.appendChild(div);
  });
}

function renderSales() {
  const body = document.getElementById('sales-body');
  if(!body) return;
  body.innerHTML = '';

  const table = body.closest('table');
  if (table) {
    const theadTr = table.querySelector('thead tr');
    if (theadTr && !theadTr.querySelector('.bulk-check-header')) {
      const th = document.createElement('th');
      th.className = 'bulk-check-header';
      th.style.width = '40px'; 
      th.innerHTML = '<input type="checkbox" id="check-all-sales" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);">';
      theadTr.insertBefore(th, theadTr.firstChild);
    }

    let controlsDiv = document.getElementById('sales-controls-div');
    if (!controlsDiv) {
      controlsDiv = document.createElement('div');
      controlsDiv.id = 'sales-controls-div';
      controlsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;';
      
      const filterBar = document.createElement('div');
      filterBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(128,128,128,0.05); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); flex-wrap: wrap; gap: 12px;';
      filterBar.innerHTML = `
        <div style="color: var(--text-secondary); font-size: 14px; font-weight: 500;" id="sales-count-display"></div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <label style="font-size: 13px; color: var(--text-secondary); margin: 0;">Sort:</label>
          <select id="sort-sales" style="width: auto; display: inline-block; padding: 6px 12px; border-radius: 6px; background: transparent; color: inherit; border: 1px solid var(--border-color); outline: none; cursor: pointer; font-size: 13px;">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="az">Name (A-Z)</option>
            <option value="za">Name (Z-A)</option>
            <option value="price-high">Price (High-Low)</option>
            <option value="price-low">Price (Low-High)</option>
          </select>
          <label style="font-size: 13px; color: var(--text-secondary); margin: 0; margin-left: 8px;">Filter:</label>
          <select id="sales-month-filter" style="width: auto; display: inline-block; padding: 6px 12px; border-radius: 6px; background: transparent; color: inherit; border: 1px solid var(--border-color); outline: none; cursor: pointer; font-size: 13px;">
            <option value="all">All Months</option>
            <option value="0">Jan</option>
            <option value="1">Feb</option>
            <option value="2">Mar</option>
            <option value="3">Apr</option>
            <option value="4">May</option>
            <option value="5">Jun</option>
            <option value="6">Jul</option>
            <option value="7">Aug</option>
            <option value="8">Sep</option>
            <option value="9">Oct</option>
            <option value="10">Nov</option>
            <option value="11">Dec</option>
          </select>
          <select id="sales-year-filter" style="width: auto; display: inline-block; padding: 6px 12px; border-radius: 6px; background: transparent; color: inherit; border: 1px solid var(--border-color); outline: none; cursor: pointer; font-size: 13px;">
            <option value="all">All Years</option>
          </select>
        </div>
      `;
      controlsDiv.appendChild(filterBar);

      const bulkDiv = document.createElement('div');
      bulkDiv.id = 'bulk-delete-div';
      bulkDiv.style.cssText = 'display: none; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px;';
      bulkDiv.innerHTML = `
        <span style="color: #ef4444; font-weight: 600; font-size: 14px;"><span id="bulk-delete-count">0</span> sale(s) selected</span>
        <button id="btn-bulk-delete" style="background: #ef4444; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Delete Selected</button>
      `;
      controlsDiv.appendChild(bulkDiv);

      table.parentNode.insertBefore(controlsDiv, table);

      document.getElementById('sort-sales').addEventListener('change', () => { renderSales(); });
      document.getElementById('sales-month-filter').addEventListener('change', () => { renderSales(); });
      document.getElementById('sales-year-filter').addEventListener('change', () => { renderSales(); });
    } else {
      document.getElementById('bulk-delete-div').style.display = 'none'; 
    }

    const yearSelect = document.getElementById('sales-year-filter');
    if (yearSelect && state.sales) {
      const currentYearVal = yearSelect.value;
      const years = [...new Set(state.sales.map(s => new Date(s.date || Date.now()).getFullYear()))].sort((a,b) => b - a);
      if(years.length === 0) years.push(new Date().getFullYear());
      
      let yearOpts = '<option value="all">All Years</option>';
      years.forEach(y => { yearOpts += `<option value="${y}" ${String(y) === currentYearVal ? 'selected' : ''}>${y}</option>`; });
      yearSelect.innerHTML = yearOpts;
      if (!years.includes(Number(currentYearVal)) && currentYearVal !== 'all') yearSelect.value = 'all'; 
    }
  }

  const monthFilter = document.getElementById('sales-month-filter') ? document.getElementById('sales-month-filter').value : 'all';
  const yearFilter = document.getElementById('sales-year-filter') ? document.getElementById('sales-year-filter').value : 'all';
  
  let filteredSales = [...state.sales];
  filteredSales = filteredSales.filter(s => {
    const sDate = new Date(s.date || Date.now());
    const matchMonth = (monthFilter === 'all') || (sDate.getMonth() === Number(monthFilter));
    const matchYear = (yearFilter === 'all') || (sDate.getFullYear() === Number(yearFilter));
    return matchMonth && matchYear;
  });

  const sortVal = document.getElementById('sort-sales') ? document.getElementById('sort-sales').value : 'newest';
  if (sortVal === 'newest') filteredSales.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  else if (sortVal === 'oldest') filteredSales.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  else if (sortVal === 'az') filteredSales.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  else if (sortVal === 'za') filteredSales.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
  else if (sortVal === 'price-high') filteredSales.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  else if (sortVal === 'price-low') filteredSales.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));

  const countDisplay = document.getElementById('sales-count-display');
  if (countDisplay) countDisplay.textContent = `Showing ${filteredSales.length} record(s)`;

  updateSoldCardsStatsAndCharts(filteredSales);

  if(filteredSales.length === 0) {
    body.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--text-secondary);">No sales records found for this period.</td></tr>`;
    return;
  }

  const calc = getCalculatedData();

  filteredSales.forEach((sale, index) => {
    const linkedCard = state.inventory.find(c => c.id === sale.cardid);
    let totalCostOfSold = 0;
    
    if (linkedCard) {
      const groupInfo = calc.groupsMap[linkedCard.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0, shippingDivider: 1 };
      const basePriceRp = Number(linkedCard.yenprice || 0) * groupInfo.rate;
      const shippingPerCard = groupInfo.shippingDivider > 0 ? (groupInfo.shippingFee / groupInfo.shippingDivider) : 0;
      const totalCostPerCard = basePriceRp + shippingPerCard;
      totalCostOfSold = totalCostPerCard * Number(sale.quantity || 1);
    }
    
    const salePrice = Number(sale.price || 0);
    const profit = salePrice - totalCostOfSold;
    
    const isLoss = profit < 0;
    const profitColor = isLoss ? '#ef4444' : '#22c55e'; 
    const formattedProfit = (isLoss ? '-' : '') + 'Rp ' + Math.abs(Math.round(profit)).toLocaleString('id-ID');

    const saleDateObj = new Date(sale.date || Date.now());
    const offset = saleDateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(saleDateObj.getTime() - offset)).toISOString().split('T')[0];

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="sale-check" data-index="${index}" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);"></td>
      <td title="Click to edit date">
        <input type="date" class="inline-edit-date edit-sale-date" value="${localISOTime}" style="background:transparent; color:inherit; border:1px dashed transparent; outline:none; cursor:pointer; padding:2px 4px; border-radius:4px; font-size:inherit; font-family:inherit; color-scheme: inherit;">
      </td>
      <td><strong>${sale.name || '—'}</strong></td>
      <td>${sale.set || '—'}</td>
      <td>${sale.rarity || '—'}</td> 
      <td>${sale.quantity || 1}</td>
      <td>Rp ${salePrice.toLocaleString('id-ID')}</td>
      <td style="color: ${profitColor}; font-weight: 600;">${formattedProfit}</td>
      <td class="editable-cell edit-sale-notes" contenteditable="true" title="Click to edit">${sale.notes || '—'}</td>
      <td>
        <div style="display: flex; gap: 4px; align-items: center; justify-content: flex-start;">
          <button class="btn-outline btn-delete-sale" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete Sale"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;

    const dateInput = tr.querySelector('.edit-sale-date');
    dateInput.addEventListener('mouseenter', () => dateInput.style.border = '1px dashed var(--border-color)');
    dateInput.addEventListener('mouseleave', () => dateInput.style.border = '1px dashed transparent');
    dateInput.addEventListener('change', (e) => {
      const newDateStr = e.target.value;
      if(!newDateStr) return;
      const newSaleDate = new Date(newDateStr + 'T00:00:00').toISOString();
      sale.date = newSaleDate;
      silentPostData('updateSale', { oldDate: sale.date, cardId: sale.cardid, newDate: newSaleDate, notes: sale.notes });
      updateDashboard(); renderSales(); 
    });

    const notesCell = tr.querySelector('.edit-sale-notes');
    notesCell.addEventListener('mouseenter', () => notesCell.style.background = 'rgba(128,128,128,0.1)');
    notesCell.addEventListener('mouseleave', () => notesCell.style.background = 'transparent');
    notesCell.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); notesCell.blur(); } });
    notesCell.addEventListener('blur', () => {
      notesCell.style.background = 'transparent';
      let newNotes = notesCell.textContent.trim();
      if (newNotes === '—') newNotes = '';
      if (newNotes !== (sale.notes || '')) {
        sale.notes = newNotes;
        silentPostData('updateSale', { oldDate: sale.date, cardId: sale.cardid, newDate: sale.date, notes: newNotes });
      }
    });

    tr.querySelector('.btn-delete-sale').addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete this sale record for ${sale.name}? This will restore ${sale.quantity} stock back to the inventory.`)) {
        if (linkedCard) linkedCard.quantity = Number(linkedCard.quantity || 0) + Number(sale.quantity || 1);
        state.sales = state.sales.filter(s => s !== sale); 
        updateDashboard(); renderSales(); renderInventory(); 
        postData('deleteSale', { date: sale.date, cardId: sale.cardid, quantity: sale.quantity });
      }
    });

    body.appendChild(tr);
  });

  let checkAll = document.getElementById('check-all-sales');
  const itemChecks = document.querySelectorAll('.sale-check');
  const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
  const bulkCountText = document.getElementById('bulk-delete-count');
  const bulkDiv = document.getElementById('bulk-delete-div');

  if (checkAll) {
    const newCheckAll = checkAll.cloneNode(true);
    checkAll.parentNode.replaceChild(newCheckAll, checkAll);
    checkAll = newCheckAll;
    checkAll.checked = false;
  }

  if (checkAll && itemChecks && bulkDeleteBtn && bulkCountText && bulkDiv) {
    function updateBulkUI() {
      const checkedCount = document.querySelectorAll('.sale-check:checked').length;
      if (checkedCount > 0) {
        bulkDiv.style.display = 'flex';
        bulkCountText.textContent = checkedCount;
      } else {
        bulkDiv.style.display = 'none';
      }
      checkAll.checked = (checkedCount === itemChecks.length && itemChecks.length > 0);
    }

    checkAll.addEventListener('change', (e) => { itemChecks.forEach(chk => chk.checked = e.target.checked); updateBulkUI(); });
    itemChecks.forEach(chk => { chk.addEventListener('change', updateBulkUI); });

    const newBulkBtn = bulkDeleteBtn.cloneNode(true);
    bulkDeleteBtn.parentNode.replaceChild(newBulkBtn, bulkDeleteBtn);

    newBulkBtn.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.sale-check:checked');
      if (checkedBoxes.length === 0) return;

      if (confirm(`Are you sure you want to delete ${checkedBoxes.length} sale record(s)? This will restore their stock back to the inventory.`)) {
        const salesToDelete = Array.from(checkedBoxes).map(chk => filteredSales[chk.getAttribute('data-index')]);
        salesToDelete.forEach(sale => {
          const linkedCard = state.inventory.find(c => c.id === sale.cardid);
          if (linkedCard) linkedCard.quantity = Number(linkedCard.quantity || 0) + Number(sale.quantity || 1);
          state.sales = state.sales.filter(s => s !== sale);
        });

        updateDashboard(); renderInventory(); renderSales();

        (async function syncBulkDelete() {
          for (const sale of salesToDelete) {
            try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteSale', date: sale.date, cardId: sale.cardid, quantity: sale.quantity }) }); } catch(e) {}
          }
        })();
      }
    });
  }
}

function renderTrash() {
  const body = document.getElementById('trash-body');
  if(!body) return;
  body.innerHTML = '';

  const table = body.closest('table');
  if (table) {
    const theadTr = table.querySelector('thead tr');
    if (theadTr && !theadTr.querySelector('.bulk-check-header-trash')) {
      const th = document.createElement('th');
      th.className = 'bulk-check-header-trash';
      th.style.width = '40px'; 
      th.innerHTML = '<input type="checkbox" id="check-all-trash" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);">';
      theadTr.insertBefore(th, theadTr.firstChild);
    }

    let controlsDiv = document.getElementById('trash-controls-div');
    if (!controlsDiv) {
      controlsDiv = document.createElement('div');
      controlsDiv.id = 'trash-controls-div';
      controlsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px;';

      const bulkDiv = document.createElement('div');
      bulkDiv.id = 'bulk-action-trash-div';
      bulkDiv.style.cssText = 'display: none; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px;';
      bulkDiv.innerHTML = `
        <span style="color: var(--accent-yellow); font-weight: 600; font-size: 14px;"><span id="bulk-trash-count">0</span> item(s) selected</span>
        <div style="display: flex; gap: 10px;">
          <button id="btn-bulk-restore-trash" style="background: transparent; color: var(--text-primary); border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"><i class="fas fa-undo" style="color: var(--accent-yellow);"></i> Restore Selected</button>
          <button id="btn-bulk-delete-trash" style="background: #ef4444; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Delete Permanently</button>
        </div>
      `;
      controlsDiv.appendChild(bulkDiv);
      table.parentNode.insertBefore(controlsDiv, table);
    } else {
      document.getElementById('bulk-action-trash-div').style.display = 'none';
    }
  }

  if(!state.trash || state.trash.length === 0) {
    body.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-secondary);">Your Recycle Bin is empty.</td></tr>`;
    return;
  }

  let sortedTrash = [...state.trash].sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));

  sortedTrash.forEach((item, index) => {
    let payloadStr = "Unknown Data Data";
    try {
      const p = JSON.parse(item.payload);
      if (item.type === 'Card') {
        payloadStr = `<strong>${p.name || 'Unknown'}</strong> (${p.set || 'No Set'}) - Stock: ${p.quantity} | Yen: ¥${Number(p.yenPrice).toLocaleString('ja-JP')}`;
      } else if (item.type === 'Sale') {
        payloadStr = `<strong>${p.name || 'Unknown'}</strong> | Sold: ${p.quantity} pcs | Price: Rp ${Number(p.price).toLocaleString('id-ID')}`;
      } else if (item.type === 'GroupBundle') {
        payloadStr = `<strong>Group: ${p.group.name}</strong> | Rate: ¥1 = Rp ${p.group.exchangeRate} | Contains ${p.cards ? p.cards.length : 0} card(s)`;
      }
    } catch(e) {}

    const typeBg = item.type === 'Card' ? 'rgba(59, 130, 246, 0.15)' : item.type === 'Sale' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(168, 85, 247, 0.15)'; 
    const typeColor = item.type === 'Card' ? '#3b82f6' : item.type === 'Sale' ? '#22c55e' : '#a855f7';
    const displayType = item.type === 'GroupBundle' ? 'Group & Cards' : item.type;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="trash-check" data-index="${index}" style="cursor:pointer; width:16px; height:16px; accent-color: var(--accent-yellow);"></td>
      <td><span style="padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600; background: ${typeBg}; color: ${typeColor};">${displayType}</span></td>
      <td>${new Date(item.deletedAt).toLocaleString()}</td>
      <td>${payloadStr}</td>
      <td>
        <div style="display:flex; justify-content: flex-start; gap:8px;">
          <button class="btn-outline btn-restore-trash" style="padding: 6px 12px; font-weight: 500; color: var(--accent-yellow); border-color: rgba(234, 179, 8, 0.3);" title="Restore back to tracker"><i class="fas fa-undo"></i> Restore</button>
          <button class="btn-outline btn-destroy-trash" style="padding: 6px 12px; font-weight: 500; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete Permanently"><i class="fas fa-times"></i> Delete</button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-restore-trash').addEventListener('click', () => { if(confirm(`Are you sure you want to restore this ${displayType} back to the active tracker?`)) restoreSingleTrash(item); });
    tr.querySelector('.btn-destroy-trash').addEventListener('click', () => { if(confirm(`Permanently delete this ${displayType}? This action cannot be undone.`)) deleteSingleTrash(item); });
    body.appendChild(tr);
  });

  let checkAll = document.getElementById('check-all-trash');
  const itemChecks = document.querySelectorAll('.trash-check');
  const bulkRestoreBtn = document.getElementById('btn-bulk-restore-trash');
  const bulkDeleteBtn = document.getElementById('btn-bulk-delete-trash');
  const bulkCountText = document.getElementById('bulk-trash-count');
  const bulkDiv = document.getElementById('bulk-action-trash-div');

  if (checkAll) {
    const newCheckAll = checkAll.cloneNode(true);
    checkAll.parentNode.replaceChild(newCheckAll, checkAll);
    checkAll = newCheckAll;
    checkAll.checked = false;
  }

  if (checkAll && itemChecks && bulkRestoreBtn && bulkDeleteBtn && bulkCountText && bulkDiv) {
    function updateBulkUI() {
      const checkedCount = document.querySelectorAll('.trash-check:checked').length;
      if (checkedCount > 0) { bulkDiv.style.display = 'flex'; bulkCountText.textContent = checkedCount; } 
      else { bulkDiv.style.display = 'none'; }
      checkAll.checked = (checkedCount === itemChecks.length && itemChecks.length > 0);
    }

    checkAll.addEventListener('change', (e) => { itemChecks.forEach(chk => chk.checked = e.target.checked); updateBulkUI(); });
    itemChecks.forEach(chk => { chk.addEventListener('change', updateBulkUI); });

    const newBulkRestore = bulkRestoreBtn.cloneNode(true);
    bulkRestoreBtn.parentNode.replaceChild(newBulkRestore, bulkRestoreBtn);
    newBulkRestore.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.trash-check:checked');
      if (checkedBoxes.length === 0) return;
      if (confirm(`Are you sure you want to restore ${checkedBoxes.length} item(s)?`)) {
        const itemsToRestore = Array.from(checkedBoxes).map(chk => sortedTrash[chk.getAttribute('data-index')]);
        itemsToRestore.forEach(item => processRestoreState(item));
        updateDashboard(); renderInventory(); renderGroups(); renderTrash();
        (async function syncBulkRestore() {
          for (const item of itemsToRestore) {
            try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'restoreTrash', trashId: item.id }) }); } catch(e) {}
          }
        })();
      }
    });

    const newBulkDelete = bulkDeleteBtn.cloneNode(true);
    bulkDeleteBtn.parentNode.replaceChild(newBulkDelete, bulkDeleteBtn);
    newBulkDelete.addEventListener('click', () => {
      const checkedBoxes = document.querySelectorAll('.trash-check:checked');
      if (checkedBoxes.length === 0) return;
      if (confirm(`Permanently delete ${checkedBoxes.length} item(s)? This cannot be undone.`)) {
        const itemsToDelete = Array.from(checkedBoxes).map(chk => sortedTrash[chk.getAttribute('data-index')]);
        itemsToDelete.forEach(item => { state.trash = state.trash.filter(t => t.id !== item.id); });
        renderTrash();
        (async function syncBulkDelete() {
          for (const item of itemsToDelete) {
            try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteTrash', trashId: item.id }) }); } catch(e) {}
          }
        })();
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
      if (p.cards) { p.cards.forEach(c => state.inventory.push(c)); }
    } else if (item.type === 'Card') {
       state.inventory.push(p);
    } else if (item.type === 'Sale') {
       state.sales.push({ date: p.date, cardid: p.cardId, name: p.name, set: p.set, rarity: p.rarity, quantity: p.quantity, price: p.price, notes: p.notes });
       const linkedCard = state.inventory.find(c => c.id === p.cardId);
       if (linkedCard) linkedCard.quantity = Number(linkedCard.quantity || 0) - Number(p.quantity || 0);
    }
  } catch (e) {}
}

function restoreSingleTrash(item) {
  processRestoreState(item); updateDashboard(); renderInventory(); renderGroups(); renderTrash(); postData('restoreTrash', { trashId: item.id });
}

function deleteSingleTrash(item) {
  state.trash = state.trash.filter(t => t.id !== item.id); renderTrash(); silentPostData('deleteTrash', { trashId: item.id });
}