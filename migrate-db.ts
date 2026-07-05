import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

async function main() {
  const env = readFileSync('.env', 'utf8');
  const uri = env.match(/MONGODB_URI=(.*)/)?.[1];
  const baseUri = uri!.replace(/DateWithYou_Local\?/, '?');
  const client = new MongoClient(baseUri);
  await client.connect();
  
  const testDb = client.db('test');
  const prodDb = client.db('vivu_prod');
  
  const collections = await testDb.listCollections().toArray();
  console.log("Collections in test DB:", collections.map(c => c.name));
  
  for (const coll of collections) {
    const name = coll.name;
    const data = await testDb.collection(name).find({}).toArray();
    console.log(`Found ${data.length} docs in ${name}.`);
    if (data.length > 0) {
      // Clear the target collection first
      await prodDb.collection(name).deleteMany({});
      // Insert all documents
      await prodDb.collection(name).insertMany(data);
      console.log(`Migrated ${data.length} docs to vivu_prod.${name}.`);
    }
  }
  
  await client.close();
  console.log("Migration complete!");
  process.exit(0);
}
main();
