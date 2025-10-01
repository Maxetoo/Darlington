const User = require('../db/userModel')
const CustomError = require('../errors')
const { StatusCodes } = require('http-status-codes')




// get me 
const myProfile = async(req, res) => {
    const {userId} = req.user
    const user = await User.findOne({_id: userId}).select('-password -embedding')
    if (!user) {
        throw new CustomError.BadRequestError('User not found')
    }
    res.status(StatusCodes.OK).json({user}) 
}


// @admin 
// get all users 
const getUsers = async(req, res) => {

    const {
            search,
            limit = 5,
            page = 1,
            select
        } = req.query
    
    const totalUsers = await User.countDocuments()
    const users = await User.find({
        $or: [
            {
                fullNames: {
                    $regex: search || '',
                    $options: 'i'
                },
            },            
            {
                email: {
                    $regex: search || '',
                    $options: 'i'
                }
            },
            {
                role: {
                    $regex: search || '',
                    $options: 'i'
                }
            }
        ]
        })
            .limit(parseInt(limit))
            .skip(parseInt(limit) * (parseInt(page) - 1))
            .select(`-embedding -password`)

        const totalPages = Math.ceil(totalUsers / limit);
        
        res.status(StatusCodes.OK).json({ 
            users, 
            count: totalUsers,
            totalPages,
            currentPage: parseInt(page),
            perPage: parseInt(limit),
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1,
        })
}


// @admin 
// get single user 
const getSingleUser = async(req, res) => {
    const {id} = req.params
    if (!id) {
        throw new CustomError.NotFoundError('No id found')
    }
    const user = await User.findOne({_id: id}).select('-password -embedding')
    if (!user) {
        throw new CustomError.BadRequestError('No user found')
    }
    res.status(StatusCodes.OK).json({ user})
}


// @admin 
// update single user 
const updateUser = async(req, res) => {
    const { id } = req.params
    if (!id) {
        throw new CustomError.BadRequestError(`User id must be specified`)
    }

    const user = await User.findOneAndUpdate({
        _id: id
    }, req.body, {
        new: true,
        runValidators: true
    }).select('-password -embedding')

    if (!user) {
        throw new CustomError.BadRequestError('No user found')
    }
    res.status(StatusCodes.OK).json({ user })
}


// @admin 
// delete single user 
const deleteUser = async(req, res) => {
    const {id} = req.params

    if (!id) {
        throw new CustomError.BadRequestError(`User id must be specified`)
    }

    const user = await User.findOneAndDelete({
        _id: id
    })

    if (!user) {
        throw new CustomError.BadRequestError('No user found')
    }

    res.status(StatusCodes.OK).json({msg: `User deleted successfully` })
}





module.exports = {
    myProfile,
    getUsers,
    getSingleUser,
    updateUser,
    deleteUser,

}