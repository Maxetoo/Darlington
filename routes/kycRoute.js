const express = require('express');
const KycRoute = express.Router();
const { handleKycWebhook, getKycStatus, retryKycVerification } = require('../controllers/kycController');
const { authenticateUser } = require('../middleware/authentication');

// Webhook endpoint (no auth required)
KycRoute.post('/webhook', handleKycWebhook);

// Protected routes
KycRoute.get('/status', authenticateUser, getKycStatus);
KycRoute.post('/retry', authenticateUser, retryKycVerification);

module.exports = KycRoute;