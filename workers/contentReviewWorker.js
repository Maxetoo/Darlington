const { Worker } = require('bullmq');
const bullConnection = require('../configs/bullMqConfig');
const User = require('../db/userModel');

// Worker
const worker = new Worker('content-review-queue', async job => {
    const { userId, text } = job.data;

    
    return { status: 'Content has been reviewed'};


}, { connection: bullConnection });

// log worker errors
worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
