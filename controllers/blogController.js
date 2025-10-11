const BlogPost = require('../db/blogPostModel');
const User = require('../db/userModel');
const CustomError = require('../errors');
const {StatusCodes} = require('http-status-codes')
const contentReviewQueue = require('../events/contentReviewEvent');
const reviewContent = require('../helpers/content/reviewContent');


const createBlog = async (req, res) => {
  const {userId} = req.user

  if (!userId) {
    throw new CustomError.BadRequestError(`Please sign in`)
  }

  const {
    title,
    content,
    featuredImage,
    images,
    videos,
    category,
    tags,
    culturalAspects,
    metaTitle,
    metaDescription,
  } = req.body;

  // Generate slug from title
  const slug = title?.toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');


  const blogPost = await BlogPost.create({
    author: userId,
    title,
    slug,
    content,
    category,
    tags,
    culturalAspects,
    images,
    videos,
    featuredImage: featuredImage || images?.[0] || null,
    metaTitle,
    metaDescription,
    status: 'pending_review'
  });

  // Update user stats
  await User.findByIdAndUpdate(userId, {
    $inc: { 'stats.blogPosts': 1 }
  });

  const populatedBlog = await BlogPost.findById(blogPost._id)
    .populate('author', 'fullNames profileImage');

  await contentReviewQueue.add('content-review-queue', {
        blogId: blogPost._id,
        text: `
          title: ${blogPost.title},
          content: ${blogPost.content}`,
    });

  res.status(StatusCodes.CREATED).json({
    success: true,
    blog: populatedBlog
  });
};

const getSingleBlog = async (req, res) => {
  const { id } = req.params;
  
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 4));
  const skip = (page - 1) * limit;

  if (!id) {
    throw new CustomError.BadRequestError('Blog id is required');
  }

  // Fetch blog without populating all comments
  const blog = await BlogPost.findById(id)
    .populate('author', 'fullNames profileImage')
    .select('-comments'); // Exclude comments initially

  if (!blog || blog.status !== 'published') {
    throw new CustomError.NotFoundError('Blog post not found');
  }

  // Increment view count
  blog.views += 1;
  await blog.save();

  // Fetch paginated comments separately
  const blogWithComments = await BlogPost.findById(id)
    .select('comments commentCount')
    .populate({
      path: 'comments.user',
      select: 'fullNames profileImage'
    })
    .lean();

  // Slice comments for pagination (newest first)
  const allComments = blogWithComments.comments || [];
  const totalComments = blogWithComments.commentCount || allComments.length;
  const totalLikes = blog.likeCount || 0;
  const paginatedComments = allComments
    .slice()
    .reverse() // Show newest first
    .slice(skip, skip + limit);

  // Check if user has liked this post
  let hasLiked = false;
  if (req.user) {
    hasLiked = blog.likes.find(like => like.user.toString() === req.user.userId);
  }

  res.status(StatusCodes.OK).json({
    blog: {
      ...blog.toObject(),
      hasLiked,
      comments: paginatedComments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        totalLikes,
        commentsPerPage: limit,
        hasNextPage: skip + limit < totalComments,
        hasPrevPage: page > 1
      }
    }
  });
};



const getAllBlogs = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category;
  const status = req.query.status;
  const createdBy = req.query.createdBy;
  const search = req.query.search;
  const tags = req.query.tags;

  // Build query
  const query = {  };
  
  if (category) {
    query.category = category;
  }

  if (status) {
    query.status = status;
  }

  if (createdBy) {
    query.author = createdBy;
  }
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
    ];
  }
  
  if (tags) {
    query.tags = { $in: tags.split(',') };
  }

  const blogs = await BlogPost.find(query)
    .populate('author', 'fullNames profileImage')
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select('-content');

  const total = await BlogPost.countDocuments(query);

  res.json({
    success: true,
    blogs,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
};


const updateBlog = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  let message;

  if (!id) {
    throw new CustomError.BadRequestError('Blog ID is required');
  }

  if (!userId) {
    throw new CustomError.BadRequestError('Please sign in');
  }

  const blog = await BlogPost.findById(id);
  if (!blog) {
    throw new CustomError.NotFoundError('Blog not found');
  }

  // Check ownership
  if (blog.author.toString() !== userId && req.user.role !== 'admin') {
    throw new CustomError.UnauthorizedError('Unauthorized for this request');
  }

  // Handle slug generation only if title exists
  const title = req.body.title || blog.title;
  const slug = title
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');

  // Admin can feature blog
  if (req.user.role === 'admin' && req.body.isFeatured) {
    blog.isFeatured = true;
    blog.featuredUntil = req.body.featuredUntil || null;
  }

  // Re-review content if title or content updated
  if (req.body.title || req.body.content) {
    blog.title = req.body.title || blog.title;
    blog.content = req.body.content || blog.content;
    blog.slug = slug;

    await contentReviewQueue.add('content-review-queue', {
      blogId: blog._id,
      text: `title: ${blog.title}, content: ${blog.content}`,
    });

    blog.status = 'pending_review';
    message = 'Blog update is under review';
  }

  // Apply other updatable fields safelyxs
  Object.keys(req.body).forEach((key) => {
    if (!['title', 'content', 'isFeatured', 'featuredUntil'].includes(key)) {
      blog[key] = req.body[key];
    }
  });

  await blog.save();

  res
    .status(StatusCodes.OK)
    .json({ msg: message || 'Blog updated successfully'});
};



