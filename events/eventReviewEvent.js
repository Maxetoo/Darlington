const { Queue } = require('bullmq');
const bullConnection = require('../configs/bullMqConfig');

const embeddingQueue = new Queue('event-review-queue', {
  connection: bullConnection,
});

module.exports = embeddingQueue;