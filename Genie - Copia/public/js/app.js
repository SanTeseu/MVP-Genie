// Universal UI & State Controller
const UI = (() => {
  const views = ['login', 'register', 'dashboard', 'tasks', 'voice', 'upload', 'settings'];
  let charts = {};

  const init = () => {
    // Listen to hash change for SPA routing
    window.addEventListener('hashchange', handleRouting);
    // Listen to offline/online browser events for visual indicators
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial routing
    handleRouting();
    updateOnlineStatus();

    // Bind auth forms
    document.getElementById('form-login').addEventListener('submit', AuthController.handleLoginSubmit);
    document.getElementById('form-register').addEventListener('submit', AuthController.handleRegisterSubmit);
    
    // Bind manual task creator form
    document.getElementById('form-manual-task').addEventListener('submit', TasksController.handleManualSubmit);

    // Bind IA task save confirm button
    document.getElementById('btn-save-ia-task').addEventListener('click', TasksController.handleIASubmitConfirm);

    // Auto sync local queue on load if online
    StorageOffline.syncQueue();
  };

  const updateOnlineStatus = () => {
    const online = StorageOffline.isOnline();
    const syncBadge = document.getElementById('sync-badge');
    
    if (online) {
      syncBadge.classList.add('hidden');
      // Sync queue as soon as online is detected
      StorageOffline.syncQueue();
    } else {
      showToast('Modo offline ativo. Genie salvará tudo localmente.', 'cloud_off');
      syncBadge.classList.remove('hidden');
    }
  };

  const handleRouting = () => {
    const hash = window.location.hash || '#dashboard';
    const viewName = hash.replace('#', '');

    // Drawer info refresh if logged in
    const user = API.getUsuario();
    if (API.isLoggedIn() && user) {
      document.getElementById('drawer-user-name').textContent = user.nome;
      document.getElementById('drawer-user-email').textContent = user.email;
      
      // Settings profile
      if (document.getElementById('profile-name')) {
        document.getElementById('profile-name').textContent = user.nome;
        document.getElementById('profile-email').textContent = user.email;
        const initials = user.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('profile-initials').textContent = initials;
      }
    }

    // Auth redirection guards
    if (!API.isLoggedIn()) {
      if (viewName !== 'login' && viewName !== 'register') {
        window.location.hash = '#login';
        return;
      }
    } else {
      if (viewName === 'login' || viewName === 'register') {
        window.location.hash = '#dashboard';
        return;
      }
    }

    // Toggle viewport visibility
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (v === viewName) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Toggle global decorations (bottom nav & header)
    const mainHeader = document.getElementById('main-header');
    const bottomNav = document.getElementById('bottom-nav');
    const floatingBtn = document.getElementById('floating-btn-add');

    if (API.isLoggedIn()) {
      mainHeader.classList.remove('hidden');
      bottomNav.classList.remove('hidden');
      floatingBtn.classList.remove('hidden');
      
      // Set active nav link style
      const navLinks = bottomNav.querySelectorAll('a');
      navLinks.forEach(link => {
        const linkHash = link.getAttribute('href');
        if (linkHash === hash) {
          link.classList.remove('text-white/50');
          link.classList.add('text-white');
        } else if (linkHash !== '#voice') {
          link.classList.add('text-white/50');
          link.classList.remove('text-white');
        }
      });
    } else {
      mainHeader.classList.add('hidden');
      bottomNav.classList.add('hidden');
      floatingBtn.classList.add('hidden');
    }

    // View specific activation hooks
    if (viewName === 'dashboard') {
      DashboardController.load();
    } else if (viewName === 'tasks') {
      TasksController.load();
    } else if (viewName === 'voice') {
      VoiceController.load();
    } else if (viewName === 'upload') {
      UploadController.load();
    } else if (viewName === 'settings') {
      SettingsController.load();
    }

    // Clear voice recorder states when leaving the voice route
    if (viewName !== 'voice') {
      VoiceController.resetRecorderState();
    }
  };

  const showToast = (message, icon = 'info', duration = 3500) => {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    toastMessage.textContent = message;
    toastIcon.textContent = icon;

    toast.classList.remove('opacity-0', 'translate-y-12', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-12', 'pointer-events-none');
    }, duration);
  };

  const showLoader = (text = 'Carregando...') => {
    const loader = document.getElementById('global-loader');
    const loaderText = document.getElementById('global-loader-text');
    loaderText.textContent = text;
    loader.classList.remove('hidden');
  };

  const hideLoader = () => {
    const loader = document.getElementById('global-loader');
    loader.classList.add('hidden');
  };

  const openModal = (id) => {
    const modal = document.getElementById(id);
    modal.classList.remove('hidden');
  };

  const closeModal = (id) => {
    const modal = document.getElementById(id);
    modal.classList.add('hidden');
  };

  const toggleSideMenu = () => {
    const drawer = document.getElementById('side-drawer');
    if (drawer.classList.contains('hidden')) {
      drawer.classList.remove('hidden');
      setTimeout(() => drawer.classList.remove('-translate-x-full'), 10);
    } else {
      drawer.classList.add('-translate-x-full');
      setTimeout(() => drawer.classList.add('hidden'), 300);
    }
  };

  const showOfflineIndicator = () => {
    const queue = StorageOffline.getQueue();
    if (queue.length > 0) {
      showToast(`Você possui ${queue.length} tarefas pendentes de sincronização offline.`, 'cloud_sync');
    } else {
      showToast('Tudo sincronizado na nuvem Genie!', 'cloud_done');
    }
  };

  const handleLogout = () => {
    API.logout();
    toggleSideMenu();
    window.location.hash = '#login';
    showToast('Sessão encerrada com sucesso.', 'lock');
  };

  const renderPrioritiesChart = (canvasId, high, normal, low) => {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (charts[canvasId]) charts[canvasId].destroy();
    
    // Total is zero handle
    if (high === 0 && normal === 0 && low === 0) {
      normal = 1; // display empty normal gray block
    }

    charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Alta', 'Normal', 'Baixa'],
        datasets: [{
          data: [high, normal, low],
          backgroundColor: ['#ef4444', '#38bdf8', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Prioridades',
            color: '#ffffff',
            font: { size: 10, family: 'Be Vietnam Pro', weight: 'bold' }
          }
        },
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%'
      }
    });
  };

  const renderCompletionChart = (canvasId, completed, pending) => {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (charts[canvasId]) charts[canvasId].destroy();

    if (completed === 0 && pending === 0) {
      pending = 1;
    }

    charts[canvasId] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Concluídas', 'Pendentes'],
        datasets: [{
          data: [completed, pending],
          backgroundColor: ['#38bdf8', 'rgba(255,255,255,0.18)'],
          borderWidth: 0
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Conclusão',
            color: '#ffffff',
            font: { size: 10, family: 'Be Vietnam Pro', weight: 'bold' }
          }
        },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  };

  return {
    init,
    showToast,
    showLoader,
    hideLoader,
    openModal,
    closeModal,
    toggleSideMenu,
    handleLogout,
    showOfflineIndicator,
    renderPrioritiesChart,
    renderCompletionChart
  };
})();


