const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, 'audio-' + uniqueSuffix + ext);
  }
});

// File Filter to validate allowed audio MIME types
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/opus',
    'audio/m4a',
    'audio/x-m4a', // some platforms use x-m4a
    'audio/webm',  // WebSpeech API uses webm on Chrome/Firefox recordings
    'video/webm',  // Some browsers record audio into video/webm container
    'application/octet-stream' // sometimes sent by mobile devices or binary blobs
  ];

  if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(wav|mp3|mpeg|ogg|opus|m4a|webm)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de áudio não permitido. Tipos aceitos: WAV, MP3, OGG, OPUS, M4A.'), false);
  }
};

// Configured Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Duration Validator Middleware
const validateAudioDuration = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado.' });
  }

  // Frontend can pass precise duration in request body
  let duration = parseFloat(req.body.duracao_seg);

  // If frontend did not specify, approximate it gracefully on backend
  if (isNaN(duration) || duration <= 0) {
    const stats = fs.statSync(req.file.path);
    const sizeInBytes = stats.size;
    
    // Estimate based on standard 128 kbps bitrate (16 KB/sec) for compressed audio
    // This acts as a robust fallback without native ffmpeg/sox dependencies
    duration = Math.round(sizeInBytes / 16000);
  }

  // Limit duration to 60 seconds
  if (duration > 60) {
    // Delete file if it exceeds the limit to keep server storage clean
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({ error: 'O áudio excede a duração máxima permitida de 60 segundos.' });
  }

  req.audioDuration = duration;
  next();
};

module.exports = {
  upload,
  validateAudioDuration
};
