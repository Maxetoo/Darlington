const Booking = require('../db/bookingModel');
const User = require('../db/userModel');
const {StatusCodes} = require('http-status-codes')
const CustomError = require('../errors')


// const searchServiceProvider = async (req, res) => {

// }


const createBooking = async (req, res) => {
  try {
   
    const userId = req.user?.userId;
    const {providerId, serviceName, pricingModel, servicePackageDetails, scheduledDate, duration, location, locationDetails, notes, paymentStatus, paymentReference, packageId, customerPhone} = req.body
    
    if (!userId) {
      throw new CustomError.BadRequestError('User not logged in')
    }

    if (!providerId) {
      throw new CustomError.BadRequestError('Provider id is required')
    }

    if (!serviceName) {
      throw new CustomError.BadRequestError('Name of service is required')
    }

    if (pricingModel === 'hourly' && !duration) {
      throw new CustomError.BadRequestError('Service duration is required for hourly package')
    }

    if (pricingModel === 'package' && !packageId) {
      throw new CustomError.BadRequestError('Package needs to be specified')
    }

    if (!customerPhone) {
      throw new CustomError.BadRequestError('Phone number is required')
    }


    // provider
    const provider = await User.findOne({_id: providerId, role: 'service_provider'});

    if (!provider) {
        throw new CustomError.NotFoundError(`Service provider not found`)
    }

    // check if provider is verified 
    if (provider.serviceProvider.verificationStatus !== 'approved'
    ) {
        throw new CustomError.BadRequestError(`Serice provider is ongoing approval`)
    }

    // check if provider is locked
    if (provider.isLocked) {
        throw new CustomError.BadRequestError(`Serice provider is currently booked`)
    }

    // determine location 
    // let bookingLocation = {}
    if (location === 'provider_location') {
      locationDetails = provider.location
    } 

    if (location !== 'provider_location') {
        if (!locationDetails || Object.keys(locationDetails).length === 0) {
          throw new CustomError.BadRequestError('Fill location details')
        }
    }

    // Check overlapping bookings
    const overlap = await Booking.findOne({
      providerId,
      scheduledDate: { $lte: new Date(scheduledDate.getTime() + duration * 60 * 1000) },
      status: { $in: ['pending', 'confirmed'] }
    });

    if (overlap) {
        throw new CustomError.BadRequestError(`Provider not available at this time`)
    }

    // calculate price
    let finalPrice = 0;
    if (pricingModel === 'hourly') {
      finalPrice = provider.pricing.find(p => p.type === 'hourly')?.amount * duration;
    } else if (pricingType === 'session') {
      finalPrice = provider.pricing.find(p => p.type === 'session')?.amount;
    } else if (pricingType === 'package') {
      const pack = provider.services.id(packageId);
      finalPrice = pack.price;
    }

    // Create booking
    const booking = new Booking({
      userId,
      providerId,
      serviceName,
      servicePrice: finalPrice,
      pricingModel,
      servicePackageDetails,
      scheduledDate,
      duration,
      status: 'pending',
      location,
      locationDetails,
      notes,
      paymentReference,
      paymentStatus,
      contactInformation: {
        customerPhone,
        serviceProviderPhone: provider.phone 
      }
    });

    await booking.save();

    // send email notification to user and service provider 

    // Emit socket event to provider
    req.io.to(providerId.toString()).emit("new_booking_request", booking);

    // Populate booking for response
    const populatedBooking = await Booking.findById(booking._id)
    .populate('userId', 'fullNames email')
    .populate('serviceProvider', 'fullNames email profileImage');


    res.status(StatusCodes.CREATED).json({ booking: populatedBooking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const userGetAllBookings = async (req, res) => {
  const user = req.user?.userId;
  const { date, status, limit = 7, page = 1, select } = req.query;

  const findUser = await User.findById(user);
  if (!findUser) throw new CustomError.BadRequestError('User not found');

  // Filter by userId and optional status
  let filter = { userId: user };
  if (status) filter.status = status;

  const totalCount = await Booking.countDocuments(filter);
  const totalPages = Math.ceil(totalCount / limit);

  // Sorting
  let sortOption = {};
  if (date) sortOption.scheduledDate = date === 'asc' ? 1 : -1;

  const bookings = await Booking.find(filter)
    .populate({
      path: 'providerId',
      select: 'email phone serviceProvider.profileImage serviceProvider.profession'
    })
    .select(select)
    .sort(sortOption)
    .limit(parseInt(limit))
    .skip(parseInt(limit) * (parseInt(page) - 1));

  if (bookings.length === 0) {
    throw new CustomError.NotFoundError('No bookings found');
  }

  res.status(StatusCodes.OK).json({
    bookings,
    totalBookings: totalCount,
    totalPages,
    currentPage: parseInt(page),
    perPage: parseInt(limit),
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  });
};


const providerGetAllBookings = async (req, res) => {
  const user = req.user?.userId;
  const { date, status, limit = 7, page = 1, select } = req.query;

  const findUser = await User.findById(user);
  if (!findUser) throw new CustomError.BadRequestError('User not found');

  // Filter by providerId and optional status
  let filter = { providerId: user };
  if (status) filter.status = status;

  const totalCount = await Booking.countDocuments(filter);
  const totalPages = Math.ceil(totalCount / limit);

  // Sorting
  let sortOption = {};
  if (date) sortOption.scheduledDate = date === 'asc' ? 1 : -1;

  const bookings = await Booking.find(filter)
    .populate({
      path: 'userId',
      select: 'email fullNames phone'
    })
    .select(select)
    .sort(sortOption)
    .limit(parseInt(limit))
    .skip(parseInt(limit) * (parseInt(page) - 1));

  if (bookings.length === 0) {
    throw new CustomError.NotFoundError('No bookings found');
  }

  res.status(StatusCodes.OK).json({
    bookings,
    totalBookings: totalCount,
    totalPages,
    currentPage: parseInt(page),
    perPage: parseInt(limit),
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  });
};


const getSingleBooking = async(req, res) => {
  const {id} = req.params;

  if (!id) {
    throw new CustomError.BadRequestError('Booking id needs to be specified');
  }

  const booking = await Booking.findById(id).populate({
      path: 'providerId',
      select: 'email phone serviceProvider.profileImage serviceProvider.profession'
    })
    .populate({
      path: 'userId',
      select: 'email fullNames phone'
    });

  if (!booking) {
    throw new CustomError.BadRequestError('Booking not found')
  }

  // check if unauthorised have access to booking 
  const currentUserId = req.user?.userId;

  if (
    currentUserId?.toString() !== booking.userId.toString() &&
    currentUserId?.toString() !== booking.providerId.toString() &&
    req.user?.role !== 'admin'
  ) {
    throw new CustomError.UnauthorizedError('Access denied');
  }

  res.status(StatusCodes.OK).json({
    booking
  })
}

const updateBooking = async (req, res) => {
  const { status, reason } = req.body;

  if (!status) {
    throw new CustomError.BadRequestError('Status is required')
  }

  // find booking
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw new CustomError.NotFoundError('Booking not found');
  }

  // permission checks
  const isProvider = booking.providerId.toString() === req.user?.userId;
  const isCustomer = booking.userId.toString() === req.user?.userId;
  const isAdmin = req.user?.role === 'admin';

  if (!isProvider && !isCustomer && !isAdmin) {
    throw new CustomError.UnauthorizedError('Access denied');
  }

  // restrict who can update specific statuses
  if (status === 'confirmed' && !isProvider && !isAdmin) {
    throw new CustomError.UnauthorizedError(
      'Only service provider or admin can confirm bookings'
    );
  }

  if (status === 'completed' && !isProvider && !isAdmin) {
    throw new CustomError.UnauthorizedError(
      'Only service provider or admin can mark as completed'
    );
  }

  if (status === 'cancelled' && !isCustomer && !isAdmin) {
    throw new CustomError.UnauthorizedError(
      'Only customer or admin can cancel a booking'
    );
  }

  // prevent multiple confirmed bookings for one provider
  if (status === 'confirmed') {
    const activeBooking = await Booking.findOne({
      providerId: booking.providerId,
      status: 'confirmed'
    });

    if (
      activeBooking &&
      activeBooking._id.toString() !== booking._id.toString()
    ) {
      throw new CustomError.BadRequestError(
        'Provider is already locked with another confirmed booking'
      );
    }

    // lock provider
    await User.findByIdAndUpdate(booking.providerId, {
      'serviceProvider.isLocked': true
    });
  }

  // update booking fields
  booking.status = status;
  booking.statusHistory.push({
    status,
    changedBy: req.user?.userId,
    reason,
    timestamp: new Date()
  });

  if (status === 'completed') {
    booking.completedAt = new Date();
  }

  // unlock provider if completed or cancelled
  if (status === 'completed' || status === 'cancelled') {
    await User.findByIdAndUpdate(booking.providerId, {
      'serviceProvider.isLocked': false
    });
  }

  await booking.save();

  res.status(StatusCodes.OK).json({ booking });
};


const getBookingStats = async (req, res) => {
  const userId = req.user?.userId; 
  const isProvider = req.user?.role === 'service_provider';
  const isCustomer = req.user?.role === 'customer';
  const isAdmin = req.user?.role === 'admin';

  // build filter condition
  let matchStage = {};
  if (isProvider) {
    matchStage = { providerId: new mongoose.Types.ObjectId(userId) };
  } else if (isCustomer) {
    matchStage = { userId: new mongoose.Types.ObjectId(userId) };
  } else if (isAdmin) {
    matchStage = {};
  } else {
    throw new CustomError.UnauthorizedError('Invalid role for stats access');
  }

  // group stats by status
  const stats = await Booking.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$pricing.totalAmount' }
      }
    }
  ]);

  // total bookings
  const totalBookings = await Booking.countDocuments(matchStage);

  // provider earnings (only completed bookings matter)
  let totalEarnings = 0;
  if (isProvider || isAdmin) {
    const earnings = await Booking.aggregate([
      {
        $match: {
          ...matchStage,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.subtotal' } // or totalAmount depending on business rules
        }
      }
    ]);
    totalEarnings = earnings[0]?.total || 0;
  }

  res.status(StatusCodes.OK).json({
    success: true,
    stats: {
      totalBookings,
      statusBreakdown: stats.reduce((acc, s) => {
        acc[s._id] = {
          count: s.count,
          totalAmount: s.totalAmount
        };
        return acc;
      }, {}),
      totalEarnings
    }
  });
};


module.exports = {
  createBooking,
  userGetAllBookings,
  providerGetAllBookings,
  getSingleBooking,
  updateBooking,
  getBookingStats,
};
