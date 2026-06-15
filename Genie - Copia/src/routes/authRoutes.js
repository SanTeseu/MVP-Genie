const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginLimiter } = require('../middlewares/rateLimiter');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login (with brute-force rate limiter)
router.post('/login', loginLimiter, authController.login);

module.exports = router;
