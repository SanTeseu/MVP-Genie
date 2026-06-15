const StorageOffline = (() => {
  const QUEUE_KEY = 'genie_fila';
  const CACHE_KEY = 'genie_tarefas_cache';

  // Helper to generate UUID if crypto.randomUUID is not fully supported
  const generateUUID = () => {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const isOnline = () => navigator.onLine;

  const getQueue = () => {
    try {
      const queue = localStorage.getItem(QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  };

  const saveQueue = (queue) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  };

  const getCache = () => {
    try {
      const cache = localStorage.getItem(CACHE_KEY);
      return cache ? JSON.parse(cache) : [];
    } catch {
      return [];
    }
  };

  const saveCache = (tasks) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(tasks));
  };

  // Add task to offline sync queue
  const queueTaskCreation = (taskData) => {
    const queue = getQueue();
    const newOfflineTask = {
      client_id: taskData.client_id || generateUUID(),
      _offline: true,
      titulo: taskData.titulo,
      descricao: taskData.descricao || '',
      data: taskData.data || new Date().toISOString().split('T')[0],
      hora: taskData.hora || null,
      prioridade: taskData.prioridade || 'Normal',
      concluida: taskData.concluida ? 1 : 0,
      audio_id: taskData.audio_id || null,
      criado_em: new Date().toISOString()
    };

    queue.push(newOfflineTask);
    saveQueue(queue);

    // Save in local UI cache as well for immediate rendering
    const cache = getCache();
    cache.unshift(newOfflineTask);
    saveCache(cache);

    console.log('Task queued offline:', newOfflineTask.client_id);
    return newOfflineTask;
  };

  // Process offline sync queue to backend
  const syncQueue = async () => {
    if (!isOnline() || !API.isLoggedIn()) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    console.log(`Synchronizing offline queue. Found ${queue.length} tasks.`);
    const failedItems = [];

    for (const task of queue) {
      try {
        // Post task to server API
        await API.post('/tarefas', {
          client_id: task.client_id,
          titulo: task.titulo,
          descricao: task.descricao,
          data: task.data,
          hora: task.hora,
          prioridade: task.prioridade,
          concluida: task.concluida === 1,
          audio_id: task.audio_id
        });
        console.log('Synced task successful:', task.client_id);
      } catch (err) {
        console.error('Failed to sync task:', task.client_id, err.message);
        // Retain failed items to retry later
        failedItems.push(task);
      }
    }

    saveQueue(failedItems);

    // Trigger local tasks list refresh if active
    if (window.refreshTasksList && typeof window.refreshTasksList === 'function') {
      window.refreshTasksList();
    }
  };

  // Listen to browser online connectivity changes
  window.addEventListener('online', () => {
    console.log('Browser online. Triggering synchronization...');
    syncQueue();
  });

  return {
    isOnline,
    getQueue,
    getCache,
    saveCache,
    queueTaskCreation,
    syncQueue
  };
})();
