const express = require('express');
const EventRoute = express.Router();
const { 
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
    } = require('../controllers/eventController');
const { authentication, checkUser} = require('../middlewares/authentication')

EventRoute.route('/').get(checkUser, getAllEvents).post(authentication, createEvent)
EventRoute.route('/me').get(authentication, getAllMyEvents)
EventRoute.route('/featured').get(getFeaturedEvents)
EventRoute.route('/:id').get(getSingleEvent).delete(authentication, deleteEvent).patch(authentication, updateEvent)
EventRoute.route('/:id/like').post(authentication, likeEvent)
EventRoute.route('/:id/comment').post(authentication, addEventComment).delete(authentication, deleteEventComment)

 
module.exports = EventRoute