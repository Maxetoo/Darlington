const IORedis = require('ioredis');

const client = new IORedis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  username: 'default',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

client.on('connect', () => console.log('Redis Client Connected'));
client.on('error', err => console.log('Redis Client Connection Error'));

module.exports = client