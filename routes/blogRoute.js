const express = require('express');
const BlogRoute = express.Router();
const { 
    getAllBlogs,
    getSingleBlog,
    createBlog,
    deleteBlog,
    likeBlog,
    updateBlog,
    addComment,
    deleteComment,
    getFeaturedBlogs
    } = require('../controllers/blogController');
const { authentication, authorization } = require('../middlewares/authentication')

BlogRoute.route('/').get(getAllBlogs).post(authentication, createBlog)
BlogRoute.route('/featured').get(getFeaturedBlogs)
BlogRoute.route('/:id').get(getSingleBlog).delete(authentication, deleteBlog).patch(authentication, updateBlog)
BlogRoute.route('/:id/like').post(authentication, likeBlog)
BlogRoute.route('/:id/comment').post(authentication, addComment).delete(authentication, deleteComment)

module.exports = BlogRoute