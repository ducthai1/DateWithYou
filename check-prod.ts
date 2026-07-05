import { MongoClient } from "mongodb";
import { readFileSync } from "fs";

async function main() {
  const env = readFileSync('.env', 'utf8');
  // NOTE: This uses the LOCAL URI. The user said "Prod DB", so we don't have the Prod URI unless it's the same!
  // Wait, is DateWithYou_Local the same cluster as Prod?
  // URI: mongodb://thaitangduc_db_user:...@ac-djyhdk3-shard-00-00.srt8p4g.mongodb.net...
  // Yes, it's Atlas!
  const uri = env.match(/MONGODB_URI=(.*)/)?.[1];
  if (!uri) return;
  
  // Connect without DB name to check all DBs
  const baseUri = uri.replace(/DateWithYou_Local\?/, '?');
  const client = new MongoClient(baseUri);
  await client.connect();
  
  const adminDb = client.db('admin');
  const dbs = await adminDb.admin().listDatabases();
  
  console.log("Databases on cluster:");
  for (const db of dbs.databases) {
    console.log(`- ${db.name}`);
    const currentDb = client.db(db.name);
    const spaces = await currentDb.collection('spaces').countDocuments();
    const users = await currentDb.collection('user').countDocuments();
    console.log(`  Spaces: ${spaces}, Users: ${users}`);
  }
  
  await client.close();
  process.exit(0);
}
main();
