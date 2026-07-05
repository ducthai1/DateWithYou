import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
async function main() {
  const env = readFileSync('.env', 'utf8');
  const uri = env.match(/MONGODB_URI=(.*)/)?.[1];
  const baseUri = uri!.replace(/DateWithYou_Local\?/, '?');
  const client = new MongoClient(baseUri);
  await client.connect();
  
  const testDb = client.db('test');
  const testSpaces = await testDb.collection('spaces').find({}).toArray();
  const testUsers = await testDb.collection('user').find({}).toArray();
  console.log("=== TEST DB ===");
  console.log("Spaces:", JSON.stringify(testSpaces, null, 2));
  console.log("Users:", JSON.stringify(testUsers, null, 2));

  const prodDb = client.db('vivu_prod');
  const prodSpaces = await prodDb.collection('spaces').find({}).toArray();
  const prodUsers = await prodDb.collection('user').find({}).toArray();
  console.log("=== VIVU_PROD DB ===");
  console.log("Spaces:", JSON.stringify(prodSpaces, null, 2));
  console.log("Users:", JSON.stringify(prodUsers, null, 2));
  
  await client.close();
  process.exit(0);
}
main();
