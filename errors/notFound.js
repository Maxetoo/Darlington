const CustomError = require('./customError');
const { StatusCodes } = require('http-status-codes');

class NotFoundError extends CustomError {
    constructor(message) {
        super(message)
        this.statuscode = StatusCodes.NOT_FOUND
    }
}

module.exports = NotFoundError