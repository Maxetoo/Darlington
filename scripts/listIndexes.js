// const { MongoClient } = require('mongodb');
// require('dotenv').config();

// const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/darlington';
// const dbName = process.env.MONGO_DB_NAME || (new URL(uri).pathname.replace('/', '') || 'darlington');

// (async () => {
//   const client = new MongoClient(uri, { useUnifiedTopology: true });
//   try {
//     await client.connect();
//     const db = client.db(dbName);
//     const collection = db.collection('users');
//     const indexes = await collection.indexes();
//     console.log('Indexes on users collection:');
//     console.dir(indexes, { depth: null });
//   } catch (err) {
//     console.error('Error listing indexes:', err.message);
//   } finally {
//     await client.close();
//   } 
// })();
