import mongoose from "mongoose";
import { SpaceModel } from "../src/server/db/models/space";
import { MemoryModel } from "../src/server/db/models/memory";
import { LocationModel } from "../src/server/db/models/location";
import { LocationConfigModel } from "../src/server/db/models/location-config";
import { WishlistItemModel } from "../src/server/db/models/wishlist-item";
import { TimeCapsuleModel } from "../src/server/db/models/time-capsule";
import { RewardTaskModel, RewardAccountModel } from "../src/server/db/models/reward-models";
import { SpecialDateModel } from "../src/server/db/models/special-date";

const USER_ID = "6a23ff579fdcc76e494592bf";
const PARTNER_ID = "fake-partner-id-123";

async function seed() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  // 1. Create Space
  const space = await SpaceModel.create({
    name: "Test Space (Full Data)",
    members: [USER_ID, PARTNER_ID],
    themePreset: "ocean",
    anniversaryDate: new Date("2024-01-01"),
    createdBy: USER_ID,
    memberProfiles: [
      { userId: USER_ID, nickname: "Đức", avatarEmoji: "👨", avatarColor: "#3b82f6" },
      { userId: PARTNER_ID, nickname: "Bé Yêu", avatarEmoji: "👩", avatarColor: "#ec4899" },
    ]
  });
  const spaceId = space._id.toString();
  console.log("Created Space with ID:", spaceId);

  // 2. Timeline (Memories)
  console.log("Seeding Memories...");
  await MemoryModel.create([
    {
      spaceId,
      title: "Chuyến đi Đà Lạt đầu tiên",
      caption: "Lạnh nhưng mà vui! Ăn bánh tráng nướng quá chừng.",
      date: new Date("2024-02-14"),
      createdBy: USER_ID,
      tags: ["Du lịch", "Đà Lạt"],
      photos: [
        { url: "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg", publicId: "sample", width: 800, height: 600 }
      ]
    },
    {
      spaceId,
      title: "Kỷ niệm 1 tháng quen nhau",
      caption: "Đi ăn buffet hải sản no nê.",
      date: new Date("2024-03-01"),
      createdBy: PARTNER_ID,
      tags: ["Kỷ niệm", "Ăn uống"],
    },
    {
      spaceId,
      title: "Cùng nhau xem phim Dune 2",
      caption: "Phim quá hay, nhạc Hans Zimmer đỉnh của chóp.",
      date: new Date("2024-03-10"),
      createdBy: USER_ID,
      tags: ["Xem phim"],
    }
  ]);

  // 3. Map (Locations & Config)
  console.log("Seeding Locations...");
  await LocationConfigModel.create({
    spaceId,
    categories: ["Nhà hàng", "Quán Cafe", "Khu vui chơi", "Rạp chiếu phim"],
    districts: ["Quận 1", "Quận 3", "Quận 10", "Gò Vấp", "Bình Thạnh"]
  });

  await LocationModel.create([
    {
      spaceId,
      name: "Bitexco Financial Tower",
      district: "Quận 1",
      category: "Khu vui chơi",
      status: "visited",
      visitedAt: new Date("2024-02-01"),
      geo: { lat: 10.7715, lng: 106.7044 },
      note: "Ngắm cảnh toàn thành phố.",
      rating: 5,
      createdBy: USER_ID
    },
    {
      spaceId,
      name: "Landmark 81",
      district: "Bình Thạnh",
      category: "Khu vui chơi",
      status: "want_to_go",
      geo: { lat: 10.795, lng: 106.7218 },
      note: "Chưa đi bao giờ, muốn lên thử đài quan sát.",
      createdBy: PARTNER_ID
    },
    {
      spaceId,
      name: "Highlands Coffee Nhà Hát Lớn",
      district: "Quận 1",
      category: "Quán Cafe",
      status: "visited",
      visitedAt: new Date("2024-04-15"),
      geo: { lat: 10.7766, lng: 106.7031 },
      note: "Ngồi lề đường ngắm xe cộ.",
      rating: 4,
      createdBy: USER_ID
    }
  ]);

  // 4. Vault (Wishlist & Time Capsule)
  console.log("Seeding Vault...");
  await WishlistItemModel.create([
    {
      spaceId,
      itemName: "Son MAC Ruby Woo",
      forWhom: "partner",
      price: 650000,
      pointCost: 1000,
      bought: false,
      note: "Đợi dịp 8/3 mua tặng",
      createdBy: USER_ID
    },
    {
      spaceId,
      itemName: "Bàn phím cơ Keychron",
      forWhom: "me",
      price: 1500000,
      pointCost: 5000,
      bought: true,
      note: "Đã tự mua!",
      createdBy: USER_ID
    }
  ]);

  await TimeCapsuleModel.create([
    {
      spaceId,
      creatorId: USER_ID,
      title: "Gửi chúng ta của 1 năm sau",
      message: "Hy vọng lúc này 2 đứa đã để dành đủ tiền đi Nhật bản!",
      unlockDate: new Date("2025-01-01"),
      isOpened: false
    },
    {
      spaceId,
      creatorId: PARTNER_ID,
      title: "Bí mật 1",
      message: "Anh không biết đâu, hôm đó em đã lén ăn cái bánh cuối cùng.",
      unlockDate: new Date("2024-05-01"), // past date
      isOpened: true
    }
  ]);

  // 5. Rewards / Games
  console.log("Seeding Rewards...");
  await RewardAccountModel.create([
    { spaceId, userId: USER_ID, balance: 2500 },
    { spaceId, userId: PARTNER_ID, balance: 1200 }
  ]);

  await RewardTaskModel.create([
    { spaceId, title: "Đấm lưng 15 phút", points: 50 },
    { spaceId, title: "Nấu ăn tối", points: 100 },
    { spaceId, title: "Rửa bát", points: 30 }
  ]);

  // 6. Special Dates
  console.log("Seeding Special Dates...");
  await SpecialDateModel.create([
    { spaceId, title: "Sinh nhật Đức", date: new Date("2002-10-16"), isAnnual: true, notifyBefore: [1, 7], createdBy: PARTNER_ID },
    { spaceId, title: "Kỷ niệm yêu nhau", date: new Date("2024-01-01"), isAnnual: true, notifyBefore: [1, 3], createdBy: USER_ID }
  ]);

  console.log("==========================================");
  console.log("✅ Seed completed successfully!");
  console.log("🔑 NEW SPACE ID:", spaceId);
  console.log("To use this space, update your `active_space_id` cookie to:", spaceId);
  console.log("==========================================");

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