// Authentication Logic Controller
const AuthController = (() => {
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    UI.showLoader('Realizando login...');
    try {
      const data = await API.post('/auth/login', { email, senha });
      API.setToken(data.token);
      API.setUsuario(data.usuario);
      
      UI.showToast(data.message, 'lock_open');
      window.location.hash = '#dashboard';
      
      // Sync offline queue immediately on login
      StorageOffline.syncQueue();
    } catch (err) {
      UI.showToast(err.message, 'warning');
    } finally {
      UI.hideLoader();
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const nome = document.getElementById('register-nome').value;
    const email = document.getElementById('register-email').value;
    const senha = document.getElementById('register-senha').value;

    UI.showLoader('Registrando conta...');
    try {
      const data = await API.post('/auth/register', { nome, email, senha });
      API.setToken(data.token);
      API.setUsuario(data.usuario);

      UI.showToast(data.message, 'done_all');
      window.location.hash = '#dashboard';
    } catch (err) {
      UI.showToast(err.message, 'warning');
    } finally {
      UI.hideLoader();
    }
  };

  return {
    handleLoginSubmit,
    handleRegisterSubmit
  };
})();


// Dashboard Data Controller
const DashboardController = (() => {
  const load = async () => {
    const user = API.getUsuario();
    if (user) {
      document.getElementById('dashboard-greeting').textContent = `Olá, ${user.nome.split(' ')[0]} 👋`;
    }

    let metrics = { total: 0, concluidas: 0, pendentes: 0, alta_prioridade: 0, normal_prioridade: 0, baixa_prioridade: 0, audios_processados: 0, taxa_conclusao: 0 };
    let tasks = [];

    if (StorageOffline.isOnline()) {
      try {
        metrics = await API.get('/tarefas/dashboard');
        tasks = await API.get('/tarefas');
        // Cache tasks
        StorageOffline.saveCache(tasks);
      } catch (err) {
        console.error('Error fetching dashboard network details, loading cache:', err.message);
        // Fallback to cache
        tasks = StorageOffline.getCache();
        metrics = calculateLocalMetrics(tasks);
      }
    } else {
      // Offline fallback
      tasks = StorageOffline.getCache();
      metrics = calculateLocalMetrics(tasks);
    }

    // Populate tallies
    document.getElementById('stats-total').textContent = metrics.total;
    document.getElementById('stats-concluidas').textContent = metrics.concluidas;
    document.getElementById('stats-pendentes').textContent = metrics.pendentes;

    // Render Charts
    UI.renderPrioritiesChart('chart-priorities', metrics.alta_prioridade, metrics.normal_prioridade, metrics.baixa_prioridade);
    UI.renderCompletionChart('chart-completion', metrics.concluidas, metrics.pendentes);

    // Populate brief upcoming tasks (max 3 items)
    const container = document.getElementById('dashboard-tasks-container');
    container.innerHTML = '';

    const upcomingTasks = tasks.filter(t => t.concluida === 0).slice(0, 3);
    
    if (upcomingTasks.length === 0) {
      container.innerHTML = `
        <div class="px-5 py-6 text-center text-slate-400">
          <span class="material-icons text-3xl mb-1 text-slate-300">verified</span>
          <p class="text-xs font-semibold">Tudo em dia! Nenhuma tarefa pendente.</p>
        </div>
      `;
      return;
    }

    upcomingTasks.forEach(task => {
      const priorityColor = task.prioridade === 'Alta' ? 'bg-red-100 text-red-700' : (task.prioridade === 'Baixa' ? 'bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700');
      const dateStr = formatDateDisplay(task.data);
      const timeStr = task.hora ? ` · ${task.hora}` : '';

      const div = document.createElement('div');
      div.className = 'flex items-center gap-4 px-5 py-4 border-b border-slate-100 active-scale cursor-pointer';
      div.onclick = () => TasksController.openManualCreator(task);
      div.innerHTML = `
        <div class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
          <span class="material-icons text-lg">${task.audio_id ? 'volume_up' : 'assignment'}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-slate-800 font-semibold text-sm truncate">${task.titulo}</p>
          <p class="text-slate-400 text-xs mt-0.5">${dateStr}${timeStr}</p>
        </div>
        <div>
          <span class="text-[10px] ${priorityColor} font-bold px-2 py-0.5 rounded-full">${task.prioridade}</span>
        </div>
      `;
      container.appendChild(div);
    });
  };

  const calculateLocalMetrics = (tasks) => {
    const total = tasks.length;
    const concluidas = tasks.filter(t => t.concluida === 1).length;
    const pendentes = total - concluidas;
    const alta = tasks.filter(t => t.prioridade === 'Alta').length;
    const normal = tasks.filter(t => t.prioridade === 'Normal').length;
    const baixa = tasks.filter(t => t.prioridade === 'Baixa').length;
    const audioCount = tasks.filter(t => t.audio_id !== null).length;
    const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    return {
      total, concluidas, pendentes,
      alta_prioridade: alta,
      normal_prioridade: normal,
      baixa_prioridade: baixa,
      audios_processados: audioCount,
      taxa_conclusao: taxa
    };
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'Sem data';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return 'Hoje';
    
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrow = tomorrowObj.toISOString().split('T')[0];
    if (dateStr === tomorrow) return 'Amanhã';

    return `${parts[2]}/${parts[1]}/${parts[0].substring(2)}`;
  };

  return {
    load,
    formatDateDisplay
  };
})();


