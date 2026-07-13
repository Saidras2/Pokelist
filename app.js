// 1. Paste your actual Google Web App URL between the single quotes below:
const API_URL = 'https://script.google.com/macros/s/AKfycbymA0CfeEuSx7_yetVi8gSxNDL9Zvbse30dHa9FsVPoa5zDZkipTwVlsHpKL7hooozvvg/exec'; 

// State Management
let state = {
  inventory: [],
  groups: [],
  sales: []
};

// Global DOM element references (Safely initialized inside DOMContentLoaded)
let views, navItems, addCardsBody, modalOverlay, groupModal;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Safely grab all DOM elements now that the HTML structure is fully ready
  views = document.querySelectorAll('.view');
  navItems = document.querySelectorAll('.nav-item');
  addCardsBody = document.getElementById('add-cards-body');
  modalOverlay = document.getElementById('modal-overlay');
  groupModal = document.getElementById('modal-group');
  
  setupThemeToggle(); // Initializes the persistent theme engine
  setupNavigation();
  setupModals();
  setupSearchFilters(); 
  addEmptyCardRow(); 
  fetchData(); 

  // Dismiss any active action dropdown menus if clicking outside of them
  document.addEventListener('click', () => {
    document.querySelectorAll('.action-dropdown').forEach(d => d.remove());
  });
});

// --- Navigation & Theme Engine ---
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
    });
  });
}

function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle') || document.querySelector('.theme-toggle');
  
  if (!themeToggle) {
    console.warn("Theme toggle element not found. Ensure your HTML button has id='theme-toggle' or class='theme-toggle'.");
    return;
  }

  // Retrieve saved theme preference, defaulting to 'dark' if none exists
  const savedTheme = localStorage.getItem('theme') || 'dark';

  // Apply the saved theme immediately on load
  if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.body.classList.remove('light');
    document.body.classList.add('dark');
    themeToggle.innerHTML = '🌙 Night';
  } else {
    document.body.setAttribute('data-theme', 'light');
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    themeToggle.innerHTML = '☀️ Day';
  }

  // Listen for toggle clicks and save choices to localStorage
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark');
    
    if (isDark) {
      document.body.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
      document.body.classList.add('light');
      themeToggle.innerHTML = '☀️ Day';
      localStorage.setItem('theme', 'light'); 
    } else {
      document.body.setAttribute('data-theme', 'dark');
      document.body.classList.remove('light');
      document.body.classList.add('dark');
      themeToggle.innerHTML = '🌙 Night';
      localStorage.setItem('theme', 'dark');
    }
  });
}

// --- Real-time Filter Tracking Engine ---
function setupSearchFilters() {
  const searchInput = document.querySelector('input[placeholder="Search cards..."]');
  if (searchInput) {
    searchInput.addEventListener('input', renderInventory);
  }

  const filterSelects = document.querySelectorAll('select');
  filterSelects.forEach(select => {
    if (select.id !== 'group-select' && !select.classList.contains('c-lang')) {
      select.addEventListener('change', renderInventory);
    }
  });
}

// --- Data Fetching & Sync ---
async function fetchData() {
  try {
    if(API_URL.includes('YOUR_GOOGLE')) return; 
    const res = await fetch(API_URL);
    const data = await res.json();
    
    state.inventory = data.inventory || [];
    state.groups = data.groups || [];
    state.sales = data.sales || [];
    
    updateDashboard();
    renderInventory();
    renderGroups();
    renderSales();
  } catch(err) {
    console.error("Failed to fetch data from Google Sheets", err);
  }
}

async function postData(action, payload) {
  if(API_URL.includes('YOUR_GOOGLE')) return alert('Please set your Google Web App URL first!');
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload })
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
  if(API_URL.includes('YOUR_GOOGLE')) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload })
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
}

