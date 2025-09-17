const { StatusCodes } = require('http-status-codes');

const errorHandlerMiddleware = (err, req, res, next) => {
    let customerror = {
        statuscode: err.statuscode || StatusCodes.INTERNAL_SERVER_ERROR,
        msg: err.message || 'something went wrong'
    }

    if (err.name === 'ValidationError') {
        customerror.msg = Object.values(err.errors).map((item) => item.message).join(',').replace('User validation failed: ','');
        customerror.statuscode = 400
    }
    if (err.code && err.code === 11000) {
        customerror.msg = `Duplicate value entered for ${Object.keys(
      err.keyValue
    )} field, please choose another value`
        customerror.statuscode = 400
    }
    if (err.name === 'CastError') {
        customerror.msg = `Id : ${err.value} not found`
        customerror.statuscode = 404
    }

    return res.status(customerror.statuscode).json({ msg: customerror.msg })
}


module.exports = errorHandlerMiddleware