const { RateLimiterMemory } = require('rate-limiter-flexible');

const commonLimiter = new RateLimiterMemory({ points: 300, duration: 60 }); // 300 req/min per IP
const authLimiter = new RateLimiterMemory({ points: 15, duration: 60 }); // 15 req/min per IP

function rateLimit(limiter) {
  return async (req, res, next) => {
    try {
      await limiter.consume(req.ip);
      next();
    } catch (e) {
      res.status(429).json({ message: 'Too many requests' });
    }
  };
}

module.exports = { rateLimit, commonLimiter, authLimiter };