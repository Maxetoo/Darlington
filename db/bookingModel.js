const mongoose = require('mongoose');
const validator = require('validator');


const bookingSchema = new mongoose.Schema({
    userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // profession of service provider 
  serviceName: {
    type: String,
    required: true
  },

  pricingModel: {
    type: String,
    required: true
  },

  servicePrice: {
    type: Number,
    required: true
  },

  servicePackageDetails: {
    name: String,
    price: String,
    duration: String,
    default: null
  },

  scheduledDate: {
    type: Date,
    required: true
  },

  duration: {
    type: Number, 
    required: true,
    default: 0
  },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'],
    default: 'pending'
  },

  location: {
    type: String,
    enum: ['provider_location', 'customer_location', 'custom'],
    default: 'provider_location'
  },

  locationDetails: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },

  notes: {
    customer: String,
    provider: String
  },

  paymentReference: {
    type: String,
  },

  paymentStatus: {
    type: String,
    enum: ['pendind', 'successful', 'failed']
  },

  statusHistory: [{
    status: String,
    changedBy: mongoose.Types.ObjectId,
    reason: String,
    timestamp: Date
  }],

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