// --- Calculation Helper Functions ---
function getCalculatedData() {
  let groupsMap = {};
  state.groups.forEach(g => {
    groupsMap[g.name] = {
      rate: Number(g.exchangerate || 0),
      shippingFee: Number(g.shippingfee || 0),
      totalCardsInGroup: 0
    };
  });

  // Dynamically count total cards in each group based on the latest state
  state.inventory.forEach(item => {
    if (groupsMap[item.group]) {
      groupsMap[item.group].totalCardsInGroup += Number(item.quantity || 0);
    }
  });

  let mergedInventory = {};
  let totalValueRp = 0;
  let totalValueYen = 0;

  state.inventory.forEach(item => {
    const key = `${item.name || ''}_${item.set || ''}_${item.cardnumber || ''}_${item.language || ''}`.toLowerCase().trim();
    const qty = Number(item.quantity || 0);
    const yenPrice = Number(item.yenprice || 0);
    
    // Automatically uses the updated totalCardsInGroup for precise shipping division per card
    const groupInfo = groupsMap[item.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0 };
    const basePriceRp = yenPrice * groupInfo.rate;
    const shippingPerCard = groupInfo.totalCardsInGroup > 0 ? (groupInfo.shippingFee / groupInfo.totalCardsInGroup) : 0;
    const totalCostPerCard = basePriceRp + shippingPerCard;

    if (qty > 0) { 
      totalValueYen += (yenPrice * qty);
      totalValueRp += (totalCostPerCard * qty);
    }

    if (!mergedInventory[key]) {
      mergedInventory[key] = {
        id: item.id, 
        name: item.name,
        set: item.set,
        cardnumber: item.cardnumber,
        language: item.language,
        quantity: 0,
        yenprice: yenPrice,
        priceRp: basePriceRp,
        shippingAllocation: shippingPerCard,
        totalCost: totalCostPerCard,
        group: item.group
      };
    }
    mergedInventory[key].quantity += qty;
  });

  return {
    mergedList: Object.values(mergedInventory).filter(c => c.quantity > 0),
    totalValueRp,
    totalValueYen,
    groupsMap
  };
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
      const groupInfo = calc.groupsMap[linkedCard.group] || { rate: 0, shippingFee: 0, totalCardsInGroup: 0 };
      const basePriceRp = Number(linkedCard.yenprice || 0) * groupInfo.rate;
      const shippingPerCard = groupInfo.totalCardsInGroup > 0 ? (groupInfo.shippingFee / groupInfo.totalCardsInGroup) : 0;
      const totalCostPerCard = basePriceRp + shippingPerCard;
      totalCostOfSold += totalCostPerCard * Number(sale.quantity || 1);
    }
  });

  const netProfit = totalSalesRevenue - totalCostOfSold;
  
  const uniqueEl = document.getElementById('stat-unique');
  const totalEl = document.getElementById('stat-total');
  const rpEl = document.getElementById('stat-val-rp');
  const yenEl = document.getElementById('stat-val-yen');
  const soldEl = document.getElementById('stat-sold');
  const profitEl = document.getElementById('stat-profit');

  if (uniqueEl) uniqueEl.textContent = calc.mergedList.length;
  if (totalEl) totalEl.textContent = totalQty;
  if (rpEl) rpEl.textContent = "Rp " + Math.round(calc.totalValueRp).toLocaleString('id-ID');
  if (yenEl) yenEl.textContent = "¥" + calc.totalValueYen.toLocaleString('ja-JP');
  if (soldEl) soldEl.textContent = state.sales.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
  if (profitEl) profitEl.textContent = "Rp " + Math.round(netProfit).toLocaleString('id-ID');
}

// --- Modals Controls ---
function setupModals() {
  const newGroupBtn1 = document.getElementById('btn-new-group');
  const newGroupBtn2 = document.getElementById('btn-create-group-page');
  
  if (newGroupBtn1) newGroupBtn1.addEventListener('click', openGroupModal);
  if (newGroupBtn2) newGroupBtn2.addEventListener('click', openGroupModal);

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
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
}

