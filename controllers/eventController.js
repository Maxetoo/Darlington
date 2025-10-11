const Event = require('../db/eventModel');
const User = require('../db/userModel');
const CustomError = require('../errors');
const {StatusCodes} = require('http-status-codes')
const eventReviewQueue = require('../events/eventReviewEvent');


const createEvent = async (req, res) => {

  const {userId} = req.user || {}

  if (!userId) {
    throw new CustomError.BadRequestError(`Please sign in`)
  }

  const {
    title,
    description,
    images,
    location,
    startDate,
    endDate,
    category,
    tags,
    culturalAspects,
    ticketLink,
    contactInfo
  } = req.body;

  // Generate slug from title
  const slug = title?.toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-') + '-' + Date.now();

  const event = await Event.create({
    publisher: userId,
    title,
    slug,
    description,
    images,
    location,
    startDate,
    endDate,
    category,
    tags,
    culturalAspects,
    ticketLink,
    contactInfo,
    bannerImage: images?.[0] || null,
    status: 'pending_review'
  });

  // Update user stats
  await User.findByIdAndUpdate(userId, {
    $inc: { 'stats.eventsPosted': 1 }
  });

  const populatedEvent = await Event.findById(event._id)
    .populate('publisher', 'fullNames profileImage');

  await eventReviewQueue.add('event-review-queue', {
        eventId: event._id,
        text: `
            title: ${event.title},
            content: ${event.ticketLink}`,
    });

  res.status(StatusCodes.OK).json({
    success: true,
    event: populatedEvent
  });
};

