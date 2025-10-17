// const { Worker } = require('bullmq');
// const bullConnection = require('../configs/bullMqConfig');
// const { MongoClient, Binary } = require('mongodb');
// const { getEmbedding} = require('../services/transformers')
// const User = require('../db/userModel');

// // Worker
// const worker = new Worker('embedding-queue', async job => {
//     const { userId, text } = job.data;

//     // generate embedding
//     const embedding = await getEmbedding(text);

//     // convert embedding to Binary
//      const binaryEmbedding = new Binary(Buffer.from(Float32Array.from(embedding).buffer));

//     // save to user in MongoDB
//       await User.findByIdAndUpdate(userId, {
//         $set: { embedding: binaryEmbedding },
//      });

//     console.log('User embedding succesfully generated');
//     return { status: 'User embedding successfully generated'};


// }, { connection: bullConnection });

// // log worker errors
// worker.on('failed', (job, err) => {
//   console.error(`Job ${job.id} failed:`, err);
// });

// Run this script once to fix existing embeddings

const { Worker } = require('bullmq');
const bullConnection = require('../configs/bullMqConfig');
const { getEmbedding } = require('../services/transformers');
const User = require('../db/userModel');

// Worker
const worker = new Worker('embedding-queue', async job => {
    const { userId, text } = job.data;

    // generate embedding
    const embedding = await getEmbedding(text);  
    const embeddingArray = Array.from(embedding);

    // save to user
    await User.findByIdAndUpdate(userId, {
        $set: { embedding: embeddingArray },
    });

    console.log('User embedding successfully generated and saved');
    return { status: 'User embedding successfully generated' };

}, { connection: bullConnection });

// Log worker errors
worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err);
});

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
});

module.exports = worker;

