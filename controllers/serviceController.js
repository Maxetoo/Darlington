const User = require('../db/userModel');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');
const { getEmbedding } = require('../services/transformers');

const searchService = async (req, res) => {
  try {
    const {
      searchQuery,
      limit = 10,
      minScore = 0.5,
      page = 1,
      longitude,
      latitude,
      maxDistance = 50000
    } = req.body;

    // validate search query
    if (!searchQuery || searchQuery.trim().length === 0) {
      throw new CustomError.BadRequestError('Search query is required');
    }

    const hasLocation = latitude && longitude;
    let results = [];
    let usedFallback = false;

    // vector search with embeddings
    try {
      const queryEmbedding = await getEmbedding(searchQuery.trim());
      const embeddingArray = Array.isArray(queryEmbedding) 
        ? queryEmbedding 
        : Array.from(queryEmbedding);

      const vectorPipeline = [
        // vector search
        {
          $vectorSearch: {
            index: 'vector_index_search',
            queryVector: embeddingArray,
            path: 'embedding',
            numCandidates: 200,
            limit: 100,
            filter: {
              role: 'service_provider',
              'serviceProvider.verificationStatus': 'approved',
              isActive: true,
              isBanned: false
            }
          }
        },
        // add vector search score
        {
          $addFields: {
            score: { $meta: 'vectorSearchScore' }
          }
        },
        // filter by minimum score
        {
          $match: { 
            score: { $gte: minScore }
          }
        }
      ];

      // add location filtering (if coordinates provided)
      if (hasLocation) {
        // calculate distance using Haversine formula
        vectorPipeline.push({
          $addFields: {
            distance: {
              $cond: {
                if: { 
                  $and: [
                    { $isArray: '$location.coordinates' },
                    { $gte: [{ $size: '$location.coordinates' }, 2] }
                  ]
                },
                then: {
                  $let: {
                    vars: {
                      lon1: { $arrayElemAt: ['$location.coordinates', 0] },
                      lat1: { $arrayElemAt: ['$location.coordinates', 1] },
                      lon2: parseFloat(longitude),
                      lat2: parseFloat(latitude),
                      toRad: { $divide: [Math.PI, 180] }
                    },
                    in: {
                      $multiply: [
                        6371, // earth radius in km
                        {
                          $acos: {
                            $add: [
                              {
                                $multiply: [
                                  { $sin: { $multiply: ['$$lat1', '$$toRad'] } },
                                  { $sin: { $multiply: ['$$lat2', '$$toRad'] } }
                                ]
                              },
                              {
                                $multiply: [
                                  { $cos: { $multiply: ['$$lat1', '$$toRad'] } },
                                  { $cos: { $multiply: ['$$lat2', '$$toRad'] } },
                                  {
                                    $cos: {
                                      $multiply: [
                                        { $subtract: ['$$lon2', '$$lon1'] },
                                        '$$toRad'
                                      ]
                                    }
                                  }
                                ]
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                },
                else: 999999
              }
            }
          }
        });

        // filter by maximum distance
        vectorPipeline.push({
          $match: {
            distance: { $lte: maxDistance / 1000 } // convert meters to km
          }
        });
      }

      // final stage
      vectorPipeline.push(
        // select fields to return
        {
          $project: {
            _id: 1,
            fullNames: 1,
            email: 1,
            phone: 1,
            profileImage: 1,
            'serviceProvider.profession': 1,
            'serviceProvider.businessName': 1,
            'serviceProvider.bio': 1,
            'serviceProvider.experience': 1,
            'serviceProvider.averageRating': 1,
            'serviceProvider.pricing': 1,
            'serviceProvider.portfolio': 1,
            'serviceProvider.availability': 1,
            location: 1,
            score: 1,
            ...(hasLocation && { distance: 1 })
          }
        },
        // sort results
        {
          $sort: hasLocation 
            ? { distance: 1, score: -1 } // sort by distance first, then score
            : { score: -1 } // sort by score only
        },
        // pagination - skip
        {
          $skip: (page - 1) * limit
        },
        // pagination - limit
        {
          $limit: limit
        }
      );

      results = await User.aggregate(vectorPipeline);

    } catch (embeddingError) {
      console.warn('Vector search failed, using fallback:', embeddingError.message);
      usedFallback = true;
    }

    // fallback to regex + geo search
    if (usedFallback || results.length === 0) {
      usedFallback = true;

      const regex = new RegExp(searchQuery, 'i');

      // base filter for service providers
      const baseFilter = {
        role: 'service_provider',
        'serviceProvider.verificationStatus': 'approved',
        isActive: true,
        isBanned: false,
        $or: [
          { 'serviceProvider.profession': regex },
          { 'serviceProvider.bio': regex },
          { 'serviceProvider.businessName': regex },
          { fullNames: regex }
        ]
      };

      const fallbackPipeline = [];

      // use geosearch if location is provided
      if (hasLocation) {
        // $geoNear (MUST be first stage)
        fallbackPipeline.push({
          $geoNear: {
            near: { 
              type: 'Point', 
              coordinates: [parseFloat(longitude), parseFloat(latitude)] 
            },
            distanceField: 'distance',
            maxDistance: maxDistance,
            spherical: true,
            query: {
              ...baseFilter,
              'location.coordinates': { $exists: true, $ne: [] }
            },
            key: 'location.coordinates'
          }
        });
      } else {
        // regular match (no location)
        fallbackPipeline.push({ $match: baseFilter });
      }

      // final stage
      fallbackPipeline.push(
        // select fields
        {
          $project: {
            _id: 1,
            fullNames: 1,
            email: 1,
            phone: 1,
            profileImage: 1,
            'serviceProvider.profession': 1,
            'serviceProvider.businessName': 1,
            'serviceProvider.bio': 1,
            'serviceProvider.experience': 1,
            'serviceProvider.averageRating': 1,
            'serviceProvider.pricing': 1,
            'serviceProvider.portfolio': 1,
            'serviceProvider.availability': 1,
            location: 1,
            ...(hasLocation && { distance: 1 })
          }
        },
        // sort
        {
          $sort: hasLocation 
            ? { distance: 1 } 
            : { 'serviceProvider.averageRating': -1 }
        },
        // skip
        {
          $skip: (page - 1) * limit
        },
        // limit
        {
          $limit: limit
        }
      );

      results = await User.aggregate(fallbackPipeline);
    }

    // send response
    res.status(StatusCodes.OK).json({
      success: true,
      message: results.length === 0
        ? 'No matching service providers found'
        : `Found ${results.length} matching service provider(s)`,
      results,
      count: results.length,
      searchQuery,
      usedFallback,
      ...(hasLocation && { 
        searchLocation: { latitude, longitude },
        maxDistance: `${maxDistance / 1000}km`
      })
    }); 

  } catch (error) {
    console.error('Search error:', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || 'Error performing search'
    });
  }
};

module.exports = { searchService };


