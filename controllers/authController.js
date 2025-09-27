// const crypto = require('crypto');
const User = require('../db/userModel')
const CustomError = require('../errors')
const {StatusCodes} = require('http-status-codes')
const {createCookies} = require('../handlers/authHandler')
const { v4: uuidv4 } = require('uuid');
const {checkForKyc} = require('../helpers/auth/checkForKyc')
const {serviceProviderErrorLogs} = require('../helpers/auth/errorLogs')
const getEmbedding = async (...args) => {
const { getEmbedding } = await import('../services/transformer.mjs');
  return getEmbedding(...args);
};
// const generateToken = require('../utils/generateToken');
// const { sendEmail, emailTemplates } = require('../utils/email');



const register = async (req, res) => {
  let { fullNames, email, password, role = 'user', location, serviceProvider, phone } = req.body || {};

  if (!fullNames || !email || !password) {
    throw new CustomError.BadRequestError('Please fill in full names, email, and password');
  }

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new CustomError.BadRequestError('User already exists with this email');
  }

  // Base user data
  let userData = {
    fullNames,
    email,
    password,
    role,
    location,
    phone,
  };

  // service_provider workflow
  if (role === 'service_provider') {
    const {
      documents,
      profession,
      businessName,
      bio,
      experience,
      availability,
      pricingModel,
      pricing,
      portfolio,
      profileImage,
      language = 'en',
    } = serviceProvider || {};

    const { governmentId, liveSelfie } = documents || {};

    // Validate provider fields
    serviceProviderErrorLogs({ documents, profession, bio, experience, pricing, portfolio, profileImage, phone });

    // validate user identity 
    const checkUserValidity = await checkForKyc(governmentId, liveSelfie);

    if (!checkUserValidity.isMatch) {
        throw new CustomError.BadRequestError('KYC verification failed')
    }

    let createProviderServices = {
      verificationStatus: 'pending',
      documents,
      profession,
      businessName,
      bio,
      experience,
      availability,
      pricingModel,
      pricing,
      portfolio,
      profileImage,
      language,
      phone,
    };

    userData.serviceProvider = createProviderServices;
  }

  // Create user
  const user = await User.create(userData);

  // add background queue for embedding 
  await embeddingQueue.add('generate-embedding', {
    userId: user._id.toString(),
    text: `Fullnames: ${user.fullNames}
     Email: ${user.email} 
     Location: ${user.location || ''} 
     Service: ${user?.serviceProvider?.profession || ''}
     Service Description: ${user?.serviceProvider?.bio || ''}
     `,
  });

  const token = {
    userId: user._id,
    role: user.role
    }

    createCookies(res, token)

    res.status(StatusCodes.CREATED).json({
        success: true,
        message: `Registration completed! ${user.role === 'service_provider'
        ? 'Verification will be sent to email as soon as confirmation is complete'
        : 'Check your email for verification'
        }`,
    });
};


const login = async(req, res) => {
    try {
        const {email, password} = req.body;

         // auth verification 
        if (!email || !password) {
            throw new CustomError.BadRequestError('Email and Password are required');
        }

        const user = await User.findOne({email})
        if (!user) {
            throw new CustomError.NotFoundError('User not found');
        }

        if (user.oauthProvider) {
            throw new CustomError.BadRequestError(`This account is linked with ${user.oauthProvider}. Please use ${user.oauthProvider} to login`)
        }

        // check if account is locked 
        if (user.isLocked) {
            throw new CustomError.BadRequestError(`Account temporarily locked due to too many failed login attempts`)
        }

        const passowrdIsMatch = await user.comparePassword(password);
        if (!passowrdIsMatch) {
            await user.incrementLoginAttempts()
            throw new CustomError.BadRequestError('Incorrect password')
        }

        // reset login attempts 
        await user.resetLoginAttempts()


        user.lastLoginMethod = 'email'
        await user.save();

         const token = {
            userId: user._id,
            role: user.role
        }

        createCookies(res, token)
        res.status(StatusCodes.OK).json({
            success: true,
            msg: `Login successful`
        })


    } catch (error) {
        throw new CustomError.BadRequestError(`${error.message}`)
    }
}

const oauthCallback = async(req, res) => {
    try {

        if (!req.user) {  
            return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
        }

        const token = {
            userId: req.user._id,
            role: req.user.role
            
        };

        createCookies(res, token);
        res.redirect(`${process.env.CLIENT_URL}`);

    } catch (error) {
        console.error('Oauth error', error)
        res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`)
    }
}

const forgotPassword = async(req, res) => {
    const { email } = req.body 

    if (!email) {
        throw new CustomError.BadRequestError('Please input email') 
    }

    const user = await User.findOne({
        email,
    })

    if (!user) {
        throw new CustomError.BadRequestError(`User not found!`)
    }
 
    const token = uuidv4()
    const tokenExpiry = Date.now() + 24 * (60 * 60 * 1000)

    user.resetPasswordToken = token
    user.resetPasswordExpiry = tokenExpiry


    await user.save()

    const protocol = req.protocol; 
    const host = req.get('host'); 
    const reset_url = `${protocol}://${host}/change-password?token=${token}`;
    

    // await resetPasswordEmail({email, reset_url})
    res.status(200).json({ msg: `Reset link has been sent to ${email}`, token })
} 



const resetPassword = async(req, res) => {
    const { token, newPassword, confirmPassword } = req.body

    if (!token) {
        throw new CustomError.BadRequestError('No token found')
    }  

    if (!newPassword || !confirmPassword) {
        throw new CustomError.BadRequestError('Please fill up credentials')
    } 

    if (newPassword !== confirmPassword) {
        throw new CustomError.BadRequestError('Passwords donot match')
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpiry: {
            $gt: Date.now()
        }
    })
  
    if (!user) { 
        throw new CustomError.BadRequestError('Invalid token') 
    }  
 
    user.password = newPassword
    await user.save() 
   
    const newtoken = {
        userId: user._id, 
        role: user.role
    }

    createCookies(res, newtoken)  
    res.status(StatusCodes.OK).json({msg: 'Password updated successfully'})
}
 



const testVerification = async(req, res) => {
    const {governmentId, liveSelfie} = req.body

    if (!governmentId || !liveSelfie) {
        throw new CustomError.BadRequestError('Please fill up credentials')
    }

    try {
        const checkUserValidity = await checkForKyc(governmentId, liveSelfie);

    // if (!checkUserValidity.isMatch) {
    //     throw new CustomError.BadRequestError('KYC verification failed')
    // }

    res.status(StatusCodes.OK).json({
        success: true,
        checkUserValidity
    })
    } catch (error) {
        throw new CustomError.BadRequestError(`${error}`)
    }
}


const logout = async(req, res) => {
    res.cookie('token', 'logout', {
        // httpOnly: true,
        // sameSite: 'none',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        signed: true,
        expires: new Date(Date.now()),
    })
    res.status(StatusCodes.OK).json({
        msg: `User logged out successfully`,
    })
} 




module.exports = {
  register,
  login,
  oauthCallback,
  forgotPassword,
  resetPassword,
  login,
  testVerification
};
