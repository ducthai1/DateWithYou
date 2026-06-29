import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

async function main() {
  const env = readFileSync('.env', 'utf8');
  const uri = env.match(/MONGODB_URI=(.*)/)?.[1];
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db();
  const user = await db.collection('user').findOne({});
  console.log("User _id type:", typeof user?._id, user?._id);
  await client.close();
  process.exit(0);
}
main();
