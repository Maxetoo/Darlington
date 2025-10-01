const express = require('express');
const FileUploadRoute = express.Router()
const {uploadFile} = require('../controllers/uploadController');

FileUploadRoute.route('/').post(uploadFile)

module.exports = FileUploadRoute