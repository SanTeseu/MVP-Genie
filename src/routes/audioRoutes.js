const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');
const auth = require('../middlewares/auth');
const { upload, validateAudioDuration } = require('../middlewares/upload');

// Protect all audio routes with JWT Auth
router.use(auth);

// POST /api/audio/upload (requires file upload, max 5MB, max 60s)
router.post('/upload', upload.single('audio'), validateAudioDuration, audioController.uploadAudio);

// POST /api/audio/processar (process transcript text with Claude)
router.post('/processar', audioController.processTranscription);

// GET /api/usuario/configuracao (fetch custom prompt configuration)
router.get('/configuracao', audioController.getUserConfig);

// POST /api/usuario/configuracao (save custom prompt configuration)
router.post('/configuracao', audioController.saveUserConfig);

module.exports = router;
