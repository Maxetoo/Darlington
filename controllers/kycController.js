const KycVerification = require('../models/kycVerificationModel');
const User = require('../db/userModel');
const CustomError = require('../errors');
const { StatusCodes } = require('http-status-codes');
const crypto = require('crypto');
const { checkForKyc } = require('../helpers/auth/checkForKyc');

// Webhook handler for Didit callbacks
const handleKycWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-didit-signature'];
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;
    
    if (!signature || !webhookSecret) {
      throw new CustomError.UnauthorizedError('Invalid webhook signature');
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      throw new CustomError.UnauthorizedError('Webhook signature mismatch');
    }

    const { verificationId, status, result } = req.body;

    // Find KYC verification record
    const kycRecord = await KycVerification.findOne({ verificationId });
    
    if (!kycRecord) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Verification record not found'
      });
    }

    // Update KYC record
    kycRecord.status = status;
    kycRecord.webhookReceivedAt = new Date();
    
    if (result) {
      kycRecord.verificationResult = {
        faceMatch: result.faceMatch,
        documentValidation: result.documentValidation,
        livenessCheck: result.livenessCheck
      };
    }

    // Update user verification status
    const user = await User.findById(kycRecord.userId);
    
    if (!user) {
      throw new CustomError.NotFoundError('User not found');
    }

    if (status === 'approved') {
      kycRecord.approvedAt = new Date();
      user.serviceProvider.verificationStatus = 'approved';
      user.serviceProvider.verifiedAt = new Date();
      user.isEmailVerified = true;
      
      // TODO: Send approval email
      // await sendEmail({
      //   to: user.email,
      //   template: emailTemplates.kycApproved,
      //   data: { fullNames: user.fullNames }
      // });
      
    } else if (status === 'rejected') {
      kycRecord.rejectedAt = new Date();
      kycRecord.rejectionReason = result?.reason || 'Verification failed';
      user.serviceProvider.verificationStatus = 'rejected';
      user.serviceProvider.verificationNotes = result?.reason || 'Documents did not pass verification';
      
      // TODO: Send rejection email
      // await sendEmail({
      //   to: user.email,
      //   template: emailTemplates.kycRejected,
      //   data: { 
      //     fullNames: user.fullNames,
      //     reason: result?.reason 
      //   }
      // });
    }

    await kycRecord.save();
    await user.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};

// Get KYC status for a user
const getKycStatus = async (req, res) => {
  const userId = req.user.userId;

  const kycRecord = await KycVerification.findOne({ userId });

  if (!kycRecord) {
    throw new CustomError.NotFoundError('No KYC verification found');
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      status: kycRecord.status,
      verificationId: kycRecord.verificationId,
      attempts: kycRecord.attempts,
      lastAttemptDate: kycRecord.lastAttemptDate,
      approvedAt: kycRecord.approvedAt,
      rejectedAt: kycRecord.rejectedAt,
      rejectionReason: kycRecord.rejectionReason
    }
  });
};

// Retry KYC verification (if rejected)
const retryKycVerification = async (req, res) => {
  const userId = req.user.userId;

  // Check for uploaded files
  if (!req.files || !req.files.governmentId || !req.files.liveSelfie) {
    throw new CustomError.BadRequestError('Government ID and live selfie files are required');
  }

  const { governmentId, liveSelfie } = req.files;

  const kycRecord = await KycVerification.findOne({ userId });

  if (!kycRecord) {
    throw new CustomError.NotFoundError('No KYC verification found');
  }

  if (kycRecord.status === 'approved') {
    throw new CustomError.BadRequestError('KYC already approved');
  }

  if (kycRecord.attempts >= 3) {
    throw new CustomError.BadRequestError('Maximum verification attempts reached. Please contact support.');
  }

  // Create new verification (files will be deleted automatically in checkForKyc)
  const verificationResult = await checkForKyc(governmentId, liveSelfie);

  // Update record
  kycRecord.verificationId = verificationResult.verificationId;
  kycRecord.status = 'processing';
  kycRecord.documentMetadata = {
    governmentIdSubmittedAt: new Date(),
    selfieSubmittedAt: new Date()
  };
  kycRecord.attempts += 1;
  kycRecord.lastAttemptDate = new Date();

  await kycRecord.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Verification resubmitted successfully',
    data: {
      verificationId: verificationResult.verificationId,
      status: 'processing'
    }
  });
};

module.exports = {
  handleKycWebhook,
  getKycStatus,
  retryKycVerification
};