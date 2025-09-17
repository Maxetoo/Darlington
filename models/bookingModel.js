const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  
    userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true
  },

  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true // reference to service within provider's services array
  },

  serviceName: {
    type: String,
    required: true
  },

  servicePrice: {
    type: Number,
    required: true
  },

  scheduledDate: {
    type: Date,
    required: true
  },

  duration: {
    type: Number, // in minutes
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },

  location: {
    type: String,
    enum: ['provider_location', 'customer_location'],
    default: 'provider_location'
  },

  customerAddress: {
    type: String // if location is customer_location
  },

  notes: {
    customer: String,
    provider: String
  },

  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },

  completedAt: Date,

  cancelledBy: {
    type: String,
    enum: ['user', 'provider', 'admin']
  },
  
  cancellationReason: String
}, {
  timestamps: true
});

// Indexes for efficient queries
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ providerId: 1, status: 1 });
bookingSchema.index({ scheduledDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);