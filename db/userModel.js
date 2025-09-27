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
            minLength: [5, 'Password must be at least 5 characters'],
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
            type: String,
            enum: ['hourly', 'session', 'package'],
            default: 'session'
        },

        pricing: {
            hourlyRate: {
                type: Number,
                min: 0
            },
            sessionRate: {
                type: Number,
                min: 0
            },
            packages: [PackageSchema]
        },

        portfolio: [{
            type: String,
            required: function() {
                    return this.role === 'service_provider'
            }
        }],

        serviceRadius: {
            type: Number,
            default: 10 // km
        },

        isLocked: {
            type: Boolean,
            default: false // active when booking is in session
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

        profileImage: {
            type: String,
            required: function() {
                    return this.role === 'service_provider'
            }
        }
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
            address: String,
            city: String,
            state: String,
            country: String,
            coordinates: {
            lat: Number,
            lng: Number
            }
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


UserSchema.index({email: 1});
UserSchema.index({role: 1});
UserSchema.index({'serviceProvider.profession': 1});
// UserSchema.index({''})

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


UserSchema.methods.incrementLoginAttempts = function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: {loginAttempts: 1},
            $unset: {lockUntil: 1}
        });
    }

    const updates = {$inc: {
        loginAttempts: 1
    }};

    // lock account after 5 attempts for 2 hours 

    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = {
            lockUntil: Date.now() + 2 * 60 * 60 * 1000 
        }
        return this.updateOne(updates);
    }
}

UserSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $unset: {
            loginAttempts: 1, lockUntil: 1
        }
    })
}


UserSchema.statics.findOrCreateOAuthUser = async function(profile, provider) {
    try {
        // find user by auth id 

        let user = await this.findOne({
            oauthId: profile.id,
            oauthProvider: provider
        });

        if (user) {
            // update last login method and reset login attempts 
            user.lastLoginMethod = 'oauth';
            user.lastLogin = new Date();
            await user.resetLoginAttempts();
            await user.save();
            return user
        }

        // if not found by auth id check by email 

        user = await this.findOne({email: profile.emails[0].value});

        if (user) {
            // check if service provider email is verified 
            if (user.role === 'service_provider' && user.serviceProvider?.verificationStatus !== 'approved') {
                throw new CustomError.BadRequestError('Email is not verified yet')
            }

            // link existing account with oauth 
            user.oauthProvider = provider;
            user.oauthId = profile.id;
            user.isEmailVerified = true;
            user.lastLoginMethod = 'oauth';
            user.lastLogin = new Date();

            if (profile.name && !user.fullNames) {
                user.fullNames = `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim(); 
            }


            // create new user (only regular user can signup via oauth)
            const newUser = new this({
                email: profile.emails[0].value,
                fullNames: `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim(),
                oauthProvider: provider,
                oauthId: profile.id,
                isEmailVerified: true,
                lastLoginMethod: 'oauth',
                role: 'user'
            });

            await newUser.save();
            return newUser()
        }
    } catch (error) {
        throw new CustomError.BadRequestError(`An error occured: ${error.message}`)
    }
};


module.exports = mongoose.model('User', UserSchema);