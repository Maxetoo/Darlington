const express = require('express');
const AuthRoute = express.Router()
const { register, testVerification
} = require('../controllers/authController');
// const passport = require('../configs/passport')


AuthRoute.route('/register').post(register)
AuthRoute.route('/verification').post(testVerification)

module.exports = AuthRoute 