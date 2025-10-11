const mongoose = require('mongoose');


const EventSchema = new mongoose.Schema({
    publisher: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Publisher is required']
    },

    title: {
        type: String,
        required: [true, 'Title is required'],
        maxLength: 100,
        trim: true,
        unique: true
    },

    slug: {
        type: String,
        unique: true,
        lowercase: true,
        required: [true, 'Slug is required'],
        trim: true
    },

    description: {
        type: String,
        required: [true, 'Description is required'],
        minLength: 50,
        maxLength: 300,
    },

    images: [{
        type: String,
        required: [true, 'Image assest is required'] 
    }],

    bannerImage: {
        type: String,
        required: [true, 'Banner image is required']
    },

    location: {
        address: String,
        city: String,
        state: String,
        country: String,
    },

    startDate: {
        type: Date,
        required: [true, 'Start date of event is required']
    },

    endDate: {
        type: Date,
        required: [true, 'End date of event is required']
    },

    category: {
        type: String,
        required: [true, 'Category is required'],
    },

    tags: [{
        type: String,
        lowercase: true,
        trim: true
    }],

    // publishing 
    status: {
        type: String,
        enum: ['draft', 'pending_review', 'published', 'rejected', 'archived'],
        default: 'draft'
    },

  
    // engagement 
    views: {
        type: Number,
        default: 0
    },

    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      likedAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    likeCount: {
      type: Number,
      default: 0
    },


    // African Culture Focus
    culturalAspects: {
        // Which African countries featured
        countries: [String], 
        // Languages discussed
        languages: [String], 
        // Traditional practices featured
        traditions: [String], 
        // Diaspora regions covered
        diasporaRegions: [String] 
    },

  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxLength: 500
    },
    isApproved: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],


  commentCount: {
    type: Number,
    default: 0
  },

  // Sharing
  shares: {
    type: Number,
    default: 0
  },


  //   Moderation
  moderationNotes: String,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date,

  
  // Featured
  isFeatured: {
    type: Boolean,
    default: false
  },

  featuredUntil: Date,  

  ticketLink: {
    type: String,
    required: [true, 'Link to ticket is required']
  },



  // Contact Information
  contactInfo: {
    email: String,
    phone: String,
    website: String,
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String
    }
  },

}, {
    timestamps: true
})



EventSchema.index({ publisher: 1, createdAt: -1 });
EventSchema.index({ status: 1, publishedAt: -1 });
EventSchema.index({ category: 1 });
EventSchema.index({ tags: 1 });
EventSchema.index({ slug: 1 });
EventSchema.index({ isFeatured: -1, publishedAt: -1 });

module.exports = mongoose.model('Event', EventSchema);