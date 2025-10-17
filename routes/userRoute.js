const express = require('express');
const UserRoute = express.Router();
const { 
    myProfile,
    getUsers,
    getSingleUser,
    updateUser,
    deleteUser} = require('../controllers/userController');
const { authentication, authorization } = require('../middlewares/authentication')

UserRoute.route('/myProfile').get(authentication, myProfile)
UserRoute.route('/getAllUsers').get(authentication, authorization, getUsers)
UserRoute.route('/getSingleUser/:id').get(authentication, authorization, getSingleUser)
UserRoute.route('/updateSingleUser/:id').patch(authentication, authorization, updateUser)
UserRoute.route('/deleteSingleUser/:id').delete(authentication, authorization, deleteUser)

module.exports = UserRoute 