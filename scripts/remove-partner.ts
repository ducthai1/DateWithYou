import mongoose from "mongoose";
import { SpaceModel } from "../src/server/db/models/space";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const spaceId = "6a327c1b7e6a9d5a8394e65a";
  const space = await SpaceModel.findById(spaceId);
  if (space) {
    space.members = space.members.filter((m: string) => m === "6a23ff579fdcc76e494592bf");
    space.memberProfiles = space.memberProfiles.filter((p: any) => p.userId === "6a23ff579fdcc76e494592bf");
    await space.save();
    console.log("Removed partner from space", spaceId);
  } else {
    console.log("Space not found");
  }
  await mongoose.disconnect();
}
run().catch(console.error);
