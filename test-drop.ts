import { MongoClient } from "mongodb";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI in env");
    // read from .env
    const fs = require('fs');
    const env = fs.readFileSync('.env', 'utf8');
    const match = env.match(/MONGODB_URI=(.*)/);
    if (!match) {
        console.log("Not found in .env");
        process.exit(1);
    }
    process.env.MONGODB_URI = match[1];
  }

  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db();
  try {
    await db.collection("spaces").dropIndex("members_1");
    console.log("Index dropped successfully.");
  } catch (err: any) {
    console.log("Error dropping index (might not exist):", err.message);
  }
  await client.close();
  process.exit(0);
}
main();
