const { Worker } = require('bullmq');
const bullConnection = require('../configs/bullMqConfig');
const Blog = require('../db/blogPostModel')
const contentReviewer = require('../helpers/content/reviewContent')

// Worker
const worker = new Worker('content-review-queue', async job => {
    const { blogId, text } = job.data;

    const contentReviewResult = await contentReviewer(text);
    const blog = await Blog.findById(blogId)
    
    if (contentReviewResult) {
        if (contentReviewResult?.suitable) {
          blog.status = 'published'
          blog.moderationNotes = ''
        } else {
          blog.status = 'rejected'
          blog.moderationNotes = contentReviewResult?.reason || ''
        }
    }

  await blog.save();
  return { status: blog.status, blogId: blog._id };


}, { connection: bullConnection });

// log worker errors
worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});
