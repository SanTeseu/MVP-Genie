const rateLimit = require('express-rate-limit');

// Rate limiting for auth endpoints (specifically login)
// 5 requests per minute
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Muitas tentativas de login a partir deste IP. Por favor, tente novamente após 1 minuto.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

module.exports = {
  loginLimiter
};
