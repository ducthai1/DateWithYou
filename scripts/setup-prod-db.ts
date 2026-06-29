import { MongoClient } from "mongodb";

async function main() {
  // Base URI without database name
  const baseUri = "mongodb://thaitangduc_db_user:Rz5WNmxR1xkfD5nR@ac-djyhdk3-shard-00-00.srt8p4g.mongodb.net:27017,ac-djyhdk3-shard-00-01.srt8p4g.mongodb.net:27017,ac-djyhdk3-shard-00-02.srt8p4g.mongodb.net:27017/?ssl=true&replicaSet=atlas-phxz63-shard-0&authSource=admin&retryWrites=true&w=majority&appName=DateWithYou";

  const client = new MongoClient(baseUri);
  try {
    await client.connect();
    console.log("Connected to MongoDB cluster.");
    
    // 1. Drop the 'test' database
    const testDb = client.db("test");
    await testDb.dropDatabase();
    console.log("-> Dropped the 'test' database successfully.");

    // 2. Create the 'vivu_prod' database
    // MongoDB only creates a db when something is written to it. 
    // We will create a dummy collection to force creation.
    const prodDb = client.db("vivu_prod");
    await prodDb.createCollection("_init");
    console.log("-> Created the 'vivu_prod' database (added '_init' collection).");
    
  } catch (err) {
    console.error("Error setting up databases:", err);
  } finally {
    await client.close();
  }
  process.exit(0);
}

main();
