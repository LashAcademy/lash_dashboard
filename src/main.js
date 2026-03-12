document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let workflows = JSON.parse(localStorage.getItem('lash_workflows') || '[]');
  let settings = JSON.parse(localStorage.getItem('lash_academy_settings') || '{}');

  // --- NAVIGATION ---
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.module-section');

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('data-module');
      if (!target) return;
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      sections.forEach(s => s.classList.remove('active'));
      document.getElementById(target).classList.add('active');
      if (target === 'workflows') renderWorkflows();
      if (target === 'shopify') syncShopify();
    });
  });

  // --- MODAL SYSTEM ---
  const modal = document.getElementById('modal-container');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const closeModal = () => modal.classList.remove('active');
  document.querySelector('.close-modal').addEventListener('click', closeModal);

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
      supabaseKey: document.getElementById('supabase-key').value
    };
    localStorage.setItem('lash_academy_settings', JSON.stringify(settings));
    alert('Configuración guardada!');
    updateStatus();
  };
  document.getElementById('save-settings').addEventListener('click', saveSettings);

  const updateStatus = () => {
    const indicator = document.getElementById('global-status');
    const isConn = settings.shopifyToken && settings.n8nKey;
    indicator.innerHTML = isConn ? '<span class="dot"></span> Connected' : '<span class="dot" style="background:#666"></span> Disconnected';
    indicator.style.color = isConn ? '#4CAF50' : '#666';
  };

  // --- WORKFLOW CRUD ---
  const renderWorkflows = () => {
    const container = document.getElementById('workflow-list-container');
    if (workflows.length === 0) {
      container.innerHTML = '<p class="empty-msg">No hay workflows. Crea uno nuevo.</p>';
      return;
    }
    container.innerHTML = workflows.map(wf => `
      <div class="workflow-card">
        <div class="wf-info">
          <h4>${wf.name}</h4>
          <p>${wf.status ? 'Activo' : 'Pausado'}</p>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          <button class="btn-icon" onclick="editWorkflow('${wf.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon delete" onclick="deleteWorkflow('${wf.id}')"><i class="fa-solid fa-trash"></i></button>
          <label class="switch">
            <input type="checkbox" ${wf.status ? 'checked' : ''} onchange="toggleWorkflow('${wf.id}')">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `).join('');
  };

  window.deleteWorkflow = (id) => {
    workflows = workflows.filter(w => w.id !== id);
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    renderWorkflows();
  };

  window.toggleWorkflow = (id) => {
    const wf = workflows.find(w => w.id === id);
    if (wf) wf.status = !wf.status;
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    renderWorkflows();
  };

  document.getElementById('open-add-workflow').addEventListener('click', () => {
    openModal('Añadir Workflow', `
      <div class="input-group">
        <label>Nombre</label>
        <input type="text" id="new-wf-name" placeholder="Ej: Facturas WhatsApp">
      </div>
      <div class="input-group">
        <label>Endpoint / n8n ID</label>
        <input type="text" id="new-wf-url" placeholder="webhook-id-o-url">
      </div>
      <button class="btn-primary" onclick="saveNewWorkflow()">Guardar Workflow</button>
    `);
  });

  window.saveNewWorkflow = () => {
    const name = document.getElementById('new-wf-name').value;
    const url = document.getElementById('new-wf-url').value;
    if (!name || !url) return;
    workflows.push({ id: Date.now().toString(), name, url, status: true });
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    closeModal();
    renderWorkflows();
  };

  // --- SHOPIFY INTEGRATION ---
  const syncShopify = async () => {
    if (!settings.shopifyToken || !settings.shopifyUrl) return;
    const ordersList = document.getElementById('shopify-orders-list');
    ordersList.innerHTML = '<p>Sincronizando...</p>';

    try {
      // Proxy/Handle real API calls here. For now, mock based on real structure
      setTimeout(() => {
        ordersList.innerHTML = `
          <div class="log-entry"><b>#1042</b> - María G. - €150.00 <span class="badge success">Paid</span></div>
          <div class="log-entry"><b>#1041</b> - Juan P. - €85.00 <span class="badge success">Paid</span></div>
        `;
        document.querySelector('.stat-card .value').textContent = '€14,820.00';
      }, 1000);
    } catch (e) {
      ordersList.innerHTML = '<p class="error">Error de conexión.</p>';
    }
  };
  document.getElementById('sync-shopify').addEventListener('click', syncShopify);

  // --- VECTOR DB ---
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-upload');

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleUpload(e.target.files[0]));

  const handleUpload = async (file) => {
    if (!file) return;
    const status = document.getElementById('upload-status');
    status.innerHTML = `<div class="log-entry">Leyendo archivo ${file.name}...</div>`;

    if (!settings.openaiKey || !settings.supabaseUrl || !settings.supabaseKey) {
      status.innerHTML += `<div class="log-entry error">Faltan credenciales de OpenAI o Supabase en Settings.</div>`;
      return;
    }

    try {
      const text = await file.text();
      // Simple chunking (split by paragraphs)
      const chunks = text.split('\n\n').filter(c => c.trim().length > 10);
      status.innerHTML += `<div class="log-entry">Generando vectores para ${chunks.length} fragmentos...</div>`;

      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i].trim();

        // 1. OpenAI Embedding (text-embedding-3-small)
        const openAiRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: chunkContent,
            model: "text-embedding-3-small"
          })
        });

        if (!openAiRes.ok) throw new Error('Error al conectar con OpenAI');
        const openAiData = await openAiRes.json();
        const embedding = openAiData.data[0].embedding;

        // 2. Supabase Insert (Supabase requires a table with a vector column, e.g., 'documents' table with 'content' and 'embedding')
        const supaRes = await fetch(`${settings.supabaseUrl}/rest/v1/documents`, {
          method: 'POST',
          headers: {
            'apikey': settings.supabaseKey,
            'Authorization': `Bearer ${settings.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            content: chunkContent,
            embedding: embedding,
            metadata: { source: file.name, chunk_id: i }
          })
        });

        if (!supaRes.ok) throw new Error(`Error al guardar en Supabase (Chunk ${i})`);
      }

      status.innerHTML += `<div class="log-entry success"><i class="fa-solid fa-check"></i> ${chunks.length} vectores guardados exitosamente en Supabase.</div>`;
      addLog('Vectorización', `Se han procesado ${chunks.length} fragmentos de ${file.name}`, 'success');

    } catch (error) {
      console.error(error);
      status.innerHTML += `<div class="log-entry error">Aviso: ${error.message}. (Asegúrate de que la tabla 'documents' existe en Supabase).</div>`;
      addLog('Error Vector', error.message, 'error');
    }
  };

  const addLog = (type, msg, status) => {
    const errorContainer = document.getElementById('error-logs');
    const entry = document.createElement('div');
    entry.className = `log-entry ${status}`;
    entry.innerHTML = `<b>[${type}]</b> ${new Date().toLocaleTimeString()} - ${msg}`;
    errorContainer.prepend(entry);
  };

  // Mock Conversations
  const renderConversations = () => {
    const container = document.getElementById('conversation-summary');
    const mocks = [
      { user: "Juan P.", summary: "Interesado en curso de pestañas para Mayo." },
      { user: "María G.", summary: "Problema con el acceso al curso online." }
    ];
    container.innerHTML = mocks.map(m => `
        <div class="log-entry">
            <b>${m.user}:</b> ${m.summary}
        </div>
    `).join('');
  };

  // --- INIT ---
  const loadInitialSettings = () => {
    if (settings.n8nUrl) document.getElementById('n8n-url').value = settings.n8nUrl;
    if (settings.n8nKey) document.getElementById('n8n-key').value = settings.n8nKey;
    if (settings.shopifyUrl) document.getElementById('shopify-url').value = settings.shopifyUrl;
    if (settings.shopifyToken) document.getElementById('shopify-token').value = settings.shopifyToken;
    if (settings.openaiKey) document.getElementById('openai-key').value = settings.openaiKey;
    if (settings.supabaseUrl) document.getElementById('supabase-url').value = settings.supabaseUrl;
    if (settings.supabaseKey) document.getElementById('supabase-key').value = settings.supabaseKey;
    updateStatus();
    renderWorkflows();
    renderConversations();
  };

  loadInitialSettings();
});
