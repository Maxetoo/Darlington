const BadRequestError = require('./badRequest')
const NotFoundError = require('./notFound')
const UnauthorizedError = require('./unAuthorised')

const CustomError = {
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
}

module.exports = CustomError