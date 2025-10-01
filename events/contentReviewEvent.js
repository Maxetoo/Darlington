const { Queue } = require('bullmq');
const bullConnection = require('../configs/bullMqConfig');

const contentReviewQueue = new Queue('content-review', {
  connection: bullConnection,
});

module.exports = contentReviewQueue;
