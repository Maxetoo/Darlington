const axios = require('axios');

const diditClient = axios.create({
  baseURL: process.env.DIDIT_BASE_URL || 'https://api.didit.me/v1',
  headers: {
    Authorization: `Bearer ${process.env.DIDIT_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

module.exports = diditClient;
