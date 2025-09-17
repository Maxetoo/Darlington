const IORedis = require('ioredis');

const bullConnection = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  username: 'default',
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});


module.exports = bullConnection