const { Queue } = require('bullmq');
const bullConnection = require('../configs/bullMqConfig');

const embeddingQueue = new Queue('embedding-queue', {
  connection: bullConnection,
});

module.exports = embeddingQueue;
