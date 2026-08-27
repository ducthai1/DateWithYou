import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

async function main() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    try {
      const env = readFileSync('.env', 'utf8');
      const match = env.match(/MONGODB_URI=(.*)/);
      if (match) {
        uri = match[1];
      }
    } catch {
      console.error("Could not read .env file");
    }
  }

  if (!uri) {
    console.error("No MONGODB_URI found");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    console.log(`Connected to database: ${db.databaseName}`);
    
    // Drop the entire database
    await db.dropDatabase();
    console.log(`Database ${db.databaseName} dropped successfully.`);
  } catch (err) {
    console.error("Error dropping database:", err);
  } finally {
    await client.close();
  }
  process.exit(0);
}

main();
