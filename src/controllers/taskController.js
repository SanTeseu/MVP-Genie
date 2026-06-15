const db = require('../models/db');

// GET /api/tarefas
const getTasks = (req, res) => {
  try {
    const usuarioId = req.user.id;

    // Order tasks by:
    // 1. Pending tasks first (concluida = 0)
    // 2. Priority: 'Alta' -> 1, 'Normal' -> 2, 'Baixa' -> 3
    // 3. Date: Coalesce null dates to today's date
    // 4. Time
    const tasks = db.prepare(`
      SELECT *,
             CASE prioridade
               WHEN 'Alta' THEN 1
               WHEN 'Normal' THEN 2
               WHEN 'Baixa' THEN 3
               ELSE 2
             END as prioridade_peso,
             COALESCE(data, date('now', 'localtime')) as data_ordenacao
      FROM tarefas
      WHERE usuario_id = ?
      ORDER BY concluida ASC, prioridade_peso ASC, data_ordenacao ASC, COALESCE(hora, '23:59') ASC
    `).all(usuarioId);

    return res.status(200).json(tasks);
  } catch (error) {
    console.error('Get Tasks Error:', error.message);
    return res.status(500).json({ error: 'Erro ao listar tarefas do usuário.' });
  }
};

// POST /api/tarefas
const createTask = (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { client_id, titulo, descricao, data, hora, prioridade, concluida, audio_id } = req.body;

    // Validate client_id and title
    if (!client_id) {
      return res.status(400).json({ error: 'O client_id é obrigatório para evitar duplicação.' });
    }
    if (!titulo || titulo.trim() === '') {
      return res.status(400).json({ error: 'O título da tarefa é obrigatório.' });
    }

    // Check if task with client_id already exists to prevent duplication
    const existingTask = db.prepare('SELECT * FROM tarefas WHERE client_id = ?').get(client_id);
    if (existingTask) {
      // Prevent duplication - return existing task instead of throwing error
      return res.status(200).json(existingTask);
    }

    // If date is null, use current local date (se data nula -> usar data atual)
    const finalDate = data && data.trim() !== '' ? data : new Date().toISOString().split('T')[0];
    const finalTime = hora && hora.trim() !== '' ? hora : null;
    const finalPriority = prioridade || 'Normal';
    const finalConcluida = concluida ? 1 : 0;
    const finalAudioId = audio_id || null;

    const result = db.prepare(`
      INSERT INTO tarefas (client_id, usuario_id, titulo, descricao, data, hora, prioridade, concluida, audio_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(client_id, usuarioId, titulo, descricao || '', finalDate, finalTime, finalPriority, finalConcluida, finalAudioId);

    const newTask = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(newTask);
  } catch (error) {
    console.error('Create Task Error:', error.message);
    return res.status(500).json({ error: 'Erro ao criar nova tarefa.' });
  }
};

// PUT /api/tarefas/:id
const updateTask = (req, res) => {
  try {
    const usuarioId = req.user.id;
    const taskId = req.params.id;
    const { titulo, descricao, data, hora, prioridade, concluida, audio_id } = req.body;

    if (!titulo || titulo.trim() === '') {
      return res.status(400).json({ error: 'O título da tarefa é obrigatório.' });
    }

    // Ensure user owns this task
    const task = db.prepare('SELECT id FROM tarefas WHERE id = ? AND usuario_id = ?').get(taskId, usuarioId);
    if (!task) {
      return res.status(444).json({ error: 'Tarefa não encontrada ou acesso negado.' });
    }

    const finalDate = data && data.trim() !== '' ? data : new Date().toISOString().split('T')[0];
    const finalTime = hora && hora.trim() !== '' ? hora : null;
    const finalPriority = prioridade || 'Normal';
    const finalConcluida = concluida ? 1 : 0;
    const finalAudioId = audio_id || null;

    db.prepare(`
      UPDATE tarefas
      SET titulo = ?, descricao = ?, data = ?, hora = ?, prioridade = ?, concluida = ?, audio_id = ?
      WHERE id = ? AND usuario_id = ?
    `).run(titulo, descricao || '', finalDate, finalTime, finalPriority, finalConcluida, finalAudioId, taskId, usuarioId);

    const updatedTask = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(taskId);
    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Update Task Error:', error.message);
    return res.status(500).json({ error: 'Erro ao atualizar tarefa.' });
  }
};

// PATCH /api/tarefas/:id/concluir
const toggleTaskCompletion = (req, res) => {
  try {
    const usuarioId = req.user.id;
    const taskId = req.params.id;
    const { concluida } = req.body;

    // Ensure user owns this task
    const task = db.prepare('SELECT id, concluida FROM tarefas WHERE id = ? AND usuario_id = ?').get(taskId, usuarioId);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada ou acesso negado.' });
    }

    // Toggle if not explicitly provided
    const newConcluida = concluida !== undefined ? (concluida ? 1 : 0) : (task.concluida === 1 ? 0 : 1);

    db.prepare(`
      UPDATE tarefas
      SET concluida = ?
      WHERE id = ? AND usuario_id = ?
    `).run(newConcluida, taskId, usuarioId);

    const updatedTask = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(taskId);
    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Toggle Task Error:', error.message);
    return res.status(500).json({ error: 'Erro ao alterar status da tarefa.' });
  }
};

// DELETE /api/tarefas/:id
const deleteTask = (req, res) => {
  try {
    const usuarioId = req.user.id;
    const taskId = req.params.id;

    // Ensure user owns this task
    const task = db.prepare('SELECT id FROM tarefas WHERE id = ? AND usuario_id = ?').get(taskId, usuarioId);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada ou acesso negado.' });
    }

    db.prepare('DELETE FROM tarefas WHERE id = ? AND usuario_id = ?').run(taskId, usuarioId);
    return res.status(200).json({ message: 'Tarefa excluída com sucesso.', id: taskId });
  } catch (error) {
    console.error('Delete Task Error:', error.message);
    return res.status(500).json({ error: 'Erro ao excluir tarefa.' });
  }
};

// GET /api/dashboard
const getDashboardMetrics = (req, res) => {
  try {
    const usuarioId = req.user.id;

    // Tallies
    const totalCount = db.prepare('SELECT COUNT(*) as cnt FROM tarefas WHERE usuario_id = ?').get(usuarioId).cnt;
    const completedCount = db.prepare('SELECT COUNT(*) as cnt FROM tarefas WHERE usuario_id = ? AND concluida = 1').get(usuarioId).cnt;
    const pendingCount = db.prepare('SELECT COUNT(*) as cnt FROM tarefas WHERE usuario_id = ? AND concluida = 0').get(usuarioId).cnt;
    
    // Priority counts
    const highPriorityCount = db.prepare("SELECT COUNT(*) as cnt FROM tarefas WHERE usuario_id = ? AND prioridade = 'Alta'").get(usuarioId).cnt;
    const normalPriorityCount = db.prepare("SELECT COUNT(*) as cnt FROM tarefas WHERE usuario_id = ? AND prioridade = 'Normal'").get(usuarioId).cnt;
    const lowPriorityCount = db.prepare("SELECT COUNT(*) as cnt FROM tarefas WHERE usuario_id = ? AND prioridade = 'Baixa'").get(usuarioId).cnt;

    // Processed Audios
    const audiosCount = db.prepare('SELECT COUNT(*) as cnt FROM audios WHERE usuario_id = ?').get(usuarioId).cnt;

    // Completion Rate (%)
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return res.status(200).json({
      total: totalCount,
      concluidas: completedCount,
      pendentes: pendingCount,
      alta_prioridade: highPriorityCount,
      normal_prioridade: normalPriorityCount,
      baixa_prioridade: lowPriorityCount,
      audios_processados: audiosCount,
      taxa_conclusao: completionRate
    });
  } catch (error) {
    console.error('Dashboard Metrics Error:', error.message);
    return res.status(500).json({ error: 'Erro ao gerar métricas do dashboard.' });
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTask,
  toggleTaskCompletion,
  deleteTask,
  getDashboardMetrics
};