const deleteBlog = async (req, res) => {
  const {id} = req.params;
  const {userId} = req.user || {}

   if (!id) {
    throw new CustomError.BadRequestError('Blog id is required')
  }

  if (!userId) {
    throw new CustomError.BadRequestError('Please sign in')
  }


  const blog = await BlogPost.findById(id);
  if (!blog) {
    throw new CustomError.NotFoundError('Blog not found')
  }

  // Check ownership
  if (blog.author.toString() !== userId && req.user.role !== 'admin') {
    throw new CustomError.BadRequestError('Unauthorised for this request')
  }

  await blog.deleteOne();

  // Update user stats
  await User.findByIdAndUpdate(blog.author, {
    $inc: { 'stats.blogPosts': -1 }
  });

  res.status(StatusCodes.OK).json({msg: 'Blog deleted successfully'});
};


const likeBlog = async (req, res) => {
  const {id} = req.params;
  const {userId} = req.user || {}

   if (!id) {
    throw new CustomError.BadRequestError('Blog id is required')
  }

  if (!userId) {
    throw new CustomError.BadRequestError('Please sign in')
  }

  const blog = await BlogPost.findById(id);

  if (!blog) {
    throw new CustomError.NotFoundError('Blog post not found')
  }


  const findLikeIndex = blog.likes.findIndex(
    like => like?.user?.toString() === userId
  );

  if (findLikeIndex > -1) {
    // unlike or remove from like array 
    blog.likes.remove(blog.likes[findLikeIndex])
    blog.likeCount -= 1
  } else {
    // like or add to like array
    blog.likes.push({user: userId})
    blog.likeCount += 1
  }

  await blog.save()

  res.status(StatusCodes.OK).json({
    liked: findLikeIndex === -1,
    likeCount: blog.likeCount
  })
};

const addComment = async (req, res) => {
  const { comment } = req.body;
  const { id } = req.params;
  const { userId } = req.user || {};

  // Early validation (no DB calls yet)
  if (!id) { 
    throw new CustomError.BadRequestError('Blog id is required');
  }

  if (!comment) {
    throw new CustomError.BadRequestError('Comment is required');
  }

  // Run all checks in parallel for maximum speed
  const [checkContent, blog, user] = await Promise.all([
    reviewContent(comment),
    BlogPost.findById(id).select('_id comments commentCount status'),
    // Fetch user data now so we have it ready
    req.user ? User.findById(userId).select('fullNames profileImage').lean() : null
  ]);

  // Check blog existence
  if (!blog) {
    throw new CustomError.NotFoundError('Blog post not found');
  }

  // Check content suitability
  if (!checkContent?.suitable) {
    throw new CustomError.BadRequestError(
      `Comment rejected: ${checkContent?.reason || 'Inappropriate content'}`
    );
  }

  // Create and add new comment
  const newComment = {
    user: userId,
    content: comment,
    createdAt: new Date()
  };

  blog.comments.push(newComment);
  blog.commentCount += 1;
  
  await blog.save();

  // Get the saved comment with its generated _id
  const savedComment = blog.comments[blog.comments.length - 1];

  // Return with user data we already fetched
  res.status(StatusCodes.OK).json({
    comment: {
      _id: savedComment._id,
      user: user,
      content: savedComment.content,
      createdAt: savedComment.createdAt
    }
  });
};


const deleteComment = async (req, res) => {
  const {id} = req.params;
  const {commentId} = req.query
  const {userId} = req.user || {}


  if (!id) {
    throw new CustomError.BadRequestError('Blog id is required')
  }

  const blog = await BlogPost.findById(id);

  if (!blog) {
    throw new CustomError.NotFoundError('Blog post not found')
  }

  if (!commentId) {
    throw new CustomError.BadRequestError('Comment id is required')
  }

  const comment = blog.comments.id(commentId);
  
  if (!comment) {
    throw new CustomError.NotFoundError('Comment not found')
  }

  // Check if user owns comment or is admin
  if (comment.user.toString() !== userId && req.user.role !== 'admin') {
    throw new CustomError.BadRequestError('Unauthorised for this request')
  }

  comment.deleteOne();
  blog.commentCount -= 1;
  await blog.save();

  res.status(StatusCodes.OK).json({
    msg: 'Comment deleted'
  });
};


const getFeaturedBlogs = async (req, res) => {

  const blogs = await BlogPost.find({
    status: 'published',
    isFeatured: true,
    $or: [
      { featuredUntil: { $exists: false } },
      { featuredUntil: { $gte: new Date() } }
    ]
  })
  .populate('author', 'fullNames profileImage')
  .sort({ publishedAt: -1 })
  .limit(5)
  .select('-content');


  res.status(StatusCodes.OK).json({
    blogs
  });

};

module.exports = {
  createBlog,
  getAllBlogs,
  deleteBlog,
  updateBlog,
  getSingleBlog,
  likeBlog,
  addComment,
  getFeaturedBlogs,
  deleteComment,
};