const saveGroupBtn = document.getElementById('save-new-group');
if (saveGroupBtn) {
  saveGroupBtn.addEventListener('click', () => {
    const name = document.getElementById('new-group-name').value;
    const rate = document.getElementById('new-group-rate').value;
    const shipping = document.getElementById('new-group-shipping').value;
    
    if(name && rate && shipping) {
      postData('saveGroup', { 
        id: 'GRP_' + Date.now(), 
        name: name, 
        exchangeRate: rate, 
        shippingFee: shipping 
      });
      document.getElementById('new-group-name').value = '';
      document.getElementById('new-group-rate').value = '';
      document.getElementById('new-group-shipping').value = '';
      closeModal();
    } else {
      alert("Please fill out all fields before saving.");
    }
  });
}

// --- Add Cards Input Row Controls ---
const addRowBtn = document.getElementById('btn-add-row');
if (addRowBtn) addRowBtn.addEventListener('click', addEmptyCardRow);

function addEmptyCardRow() {
  if (!addCardsBody) return;
  const tr = document.createElement('tr');
  const count = addCardsBody.children.length + 1;
  tr.innerHTML = `
    <td>${count}</td>
    <td><input type="text" class="c-name" placeholder="Name"></td>
    <td><input type="text" class="c-set" placeholder="Set Code"></td>
    <td><input type="text" class="c-num" placeholder="Card #"></td>
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
  tr.querySelector('.del-row').addEventListener('click', () => {
    tr.remove();
    reindexRows();
  });
  addCardsBody.appendChild(tr);
}

function reindexRows() {
  if (!addCardsBody) return;
  const rows = addCardsBody.querySelectorAll('tr');
  rows.forEach((row, idx) => {
    row.children[0].textContent = idx + 1;
  });
}

const saveCardsBtn = document.getElementById('btn-save-cards');
if (saveCardsBtn) {
  saveCardsBtn.addEventListener('click', () => {
    const group = document.getElementById('group-select').value;
    if(!group) return alert("Please select or create a group first.");
    
    const rows = addCardsBody.querySelectorAll('tr');
    let cardsToSave = [];
    
    rows.forEach(row => {
      const name = row.querySelector('.c-name').value;
      const yen = row.querySelector('.c-yen').value;
      if(name && yen) {
        cardsToSave.push({
          id: 'CARD_' + Date.now() + Math.floor(Math.random()*1000),
          group: group,
          name: name,
          set: row.querySelector('.c-set').value,
          cardNumber: row.querySelector('.c-num').value,
          language: row.querySelector('.c-lang').value,
          yenPrice: yen,
          quantity: row.querySelector('.c-qty').value
        });
      }
    });

    if(cardsToSave.length > 0) {
      postData('saveCards', { cards: cardsToSave });
      addCardsBody.innerHTML = '';
      addEmptyCardRow();
    }
  });
}

// --- Dynamic Table Data Renderers with Stable Inline Editing ---
function renderInventory() {
  const body = document.getElementById('inventory-body');
  if(!body) return;
  body.innerHTML = '';
  
  const calc = getCalculatedData();
  let filteredList = calc.mergedList;

  // 1. Process text search input box (Adaptive matching rules)
  const searchInput = document.querySelector('input[placeholder="Search cards..."]');
  if (searchInput) {
    const query = searchInput.value.toLowerCase().trim();
    
    if (query) {
      if (query.length < 3) {
        filteredList = filteredList.filter(card => 
          card.name && String(card.name).toLowerCase().startsWith(query)
        );
      } else {
        filteredList = filteredList.filter(card => 
          (card.name && String(card.name).toLowerCase().includes(query)) ||
          (card.set && String(card.set).toLowerCase().includes(query)) ||
          (card.cardnumber && String(card.cardnumber).toLowerCase().includes(query))
        );
      }
    }
  }

  // 2. Process inventory panel dropdown selections securely by position
  const inventorySelects = document.querySelectorAll('#view-inventory select');
  if (inventorySelects.length >= 2) {
    const groupVal = inventorySelects[0].value;
    const langVal = inventorySelects[1].value;

    if (groupVal && !groupVal.toLowerCase().includes('all')) {
      filteredList = filteredList.filter(c => c.group && String(c.group).toLowerCase() === groupVal.toLowerCase());
    }

    if (langVal && !langVal.toLowerCase().includes('all')) {
      filteredList = filteredList.filter(c => c.language && String(c.language).toLowerCase() === langVal.toLowerCase());
    }
  }

  const filteredQty = filteredList.reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  const subtitle = document.getElementById('inventory-subtitle');
  if (subtitle) {
    subtitle.textContent = `${filteredList.length} unique card(s) • ${filteredQty} total in stock`;
  }

  if(filteredList.length === 0) {
    body.innerHTML = `<tr><td colspan="11" style="text-align:center; color: var(--text-secondary);">No matching cards found.</td></tr>`;
    return;
  }
  
  filteredList.forEach(card => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="editable-cell edit-name" contenteditable="true" title="Click to edit"><strong>${card.name || '—'}</strong></td>
      <td class="editable-cell edit-set" contenteditable="true" title="Click to edit">${card.set || '—'}</td>
      <td class="editable-cell edit-num" contenteditable="true" title="Click to edit">${card.cardnumber || '—'}</td>
      <td class="editable-cell edit-lang" contenteditable="true" title="Click to edit">${card.language || '—'}</td>
      <td><span class="editable-cell edit-qty" contenteditable="true" title="Click to edit" style="background: rgba(234,179,8,0.15); color: var(--accent-yellow); padding: 2px 8px; border-radius: 4px; font-weight:600; display:inline-block;">${card.quantity}</span></td>
      <td class="editable-cell edit-yen" contenteditable="true" title="Click to edit">¥${Number(card.yenprice).toLocaleString('ja-JP')}</td>
      <td>Rp ${Math.round(card.priceRp).toLocaleString('id-ID')}</td>
      <td>Rp ${Math.round(card.shippingAllocation).toLocaleString('id-ID')}</td>
      <td><strong>Rp ${Math.round(card.totalCost).toLocaleString('id-ID')}</strong></td>
      <td><span style="color: var(--text-secondary);"><i class="fas fa-folder-open"></i> ${card.group || '—'}</span></td>
      <td style="display: flex; gap: 4px; align-items: center;">
        <button class="btn-outline action-trigger" style="padding: 4px 8px;"><i class="fas fa-ellipsis-v"></i></button>
        <button class="btn-outline btn-delete-card" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" title="Delete card"><i class="fas fa-trash"></i></button>
      </td>
    `;

    // Handle delete button action
    tr.querySelector('.btn-delete-card').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete ${card.name}?`)) {
        // Optimistically remove from state and re-render/update
        state.inventory = state.inventory.filter(item => item.id !== card.id);
        updateDashboard();
        renderInventory();
        
        // Sync removal to Google Sheet
        postData('deleteCard', { id: card.id });
      }
    });

    // Intercept Enter key & update local state immediately on blur
    tr.querySelectorAll('.editable-cell').forEach(cell => {
      cell.addEventListener('mouseenter', () => cell.style.background = 'rgba(255,255,255,0.04)');
      cell.addEventListener('mouseleave', () => cell.style.background = 'transparent');
      
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          cell.blur();
        }
      });

      cell.addEventListener('blur', () => {
        cell.style.background = 'transparent';
        
        const nameVal = tr.querySelector('.edit-name').textContent.trim();
        const setVal = tr.querySelector('.edit-set').textContent.trim();
        const numVal = tr.querySelector('.edit-num').textContent.trim();
        const langVal = tr.querySelector('.edit-lang').textContent.trim();
        const qtyVal = Number(tr.querySelector('.edit-qty').textContent.trim()) || 0;
        const yenVal = Number(tr.querySelector('.edit-yen').textContent.replace(/[¥,]/g, '').trim()) || 0;

        state.inventory.forEach(item => {
          if (item.id === card.id) {
            item.name = nameVal === '—' ? '' : nameVal;
            item.set = setVal === '—' ? '' : setVal;
            item.cardnumber = numVal === '—' ? '' : numVal;
            item.language = langVal === '—' ? '' : langVal;
            item.yenprice = yenVal;
            item.quantity = qtyVal;
          }
        });

        updateDashboard();
        renderInventory();

        silentPostData('updateCard', {
          id: card.id,
          name: nameVal === '—' ? '' : nameVal,
          set: setVal === '—' ? '' : setVal,
          cardNumber: numVal === '—' ? '' : numVal,
          language: langVal === '—' ? '' : langVal,
          group: card.group,
          yenPrice: yenVal,
          quantity: qtyVal
        });
      });
    });

    const actionBtn = tr.querySelector('.action-trigger');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      document.querySelectorAll('.action-dropdown').forEach(d => d.remove());
      
      const dropdown = document.createElement('div');
      dropdown.className = 'action-dropdown';
      dropdown.style.cssText = 'position: absolute; background: var(--bg-surface, #1e1e24); border: 1px solid var(--border-color, #2d2d34); border-radius: 8px; padding: 4px 0; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); z-index: 1000; min-width: 140px;';
      
      const rect = actionBtn.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
      dropdown.style.left = `${rect.left + window.scrollX - 110}px`;
      
      dropdown.innerHTML = `
        <div class="dropdown-item dropdown-sale" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: var(--text-primary); font-size:13px; font-weight:500;">
          <i class="fas fa-money-bill-wave" style="color: #22c55e;"></i> Record Sale
        </div>
      `;
      
      const item = dropdown.querySelector('.dropdown-item');
      item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.06)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
      
      item.addEventListener('click', () => {
        dropdown.remove();
        openSaleModal(card);
      });
      
      document.body.appendChild(dropdown);
    });

    body.appendChild(tr);
  });
}
// --- Automated Modal Generator & Transaction Processor for Sales ---
function ensureSaleModalExists() {
  if (document.getElementById('modal-sale')) return;
  
  const modal = document.createElement('div');
  modal.id = 'modal-sale';
  modal.style.cssText = 'display:none; position: fixed; z-index: 2000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);';
  
  modal.innerHTML = `
    <div style="background: var(--bg-surface, #1e1e24); margin: 12% auto; padding: 24px; border: 1px solid var(--border-color, #2d2d34); width: 90%; max-width: 380px; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.55);">
      <h3 id="sale-modal-title" style="margin-top:0; margin-bottom:16px; font-size:18px; color: var(--text-primary);">💰 Record Sale</h3>
      <input type="hidden" id="sale-card-id">
      <input type="hidden" id="sale-card-name">
      <input type="hidden" id="sale-card-set">
      
      <div style="margin-bottom:14px;">
        <label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Quantity Sold</label>
        <input type="number" id="sale-qty" value="1" min="1" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-input); color: var(--text-primary); box-sizing: border-box;">
      </div>
      
      <div style="margin-bottom:14px;">
        <label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Sale Price (Total Rp)</label>
        <input type="number" id="sale-price" placeholder="e.g. 50000" style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-input); color: var(--text-primary); box-sizing: border-box;">
      </div>
      
      <div style="margin-bottom:20px;">
        <label style="display:block; margin-bottom:6px; font-size:13px; color: var(--text-secondary);">Notes</label>
        <input type="text" id="sale-notes" placeholder="e.g. Sold to marketplace collector" style="width:100%
