const { StatusCodes } = require('http-status-codes')
const { signJwt } = require('../handlers/authHandler')
const CustomError = require('../errors')

const authentication = (req, res, next) => {
    const authToken = req.signedCookies.token
    if (!authToken) {
        throw new CustomError.UnauthorizedError('Not authenticated')
    }
    const user = signJwt(authToken)
    req.user = user
    next()
}


const authorization = (req, res, next) => {
    const { role } = req.user
    if (role !== 'admin') {
        throw new CustomError.UnauthorizedError('Not authorized')
    }
    next()
}

const checkUser = (req, res, next) => {
    const authToken = req.signedCookies.token || ''
    if (authToken) {
        const user = signJwt(authToken)
        req.user = user
    }
    next()
}

module.exports = {
    authentication,
    authorization,
    checkUser
}