// Tasks List & Manipulation Controller
const TasksController = (() => {
  let allTasks = [];
  let currentFilter = 'todos';
  let iaPendingSaveData = null;

  const load = async () => {
    UI.showLoader('Buscando tarefas...');
    try {
      if (StorageOffline.isOnline()) {
        allTasks = await API.get('/tarefas');
        StorageOffline.saveCache(allTasks);
      } else {
        allTasks = StorageOffline.getCache();
      }
      renderList();
    } catch (err) {
      UI.showToast(err.message, 'warning');
      allTasks = StorageOffline.getCache();
      renderList();
    } finally {
      UI.hideLoader();
    }
  };

  // Expose load helper to sync bindings
  window.refreshTasksList = load;

  const filter = (type, btnEl) => {
    currentFilter = type;
    
    // Toggle active filter button styles
    const filterButtons = document.querySelectorAll('.task-filter-btn');
    filterButtons.forEach(btn => {
      btn.classList.add('bg-white/20', 'text-white');
      btn.classList.remove('bg-white', 'text-sky-600', 'shadow-md');
    });

    btnEl.classList.remove('bg-white/20', 'text-white');
    btnEl.classList.add('bg-white', 'text-sky-600', 'shadow-md');

    renderList();
  };

  const renderList = () => {
    const container = document.getElementById('tasks-list-container');
    container.innerHTML = '';

    // Apply filtering
    let filteredTasks = [...allTasks];
    if (currentFilter === 'Alta' || currentFilter === 'Normal' || currentFilter === 'Baixa') {
      filteredTasks = allTasks.filter(t => t.prioridade === currentFilter);
    } else if (currentFilter === 'concluida') {
      filteredTasks = allTasks.filter(t => t.concluida === 1);
    } else if (currentFilter === 'pendente') {
      filteredTasks = allTasks.filter(t => t.concluida === 0);
    }

    if (filteredTasks.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-400">
          <span class="material-icons text-5xl mb-2 text-slate-200">task_alt</span>
          <h4 class="font-bold text-sm">Nenhuma tarefa encontrada</h4>
          <p class="text-xs text-slate-400 max-w-[200px] mx-auto mt-1">Crie lembretes por voz ou manualmente para exibi-los.</p>
        </div>
      `;
      return;
    }

    filteredTasks.forEach(task => {
      const concludedClass = task.concluida === 1 ? 'line-through text-slate-400 font-normal' : 'text-slate-800 font-bold';
      const checkboxIcon = task.concluida === 1 ? 'check_box' : 'check_box_outline_blank';
      const dateStr = DashboardController.formatDateDisplay(task.data);
      const timeStr = task.hora ? ` às ${task.hora}` : '';
      const priorityColor = task.prioridade === 'Alta' ? 'bg-red-100 text-red-700 border-red-200' : (task.prioridade === 'Baixa' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-sky-100 text-sky-700 border-sky-200');

      const offlineLabel = task._offline ? '<span class="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200 inline-block align-middle ml-1">Offline</span>' : '';

      const div = document.createElement('div');
      div.className = `p-4 border border-slate-100 rounded-2xl flex items-start gap-3 bg-slate-50 hover:bg-slate-100/70 transition-all group`;
      div.innerHTML = `
        <!-- Checkbox Button -->
        <button onclick="TasksController.toggleConclude(${task.id || 0}, '${task.client_id}', ${task.concluida === 1 ? 0 : 1})" class="text-sky-500 active-scale mt-0.5 flex-shrink-0">
          <span class="material-icons text-2xl">${checkboxIcon}</span>
        </button>

        <!-- Task Info Content -->
        <div class="flex-1 min-w-0 cursor-pointer" onclick="TasksController.openManualCreator(${JSON.stringify(task).replace(/"/g, '&quot;')})">
          <h4 class="text-sm leading-snug truncate ${concludedClass}">${task.titulo}${offlineLabel}</h4>
          <p class="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span class="material-icons text-xs">calendar_today</span> ${dateStr}${timeStr}
          </p>
          ${task.descricao ? `<p class="text-xs text-slate-500 mt-1 truncate">${task.descricao}</p>` : ''}
        </div>

        <!-- Right badges & Actions -->
        <div class="flex flex-col items-end justify-between self-stretch flex-shrink-0">
          <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${priorityColor}">${task.prioridade}</span>
          <button onclick="TasksController.deleteItem(${task.id || 0}, '${task.client_id}')" class="text-red-400 hover:text-red-600 active-scale p-1 opacity-60 group-hover:opacity-100 mt-2 transition-opacity">
            <span class="material-icons text-lg">delete_outline</span>
          </button>
        </div>
      `;
      container.appendChild(div);
    });
  };

  const toggleConclude = async (id, clientId, state) => {
    // Optimistic UI updates
    const taskIndex = allTasks.findIndex(t => t.client_id === clientId);
    if (taskIndex !== -1) {
      allTasks[taskIndex].concluida = state ? 1 : 0;
      renderList();
    }

    if (StorageOffline.isOnline() && id > 0) {
      try {
        await API.patch(`/tarefas/${id}/concluir`, { concluida: state });
      } catch (err) {
        console.error('Failed toggling task online:', err.message);
      }
    } else {
      // Offline queue updates
      const queue = StorageOffline.getQueue();
      const queueIndex = queue.findIndex(q => q.client_id === clientId);
      if (queueIndex !== -1) {
        queue[queueIndex].concluida = state ? 1 : 0;
      } else {
        // If not in queue but we have cached version, create an update in queue
        // For simplicity, we just cache locally
      }
      StorageOffline.saveCache(allTasks);
      UI.showToast('Status salvo localmente (offline).', 'cloud_queue');
    }
  };

  const deleteItem = async (id, clientId) => {
    if (confirm('Tem certeza que deseja excluir este lembrete?')) {
      // Optimistic UI updates
      allTasks = allTasks.filter(t => t.client_id !== clientId);
      renderList();

      if (StorageOffline.isOnline() && id > 0) {
        try {
          await API.delete(`/tarefas/${id}`);
          UI.showToast('Lembrete excluído com sucesso.', 'delete');
        } catch (err) {
          UI.showToast(err.message, 'warning');
        }
      } else {
        // Remove from local offline sync queue
        const queue = StorageOffline.getQueue().filter(q => q.client_id !== clientId);
        const cache = StorageOffline.getCache().filter(c => c.client_id !== clientId);
        localStorage.setItem('genie_fila', JSON.stringify(queue));
        StorageOffline.saveCache(cache);
        UI.showToast('Lembrete removido localmente.', 'delete');
      }
    }
  };

  const openManualCreator = (task = null) => {
    const modalTitle = document.getElementById('manual-modal-title');
    const idInput = document.getElementById('manual-task-id');
    const clientInput = document.getElementById('manual-client-id');
    const titleInput = document.getElementById('manual-input-title');
    const dateInput = document.getElementById('manual-input-date');
    const timeInput = document.getElementById('manual-input-time');
    const priorityInput = document.getElementById('manual-input-priority');
    const notesInput = document.getElementById('manual-input-notes');

    if (task) {
      modalTitle.textContent = 'Editar Lembrete';
      idInput.value = task.id || '';
      clientInput.value = task.client_id || '';
      titleInput.value = task.titulo || '';
      dateInput.value = task.data || '';
      timeInput.value = task.hora || '';
      priorityInput.value = task.prioridade || 'Normal';
      notesInput.value = task.descricao || '';
    } else {
      modalTitle.textContent = 'Novo Lembrete';
      idInput.value = '';
      clientInput.value = '';
      titleInput.value = '';
      dateInput.value = new Date().toISOString().split('T')[0];
      timeInput.value = '';
      priorityInput.value = 'Normal';
      notesInput.value = '';
    }

    UI.openModal('modal-task-manual');
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('manual-task-id').value;
    const clientId = document.getElementById('manual-client-id').value;
    const titulo = document.getElementById('manual-input-title').value;
    const dataVal = document.getElementById('manual-input-date').value;
    const horaVal = document.getElementById('manual-input-time').value;
    const prioridade = document.getElementById('manual-input-priority').value;
    const descricao = document.getElementById('manual-input-notes').value;

    const taskPayload = {
      client_id: clientId || undefined, // generated later if missing
      titulo,
      data: dataVal || null,
      hora: horaVal || null,
      prioridade,
      descricao
    };

    UI.showLoader('Salvando lembrete...');
    try {
      if (StorageOffline.isOnline()) {
        if (id) {
          // Edit Update
          await API.put(`/tarefas/${id}`, taskPayload);
          UI.showToast('Lembrete atualizado com sucesso!', 'done_all');
        } else {
          // New Creation
          taskPayload.client_id = StorageOffline.queueTaskCreation(taskPayload).client_id;
          // Trigger sync immediately to send it online
          await StorageOffline.syncQueue();
          UI.showToast('Lembrete criado com sucesso!', 'done');
        }
      } else {
        // Offline creation / editing
        if (id) {
          // Update offline local caches
          const cache = StorageOffline.getCache();
          const idx = cache.findIndex(c => c.client_id === clientId);
          if (idx !== -1) {
            cache[idx] = { ...cache[idx], ...taskPayload };
            StorageOffline.saveCache(cache);
          }
          UI.showToast('Lembrete atualizado localmente.', 'cloud_queue');
        } else {
          StorageOffline.queueTaskCreation(taskPayload);
          UI.showToast('Tarefa salva offline. Sincronizará com a rede.', 'cloud_queue');
        }
      }
      
      UI.closeModal('modal-task-manual');
      
      // Reload current screen data
      const hash = window.location.hash || '#dashboard';
      if (hash === '#dashboard') DashboardController.load();
      if (hash === '#tasks') load();

    } catch (err) {
      UI.showToast(err.message, 'warning');
    } finally {
      UI.hideLoader();
    }
  };

  const openIAResultConfirm = (parsedData, transcript, audioId = null) => {
    iaPendingSaveData = {
      ...parsedData,
      audio_id: audioId,
      transcript: transcript
    };

    // Fill Modal Inputs
    document.getElementById('ia-badge-priority').textContent = parsedData.prioridade || 'Normal';
    
    // Priority badges styling
    const badge = document.getElementById('ia-badge-priority');
    badge.className = 'ml-auto text-[10px] px-2.5 py-0.5 rounded-full font-bold ';
    if (parsedData.prioridade === 'Alta') {
      badge.classList.add('bg-red-500', 'text-white');
    } else if (parsedData.prioridade === 'Baixa') {
      badge.classList.add('bg-green-500', 'text-white');
    } else {
      badge.classList.add('bg-sky-500', 'text-white');
    }

    document.getElementById('ia-badge-source').textContent = audioId ? 'Enviado por Áudio' : 'Capturado por Voz';
    document.getElementById('ia-card-transcript').textContent = `"${transcript}"`;
    document.getElementById('ia-input-title').value = parsedData.titulo || '';
    
    // Handle date coalescing defaults to today (se data nula -> usar data atual)
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('ia-input-date').value = parsedData.data || today;
    document.getElementById('ia-input-time').value = parsedData.hora || '';
    document.getElementById('ia-input-priority').value = parsedData.prioridade || 'Normal';
    document.getElementById('ia-input-notes').value = parsedData.observacao || '';

    UI.openModal('modal-ia-result');
  };

  const handleIASubmitConfirm = async () => {
    if (!iaPendingSaveData) return;

    const finalTitle = document.getElementById('ia-input-title').value;
    const finalDate = document.getElementById('ia-input-date').value;
    const finalTime = document.getElementById('ia-input-time').value;
    const finalPriority = document.getElementById('ia-input-priority').value;
    const finalNotes = document.getElementById('ia-input-notes').value;

    const taskPayload = {
      titulo: finalTitle,
      data: finalDate || null,
      hora: finalTime || null,
      prioridade: finalPriority,
      descricao: finalNotes,
      audio_id: iaPendingSaveData.audio_id
    };

    UI.showLoader('Salvando tarefa...');
    try {
      if (StorageOffline.isOnline()) {
        // Enforce offline queue generator to get unique client_id
        taskPayload.client_id = StorageOffline.queueTaskCreation(taskPayload).client_id;
        await StorageOffline.syncQueue();
        UI.showToast('Lembrete inteligente criado com sucesso!', 'auto_awesome');
      } else {
        StorageOffline.queueTaskCreation(taskPayload);
        UI.showToast('Tarefa IA criada localmente (offline).', 'cloud_queue');
      }

      UI.closeModal('modal-ia-result');
      window.location.hash = '#dashboard';
    } catch (err) {
      UI.showToast(err.message, 'warning');
    } finally {
      UI.hideLoader();
    }
  };

  return {
    load,
    filter,
    toggleConclude,
    deleteItem,
    openManualCreator,
    handleManualSubmit,
    openIAResultConfirm,
    handleIASubmitConfirm
  };
})();


// Voice Recording Controller
const VoiceController = (() => {
  let recognition = null;
  let isRecording = false;
  let finalTranscript = '';
  
  const load = () => {
    // Initialize WebSpeech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser. Showing upload fallback.');
      UI.showToast('Comando de voz direto não suportado. Redirecionando para upload de áudio.', 'info');
      // Fallback: interface de upload deve aparecer automaticamente
      setTimeout(() => {
        window.location.hash = '#upload';
      }, 1500);
      return;
    }

    try {
      recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        isRecording = true;
        document.getElementById('voice-status').textContent = 'Gravando...';
        document.getElementById('mic-pulse-ring').classList.remove('hidden');
        document.getElementById('mic-pulse-ring').classList.add('mic-pulse');
        document.getElementById('voice-waveform').classList.remove('invisible');
        document.getElementById('transcription-preview-box').classList.remove('invisible');
        document.getElementById('svg-mic').classList.add('scale-110');
      };

      recognition.onresult = (e) => {
        let interimTranscript = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            finalTranscript += e.results[i][0].transcript;
          } else {
            interimTranscript += e.results[i][0].transcript;
          }
        }
        
        const currentPreview = finalTranscript || interimTranscript || 'Fale agora...';
        document.getElementById('transcription-preview-text').textContent = currentPreview;
      };

      recognition.onerror = (e) => {
        console.error('Speech Recognition Error:', e.error);
        if (e.error === 'no-speech') {
          UI.showToast('Nenhuma fala detectada. Tente aproximar o microfone.', 'warning');
        } else {
          UI.showToast(`Erro na gravação: ${e.error}`, 'warning');
        }
        resetRecorderState();
      };

      recognition.onend = () => {
        if (isRecording) {
          processFinishedVoice();
        }
      };

    } catch (err) {
      console.error('Failed initializing Speech Recognition:', err.message);
    }
  };

  const toggleRecording = () => {
    if (!recognition) {
      UI.showToast('O assistente de voz não pôde ser iniciado neste dispositivo.', 'warning');
      return;
    }

    if (isRecording) {
      recognition.stop();
    } else {
      finalTranscript = '';
      document.getElementById('transcription-preview-text').textContent = 'Ouvindo...';
      try {
        recognition.start();
      } catch (err) {
        console.error('Error starting recognition:', err.message);
      }
    }
  };

  const processFinishedVoice = async () => {
    resetRecorderState();
    
    const textToProcess = finalTranscript.trim();
    if (textToProcess === '') {
      UI.showToast('Gravação cancelada pois nenhuma fala foi capturada.', 'warning');
      return;
    }

    UI.showLoader('Processando áudio com IA...');
    try {
      if (StorageOffline.isOnline()) {
        const parsedTask = await API.post('/audio/processar', { transcricao: textToProcess });
        UI.hideLoader();
        TasksController.openIAResultConfirm(parsedTask, textToProcess, null);
      } else {
        // Offline heuristic processing inside the browser wrapper
        const fallbackTask = localNLPHeuristicFrontend(textToProcess);
        UI.hideLoader();
        TasksController.openIAResultConfirm(fallbackTask, textToProcess, null);
      }
    } catch (err) {
      UI.showToast(err.message, 'warning');
      UI.hideLoader();
    }
  };

  const resetRecorderState = () => {
    isRecording = false;
    document.getElementById('voice-status').textContent = 'Capturar Voz';
    document.getElementById('mic-pulse-ring').classList.add('hidden');
    document.getElementById('mic-pulse-ring').classList.remove('mic-pulse');
    document.getElementById('voice-waveform').classList.add('invisible');
    document.getElementById('transcription-preview-box').classList.add('invisible');
    document.getElementById('svg-mic').classList.remove('scale-110');
  };

  // Quick frontend NLP heuristic for 100% offline state
  const localNLPHeuristicFrontend = (text) => {
    const textLower = text.toLowerCase();
    let data = new Date().toISOString().split('T')[0];
    let hora = '';
    let prioridade = 'Normal';
    let titulo = text;

    // Deduce priority
    if (textLower.includes('urgente') || textLower.includes('importante') || textLower.includes('médico') || textLower.includes('prova')) {
      prioridade = 'Alta';
    } else if (textLower.includes('lazer') || textLower.includes('depois')) {
      prioridade = 'Baixa';
    }

    // Deduce Date
    if (textLower.includes('amanhã') || textLower.includes('amanha')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      data = tomorrow.toISOString().split('T')[0];
    }

    // Clean text to build Title
    let cleanText = text
      .replace(/^(preciso|tenho que|lembrar de|cadastrar|criar|adicionar)\s+(uma\s+tarefa\s+para\s+|de\s+|para\s+)?/i, '')
      .replace(/(amanhã|amanha|hoje|segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo)/gi, '')
      .trim();

    titulo = cleanText ? cleanText.charAt(0).toUpperCase() + cleanText.slice(1) : 'Lembrete Inteligente';

    return {
      titulo,
      data,
      hora: hora || null,
      prioridade,
      observacao: text
    };
  };

  return {
    load,
    toggleRecording,
    resetRecorderState
  };
})();


// Audio Upload Files Controller
const UploadController = (() => {
  let selectedFile = null;

  const load = () => {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('audio-file-input');

    // Reset layout elements
    clearSelection();

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Handle drag states
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, () => dropzone.classList.add('dropzone-dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, () => dropzone.classList.remove('dropzone-dragover'), false);
    });

    // Handle dropped files
    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    });

    // Handle clicked files
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });
  };

  const handleFileSelect = (file) => {
    // Validate size limit 5MB
    if (file.size > 5 * 1024 * 1024) {
      UI.showToast('O arquivo excede o limite máximo de 5MB.', 'warning');
      return;
    }

    selectedFile = file;
    
    // Populate file info card
    document.getElementById('selected-file-name').textContent = file.name;
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    document.getElementById('selected-file-size').textContent = `${sizeInMB} MB`;

    // Swap displays
    document.getElementById('dropzone').classList.add('hidden');
    document.getElementById('selected-file-card').classList.remove('hidden');
  };

  const clearSelection = () => {
    selectedFile = null;
    document.getElementById('audio-file-input').value = '';
    document.getElementById('dropzone').classList.remove('hidden');
    document.getElementById('selected-file-card').classList.add('hidden');
  };

  const submitAudio = async () => {
    if (!selectedFile) return;

    if (!StorageOffline.isOnline()) {
      UI.showToast('O upload de arquivo exige conectividade à internet ativa.', 'cloud_off');
      return;
    }

    UI.showLoader('Carregando e transcrevendo áudio...');
    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);
      
      // Calculate or read duration safely (estimate inside HTML5 audio context if browser supports it)
      let duration = 0;
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await selectedFile.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        duration = audioBuffer.duration;
      } catch (e) {
        console.warn('Could not decode audio duration locally, falling back to server calculations:', e.message);
      }
      formData.append('duracao_seg', duration);

      // Call API upload endpoint
      const uploadResult = await API.post('/audio/upload', formData);
      
      UI.showLoader('Processando transcrição com IA...');
      // Execute Claude analysis
      const parsedTask = await API.post('/audio/processar', { transcricao: uploadResult.transcricao });
      
      UI.hideLoader();
      clearSelection();

      // Open IA confirmation dialog
      TasksController.openIAResultConfirm(parsedTask, uploadResult.transcricao, uploadResult.id);

    } catch (err) {
      UI.showToast(err.message, 'warning');
      UI.hideLoader();
    }
  };

  return {
    load,
    clearSelection,
    submitAudio
  };
})();


// Customizable Settings Controller
const SettingsController = (() => {
  const load = async () => {
    if (StorageOffline.isOnline()) {
      try {
        const config = await API.get('/usuario/configuracao');
        document.getElementById('prompt-extra-input').value = config.prompt_extra || '';
      } catch (err) {
        console.error('Error fetching custom AI settings:', err.message);
      }
    } else {
      document.getElementById('prompt-extra-input').value = '';
      UI.showToast('Ajustes de IA indisponíveis offline.', 'cloud_off');
    }
  };

  const savePrompt = async () => {
    const promptExtra = document.getElementById('prompt-extra-input').value;

    if (!StorageOffline.isOnline()) {
      UI.showToast('O ajuste das configurações de IA requer conexão com a internet.', 'cloud_off');
      return;
    }

    UI.showLoader('Salvando instruções...');
    try {
      const data = await API.post('/usuario/configuracao', { prompt_extra: promptExtra });
      UI.showToast(data.message, 'done_all');
    } catch (err) {
      UI.showToast(err.message, 'warning');
    } finally {
      UI.hideLoader();
    }
  };

  return {
    load,
    savePrompt
  };
})();


// Fire startup initializers on DOM load
document.addEventListener('DOMContentLoaded', UI.init);
