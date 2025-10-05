const mongoose = require('mongoose');
const validator = require('validator');
const CustomError = require('../errors');


const BlogPostSchema = new mongoose.Schema({
    author: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Author is required']
    },

    title: {
        type: String,
        required: [true, 'Title is required'],
        maxLength: 50,
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

    content: {
        type: String,
        required: [true, 'Content is required'],
        minLength: 50,
        maxLength: 2000,
    },

    featuredImage: String,

    images: [String],
    videos: [String],

    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['culture', 'food', 'music', 'fashion', 'history', 'travel', 'business', 'lifestyle', 'community', 'other']
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

  // SEO
  metaTitle: String,
  metaDescription: String,

  // Featured
  isFeatured: {
    type: Boolean,
    default: false
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

  embedding: {
    type: [String],
    default: []
  },
}, {
    timestamps: true
})



BlogPostSchema.index({ author: 1, createdAt: -1 });
BlogPostSchema.index({ status: 1, publishedAt: -1 });
BlogPostSchema.index({ category: 1 });
BlogPostSchema.index({ tags: 1 });
BlogPostSchema.index({ slug: 1 });
BlogPostSchema.index({ isFeatured: -1, publishedAt: -1 });

module.exports = mongoose.model('BlogPost', BlogPostSchema);