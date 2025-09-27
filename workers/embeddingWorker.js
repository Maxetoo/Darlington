const { Worker } = require('bullmq');
const bullConnection = require('../config/bullmq');
const { MongoClient, Binary } = require('mongodb');
const getEmbedding = async (...args) => {
  const { getEmbedding } = await import('../services/transformer.mjs');
  return getEmbedding(...args);
};
const User = require('../db/userModel');

// Worker
const worker = new Worker('embedding-queue', async job => {
  const { userId, text } = job.data;

  // generate embedding
  const embedding = await getEmbedding(text);

  // convert embedding to Binary
  const binaryEmbedding = new Binary(Buffer.from(Float32Array.from(embedding).buffer));

  // Save to user in MongoDB
  await User.findByIdAndUpdate(userId, {
    $set: { embedding: binaryEmbedding },
  });

  return { status: 'User embedding successfully generated'};
}, { connection: bullConnection });

// log worker errors
worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
