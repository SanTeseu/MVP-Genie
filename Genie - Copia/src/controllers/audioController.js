const db = require('../models/db');
const claudeService = require('../services/claudeService');

// POST /api/audio/upload
const uploadAudio = (req, res) => {
  try {
    const usuarioId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo de áudio não enviado.' });
    }

    // Relative path to store in DB
    const relativePath = `uploads/${req.file.filename}`;
    const duration = req.audioDuration || 0;
    
    // Frontend can pass the WebSpeech transcription alongside the file
    let transcricao = req.body.transcricao || '';

    if (!transcricao || transcricao.trim() === '') {
      // Fallback transcription if none is provided
      transcricao = 'Nova tarefa por voz criada às ' + new Date().toLocaleTimeString('pt-BR');
    }

    // Save audio registry to DB
    const result = db.prepare(`
      INSERT INTO audios (usuario_id, arquivo_path, transcricao, duracao_seg)
      VALUES (?, ?, ?, ?)
    `).run(usuarioId, relativePath, transcricao, Math.round(duration));

    const audioRegistry = db.prepare('SELECT * FROM audios WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(audioRegistry);
  } catch (error) {
    console.error('Audio Upload Controller Error:', error.message);
    return res.status(500).json({ error: 'Erro ao registrar arquivo de áudio.' });
  }
};

// POST /api/audio/processar
const processTranscription = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { transcricao } = req.body;

    if (!transcricao || transcricao.trim() === '') {
      return res.status(400).json({ error: 'Transcrição vazia não pode ser processada.' });
    }

    const structuredTask = await claudeService.processTaskTranscription(transcricao, usuarioId);
    return res.status(200).json(structuredTask);
  } catch (error) {
    console.error('AI Processing Error:', error.message);
    return res.status(500).json({ error: error.message || 'Erro ao processar áudio com inteligência artificial.' });
  }
};

// GET /api/usuario/configuracao
const getUserConfig = (req, res) => {
  try {
    const usuarioId = req.user.id;
    let config = db.prepare('SELECT prompt_extra FROM configuracoes_usuario WHERE usuario_id = ?').get(usuarioId);
    
    if (!config) {
      db.prepare('INSERT INTO configuracoes_usuario (usuario_id, prompt_extra) VALUES (?, ?)').run(usuarioId, '');
      config = { prompt_extra: '' };
    }

    return res.status(200).json({ prompt_extra: config.prompt_extra || '' });
  } catch (error) {
    console.error('Get Config Error:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar configurações do usuário.' });
  }
};

// POST /api/usuario/configuracao
const saveUserConfig = (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { prompt_extra } = req.body;

    db.prepare(`
      INSERT INTO configuracoes_usuario (usuario_id, prompt_extra)
      VALUES (?, ?)
      ON CONFLICT(usuario_id) DO UPDATE SET prompt_extra = excluded.prompt_extra
    `).run(usuarioId, prompt_extra || '');

    return res.status(200).json({ message: 'Configurações de IA atualizadas com sucesso!', prompt_extra });
  } catch (error) {
    console.error('Save Config Error:', error.message);
    return res.status(500).json({ error: 'Erro ao salvar configurações do usuário.' });
  }
};

module.exports = {
  uploadAudio,
  processTranscription,
  getUserConfig,
  saveUserConfig
};
