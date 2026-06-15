require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Boot and migrate database
require('./src/models/db');

// Instantiate express server
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend single page app
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded audio files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import API Routers
const authRoutes = require('./src/routes/authRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const audioRoutes = require('./src/routes/audioRoutes');

// Mount API Routers
app.use('/api/auth', authRoutes);
app.use('/api/tarefas', taskRoutes);
app.use('/api/audio', audioRoutes);

// Double mount audioRoutes to support both /api/audio/upload and /api/usuario/configuracao cleanly
app.use('/api/usuario', audioRoutes);

// Fallback HTML page for single page application routing
app.get('*', (req, res, next) => {
  // If request is for an API endpoint, do not serve index.html
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Internal Error:', err.stack || err.message);
  
  // Custom response if error comes from multer validation
  if (err.name === 'MulterError' || err.message.includes('MulterError')) {
    return res.status(400).json({ error: `Erro no upload de arquivo: ${err.message}` });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Ocorreu um erro interno no servidor.'
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   GENIE SERVER BOOTED SUCCESSFUL`);
  console.log(`   Running locally on: http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`==================================================`);
});

module.exports = app;