, padding:10px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-input); color: var(--text-primary); box-sizing: border-box;">
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" id="btn-close-sale" class="btn-outline" style="padding:10px 16px; border-radius:6px; cursor:pointer;">Cancel</button>
        <button type="button" id="btn-submit-sale" style="padding:10px 16px; background:var(--accent-yellow, #eab308); color:#000; border:none; border-radius:6px; font-weight:600; cursor:pointer;">Confirm Sale</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('btn-close-sale').addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('btn-submit-sale').addEventListener('click', submitSaleRecord);
}

function openSaleModal(card) {
  ensureSaleModalExists();
  document.getElementById('sale-modal-title').innerHTML = `<i class="fas fa-shopping-cart" style="color: var(--accent-yellow);"></i> Sell ${card.name}`;
  document.getElementById('sale-card-id').value = card.id;
  document.getElementById('sale-card-name').value = card.name;
  document.getElementById('sale-card-set').value = card.set;
  document.getElementById('sale-qty').value = 1;
  document.getElementById('sale-qty').max = card.quantity; 
  document.getElementById('sale-price').value = '';
  document.getElementById('sale-notes').value = '';
  
  document.getElementById('modal-sale').style.display = 'block';
}

function submitSaleRecord() {
  const id = document.getElementById('sale-card-id').value;
  const name = document.getElementById('sale-card-name').value;
  const set = document.getElementById('sale-card-set').value;
  const qty = Number(document.getElementById('sale-qty').value);
  const price = document.getElementById('sale-price').value;
  const notes = document.getElementById('sale-notes').value;
  const maxQty = Number(document.getElementById('sale-qty').max);
  
  if (!price || qty <= 0) return alert("Please enter a valid quantity and selling price.");
  if (qty > maxQty) return alert(`Insufficient stock. You only have ${maxQty} pcs available.`);
  
  postData('recordSale', {
    cardId: id,
    name: name,
    set: set,
    quantity: qty,
    price: price,
    notes: notes
  });
  
  document.getElementById('modal-sale').style.display = 'none';
}

