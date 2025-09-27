const User = require('../db/userModel')
const CustomError = require('../errors')
const { StatusCodes } = require('http-status-codes')

const myProfile = async(req, res) => {
    const {userId} = req.user
    const user = await User.findOne({_id: userId}).select('-password')
    if (!user) {
        throw new CustomError.BadRequestError('User not found')
    }

    res.status(StatusCodes.OK).json({user}) 
}

const getUsers = async(req, res) => {

    const {
            search,
            limit = 10,
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
            }
        ]
        }).select(select)
            .limit(parseInt(limit))
            .skip(parseInt(limit) * (parseInt(page) - 1))

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

const getSingleUser = async(req, res) => {
    const {id} = req.params

    if (!id) {
        throw new CustomError.NotFoundError('No id found')
    }
    const user = await User.findOne({_id: id}).populate('-password')

    if (!user) {
        throw new CustomError.BadRequestError('No user found')
    }
    res.status(StatusCodes.OK).json({ user})
}


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
    })

    if (!user) {
        throw new CustomError.BadRequestError('No user found')
    }
    res.status(StatusCodes.OK).json({ user })
}



const getAllUsersCount = async(req, res) => {
    const users = await User.find({})
    res.status(StatusCodes.OK).json({
        totalCount: users.length
    })
};


const getAllAdmins = async(req, res) => {
    const users = await User.find({ role: 'admin' })
    res.status(StatusCodes.OK).json({ users })
}


const manageRole = async(req, res) => {
    const getId = req.user.userId
    const { id } = req.params


    if (!id) {
        throw new CustomError.NotFoundError('No id found')
    }

    
    const findSuperAdmin = await User.findOne({})
    if (findSuperAdmin._id.toString() === getId) {
        await User.findOneAndUpdate({
            _id: id
        }, {
            isAdmin: false
        }, {
            new: true,
            runValidators: true
        })
    } else {
        throw new CustomError.BadRequestError('Not authorised for this request')
    }


    res.status(StatusCodes.OK).json({ msg: "User removed from admin" })
}






module.exports = {
    myProfile,
    getAllUsersCount,
    authorizeUser,
    getUserAddresses,
    updateUserAddressDetails,
    addAddressDetails,
    editSingleAddress,
    deleteSingleAddress,
    clearAllAddresses,
    getAllAdmins,
    updateUser,
    getUsers,
    getSingleUser,
    manageAdmins
}