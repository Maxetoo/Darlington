const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');
const CustomError = require('../errors')


const PackageSchema = new mongoose.Schema({
    name: String,
    description: String,
    price: Number,
    duration: Number
});


const UserSchema = new mongoose.Schema({
    fullNames: {
        type: String,
        required: [true, 'Full names is required'],
        minLength: [5, 'Full names must be more than 5 characters'],
    },

    email: {
        type: String,
        required: [true, 'Email is required'],
        validate: {
            validator: validator.isEmail,
            message: (props) => `${props.value} is not a valid email`
        },
        unique: true,
        lowercase: true,
        trim: true
    },

     password: {
            type: String,
            required: function() {
                return !this.oauthProvider;
            },
            validate: {
                validator: function (value) {
                    // Skip validation if using OAuth (no password)
                    if (!value && this.oauthProvider) return true;
                    
                    return validator.isStrongPassword(value, {
                        minLength: 5,
                        minLowercase: 1,
                        minUppercase: 1,
                        minNumbers: 1,
                        minSymbols: 1
                    });
                },
                message: "Password must be at least 5 characters long and include lowercase, uppercase, number, and symbol."
            }
        },

    oauthProvider: {
        type: String,
        enum: ['google', null],
        default: null
    },

    oauthId: {
        type: String,
        sparse: true 
    },

    isEmailVerified: {
        type: Boolean,
        default: false
    },

    emailVerificationToken: {
        type: String
    },

    emailVerificationExpiry: {
        type: Date
    },

    role: {
        type: String,
        enum: ['user', 'service_provider', 'admin'],
        default: 'user'
    },

    profileImage: {
        type: String,
        required: function() {
            return this.role === 'service_provider'
        }
    },


    serviceProvider: {
        verificationStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'suspended'],
            default: function() {
                return this.role === 'service_provider' ? 'pending' : null
            }
        },

        documents: {
            governmentId: {
                type: String,
                required: function() {
                    return this.role === 'service_provider'
                }
            },
            
            liveSelfie: {
                type: String,
                required: function() {
                    return this.role === 'service_provider'
                }
            },

            additionalDocs: [String]
        },

        profession: {
            type: String,
            required: function() {
                    return this.role === 'service_provider'
            },
            enum: ['barber', 'chef', 'teacher', 'event_planner', 'musician', 'tailor', 'other']
        },

        businessName: {
            type: String,
            trim: true
        },

        bio: {
            type: String,
            maxLength: [500, 'Bio cannot exceed 500 characters'],
            trim: true
        },

        experience: {
            type: Number,
            min: 0
        },

        availability: {
            days: [{
                type: String,
                enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            }],
            hours: {
                start: String,
                end: String
            },
            timezone: {
                type: String,
                default: 'UTC'
            }
        },

        pricingModel: {
            type: [String],
            enum: ['hourly', 'session', 'package'],
            default: ['session']
        },

        currency: {
            type: String,
            enum: ['NGN', 'USD', 'EUR', 'GBP'],
            default: 'USD'
        },

        pricing: {
            hourlyRate: {
                type: Number,
                required: function () {
                    return this.serviceProvider?.pricingModel?.includes('hourly');
                },
                min: [0, 'Hourly rate cannot be negative']
            },
            sessionRate: {
                type: Number,
                required: function () {
                    return this.serviceProvider?.pricingModel?.includes('session');
                },
                min: [0, 'Session rate cannot be negative']
            },
            packages: {
                type: [PackageSchema],
                required: function () {
                    return this.serviceProvider?.pricingModel?.includes('package');
                },
                validate: {
                    validator: function (packages) {
                    if (this.serviceProvider?.pricingModel?.includes('package')) {
                        return Array.isArray(packages) && packages.length > 0;
                    }
                    return true;
                    },
                    message: 'At least one package is required when pricing model includes "package".'
                }
            }
        },
        portfolio: [{
            type: String,
            required: function() {
                    return this.role === 'service_provider'
            }
        }],

        serviceRadius: {
            type: Number,
            default: 10
        },

        isLocked: {
            type: Boolean,
            default: false
        },

        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },

        reviews: [
              {
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                comment: String,
                rating: { type: Number, min: 1, max: 5 },
                createdAt: { type: Date, default: Date.now },
              },
        ],

        verificationNotes: String,
        verifiedAt: Date,
        },

        phone: {
            type: String,
            required: function() {
                    return this.role === 'service_provider'
            },
            validate: {
                validator: function(v) {
                    if (!v) return true;
                    return validator.isMobilePhone(v, 'any')
                },
                message: 'Please provide a valid phone number'
            }
        },

        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], 
                // required: true,
                validate: {
                validator: function (value) {
                        return value.length === 2 && value.every(num => typeof num === 'number');
                    },
                    message: 'Coordinates must be an array of two numbers: [longitude, latitude]'
                    }
            },
            address: String,
            city: String,
            state: String,
            country: String
        },



        isActive: {
            type: Boolean,
            default: true
        },

        isBanned: {
            type: Boolean,
            default: false
        },

        banReason: String,
        bannedAt: Date,

        lastLogin: {
            type: Date,
            default: Date.now
        },

        lastLoginMethod: {
            type: String,
            enum: ['email', 'oauth'],
            default: 'email'
        },

        loginAttempts: {
            type: Number,
            default: 0
        },

        lockUntil: Date,

        // Password reset

        resetPasswordToken: String,
        resetPasswordExpiry: Date,

        language: {
            type: String,
            enum: ['en', 'fr', 'es', 'pt'],
            default: 'en'
        },

        // service provider embedding 
        embedding: {
            type: [Number],
            default: []
        },

        // statistics 
        stats: {
            totalBookings: {
                type: Number,
                default: 0
            },

            completedBookings: {
                type: Number,
                default: 0
            },

            totalEarnings: {
                type: Number,
                default: 0
            },

            blogPosts: {
                type: Number,
                default: 0
            },

            eventsPosted: {
                type: Number,
                default: 0
            }
        }
    
    
}, {
    timestamps: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
});


