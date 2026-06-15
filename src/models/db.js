const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure database directory exists
const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite Database
const dbPath = path.join(dbDir, 'genie.db');
const db = new Database(dbPath, { verbose: console.log });

// Enable WAL journal mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
const initializeDatabase = () => {
  // Create 'usuarios' table
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL
    );
  `);

  // Create 'audios' table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      arquivo_path TEXT NOT NULL,
      transcricao TEXT,
      duracao_seg INTEGER,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `);

  // Create 'tarefas' table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tarefas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT UNIQUE NOT NULL,
      usuario_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT,
      data TEXT,
      hora TEXT,
      prioridade TEXT NOT NULL DEFAULT 'Normal',
      concluida INTEGER DEFAULT 0,
      audio_id INTEGER,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (audio_id) REFERENCES audios(id) ON DELETE SET NULL
    );
  `);

  // Create 'configuracoes_usuario' table
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuracoes_usuario (
      usuario_id INTEGER PRIMARY KEY,
      prompt_extra TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `);

  // Create 'logs_ia' table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs_ia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      texto_original TEXT NOT NULL,
      json_gerado TEXT NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tarefas_usuario ON tarefas(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_tarefas_client_id ON tarefas(client_id);
    CREATE INDEX IF NOT EXISTS idx_audios_usuario ON audios(usuario_id);
  `);

  console.log('Database schemas initialized successfully.');
};

initializeDatabase();

module.exports = db;
