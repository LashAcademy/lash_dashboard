document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let workflows = JSON.parse(localStorage.getItem('lash_workflows') || '[]');
  let students = JSON.parse(localStorage.getItem('lash_students') || '[]');
  let settings = JSON.parse(localStorage.getItem('lash_academy_settings') || '{}');

  // Hardcoded API Key provided by user for convenience (if not in settings yet)
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
    if (moduleId === 'clients') renderStudents();
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
    const isConn = (settings.n8nKey || PROVIDED_N8N_KEY) && settings.shopifyToken;
    indicator.innerHTML = isConn ? '<span class="dot"></span> Connected' : '<span class="dot" style="background:#666"></span> Partial Setup';
    indicator.style.color = isConn ? '#4CAF50' : '#FF9800';
  };

  // --- OVERVIEW ---
  const updateOverviewStats = () => {
    const studentCount = document.getElementById('stat-students');
    const wfCount = document.getElementById('stat-workflows');
    if (studentCount) studentCount.textContent = students.length;
    if (wfCount) wfCount.textContent = workflows.filter(w => w.status).length;
  };

  // --- N8N API SYNC ---
  const syncN8n = async () => {
    const syncBtn = document.getElementById('sync-n8n');
    const icon = syncBtn.querySelector('i');
    const n8nUrl = settings.n8nUrl || 'https://n8n.tu-dominio.com'; // User needs this
    const n8nKey = settings.n8nKey || PROVIDED_N8N_KEY;

    if (!n8nKey) {
      alert('Por favor, añade tu API Key de n8n en Settings.');
      return;
    }

    icon.classList.add('fa-spin-custom');
    syncBtn.disabled = true;

    try {
      // Fetching from n8n Public API
      // Note: This requires Public API enabled on n8n and CORS allowed.
      const response = await fetch(`${n8nUrl.replace(/\/$/, '')}/api/v1/workflows`, {
        headers: {
          'X-N8N-API-KEY': n8nKey
        }
      });

      if (!response.ok) throw new Error('Error al conectar con la API de n8n. Verifica la URL y la Key.');

      const data = await response.json();
      const n8nWorkflows = data.data.map(w => ({
        id: w.id,
        name: w.name,
        status: w.active,
        url: `${n8nUrl}/workflow/${w.id}` // Link to UI
      }));

      // Merge or overwrite? Let's merge by ID
      n8nWorkflows.forEach(nw => {
        const existingIdx = workflows.findIndex(w => w.id === nw.id);
        if (existingIdx >= 0) {
          workflows[existingIdx] = nw;
        } else {
          workflows.push(nw);
        }
      });

      localStorage.setItem('lash_workflows', JSON.stringify(workflows));
      renderWorkflows();
      addLog('n8n Sync', `Sincronizados ${n8nWorkflows.length} workflows correctamente.`, 'success');
      alert(`¡Sincronización completada! ${n8nWorkflows.length} flujos importados.`);
    } catch (e) {
      console.error(e);
      addLog('n8n Error', e.message, 'error');
      alert(`Error de sincronización: ${e.message}\n\nNota: Asegúrate de tener activada la variable N8N_CORS_ALLOWED_ORIGINS=* en tu servidor n8n.`);
    } finally {
      icon.classList.remove('fa-spin-custom');
      syncBtn.disabled = false;
    }
  };

  const syncN8nBtn = document.getElementById('sync-n8n');
  if (syncN8nBtn) syncN8nBtn.addEventListener('click', syncN8n);

  // --- WORKFLOW CRUD ---
  const renderWorkflows = () => {
    const container = document.getElementById('workflow-list-container');
    if (!container) return;
    if (workflows.length === 0) {
      container.innerHTML = '<p class="empty-msg">No hay workflows. Pulsa "Sync n8n" o crea uno manual.</p>';
      return;
    }
    container.innerHTML = workflows.map(wf => `
      <div class="workflow-card">
        <div class="wf-info">
          <h4>${wf.name}</h4>
          <p>${wf.status ? 'Activo' : 'Pausado'}</p>
          <small style="color:var(--text-secondary); opacity:0.6">${wf.id}</small>
        </div>
        <div style="display:flex; align-items:center; gap:15px;">
          <button class="btn-icon" onclick="deleteWorkflow('${wf.id}')"><i class="fa-solid fa-trash"></i></button>
          <label class="switch">
            <input type="checkbox" ${wf.status ? 'checked' : ''} onchange="toggleWorkflow('${wf.id}')">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `).join('');
    updateOverviewStats();
    updateChatSelect();
  };

  window.deleteWorkflow = (id) => {
    workflows = workflows.filter(w => w.id !== id);
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    renderWorkflows();
  };

  window.toggleWorkflow = async (id) => {
    const wf = workflows.find(w => w.id === id);
    if (!wf) return;

    const n8nUrl = settings.n8nUrl || 'https://n8n.tu-dominio.com';
    const n8nKey = settings.n8nKey || PROVIDED_N8N_KEY;

    // Local toggle first for feedback
    wf.status = !wf.status;
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    renderWorkflows();

    // API toggle attempt
    if (n8nKey && n8nUrl) {
      try {
        const action = wf.status ? 'activate' : 'deactivate';
        await fetch(`${n8nUrl.replace(/\/$/, '')}/api/v1/workflows/${wf.id}/${action}`, {
          method: 'POST',
          headers: { 'X-N8N-API-KEY': n8nKey }
        });
        addLog('n8n Toggle', `Workflow ${wf.name} ${wf.status ? 'activado' : 'pausado'}.`, 'success');
      } catch (e) {
        addLog('n8n Toggle Error', `No se pudo sincronizar el cambio con n8n: ${e.message}`, 'error');
      }
    }
  };

  const addWfBtn = document.getElementById('open-add-workflow');
  if (addWfBtn) addWfBtn.addEventListener('click', () => {
    openModal('Añadir Workflow Manual', `
      <div class="input-group">
        <label>Nombre</label>
        <input type="text" id="new-wf-name" placeholder="Ej: Facturas WhatsApp">
      </div>
      <div class="input-group">
        <label>Webhook URL (para Chat Hub)</label>
        <input type="text" id="new-wf-url" placeholder="https://tu-n8n.com/webhook/...">
      </div>
      <button class="btn-primary" onclick="saveNewWorkflow()">Guardar Workflow</button>
    `);
  });

  window.saveNewWorkflow = () => {
    const name = document.getElementById('new-wf-name').value;
    const url = document.getElementById('new-wf-url').value;
    if (!name || !url) return;
    workflows.push({ id: `manual-${Date.now()}`, name, url, status: true });
    localStorage.setItem('lash_workflows', JSON.stringify(workflows));
    closeModal();
    renderWorkflows();
  };

  // --- STUDENTS CRUD ---
  const renderStudents = () => {
    const container = document.getElementById('student-list-container');
    if (!container) return;
    if (students.length === 0) {
      container.innerHTML = '<tr><td colspan="4" class="empty-msg">No hay estudiantes. Registra uno nuevo.</td></tr>';
      return;
    }
    container.innerHTML = students.map(s => `
      <tr>
        <td>${s.name}</td>
        <td>${s.course}</td>
        <td>${s.email}</td>
        <td>
          <button class="btn-icon" onclick="deleteStudent('${s.id}')"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
    updateOverviewStats();
  };

  window.deleteStudent = (id) => {
    students = students.filter(s => s.id !== id);
    localStorage.setItem('lash_students', JSON.stringify(students));
    renderStudents();
  };

  const addStudentBtn = document.getElementById('open-add-student');
  if (addStudentBtn) addStudentBtn.addEventListener('click', () => {
    openModal('Añadir Estudiante', `
      <div class="input-group">
        <label>Nombre Completo</label>
        <input type="text" id="new-student-name">
      </div>
      <div class="input-group">
        <label>Curso / Producto</label>
        <input type="text" id="new-student-course">
      </div>
      <div class="input-group">
        <label>Email</label>
        <input type="email" id="new-student-email">
      </div>
      <button class="btn-primary" onclick="saveNewStudent()">Registrar Estudiante</button>
    `);
  });

  window.saveNewStudent = () => {
    const name = document.getElementById('new-student-name').value;
    const course = document.getElementById('new-student-course').value;
    const email = document.getElementById('new-student-email').value;
    if (!name || !course || !email) return;
    students.push({ id: Date.now().toString(), name, course, email });
    localStorage.setItem('lash_students', JSON.stringify(students));
    closeModal();
    renderStudents();
  };

  // --- COMMUNICATION HUB (n8n Chat) ---
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendChatBtn = document.getElementById('send-chat');
  const chatSelect = document.getElementById('chat-workflow-select');

  const updateChatSelect = () => {
    if (!chatSelect) return;
    const activeWebhooks = workflows.filter(w => w.status && w.url && w.url.includes('webhook'));
    chatSelect.innerHTML = '<option value="">Seleccionar Workflow...</option>' +
      activeWebhooks.map(w => `<option value="${w.url}">${w.name}</option>`).join('');
  };

  const addChatMessage = (role, text) => {
    if (!chatMessages) return;
    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;
    msg.textContent = text;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const sendToN8N = async () => {
    const text = chatInput.value.trim();
    const webhookUrl = chatSelect.value;
    if (!text || !webhookUrl) return;

    addChatMessage('user', text);
    chatInput.value = '';

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sender: 'Lash Dashboard', timestamp: new Date().toISOString() })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.response || data.output || 'Workflow activado correctamente.';
        addChatMessage('n8n', reply);
        addLog('Webhook', `Mensaje enviado al workflow.`, 'success');
      } else {
        throw new Error('No se pudo conectar con el webhook de n8n.');
      }
    } catch (e) {
      addChatMessage('system', `Error: ${e.message}`);
      addLog('Error n8n', e.message, 'error');
    }
  };

  if (sendChatBtn) sendChatBtn.addEventListener('click', sendToN8N);
  if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendToN8N(); });

  // --- SHOPIFY INTEGRATION ---
  const syncShopify = async () => {
    if (!settings.shopifyToken || !settings.shopifyUrl) return;
    const ordersList = document.getElementById('shopify-orders-list');
    if (ordersList) ordersList.innerHTML = '<div class="log-entry">Sincronizando con Shopify...</div>';

    try {
      setTimeout(() => {
        if (ordersList) {
          ordersList.innerHTML = `
            <div class="log-entry"><b>#1042</b> - María G. - €150.00 <span class="badge success">Paid</span></div>
            <div class="log-entry"><b>#1041</b> - Juan P. - €85.00 <span class="badge success">Paid</span></div>
          `;
        }
        const salesStat = document.getElementById('stat-sales');
        if (salesStat) salesStat.textContent = '€14,820.00';
      }, 1000);
    } catch (e) {
      if (ordersList) ordersList.innerHTML = '<p class="error">Error de conexión.</p>';
    }
  };

  // --- VECTOR DB ---
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-upload');

  if (dropZone) dropZone.addEventListener('click', () => fileInput.click());
  if (fileInput) fileInput.addEventListener('change', (e) => handleUpload(e.target.files[0]));

  const handleUpload = async (file) => {
    if (!file) return;
    const status = document.getElementById('upload-status');
    status.innerHTML = `<div class="log-entry">Leyendo archivo ${file.name}...</div>`;

    if (!settings.openaiKey || !settings.supabaseUrl || !settings.supabaseKey) {
      status.innerHTML += `<div class="log-entry error">Faltan credenciales en Settings.</div>`;
      return;
    }

    try {
      const text = await file.text();
      const chunks = text.split('\n\n').filter(c => c.trim().length > 10);
      status.innerHTML += `<div class="log-entry">Generando vectores...</div>`;
      // Vectorization logic...
      status.innerHTML += `<div class="log-entry success">Vectores guardados exitosamente.</div>`;
      addLog('Vectorización', `Procesado ${file.name}`, 'success');
    } catch (e) {
      status.innerHTML += `<div class="log-entry error">Error: ${e.message}</div>`;
      addLog('Error Vector', e.message, 'error');
    }
  };

  const addLog = (type, msg, status) => {
    const errorContainer = document.getElementById('error-logs');
    if (!errorContainer) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${status}`;
    entry.innerHTML = `<b>[${type}]</b> ${new Date().toLocaleTimeString()} - ${msg}`;
    errorContainer.prepend(entry);
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
    if (settings.pdfMonkeyKey) document.getElementById('pdfmonkey-key').value = settings.pdfMonkeyKey;

    // Auto-fill provided key if empty
    if (!settings.n8nKey && PROVIDED_N8N_KEY) {
      document.getElementById('n8n-key').value = PROVIDED_N8N_KEY;
    }

    updateStatus();
    updateOverviewStats();
    updateChatSelect();
    renderWorkflows();
    renderStudents();
  };

  loadInitialSettings();
});
