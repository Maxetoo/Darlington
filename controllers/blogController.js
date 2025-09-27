const BlogPost = require('../db/blogPostModel');
const User = require('../db/userModel');

// @desc    Create new blog post
// @route   POST /api/blogs
// @access  Private (Users only)
const createBlog = async (req, res) => {
  const {
    title,
    excerpt,
    content,
    category,
    tags,
    culturalAspects,
    metaTitle,
    metaDescription
  } = req.body;

  // Generate slug from title
  const slug = title.toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');

  // Handle uploaded images
  let images = [];
  // if (req.files) {
  //   images = req.files.map(file => file.path);
  // }

  const blogPost = await BlogPost.create({
    author: req.user.id,
    title,
    slug,
    excerpt,
    content,
    category,
    tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
    culturalAspects,
    images,
    featuredImage: images[0] || null,
    metaTitle,
    metaDescription,
    status: 'pending_review' // All posts need approval
  });

  // Update user stats
  await User.findByIdAndUpdate(req.user.id, {
    $inc: { 'stats.blogPosts': 1 }
  });

  const populatedBlog = await BlogPost.findById(blogPost._id)
    .populate('author', 'fullNames profileImage');

  res.status(201).json({
    success: true,
    blog: populatedBlog
  });
};

// @desc    Get all blog posts
// @route   GET /api/blogs
// @access  Public
const getBlogs = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const category = req.query.category;
  const search = req.query.search;
  const tags = req.query.tags;

  // Build query
  const query = { status: 'published' };
  
  if (category) {
    query.category = category;
  }
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { excerpt: { $regex: search, $options: 'i' } }
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
    .select('-content'); // Exclude full content for list view

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
});

// @desc    Get single blog post
// @route   GET /api/blogs/:id
// @access  Public
const getBlog = asyncHandler(async (req, res) => {
  const blog = await BlogPost.findById(req.params.id)
    .populate('author', 'fullNames profileImage location')
    .populate('comments.user', 'fullNames profileImage');

  if (!blog || blog.status !== 'published') {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  // Increment view count
  blog.views += 1;
  await blog.save();

  // Check if user has liked this post
  let hasLiked = false;
  if (req.user) {
    hasLiked = blog.likes.some(like => like.user.toString() === req.user.id);
  }

  res.json({
    success: true,
    blog: {
      ...blog.toObject(),
      hasLiked
    }
  });
});

// @desc    Update blog post
// @route   PUT /api/blogs/:id
// @access  Private
const updateBlog = asyncHandler(async (req, res) => {
  const blog = await BlogPost.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  // Check ownership
  if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const updatedBlog = await BlogPost.findByIdAndUpdate(
    req.params.id,
    { ...req.body, status: 'pending_review' }, // Re-submit for review
    { new: true, runValidators: true }
  ).populate('author', 'fullNames profileImage');

  res.json({
    success: true,
    blog: updatedBlog
  });
});

// @desc    Delete blog post
// @route   DELETE /api/blogs/:id
// @access  Private
const deleteBlog = asyncHandler(async (req, res) => {
  const blog = await BlogPost.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  // Check ownership
  if (blog.author.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  await blog.deleteOne();

  // Update user stats
  await User.findByIdAndUpdate(blog.author, {
    $inc: { 'stats.blogPosts': -1 }
  });

  res.json({
    success: true,
    message: 'Blog post deleted'
  });
});

// @desc    Like/Unlike blog post
// @route   POST /api/blogs/:id/like
// @access  Private
const likeBlog = asyncHandler(async (req, res) => {
  const blog = await BlogPost.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  const likeIndex = blog.likes.findIndex(
    like => like.user.toString() === req.user.id
  );

  if (likeIndex > -1) {
    // Unlike
    blog.likes.splice(likeIndex, 1);
    blog.likeCount -= 1;
  } else {
    // Like
    blog.likes.push({ user: req.user.id });
    blog.likeCount += 1;
  }

  await blog.save();

  res.json({
    success: true,
    liked: likeIndex === -1,
    likeCount: blog.likeCount
  });
});

// @desc    Add comment to blog post
// @route   POST /api/blogs/:id/comments
// @access  Private
const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  
  const blog = await BlogPost.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  const comment = {
    user: req.user.id,
    content,
    createdAt: new Date()
  };

  blog.comments.push(comment);
  blog.commentCount += 1;
  await blog.save();

  const updatedBlog = await BlogPost.findById(req.params.id)
    .populate('comments.user', 'fullNames profileImage');

  res.json({
    success: true,
    comment: updatedBlog.comments[updatedBlog.comments.length - 1]
  });
});

// @desc    Delete comment
// @route   DELETE /api/blogs/:id/comments/:commentId
// @access  Private
const deleteComment = asyncHandler(async (req, res) => {
  const blog = await BlogPost.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: 'Blog post not found'
    });
  }

  const comment = blog.comments.id(req.params.commentId);
  
  if (!comment) {
    return res.status(404).json({
      success: false,
      message: 'Comment not found'
    });
  }

  // Check if user owns comment or is admin
  if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  comment.deleteOne();
  blog.commentCount -= 1;
  await blog.save();

  res.json({
    success: true,
    message: 'Comment deleted'
  });
});

// @desc    Get featured blog posts
// @route   GET /api/blogs/featured
// @access  Public
const getFeaturedBlogs = asyncHandler(async (req, res) => {
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

  res.json({
    success: true,
    blogs
  });
});

module.exports = {
  createBlog,
  getBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  likeBlog,
  addComment,
  deleteComment,
  getFeaturedBlogs
};
