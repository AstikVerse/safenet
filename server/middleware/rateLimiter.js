import rateLimit from 'express-rate-limit';

// Standard rate limiter for authentications (register/login)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 login/register requests per window
  message: {
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limiter for reporting unsafe zones (rate-limited, no auth required)
export const zoneReportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // Limit each IP to 10 reports per window to prevent spam
  message: {
    message: 'Too many area reports submitted. Please try again in 10 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
