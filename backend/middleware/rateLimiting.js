const rateLimit = require('express-rate-limit');

// General API rate limiting — 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limiting — stricter for brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 auth attempts per 15 min window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Transaction rate limiting — generous for data entry workflows
const transactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 transaction requests per minute
  message: {
    success: false,
    message: 'Too many transaction requests, please slow down.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  transactionLimiter
};