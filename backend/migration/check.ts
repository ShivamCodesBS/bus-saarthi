import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config();
const mongoUrl = process.env.MONGODB_URI || '';
async function run() {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db('bus_management_db');
  const collections = await db.listCollections().toArray();
  console.log('Collections in Mongo:', collections.map(c => c.name));
  const usersCount = await db.collection('users').countDocuments();
  console.log('Number of users in Mongo:', usersCount);
  await client.close();
}
run();
