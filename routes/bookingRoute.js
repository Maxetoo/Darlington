const express = require('express');
const BookingRoute = express.Router();
const { 
    createBooking
    } = require('../controllers/bookingController');
const { authentication, authorization } = require('../middlewares/authentication')

BookingRoute.route('/').post(authentication, createBooking)
// BookingRoute.route('/featured').get(getFeaturedBlogs)
// BookingRoute.route('/:id').get(getSingleBlog).delete(authentication, deleteBlog).patch(authentication, updateBlog)
// BookingRoute.route('/:id/like').post(authentication, likeBlog)
// BookingRoute.route('/:id/comment').post(authentication, addComment).delete(authentication, deleteComment)

module.exports = BookingRoute