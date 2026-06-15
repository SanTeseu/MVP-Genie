const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/db');

// POST /api/auth/register
const register = (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    // Validate inputs
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Por favor, preencha todos os campos obrigatórios (nome, email, senha).' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está sendo utilizado.' });
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const senhaHash = bcrypt.hashSync(senha, salt);

    // Save user inside DB
    const result = db.prepare(`
      INSERT INTO usuarios (nome, email, senha_hash)
      VALUES (?, ?, ?)
    `).run(nome, email, senhaHash);

    const userId = result.lastInsertRowid;

    // Create default configuration settings (RF05)
    db.prepare(`
      INSERT INTO configuracoes_usuario (usuario_id, prompt_extra)
      VALUES (?, ?)
    `).run(userId, '');

    // Sign JWT Token
    const secret = process.env.JWT_SECRET || 'genie_secret_super_secure_key_2026_senai_tcc';
    const token = jwt.sign({ id: userId, email, nome }, secret, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'Usuário registrado com sucesso!',
      token,
      usuario: { id: userId, nome, email }
    });
  } catch (error) {
    console.error('Registration Error:', error.message);
    return res.status(500).json({ error: 'Erro interno ao registrar usuário.' });
  }
};

// POST /api/auth/login
const login = (req, res) => {
  try {
    const { email, senha } = req.body;

    // Validate inputs
    if (!email || !senha) {
      return res.status(400).json({ error: 'Por favor, informe e-mail e senha.' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas (e-mail ou senha incorretos).' });
    }

    // Compare passwords
    const isMatch = bcrypt.compareSync(senha, user.senha_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas (e-mail ou senha incorretos).' });
    }

    // Sign JWT Token
    const secret = process.env.JWT_SECRET || 'genie_secret_super_secure_key_2026_senai_tcc';
    const token = jwt.sign({ id: user.id, email: user.email, nome: user.nome }, secret, { expiresIn: '7d' });

    return res.status(200).json({
      message: 'Login realizado com sucesso!',
      token,
      usuario: { id: user.id, nome: user.nome, email: user.email }
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
};

module.exports = {
  register,
  login
};
