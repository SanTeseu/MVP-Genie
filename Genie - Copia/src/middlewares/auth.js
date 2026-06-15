const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token de autenticação ausente ou inválido.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Formato do token incorreto (esperado Bearer).' });
    }

    const secret = process.env.JWT_SECRET || 'genie_secret_super_secure_key_2026_senai_tcc';
    const decoded = jwt.verify(token, secret);

    // Attach decoded user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    return res.status(401).json({ error: 'Token inválido ou expirado. Por favor, faça login novamente.' });
  }
};
