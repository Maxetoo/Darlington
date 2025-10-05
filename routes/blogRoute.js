const express = require('express');
const BlogRoute = express.Router();
const { 
    getAllBlogs,
    getSingleBlog,
    createBlog,
    deleteBlog,
    likeBlog,
    addComment
    } = require('../controllers/blogController');
const { authentication, authorization } = require('../middlewares/authentication')

BlogRoute.route('/').get(getAllBlogs).post(authentication, createBlog)
BlogRoute.route('/:id').get(getSingleBlog).delete(authentication, deleteBlog)
BlogRoute.route('/:id/like').post(authentication, likeBlog) 
BlogRoute.route('/:id/comment').post(authentication, addComment) 

module.exports = BlogRoute