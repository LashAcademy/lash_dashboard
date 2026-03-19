document.addEventListener('DOMContentLoaded', () => {
  // --- CONFIGURATION ---
  const API_CONFIG = {
    supabaseUrl: 'https://izbnnfwvovtfcggkukxn.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6Ym5uZnd2b3Z0ZmNnZ2t1a3huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTg0NzksImV4cCI6MjA4ODg5NDQ3OX0.AuPUOjolOFiUgd4guRpR_pM3AyZ4-CGKqs3HRDmse3w',
    n8nUrl: 'https://lash-academy-agentes-n8n.ed2taz.easypanel.host',
    n8nKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYzk3MmE4Zi1jMWI3LTQwMDEtYTM3OC0zNTQ5ZTEyNmMzZDEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMWFiY2QwMzQtNTBkNC00NjMyLTk1MzAtYjEzZTJmMzU4YmU4IiwiaWF0IjoxNzczODY0NjQ2fQ.CZCLM9ClUZMQ1PF9LNShSj9Pm7gVhAYD17fvwp8QKp8',
    openaiKey: localStorage.getItem('lash_openai_key') || ''
  };

  // --- WORKFLOWS CACHE SECURE ---
  // Obtenidos del nodo en despliegue. n8n API principal bloquea conexiones front-end por CORS y seguridad.
  let staticWorkflows = [
    { id: 'BNcQWCNCLUFosdRb', name: 'Lash Solo Chat', active: true, webhookId: 'd4a965e7-dc9e-47a3-9520-5fe360eda87c' },
    { id: 'TELEGRAM', name: 'Telegram Facturas', active: true, webhookId: '6d4ec6c4-4da2-450e-b41b-241c2f9ff550' },
    { id: 'FACT_AUTO', name: 'Facturacion Automatica', active: true },
    { id: 'FACT_ENV', name: 'Envío de Facturas Lash Academy', active: false }
  ];

  let students = JSON.parse(localStorage.getItem('lash_students') || '[]');
  let selectedChatImage = null; // State for pending chat image

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

  // --- GLOBAL STATUS ---
  const updateStatus = () => {
    const indicator = document.getElementById('global-status');
    if (indicator) {
      indicator.innerHTML = '<span class="dot"></span> Connected APIs';
      indicator.style.color = '#4CAF50';
    }
  };

  // --- SUPABASE CLIENT ---
  const sbFetch = async (endpoint, method = 'GET', body = null) => {
    const sUrl = API_CONFIG.supabaseUrl;
    const sKey = API_CONFIG.supabaseKey;

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

    if (wfCountEl) wfCountEl.textContent = staticWorkflows.filter(w => w.active).length;

    if (API_CONFIG.supabaseUrl) {
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
    container.innerHTML = '<tr><td colspan="6" class="empty-msg">Cargando cerebros...</td></tr>';
    const data = await sbFetch('clients?select=*&order=created_at.desc');
    if (!data || data.length === 0) {
      container.innerHTML = '<tr><td colspan="6" class="empty-msg">No hay clientes.</td></tr>';
      return;
    }
    container.innerHTML = data.map(c => {
      const b64Data = btoa(unescape(encodeURIComponent(JSON.stringify(c))));
      return `
      <tr>
        <td><b>${c.full_name}</b><br><small>${c.email || ''}</small></td>
        <td>${c.city || '-'}</td>
        <td>${c.phone || '-'}<br><small>IG: ${c.instagram || '-'}</small></td>
        <td><span class="badge ${c.status === 'Active' ? 'success' : 'warning'}">${c.status}</span></td>
        <td>
          <button class="btn-secondary" style="padding: 5px 10px; font-size: 0.8rem;" onclick="generateClientInsight('${b64Data}')">
            <i class="fa-solid fa-bolt" style="color:var(--primary-gold)"></i> AI Predict
          </button>
        </td>
        <td><button class="btn-icon" onclick="deleteClient('${c.id}')"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `}).join('');
  };

  window.generateClientInsight = async (b64Data) => {
    const client = JSON.parse(decodeURIComponent(escape(atob(b64Data)))); /* Base64 to Object */

    let oaiKey = API_CONFIG.openaiKey || localStorage.getItem('lash_openai_key');
    if (!oaiKey) {
      oaiKey = prompt('Seguridad de GitHub: Inserta tu clave de OpenAI para el modo CRM Predictivo (sk-proj-...):');
      if (oaiKey) {
        localStorage.setItem('lash_openai_key', oaiKey);
        API_CONFIG.openaiKey = oaiKey;
      } else return;
    }

    openModal(`Analizando a ${client.full_name}...`, '<div style="text-align:center; padding: 2rem;"><i class="fa-solid fa-brain fa-spin fa-2x"></i><p style="margin-top:1rem; color: var(--text-secondary);">Calculando modelo predictivo estratégico (Upsell y LTV)...</p></div>');

    try {
      const stockRes = await sbFetch('productos_agencia?select=nombre,categoria,precio_eur');
      const stockTxt = stockRes ? stockRes.map(s => `${s.nombre} (€${s.precio_eur})`).join(', ') : 'Catálogo temporalmente no disponible';

      const prompt = `Analiza estratégicamente el perfil de esta clienta/alumna de Lash Academy Marbella. Historial del sistema: ${JSON.stringify(client)}. Basándote en sus datos y combinándolo de manera inteligente con nuestro catálogo actual de servicios y formaciones: [${stockTxt}], redacta un breve pitch comercial persuasivo (3 líneas de WhatsApp) sugiriéndole el próximo servicio que debería comprarnos para hacer un 'upsell'. Justifica psicologicamente por qué lo necesita. Finalmente incluye una estimación en euros de su 'Lifetime Value' (LTV) potencial. Usa tono premium.`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_CONFIG.openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: prompt }], temperature: 0.7 })
      });

      const data = await res.json();
      if (res.ok && data.choices) {
        openModal(`🎯 CRM Predictivo: ${client.full_name}`, `<div style="font-size:0.95rem; line-height: 1.6; color:var(--text-primary); border-left: 3px solid var(--primary-gold); padding-left: 15px; margin-bottom:20px;">${data.choices[0].message.content.replace(/\\n/g, '<br>')}</div><div style="display:flex; gap:10px;"><button class="btn-primary" onclick="window.open('https://wa.me/${client.phone || ''}?text=Hola ${encodeURIComponent(client.full_name.split(' ')[0])}')"><i class="fa-brands fa-whatsapp"></i> Hablarle por WhatsApp</button></div>`);
      } else {
        openModal('Error de Predicción', `<p style="color:#F44336">Error AI: ${data.error?.message || 'Rechazado'}</p>`);
      }
    } catch (e) { openModal('Error', '<p>Error contactando al servidor maestro AI.</p>'); }
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
  const renderWorkflows = async () => {
    const container = document.getElementById('workflow-list-container');
    if (!container) return;

    const wfCountEl = document.getElementById('stat-workflows');
    if (wfCountEl) wfCountEl.textContent = staticWorkflows.filter(w => w.active).length;

    container.innerHTML = staticWorkflows.map(wf => `
      <div class="workflow-card">
        <div class="wf-info">
          <h4>${wf.name}</h4>
          <p>${wf.active ? 'Activo (n8n)' : 'Pausado'}</p>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          <button class="btn-icon" onclick="window.open('${API_CONFIG.n8nUrl}/workflow/${wf.id}', '_blank')" title="Ir a n8n"><i class="fa-solid fa-external-link"></i></button>
          <label class="switch">
            <input type="checkbox" ${wf.active ? 'checked' : ''} onclick="alert('Seguridad activada. Debes cambiar el estado manualmente en la plataforma de n8n para evitar CORS browsers. ¡Atajo en el icono de al lado!'); return false;">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `).join('');

    updateChatSelect();
  };

  window.toggleWorkflow = () => { };

  // BOTÓN "New Workflow"
  const addWfBtn = document.getElementById('open-add-workflow');
  if (addWfBtn) addWfBtn.addEventListener('click', () => {
    window.open(`${API_CONFIG.n8nUrl}/workflow/new`, '_blank');
  });

  window.saveNewWorkflow = () => {
    // Ya no se usa local, redirigimos a n8n
    closeModal();
  };

  // --- COMM HUB Logic ---
  const updateChatSelect = () => {
    const chatSelect = document.getElementById('chat-workflow-select');
    if (!chatSelect) return;

    const chatChannels = [];
    staticWorkflows.forEach(wf => {
      if (!wf.active || !wf.webhookId) return;
      chatChannels.push({
        name: wf.name,
        url: `${API_CONFIG.n8nUrl}/webhook/${wf.webhookId}/chat`
      });
    });

    const manualChannels = JSON.parse(localStorage.getItem('lash_manual_chats') || '[]');

    chatSelect.innerHTML = '<option value="">Seleccionar Canal de n8n...</option>' +
      chatChannels.map(w => `<option value="${w.url}">🤖 ${w.name}</option>`).join('') +
      manualChannels.map(w => `<option value="${w.url}">💬 ${w.name} (Manual)</option>`).join('');
  };

  const addChatChannelBtn = document.getElementById('add-chat-channel');
  if (addChatChannelBtn) {
    addChatChannelBtn.addEventListener('click', () => {
      openModal('Añadir Canal Manual Externo', `
          <div class="input-group"><label>Nombre del Canal</label><input type="text" id="hub-name" placeholder="Ej: Soporte Marbella"></div>
          <div class="input-group"><label>URL del Webhook (n8n u otra IA)</label><input type="text" id="hub-url" placeholder="https://.../webhook/..."></div>
          <button class="btn-primary" onclick="saveChatHub()">Añadir Canal</button>
        `);
    });
  }

  window.saveChatHub = () => {
    const name = document.getElementById('hub-name').value;
    const url = document.getElementById('hub-url').value;
    if (!name || !url) return;
    const manualChannels = JSON.parse(localStorage.getItem('lash_manual_chats') || '[]');
    manualChannels.push({ id: `chat-${Date.now()}`, name, url });
    localStorage.setItem('lash_manual_chats', JSON.stringify(manualChannels));
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
        const n8nKey = API_CONFIG.n8nKey;
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
    updateStatus();
    updateOverviewStats();
    renderWorkflows(); // Fetch Real n8n workflows 
  };

  // --- OMNIBAR AI LOGIC ---
  const omniInput = document.getElementById('omnibar-input');
  const omniBtn = document.getElementById('omnibar-btn');

  const processOmniSearch = async () => {
    const text = omniInput.value.trim();
    if (!text) return;

    let oaiKey = API_CONFIG.openaiKey || localStorage.getItem('lash_openai_key');
    if (!oaiKey) {
      oaiKey = prompt('Seguridad de GitHub: Inserta tu clave de OpenAI (sk-proj-...) para habilitar la OmniBar AI:');
      if (oaiKey) {
        localStorage.setItem('lash_openai_key', oaiKey);
        API_CONFIG.openaiKey = oaiKey;
      } else return;
    }

    omniInput.value = '';
    openModal('OmniBar AI (Buscando...)', '<div style="text-align:center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:1rem; color: var(--text-secondary);">Barriendo bases de datos...</p></div>');

    try {
      const stockRes = await sbFetch('productos_agencia?select=nombre,categoria,precio_eur');
      const clientsRes = await sbFetch('clients?select=full_name,city,status');

      const stockTxt = stockRes ? stockRes.map(s => `${s.nombre} (€${s.precio_eur})`).join(', ') : 'ND';
      const clientsTxt = clientsRes ? clientsRes.map(c => `${c.full_name} (${c.status})`).join(', ') : 'ND';

      const prompt = `Eres la IA Omnipotente (OmniBar) integrada en la cima del dashboard de "Lash Academy Marbella". Responde de forma ultra-directa (como un asistente de comando militar y resolutivo) a esta petición del dueño:\n\nPetición: "${text}"\n\nDatos inyectados en tiempo real:\nALMACÉN: ${stockTxt}\nALUMNOS: ${clientsTxt}`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_CONFIG.openaiKey}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: prompt }], temperature: 0.2 })
      });

      const data = await res.json();
      if (res.ok && data.choices) {
        openModal(`🔎 Respuesta: "${text}"`, `<div style="font-size:1.05rem; line-height: 1.6; color:var(--text-primary);">${data.choices[0].message.content.replace(/\\n/g, '<br>')}</div>`);
      } else {
        openModal('Error de Asistente', `<p style="color:#F44336">Error: ${data.error?.message || 'Cifrado'}</p>`);
      }
    } catch (e) {
      openModal('Error de Enlace', '<p>Caída temporal de la red backend.</p>');
    }
  };

  if (omniBtn) omniBtn.addEventListener('click', processOmniSearch);
  if (omniInput) {
    omniInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') processOmniSearch();
    });
  }

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

  // --- AI ADVISOR (OPENAI) ---
  const aiInput = document.getElementById('ai-advisor-input');
  const aiBtn = document.getElementById('send-ai-advisor');
  const aiBox = document.getElementById('ai-advisor-chat');

  if (aiBtn) {
    aiBtn.addEventListener('click', async () => {
      let oaiKey = API_CONFIG.openaiKey || localStorage.getItem('lash_openai_key');
      if (!oaiKey) {
        oaiKey = prompt('Seguridad de GitHub: No podemos guardar tu clave de OpenAI pública en el código. Por favor pega tu clave de OpenAI (sk-proj-...) para habilitar el agente en tu navegador:');
        if (oaiKey) {
          localStorage.setItem('lash_openai_key', oaiKey);
          API_CONFIG.openaiKey = oaiKey;
        } else {
          return;
        }
      }

      const text = aiInput.value.trim();
      if (!text) return;

      aiBox.innerHTML += `<div class="chat-msg user">${text}</div>`;
      aiInput.value = '';
      aiBox.scrollTop = aiBox.scrollHeight;

      let stockContext = "Datos de stock no disponibles.";
      let clientsContext = "Datos de clientes no disponibles.";

      try {
        const stockData = await sbFetch('productos_agencia?select=nombre,categoria,precio_eur');
        if (stockData && stockData.length > 0) {
          stockContext = stockData.map(s => `- ${s.nombre} (${s.categoria}): €${s.precio_eur}`).join('\n');
        }

        const clientsData = await sbFetch('clients?select=full_name,city,status');
        if (clientsData && clientsData.length > 0) {
          clientsContext = clientsData.map(c => `- ${c.full_name} (${c.city}): Estado ${c.status}`).join('\n');
        }
      } catch (e) { console.error(e); }

      aiBox.innerHTML += `<div class="chat-msg system" id="typing-ai"><i class="fa-solid fa-spinner fa-spin"></i> Analizando base de datos...</div>`;
      aiBox.scrollTop = aiBox.scrollHeight;

      try {
        const systemPrompt = `Eres el AI Advisor privado de Lash Academy Marbella. Aquí tienes los datos en tiempo real de la base de datos central. Úsalos para responder precisamentre a la consulta del usuario.\n\nINVENTARIO Y SERVICIOS:\n${stockContext}\n\nESTADO DE CLIENTES:\n${clientsContext}\n\nResponde de manera amable, concisa y muy resolutiva.`;

        const payload = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
          ],
          temperature: 0.7
        };

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.openaiKey}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        const typingEl = document.getElementById('typing-ai');
        if (typingEl) typingEl.remove();

        if (res.ok && data.choices && data.choices[0]) {
          aiBox.innerHTML += `<div class="chat-msg n8n" style="background:#222; border-left: 3px solid var(--primary-gold);">${data.choices[0].message.content.replace(/\n/g, '<br>')}</div>`;
        } else {
          aiBox.innerHTML += `<div class="chat-msg system">Error procesando con OpenAI: ${data.error?.message || 'Desconocido'}</div>`;
        }
      } catch (e) {
        const typingEl = document.getElementById('typing-ai');
        if (typingEl) typingEl.remove();
        aiBox.innerHTML += `<div class="chat-msg system">Error de red conectando con OpenAI.</div>`;
      }
      aiBox.scrollTop = aiBox.scrollHeight;
    });

    aiInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') aiBtn.click();
    });
  }

  loadInitialSettings();
});
