import mongoose from "mongoose";

async function main() {
  const memberIds = ["6a42833b3f85ddf5dae19eb3"].flatMap((id) => {
    try { return [id, new mongoose.Types.ObjectId(id)]; }
    catch { return [id]; }
  });
  console.log(memberIds);
  process.exit(0);
}
main();
