const { Worker } = require('bullmq');
const bullConnection = require('../configs/bullMqConfig');
const Event = require('../db/eventModel')
const eventReviewer = require('../helpers/content/reviewEvent')

// Worker
const worker = new Worker('event-review-queue', async job => {
    const { eventId, text } = job.data;

    const eventReviewResult = await eventReviewer(text);
    const event = await Event.findById(eventId)
    
    if (eventReviewResult) {
        if (eventReviewResult?.legitimate) {
          event.status = 'published'
          event.moderationNotes = ''
        } else {
          event.status = 'rejected'
          event.moderationNotes = eventReviewResult?.reason || ''
        }
    }

  await event.save();
  return { status: event.status, eventId: event._id };


}, { connection: bullConnection });

// log worker errors
worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});