const mongoose = require('mongoose');

const KycVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  verificationId: {
    type: String,
    required: true,
    unique: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'processing', 'approved', 'rejected', 'expired'],
    default: 'pending'
  },
  
  // NO DOCUMENT URLS STORED - security compliance
  documentMetadata: {
    governmentIdType: String, // e.g., 'passport', 'drivers_license'
    governmentIdSubmittedAt: Date,
    selfieSubmittedAt: Date
  },
  
  verificationResult: {
    faceMatch: {
      score: Number,
      passed: Boolean
    },
    documentValidation: {
      isValid: Boolean,
      documentType: String,
      expiryDate: Date
    },
    livenessCheck: {
      passed: Boolean,
      confidence: Number
    }
  },
  
  rejectionReason: String,
  
  attempts: {
    type: Number,
    default: 1
  },
  
  lastAttemptDate: {
    type: Date,
    default: Date.now
  },
  
  approvedAt: Date,
  rejectedAt: Date,
  
  // Minimal webhook data (no sensitive info)
  webhookReceivedAt: Date
  
}, {
  timestamps: true
});

KycVerificationSchema.index({ userId: 1 });
KycVerificationSchema.index({ verificationId: 1 });
KycVerificationSchema.index({ status: 1 });

module.exports = mongoose.model('KycVerification', KycVerificationSchema);