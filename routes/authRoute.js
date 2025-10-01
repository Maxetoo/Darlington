const express = require('express');
const AuthRoute = express.Router()
const { register, testVerification, login, oauthCallback
} = require('../controllers/authController');
const passport = require('../configs/passport')


AuthRoute.route('/register').post(register)
AuthRoute.route('/login').post(login)
AuthRoute.route('/verification').post(testVerification)
AuthRoute.get('/google', 
    passport.authenticate('google', { 
        scope: ['profile', 'email'] 
    })
); 

AuthRoute.get('/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
        session: false 
    }),
    oauthCallback
);

module.exports = AuthRoute  