const LOCK_TIME = 2 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;


UserSchema.index({email: 1});
UserSchema.index({role: 1});
UserSchema.index({'serviceProvider.profession': 1});
UserSchema.index({ 'location.coordinates': '2dsphere' });

// Pre-save middleware 

UserSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password && this.oauthProvider) return;
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
})


UserSchema.methods.comparePassword = async function(password) {
    if (this.oauthProvider) {
        throw new Error('OAuth users cannot use password authentication');
    }
    const checkPassword = await bcrypt.compare(password, this.password);
    return checkPassword;
};


// Virtual field
UserSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Reset attempts on successful login
UserSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Increment attempts
UserSchema.methods.incrementLoginAttempts = function () {
  // If lock expired, reset first
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // If reached max attempts and not already locked → lock now
  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }

  return this.updateOne(updates);
};



UserSchema.statics.findOrCreateOAuthUser = async function(profile, provider) {
  try {
    // find by OAuth id
    let user = await this.findOne({
      oauthId: profile.id,
      oauthProvider: provider,
    });

    if (user) {
      user.lastLoginMethod = 'oauth';
      user.lastLogin = new Date();
      if (typeof user.resetLoginAttempts === 'function') {
        await user.resetLoginAttempts();
      }
      await user.save();
      return user;
    }

    // if not found, try by email
    const email = profile.emails?.[0]?.value;
    if (email) {
      user = await this.findOne({ email });

      if (user) {
        // check provider-specific restrictions
        if (
          user.role === 'service_provider' &&
          user.serviceProvider?.verificationStatus !== 'approved'
        ) {
          throw new CustomError.BadRequestError('Email is not verified yet');
        }

        // link OAuth details
        user.oauthProvider = provider;
        user.oauthId = profile.id;
        user.isEmailVerified = true;
        user.lastLoginMethod = 'oauth';
        user.lastLogin = new Date();

        if (profile.name && !user.fullNames) {
          user.fullNames = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim();
        }

        await user.save();
        return user;
      }
    }

    // if not found at all, create new user (default role: user)
    const newUser = new this({
      email,
      fullNames: `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
      profileImage: `${profile.photos?.[0]?.value}`,
      oauthProvider: provider,
      oauthId: profile.id,
      isEmailVerified: true,
      lastLoginMethod: 'oauth',
      role: 'user',
      lastLogin: new Date(),
    });

    await newUser.save();
    return newUser;


  } catch (error) {
    throw new CustomError.BadRequestError(`An error occurred: ${error.message}`);
  }
};



module.exports = mongoose.model('User', UserSchema);


