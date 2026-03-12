document.addEventListener('DOMContentLoaded', () => {
  // --- Navigation Logic ---
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.module-section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetModule = link.getAttribute('data-module');
      if (!targetModule) return;

      // Update active nav
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Show target section
      sections.forEach(s => s.classList.remove('active'));
      const activeSection = document.getElementById(targetModule);
      if (activeSection) activeSection.classList.add('active');
    });
  });

  // --- API / Settings Logic ---
  const saveBtn = document.getElementById('save-settings');
  const inputs = {
    n8nUrl: document.getElementById('n8n-url'),
    n8nKey: document.getElementById('n8n-key'),
    shopifyUrl: document.getElementById('shopify-url'),
    shopifyToken: document.getElementById('shopify-token')
  };

  // Load saved settings
  const loadSettings = () => {
    const settings = JSON.parse(localStorage.getItem('lash_academy_settings') || '{}');
    if (settings.n8nUrl) inputs.n8nUrl.value = settings.n8nUrl;
    if (settings.n8nKey) inputs.n8nKey.value = settings.n8nKey;
    if (settings.shopifyUrl) inputs.shopifyUrl.value = settings.shopifyUrl;
    if (settings.shopifyToken) inputs.shopifyToken.value = settings.shopifyToken;
    updateStatusIndicator();
  };

  const saveSettings = () => {
    const settings = {
      n8nUrl: inputs.n8nUrl.value,
      n8nKey: inputs.n8nKey.value,
      shopifyUrl: inputs.shopifyUrl.value,
      shopifyToken: inputs.shopifyToken.value
    };
    localStorage.setItem('lash_academy_settings', JSON.stringify(settings));
    alert('Connections saved locally!');
    updateStatusIndicator();
  };

  const updateStatusIndicator = () => {
    const settings = JSON.parse(localStorage.getItem('lash_academy_settings') || '{}');
    const indicator = document.getElementById('global-status');
    const isConnected = settings.n8nKey && settings.shopifyToken;
    
    if (isConnected) {
      indicator.innerHTML = '<span class="dot"></span> Connected';
      indicator.style.color = '#4CAF50';
      indicator.style.background = 'rgba(76, 175, 80, 0.1)';
    } else {
      indicator.innerHTML = '<span class="dot" style="background: #666; box-shadow: none;"></span> Disconnected';
      indicator.style.color = '#666';
      indicator.style.background = 'rgba(255, 255, 255, 0.05)';
    }
  };

  saveBtn.addEventListener('click', saveSettings);
  loadSettings();

  // --- Workflow Mock Logic ---
  const workflowContainer = document.getElementById('workflow-list-container');
  const mockWorkflows = [
    { id: 1, name: 'Envío de Facturas WhatsApp', status: true },
    { id: 2, name: 'Registro de Alumnos Google Sheets', status: true },
    { id: 3, name: 'Notificación Stock Shopify', status: false },
    { id: 4, name: 'Auto-Respuesta Instagram', status: true }
  ];

  const renderWorkflows = (wfs) => {
    workflowContainer.innerHTML = wfs.map(wf => `
      <div class="workflow-card">
        <div class="wf-info">
          <h4>${wf.name}</h4>
          <p>${wf.status ? 'Active & Monitoring' : 'Paused'}</p>
        </div>
        <label class="switch">
          <input type="checkbox" ${wf.status ? 'checked' : ''} onchange="console.log('Toggle ${wf.id}')">
          <span class="slider"></span>
        </label>
      </div>
    `).join('');
    document.getElementById('active-workflows-count').textContent = wfs.filter(w => w.status).length;
  };

  renderWorkflows(mockWorkflows);
});
