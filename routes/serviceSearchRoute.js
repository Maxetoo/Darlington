const express = require('express');
const ServiceSearchRoute = express.Router()
const { searchService} = require('../controllers/serviceController');

ServiceSearchRoute.route('/').get(searchService)

module.exports = ServiceSearchRoute
