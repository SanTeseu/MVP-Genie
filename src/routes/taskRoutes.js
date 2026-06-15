const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const auth = require('../middlewares/auth');

// All task routes are protected by JWT Auth
router.use(auth);

// GET /api/tarefas
router.get('/', taskController.getTasks);

// POST /api/tarefas
router.post('/', taskController.createTask);

// PUT /api/tarefas/:id
router.put('/:id', taskController.updateTask);

// PATCH /api/tarefas/:id/concluir
router.patch('/:id/concluir', taskController.toggleTaskCompletion);

// DELETE /api/tarefas/:id
router.delete('/:id', taskController.deleteTask);

// GET /api/dashboard
router.get('/dashboard', taskController.getDashboardMetrics);

module.exports = router;
