import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

async function main() {
  const env = readFileSync('.env', 'utf8');
  const uri = env.match(/MONGODB_URI=(.*)/)?.[1];
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db();
  const spaces = await db.collection('spaces').find({}).toArray();
  console.log(`Found ${spaces.length} spaces.`);
  for (const s of spaces) {
    console.log(`- Space: ${s.name}, Members: ${JSON.stringify(s.members)}`);
  }
  
  const users = await db.collection('user').find({}).toArray();
  console.log(`Found ${users.length} users.`);
  for (const u of users) {
    console.log(`- User: ${u.name}, ID: ${u._id}`);
  }
  await client.close();
  process.exit(0);
}
main();
