document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  const defaultWorkflows = [
    { id: '1', name: 'Facturación Automática (n8n)', status: true, url: '' },
    { id: '2', name: 'Sincronización Shopify-Lash', status: true, url: '' },
    { id: '3', name: 'AI WhatsApp Assistant', status: false, url: '' }
  ];

  let workflows = JSON.parse(localStorage.getItem('lash_workflows') || JSON.stringify(defaultWorkflows));
  let students = JSON.parse(localStorage.getItem('lash_students') || '[]');
  let settings = JSON.parse(localStorage.getItem('lash_academy_settings') || '{}');
  let selectedChatImage = null; // State for pending chat image

  const PROVIDED_N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYzk3MmE4Zi1jMWI3LTQwMDEtYTM3OC0zNTQ5ZTEyNmMzZDEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYmUxMTBkOWUtNmZiZi00NGVkLWEzYWUtYWMwYTM3OGE1NGE4IiwiaWF0IjoxNzczMzE4Mjc4fQ.SWoFVnUlwqLp04pViVk7-LToSNaIq7fhvfyP7w-c9Pg";

  // --- NAVIGATION ---
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.module-section');

  const goToModule = (moduleId) => {
    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));

    const targetSection = document.getElementById(moduleId);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    const navLink = document.querySelector(`.nav-link[data-module="${moduleId}"]`);
    if (navLink) navLink.classList.add('active');

    if (moduleId === 'workflows') renderWorkflows();
    if (moduleId === 'shopify') syncShopify();
    if (moduleId === 'clients') initAcademyDB();
    if (moduleId === 'comm') updateChatSelect();
    updateOverviewStats();
  };

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('data-module');
      if (target) goToModule(target);
    });
  });

  document.querySelectorAll('.stat-card.clickable').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.getAttribute('data-goto');
      if (target) goToModule(target);
    });
  });

  // --- MODAL SYSTEM ---
  const modal = document.getElementById('modal-container');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const closeModal = () => modal.classList.remove('active');
  const closeBtn = document.querySelector('.close-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  const openModal = (title, html) => {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.classList.add('active');
  };

  // --- SETTINGS ---
  const saveSettings = () => {
    settings = {
      n8nUrl: document.getElementById('n8n-url').value,
      n8nKey: document.getElementById('n8n-key').value,
      shopifyUrl: document.getElementById('shopify-url').value,
      shopifyToken: document.getElementById('shopify-token').value,
      openaiKey: document.getElementById('openai-key').value,
      supabaseUrl: document.getElementById('supabase-url').value,
      supabaseKey: document.getElementById('supabase-key').value,
      pdfMonkeyKey: document.getElementById('pdfmonkey-key').value
    };
    localStorage.setItem('lash_academy_settings', JSON.stringify(settings));
    alert('Configuración guardada!');
    updateStatus();
    updateChatSelect();
  };
  const saveBtn = document.getElementById('save-settings');
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);

  const updateStatus = () => {
    const indicator = document.getElementById('global-status');
    const isConn = settings.shopifyToken && settings.openaiKey && settings.supabaseKey;
    if (indicator) {
      indicator.innerHTML = isConn ? '<span class="dot"></span> Connected' : '<span class="dot" style="background:#666"></span> Partial Setup';
      indicator.style.color = isConn ? '#4CAF50' : '#FF9800';
    }
  };

  // --- SUPABASE CLIENT ---
  const sbFetch = async (endpoint, method = 'GET', body = null) => {
    const sUrl = settings.supabaseUrl || document.getElementById('supabase-url').value;
    const sKey = settings.supabaseKey || document.getElementById('supabase-key').value;

    if (!sUrl || !sKey) return null;

    const baseUrl = sUrl.replace(/\/$/, "");
    const url = `${baseUrl}/rest/v1/${endpoint}`;

    const headers = {
      'apikey': sKey,
      'Authorization': `Bearer ${sKey}`,
      'Content-Type': 'application/json'
    };
    if (method === 'POST') headers['Prefer'] = 'return=representation';

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`${res.status} ${res.statusText} - ${errText}`);
      }
      return res.status === 204 ? true : await res.json();
    } catch (e) {
      console.error('Supabase Error:', e);
      addLog('Supabase Error', e.message, 'error');
      return null;
    }
  };

  // --- OVERVIEW ---
  const updateOverviewStats = async () => {
    const studentCountEl = document.getElementById('stat-students');
    const wfCountEl = document.getElementById('stat-workflows');

    if (wfCountEl) wfCountEl.textContent = workflows.filter(w => w.status).length;

    if (settings.supabaseUrl) {
      const clients = await sbFetch('clients?select=id', 'GET');
      if (clients && studentCountEl) studentCountEl.textContent = clients.length;
    }
  };

  // --- ACADEMY DB ---
  const initAcademyDB = () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const dbActions = document.getElementById('db-actions');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const activeTabId = tab.getAttribute('data-tab');
        document.getElementById(activeTabId).classList.add('active');

        if (activeTabId === 'clients-list') {
          dbActions.innerHTML = '<button class="btn-primary" id="open-add-client"><i class="fa-solid fa-user-plus"></i> Nuevo Cliente</button>';
          document.getElementById('open-add-client').addEventListener('click', openAddClientModal);
          renderClients();
        } else {
          dbActions.innerHTML = '<button class="btn-primary" id="open-add-product"><i class="fa-solid fa-plus"></i> Nuevo Item</button>';
          document.getElementById('open-add-product').addEventListener('click', openAddCatalogModal);
          renderCatalog();
        }
      });
    });

    renderClients();
    const addClientBtn = document.getElementById('open-add-client');
    if (addClientBtn) addClientBtn.addEventListener('click', openAddClientModal);
  };

  const renderClients = async () => {
    const container = document.getElementById('client-list-container');
    if (!container) return;
    container.innerHTML = '<tr><td colspan="5" class="empty-msg">Cargando cerebros...</td></tr>';
    const data = await sbFetch('clients?select=*&order=created_at.desc');
    if (!data || data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" class="empty-msg">No hay clientes.</td></tr>';
      return;
    }
    container.innerHTML = data.map(c => `
      <tr>
        <td><b>${c.full_name}</b><br><small>${c.email || ''}</small></td>
        <td>${c.city || '-'}</td>
        <td>${c.phone || '-'}<br><small>IG: ${c.instagram || '-'}</small></td>
        <td><span class="badge ${c.status === 'Active' ? 'success' : 'warning'}">${c.status}</span></td>
        <td><button class="btn-icon" onclick="deleteClient('${c.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('');
  };

  const openAddClientModal = () => {
    openModal('Registrar Nuevo Cliente', `
      <div class="input-group"><label>Nombre Completo</label><input type="text" id="new-c-name"></div>
      <div class="grid-2-col">
        <div class="input-group"><label>Email</label><input type="email" id="new-c-email"></div>
        <div class="input-group"><label>Teléfono</label><input type="text" id="new-c-phone"></div>
      </div>
      <div class="grid-2-col">
        <div class="input-group"><label>Instagram</label><input type="text" id="new-c-ig" placeholder="@usuario"></div>
        <div class="input-group"><label>Ciudad</label><input type="text" id="new-c-city"></div>
      </div>
      <div class="input-group"><label>Notas</label><textarea id="new-c-notes" rows="3" style="width:100%"></textarea></div>
      <button class="btn-primary" onclick="saveNewClient()">Guardar en Supabase</button>
    `);
  };

  window.saveNewClient = async () => {
    const body = {
      full_name: document.getElementById('new-c-name').value,
      email: document.getElementById('new-c-email').value,
      phone: document.getElementById('new-c-phone').value,
      instagram: document.getElementById('new-c-ig').value,
      city: document.getElementById('new-c-city').value,
      notes: document.getElementById('new-c-notes').value
    };
    if (!body.full_name) return alert('El nombre es obligatorio');
    const res = await sbFetch('clients', 'POST', body);
    if (res) { closeModal(); renderClients(); updateOverviewStats(); }
  };

  window.deleteClient = async (id) => {
    if (!confirm('¿Seguro?')) return;
    const res = await sbFetch(`clients?id=eq.${id}`, 'DELETE');
    if (res) renderClients();
  };

  const renderCatalog = async () => {
    const container = document.getElementById('catalog-list-container');
    if (!container) return;
    container.innerHTML = '<tr><td colspan="5" class="empty-msg">Cargando catálogo...</td></tr>';
    const data = await sbFetch('productos_agencia?select=*&order=id.desc');
    if (!data || data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" class="empty-msg">Vaciado.</td></tr>';
      return;
    }
    container.innerHTML = data.map(v => `
      <tr>
        <td><b>${v.nombre || '-'}</b></td>
        <td>${v.categoria || '-'}</td>
        <td>€${v.precio_eur || 0}</td>
        <td><span class="badge success">Activo</span></td>
        <td><button class="btn-icon" onclick="deleteCatalog('${v.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('');
  };

  const openAddCatalogModal = () => {
    openModal('Añadir al Catálogo', `
      <div class="input-group"><label>Nombre del Item</label><input type="text" id="new-v-name"></div>
      <div class="input-group"><label>Tipo</label>
        <select id="new-v-type" class="chat-select" style="width:100%">
          <option value="Formation">Formación</option>
          <option value="Service">Servicio</option>
          <option value="Product">Producto Físico</option>
        </select>
      </div>
      <div class="input-group"><label>Precio (€)</label><input type="number" id="new-v-price"></div>
      <div class="input-group"><label>Descripción</label><input type="text" id="new-v-description"></div>
      <button class="btn-primary" onclick="saveNewCatalog()">Añadir</button>
    `);
  };

  window.saveNewCatalog = async () => {
    const body = {
      nombre: document.getElementById('new-v-name').value,
      categoria: document.getElementById('new-v-type').value,
      precio_eur: document.getElementById('new-v-price').value,
      marca: 'Lash Academy'
    };
    if (!body.nombre) return alert('El nombre es obligatorio');
    const res = await sbFetch('productos_agencia', 'POST', body);
    if (res) { closeModal(); renderCatalog(); }
  };

  window.deleteCatalog = async (id) => {
    if (!confirm('¿Eliminar?')) return;
    const res = await sbFetch(`productos_agencia?id=eq.${id}`, 'DELETE');
    if (res) renderCatalog();
  };

  // --- WORKFLOWS logic ---
  const renderWorkflows = () => {
    const container = document.getElementById('workflow-list-container');
    if (!container) return;
    container.innerHTML = workflows.map(wf => `
      <div class="workflow-card">
        <div class="wf-info"><h4>${wf.name}</h4><p>${wf.status ? 'Activo' : 'Pausado'}</p></div>
        <div style="display:flex; align-items:center; gap:15px;">
          <button class="btn-icon" onclick="deleteWorkflow('${wf.id}')"><i class="fa-solid fa-trash"></i></button>
          <label class="switch"><input type="checkbox" ${wf.status ? 'checked' : ''} onchange="toggleWorkflow('${wf.id}')"><span class="slider"></span></label>
        </div>
      </div>
    `).join('');
  };

  window.deleteWorkflow = (id) => {
    workflows = workflows.filter(w => w.id !== id);
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    renderWorkflows();
    updateChatSelect();
  };

  window.toggleWorkflow = (id) => {
    const wf = workflows.find(w => w.id === id);
    if (wf) wf.status = !wf.status;
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    renderWorkflows();
    updateChatSelect();
  };

  const addWfBtn = document.getElementById('open-add-workflow');
  if (addWfBtn) addWfBtn.addEventListener('click', () => {
    openModal('Añadir Workflow Manual', `
      <div class="input-group"><label>Nombre</label><input type="text" id="new-wf-name" placeholder="Ej: Chat de n8n"></div>
      <div class="input-group"><label>Webhook URL / Chat URL</label><input type="text" id="new-wf-url" placeholder="https://..."></div>
      <button class="btn-primary" onclick="saveNewWorkflow()">Guardar</button>
    `);
  });

  window.saveNewWorkflow = () => {
    const name = document.getElementById('new-wf-name').value;
    const url = document.getElementById('new-wf-url').value;
    if (!name) return;
    workflows.push({ id: `manual-${Date.now()}`, name, url, status: true });
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    closeModal();
    renderWorkflows();
    updateChatSelect();
  };

  // --- COMM HUB Logic ---
  const updateChatSelect = () => {
    const chatSelect = document.getElementById('chat-workflow-select');
    if (!chatSelect) return;
    const activeWebhooks = workflows.filter(w => w.status && w.url);
    chatSelect.innerHTML = '<option value="">Seleccionar Canal...</option>' +
      activeWebhooks.map(w => `<option value="${w.url}">${w.name}</option>`).join('');
  };

  const addChatChannelBtn = document.getElementById('add-chat-channel');
  if (addChatChannelBtn) {
    addChatChannelBtn.addEventListener('click', () => {
      openModal('Añadir Canal de Chat (n8n)', `
          <div class="input-group"><label>Nombre del Canal</label><input type="text" id="hub-name" placeholder="Ej: Soporte Marbella"></div>
          <div class="input-group"><label>URL de Chat (Copia de n8n)</label><input type="text" id="hub-url" placeholder="https://.../chat"></div>
          <button class="btn-primary" onclick="saveChatHub()">Conectar Canal</button>
        `);
    });
  }

  window.saveChatHub = () => {
    const name = document.getElementById('hub-name').value;
    const url = document.getElementById('hub-url').value;
    if (!name || !url) return;
    workflows.push({ id: `chat-${Date.now()}`, name, url, status: true });
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    closeModal();
    updateChatSelect();
    alert('Canal añadido con éxito');
  };

  // --- IMAGE HANDLING ---
  const chatImageInput = document.getElementById('chat-image-input');
  const triggerImageUpload = document.getElementById('trigger-image-upload');
  const imagePreviewArea = document.getElementById('chat-image-preview');

  if (triggerImageUpload) triggerImageUpload.addEventListener('click', () => chatImageInput.click());

  if (chatImageInput) {
    chatImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          selectedChatImage = event.target.result; // Base64
          imagePreviewArea.innerHTML = `<img src="${selectedChatImage}" class="preview-thumb"> <button class="btn-icon" onclick="clearSelectedImage()">&times;</button>`;
          imagePreviewArea.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  window.clearSelectedImage = () => {
    selectedChatImage = null;
    imagePreviewArea.style.display = 'none';
    chatImageInput.value = '';
  };

  const sendChatBtn = document.getElementById('send-chat');
  if (sendChatBtn) {
    sendChatBtn.addEventListener('click', async () => {
      const input = document.getElementById('chat-input');
      const text = input.value;
      const url = document.getElementById('chat-workflow-select').value;
      if ((!text && !selectedChatImage) || !url) return;

      const chatBox = document.getElementById('chat-messages');
      const userMsg = document.createElement('div');
      userMsg.className = 'chat-msg user';

      // Show text + image in UI
      if (selectedChatImage) {
        userMsg.innerHTML = `<img src="${selectedChatImage}" class="chat-img"><br>${text}`;
      } else {
        userMsg.textContent = text;
      }

      chatBox.appendChild(userMsg);
      const currentMsg = text;
      const currentImg = selectedChatImage;

      input.value = '';
      clearSelectedImage();
      chatBox.scrollTop = chatBox.scrollHeight;

      try {
        const requestHeaders = { 'Content-Type': 'application/json' };
        const n8nKey = settings.n8nKey || document.getElementById('n8n-key').value;
        if (n8nKey) {
          requestHeaders['Authorization'] = `Bearer ${n8nKey}`;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({
            chatInput: currentMsg,
            message: currentMsg,
            sender: 'Lash-Dashboard',
            filedata: currentImg // Sending base64 if present
          })
        });

        if (res.ok) {
          const data = await res.json();
          const aiMsg = document.createElement('div');
          aiMsg.className = 'chat-msg n8n';
          aiMsg.textContent = data.output || data.response || data.text || (typeof data === 'string' ? data : 'Mensaje enviado.');
          chatBox.appendChild(aiMsg);
          chatBox.scrollTop = chatBox.scrollHeight;
        } else {
          const errText = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
      } catch (e) {
        console.error('Chat error:', e);
        const sysMsg = document.createElement('div');
        sysMsg.className = 'chat-msg system';
        sysMsg.textContent = 'Error de conexión con n8n.';
        chatBox.appendChild(sysMsg);
      }
    });
  }

  // --- INIT ---
  const loadInitialSettings = () => {
    Object.keys(settings).forEach(key => {
      const input = document.getElementById(key.replace(/([A-Z])/g, '-$1').toLowerCase());
      if (input) input.value = settings[key];
    });
    if (!document.getElementById('n8n-url').value) document.getElementById('n8n-url').value = 'https://lash-academy-agentes-n8n.ed2taz.easypanel.host';
    if (!document.getElementById('n8n-key').value) document.getElementById('n8n-key').value = PROVIDED_N8N_KEY;
    updateStatus();
    updateOverviewStats();
    updateChatSelect();
  };

  const syncShopify = () => {
    const salesStat = document.getElementById('stat-sales');
    if (salesStat) salesStat.textContent = '€14,820.00';
  };

  const addLog = (type, msg, status) => {
    const entry = document.createElement('div');
    entry.className = `log-entry ${status}`;
    entry.innerHTML = `<b>[${type}]</b> ${new Date().toLocaleTimeString()} - ${msg}`;
    const logs = document.getElementById('error-logs');
    if (logs) logs.prepend(entry);
  };

  loadInitialSettings();
});