// --- Group & Language Dropdown Builder ---
function renderGroups() {
  const grid = document.getElementById('groups-grid');
  const addCardsGroupSelect = document.getElementById('group-select');
  const calc = getCalculatedData();
  
  if(addCardsGroupSelect) {
    addCardsGroupSelect.innerHTML = '<option value="">Select a group...</option>';
    state.groups.forEach(g => {
      addCardsGroupSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`;
    });
  }

  // Safely populate distinct dropdown elements by position in inventory panel
  const inventorySelects = document.querySelectorAll('#view-inventory select');
  if (inventorySelects.length >= 2) {
    const groupSelect = inventorySelects[0];
    const langSelect = inventorySelects[1];

    const currentGroup = groupSelect.value || 'All Groups';
    const currentLang = langSelect.value || 'All Languages';

    let groupOptions = '<option value="All Groups">All Groups</option>';
    state.groups.forEach(g => {
      groupOptions += `<option value="${g.name}">${g.name}</option>`;
    });
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
        <h3 style="margin:0;"><i class="fas fa-box" style="color: var(--accent-yellow); margin-right:6px;"></i>${g.name}</h3>
        <span style="font-size:12px; color: var(--text-secondary);">ID: ${String(g.id).substring(4,10)}</span>
      </div>
      <div class="group-stat-row"><span>Exchange Rate</span><strong>¥1 = Rp ${g.exchangerate || 0}</strong></div>
      <div class="group-stat-row"><span>Total Shipping Fee</span><strong>Rp ${Number(g.shippingfee || 0).toLocaleString('id-ID')}</strong></div>
      <div class="group-stat-row"><span>Cards Tracked</span><strong>${groupDetail.totalCardsInGroup} pcs</strong></div>
    `;
    grid.appendChild(div);
  });
}

function renderSales() {
  const body = document.getElementById('sales-body');
  if(!body) return;
  body.innerHTML = '';

  if(!state.sales || state.sales.length === 0) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-secondary);">No sales recorded yet.</td></tr>`;
    return;
  }

  state.sales.forEach(sale => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sale.date ? new Date(sale.date).toLocaleDateString() : '—'}</td>
      <td><strong>${sale.name || ''}</strong></td>
      <td>${sale.set || ''}</td>
      <td>${sale.cardid ? 'Tracked' : '—'}</td>
      <td>${sale.quantity || 0}</td>
      <td>Rp ${Number(sale.price || 0).toLocaleString('id-ID')}</td>
      <td><span style="color: var(--text-secondary); font-size: 13px;">${sale.notes || '—'}</span></td>
    `;
    body.appendChild(tr);
  });
}