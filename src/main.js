document.addEventListener('DOMContentLoaded', () => {
  // --- STATE ---
  let workflows = JSON.parse(localStorage.getItem('lash_workflows') || '[]');
  let students = JSON.parse(localStorage.getItem('lash_students') || '[]');
  let settings = JSON.parse(localStorage.getItem('lash_academy_settings') || '{}');

  // --- NAVIGATION ---
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.module-section');

  const goToModule = (moduleId) => {
    navLinks.forEach(l => l.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));

    document.getElementById(moduleId).classList.add('active');
    const navLink = document.querySelector(`.nav-link[data-module="${moduleId}"]`);
    if (navLink) navLink.classList.add('active');

    if (moduleId === 'workflows') renderWorkflows();
    if (moduleId === 'shopify') syncShopify();
    if (moduleId === 'clients') renderStudents();
    updateOverviewStats();
  };

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.getAttribute('data-module');
      if (target) goToModule(target);
    });
  });

  // Stat Card clicks
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
      supabaseKey: document.getElementById('supabase-key').value
    };
    localStorage.setItem('lash_academy_settings', JSON.stringify(settings));
    alert('Configuración guardada!');
    updateStatus();
  };
  const saveBtn = document.getElementById('save-settings');
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);

  const updateStatus = () => {
    const indicator = document.getElementById('global-status');
    const isConn = settings.shopifyToken && settings.n8nKey && settings.openaiKey;
    indicator.innerHTML = isConn ? '<span class="dot"></span> Connected' : '<span class="dot" style="background:#666"></span> Disconnected';
    indicator.style.color = isConn ? '#4CAF50' : '#666';
  };

  // --- OVERVIEW ---
  const updateOverviewStats = () => {
    document.getElementById('stat-students').textContent = students.length;
    document.getElementById('stat-workflows').textContent = workflows.filter(w => w.status).length;
    // Sales stays at 0 until Shopify sync
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
          <button class="btn-icon" onclick="deleteWorkflow('${wf.id}')"><i class="fa-solid fa-trash"></i></button>
          <label class="switch">
            <input type="checkbox" ${wf.status ? 'checked' : ''} onchange="toggleWorkflow('${wf.id}')">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `).join('');
    updateOverviewStats();
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

  const addWfBtn = document.getElementById('open-add-workflow');
  if (addWfBtn) addWfBtn.addEventListener('click', () => {
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

  // --- STUDENTS CRUD (Academy DB) ---
  const renderStudents = () => {
    const container = document.getElementById('student-list-container');
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

  // --- SHOPIFY INTEGRATION ---
  const syncShopify = async () => {
    if (!settings.shopifyToken || !settings.shopifyUrl) return;
    const ordersList = document.getElementById('shopify-orders-list');
    ordersList.innerHTML = '<div class="log-entry">Sincronizando con Shopify...</div>';

    try {
      // Simulation for now
      setTimeout(() => {
        ordersList.innerHTML = `
          <div class="log-entry"><b>#1042</b> - María G. - €150.00 <span class="badge success">Paid</span></div>
          <div class="log-entry"><b>#1041</b> - Juan P. - €85.00 <span class="badge success">Paid</span></div>
        `;
        document.getElementById('stat-sales').textContent = '€14,820.00';
      }, 1000);
    } catch (e) {
      ordersList.innerHTML = '<p class="error">Error de conexión.</p>';
    }
  };
  const syncShopifyBtn = document.getElementById('sync-shopify');
  if (syncShopifyBtn) syncShopifyBtn.addEventListener('click', syncShopify);

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
      status.innerHTML += `<div class="log-entry">Generando vectores para ${chunks.length} fragmentos...</div>`;

      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i].trim();
        const openAiRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ input: chunkContent, model: "text-embedding-3-small" })
        });
        const openAiData = await openAiRes.json();
        const embedding = openAiData.data[0].embedding;

        await fetch(`${settings.supabaseUrl}/rest/v1/documents`, {
          method: 'POST',
          headers: {
            'apikey': settings.supabaseKey,
            'Authorization': `Bearer ${settings.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ content: chunkContent, embedding, metadata: { source: file.name, chunk_id: i } })
        });
      }
      status.innerHTML += `<div class="log-entry success">Vectores guardados en Supabase exitosamente.</div>`;
      addLog('Vectorización', `Se han procesado ${chunks.length} fragmentos de ${file.name}`, 'success');
    } catch (error) {
      status.innerHTML += `<div class="log-entry error">Error: ${error.message}</div>`;
      addLog('Error Vector', error.message, 'error');
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

    updateStatus();
    updateOverviewStats();

    // Default conversations summary
    const convContainer = document.getElementById('conversation-summary');
    if (convContainer) convContainer.innerHTML = '<p class="empty-msg">Connect your APIs to see logs.</p>';
  };

  loadInitialSettings();
});
