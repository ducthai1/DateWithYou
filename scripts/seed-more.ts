import mongoose from "mongoose";
import { MediaItemModel } from "../src/server/db/models/media-item";
import { RoadmapPlanModel } from "../src/server/db/models/roadmap-plan";
import { PlanItemModel } from "../src/server/db/models/plan-item";
import { RewardVoucherModel, RewardLogModel } from "../src/server/db/models/reward-models";
import { readFileSync } from "fs";

async function run() {
  const uri = process.env.MONGODB_URI || (readFileSync(".env", "utf8").split("\n").find((l: string) => l.startsWith("MONGODB_URI="))!.split("=")[1]);
  await mongoose.connect(uri);
  
  const spaceId = "6a327c1b7e6a9d5a8394e65a";
  const USER_ID = "6a23ff579fdcc76e494592bf";

  console.log("Seeding Media Library...");
  await MediaItemModel.create([
    {
      spaceId,
      kind: "music",
      title: "Bài hát của chúng ta",
      note: "Nghe lúc đi Đà Lạt nha",
      url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      provider: "spotify",
      createdBy: USER_ID,
    },
    {
      spaceId,
      kind: "recipe",
      title: "Món tủ: Bò bít tết",
      note: "Cuối tuần nào rảnh cùng làm nhé",
      recipe: {
        ingredients: ["Thăn bò 500g", "Bơ Tỏi", "Tiêu đen", "Khoai tây"],
        steps: ["Ướp bò 15p", "Áp chảo 3p mỗi mặt", "Thêm bơ tỏi rưới lên", "Ăn kèm khoai tây chiên"],
        cookTime: "20 phút",
        servings: "2 người",
        coverImage: "https://res.cloudinary.com/demo/image/upload/v1312461204/food.jpg"
      },
      createdBy: USER_ID,
    }
  ]);

  console.log("Seeding Roadmap Plans...");
  await RoadmapPlanModel.create([
    {
      spaceId,
      title: "Đi du lịch Nhật Bản mùa thu",
      description: "Ngắm lá đỏ ở Kyoto, ăn sushi ở Tsukiji",
      category: "Du lịch",
      targetDate: new Date("2025-11-15"),
      status: "planning",
      createdBy: USER_ID
    },
    {
      spaceId,
      title: "Mua nhà nhỏ ở ngoại ô",
      description: "Có sân vườn để trồng rau và nuôi chó",
      category: "Tương lai",
      status: "idea",
      createdBy: USER_ID
    }
  ]);

  console.log("Seeding Calendar Itinerary (PlanItems)...");
  await PlanItemModel.create([
    {
      spaceId,
      title: "Ăn sáng Bún Bò",
      note: "Ăn ở quán đối diện công viên",
      date: "2024-06-20", // near future or specific date
      bucket: "morning",
      time: "08:00",
      order: 1,
      status: "planned",
      createdBy: USER_ID
    },
    {
      spaceId,
      title: "Xem phim ở rạp",
      note: "Book vé IMAX lúc 20h",
      date: "2024-06-20",
      bucket: "evening",
      time: "20:00",
      order: 1,
      status: "planned",
      createdBy: USER_ID
    }
  ]);

  console.log("Seeding Reward Vouchers & Logs...");
  await RewardVoucherModel.create([
    {
      spaceId,
      title: "Voucher 1 chầu trà sữa Phúc Long",
      cost: 500,
      redeemed: false
    },
    {
      spaceId,
      title: "Voucher Đi xem phim do tui bao",
      cost: 1500,
      redeemed: true,
      redeemedBy: USER_ID,
      redeemedAt: new Date()
    }
  ]);

  await RewardLogModel.create([
    {
      spaceId,
      taskId: "task-fake-id",
      userId: USER_ID,
      points: 50,
      doneAt: new Date("2024-06-10")
    }
  ]);

  console.log("All extra seeds done!");
  await mongoose.disconnect();
}

run().catch(console.error);