const getAllMyEvents = async (req, res) => {
  const {userId} = req.user || {}
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 7;
  const status = req.query.status
  const city = req.query.city;
  const search = req.query.search;
  const country = req.query.country;
  const upcoming = req.query.upcoming === 'true';

  if (!userId) {
    throw new CustomError.BadRequestError('Please sign in');
  }

  // Build query
  const query = { 
    publisher: userId
  };

  if (status) {
    if (status === 'all') {
      delete query.status;
    } else {
      query.status = status;
    }
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  
  
  if (city) {
    query['location.address.city'] = new RegExp(city, 'i');
  }
  
  if (country) {
    query['location.address.country'] = new RegExp(country, 'i');
  }
  
  if (upcoming) {
    query.startDate = { $gte: new Date() };
  }

  const events = await Event.find(query)
    .sort({ startDate: 1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select('-description')

  const total = await Event.countDocuments(query);

  res.status(StatusCodes.OK).json({
    success: true,
    events,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });

}


const getAllEvents = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 7;
  const category = req.query.category;
  const status = req.query.status
  const createdBy = req.query.createdBy;
  const city = req.query.city;
  const search = req.query.search;
  const country = req.query.country;
  const upcoming = req.query.upcoming === 'true';

  // check if user or admin is logged in 
  const user = req?.user || {};

  // Build query
  const query = { 
    status: 'published'
  };
  
  if (category) {
    query.category = category;
  } 

   if (user && user?.role === 'admin' && status) {
      if (status === 'all') {
        delete query.status;
      } else {
        query.status = status;
      }
  }

  if (createdBy) {
    query.publisher = createdBy;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  
  
  if (city) {
    query['location.address.city'] = new RegExp(city, 'i');
  }
  
  if (country) {
    query['location.address.country'] = new RegExp(country, 'i');
  }
  
  if (upcoming) {
    query.startDate = { $gte: new Date() };
  }

  const events = await Event.find(query)
    .populate('publisher', 'fullNames profileImage')
    .sort({ startDate: 1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select('-description')

  const total = await Event.countDocuments(query);

  res.status(StatusCodes.OK).json({
    success: true,
    events,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total
    }
  });
};

const getSingleEvent = async (req, res) => {
  const event = await Event.findById(req.params.id)
    .populate('publisher', 'fullNames profileImage contactInfo')


    if (!event || event.status !== 'published') {
      throw new CustomError.NotFoundError('Event not found')
  }

  // Increment view count
  event.views += 1;
  await event.save();

  res.status(StatusCodes.OK).json({
    success: true,
    event: {
      ...event.toObject(),
    }
  });
};

const updateEvent = async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.userId;
  let message;

  if (!id) {
    throw new CustomError.BadRequestError('Event ID is required');
  }

  if (!userId) {
    throw new CustomError.BadRequestError('Please sign in');
  }

  const event = await Event.findById(id);
  if (!event) {
    throw new CustomError.NotFoundError('Event not found');
  }

  // Check ownership
  if (event.publisher.toString() !== userId && req.user.role !== 'admin') {
    throw new CustomError.UnauthorizedError('Unauthorized for this request');
  }

  // Handle slug generation only if title exists
  const title = req.body.title || event.title;
  const slug = title?.toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-') + '-' + Date.now();

  // Admin can feature event
  if (req.user.role === 'admin' && req.body.isFeatured) {
    event.isFeatured = true;
    event.featuredUntil = req.body.featuredUntil || null;
  }

  // Re-review content if title or content updated
  if (req.body.title || req.body.description || req.body.ticketLink) {
    event.title = req.body.title || event.title;
    event.description = req.body.description || event.description;
    event.slug = slug;

    await eventReviewQueue.add('event-review-queue', {
        eventId: event._id,
        text: `
            title: ${event.title},
            content: ${event.ticketLink}`,
    });

    event.status = 'pending_review';
    message = 'Event update is under review';
  }

  // Apply other updatable fields safely
  Object.keys(req.body).forEach((key) => {
    if (!['title', 'description', 'isFeatured', 
      'featuredUntil', 'ticketLink', 'location', 
      'startDate', 'endDate'].includes(key)) {
      event[key] = req.body[key];
    }
  });

  await event.save();

  res
    .status(StatusCodes.OK)
    .json({ msg: message || 'Event updated successfully'});
};


const deleteEvent = async (req, res) => {
  const {id} = req.params;
  const {userId} = req.user || {}

   if (!id) {
    throw new CustomError.BadRequestError('Event id is required')
  }

  if (!userId) {
    throw new CustomError.BadRequestError('Please sign in')
  }


  const event = await Event.findById(id);

  if (!event) {
    throw new CustomError.NotFoundError('Event not found')
  }

  // Check ownership
  if (event.publisher.toString() !== userId && req.user.role !== 'admin') {
    throw new CustomError.BadRequestError('Unauthorised for this request')
  }

  await event.deleteOne();

  // Update user stats
  await User.findByIdAndUpdate(userId, {
    $inc: { 'stats.eventsPosted': -1 }
  });

  res.status(StatusCodes.OK).json({msg: 'Event deleted successfully'});
};

const likeEvent = async (req, res) => {
  const {id} = req.params;
  const {userId} = req.user || {}

  if (!id) {
    throw new CustomError.BadRequestError('Event id is required')
  }

  if (!userId) {
    throw new CustomError.BadRequestError('Please sign in')
  }

  const event = await Event.findById(id);

  if (!event) {
    throw new CustomError.NotFoundError('Event not found')
  }


  const findLikeIndex = event.likes.findIndex(
    like => like?.user?.toString() === userId
  );

  if (findLikeIndex > -1) {
    // unlike or remove from like array 
    event.likes.remove(blog.likes[findLikeIndex])
    event.likeCount -= 1
  } else {
    // like or add to like array
    event.likes.push({user: userId})
    event.likeCount += 1
  }

  await event.save()

  res.status(StatusCodes.OK).json({
    liked: findLikeIndex === -1,
    likeCount: event.likeCount
  })
};

const addEventComment = async (req, res) => {
  const { comment } = req.body;
  const { id } = req.params;
  const { userId } = req.user || {};

  // Early validation (no DB calls yet)
  if (!id) { 
    throw new CustomError.BadRequestError('Event id is required');
  }

  if (!comment) {
    throw new CustomError.BadRequestError('Comment is required');
  }

  // Run all checks in parallel for maximum speed
  const [checkContent, event, user] = await Promise.all([
    reviewContent(comment),
    Event.findById(id).select('_id comments commentCount status'),
    // Fetch user data now so we have it ready
    req.user ? User.findById(userId).select('fullNames profileImage').lean() : null
  ]);

  // Check event existence
  if (!event) {
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

  event.comments.push(newComment);
  event.commentCount += 1;

  await event.save();

  // Get the saved comment with its generated _id
  const savedComment = event.comments[event.comments.length - 1];

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


const deleteEventComment = async (req, res) => {
  const {id} = req.params;
  const {commentId} = req.query
  const {userId} = req.user || {}


  if (!id) {
    throw new CustomError.BadRequestError('Event id is required')
  }

  const event = await Event.findById(id);

  if (!event) {
    throw new CustomError.NotFoundError('Event not found')
  }

  if (!commentId) {
    throw new CustomError.BadRequestError('Comment id is required')
  }

  const comment = event.comments.id(commentId);
  
  if (!comment) {
    throw new CustomError.NotFoundError('Comment not found')
  }

  // Check if user owns comment or is admin
  if (comment.user.toString() !== userId && req.user.role !== 'admin') {
    throw new CustomError.BadRequestError('Unauthorised for this request')
  }

  comment.deleteOne();
  event.commentCount -= 1;
  await event.save();

  res.status(StatusCodes.OK).json({
    msg: 'Comment deleted'
  });
};


const getFeaturedEvents = async (req, res) => {

  const events = await Event.find({
    status: 'published',
    isFeatured: true,
    $or: [
      { featuredUntil: { $exists: false } },
      { featuredUntil: { $gte: new Date() } }
    ]
  })
  .populate('publisher', 'fullNames profileImage')
  .sort({ publishedAt: -1 })
  .limit(5)
  .select('-description');


  res.status(StatusCodes.OK).json({
    events
  });

};



module.exports = {
  createEvent,
  getAllMyEvents,
  getAllEvents,
  getSingleEvent,
  updateEvent,
  deleteEvent,
  likeEvent,
  addEventComment,
  deleteEventComment,
  getFeaturedEvents

};