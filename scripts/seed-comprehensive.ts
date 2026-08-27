import mongoose from "mongoose";
import { MemoryModel } from "../src/server/db/models/memory";
import { LocationModel } from "../src/server/db/models/location";
import { LocationConfigModel } from "../src/server/db/models/location-config";
import { WishlistItemModel } from "../src/server/db/models/wishlist-item";
import { TimeCapsuleModel } from "../src/server/db/models/time-capsule";
import { RewardTaskModel, RewardAccountModel, RewardVoucherModel, RewardLogModel } from "../src/server/db/models/reward-models";
import { SpecialDateModel } from "../src/server/db/models/special-date";
import { MediaItemModel } from "../src/server/db/models/media-item";
import { RoadmapPlanModel } from "../src/server/db/models/roadmap-plan";
import { PlanItemModel } from "../src/server/db/models/plan-item";
import { format, addDays, subDays } from "date-fns";
import { readFileSync } from "fs";

async function run() {
  const uri = process.env.MONGODB_URI || (readFileSync(".env", "utf8").split("\n").find((l: string) => l.startsWith("MONGODB_URI="))!.split("=")[1]);
  await mongoose.connect(uri);
  
  const spaceId = "6a327c1b7e6a9d5a8394e65a";
  const USER_ID = "6a23ff579fdcc76e494592bf";

  console.log("Cleaning up old data in the Test Space...");
  await MemoryModel.deleteMany({ spaceId });
  await LocationModel.deleteMany({ spaceId });
  await LocationConfigModel.deleteMany({ spaceId });
  await WishlistItemModel.deleteMany({ spaceId });
  await TimeCapsuleModel.deleteMany({ spaceId });
  await RewardTaskModel.deleteMany({ spaceId });
  await RewardAccountModel.deleteMany({ spaceId });
  await RewardVoucherModel.deleteMany({ spaceId });
  await RewardLogModel.deleteMany({ spaceId });
  await SpecialDateModel.deleteMany({ spaceId });
  await MediaItemModel.deleteMany({ spaceId });
  await RoadmapPlanModel.deleteMany({ spaceId });
  await PlanItemModel.deleteMany({ spaceId });

  console.log("Seeding comprehensive Map Locations...");
  await LocationConfigModel.create({
    spaceId,
    categories: ["Nhà hàng sang trọng", "Quán Cafe chill", "Ăn vặt lề đường", "Khu vui chơi", "Rạp chiếu phim", "Công viên"],
    districts: ["Quận 1", "Quận 2", "Quận 3", "Quận 10", "Gò Vấp", "Bình Thạnh", "Phú Nhuận"]
  });

  const locations = await LocationModel.create([
    { spaceId, name: "Bitexco Financial Tower", district: "Quận 1", category: "Khu vui chơi", status: "visited", visitedAt: new Date("2024-02-01"), geo: { lat: 10.7715, lng: 106.7044 }, note: "Ngắm cảnh toàn thành phố.", rating: 5, createdBy: USER_ID },
    { spaceId, name: "Landmark 81", district: "Bình Thạnh", category: "Khu vui chơi", status: "want_to_go", geo: { lat: 10.795, lng: 106.7218 }, note: "Chưa đi bao giờ, muốn lên thử đài quan sát.", createdBy: USER_ID },
    { spaceId, name: "Highlands Coffee Nhà Hát Lớn", district: "Quận 1", category: "Quán Cafe chill", status: "visited", visitedAt: new Date("2024-04-15"), geo: { lat: 10.7766, lng: 106.7031 }, note: "Ngồi lề đường ngắm xe cộ.", rating: 4, createdBy: USER_ID },
    { spaceId, name: "Haidilao Vincom Center", district: "Quận 1", category: "Nhà hàng sang trọng", status: "want_to_go", geo: { lat: 10.7779, lng: 106.7022 }, note: "Đợi khi nào lương về thì đi ăn 🤤", createdBy: USER_ID },
    { spaceId, name: "Bún Bò Huế Hạnh", district: "Gò Vấp", category: "Ăn vặt lề đường", status: "visited", visitedAt: new Date("2024-05-10"), geo: { lat: 10.8285, lng: 106.6775 }, note: "Siêu ngon, nước lèo đậm đà.", rating: 5, createdBy: USER_ID },
    { spaceId, name: "Thảo Cầm Viên", district: "Quận 1", category: "Công viên", status: "want_to_go", geo: { lat: 10.7876, lng: 106.7052 }, note: "Cuối tuần đi dạo chụp hình film.", createdBy: USER_ID },
    { spaceId, name: "Phố Đi Bộ Nguyễn Huệ", district: "Quận 1", category: "Khu vui chơi", status: "visited", visitedAt: new Date("2024-01-01"), geo: { lat: 10.7738, lng: 106.7041 }, note: "Đón giao thừa siêu đông.", rating: 4, createdBy: USER_ID },
    { spaceId, name: "The Deck Saigon", district: "Quận 2", category: "Nhà hàng sang trọng", status: "want_to_go", geo: { lat: 10.8066, lng: 106.7410 }, note: "Ngắm hoàng hôn ven sông bao chill.", createdBy: USER_ID },
    { spaceId, name: "Bánh Tráng Nướng Dì Đinh", district: "Quận 10", category: "Ăn vặt lề đường", status: "visited", visitedAt: new Date("2024-06-05"), geo: { lat: 10.7706, lng: 106.6667 }, note: "Quán ruột, ăn bao nhiêu cũng không ngán.", rating: 5, createdBy: USER_ID },
    { spaceId, name: "CGV Vạn Hạnh Mall", district: "Quận 10", category: "Rạp chiếu phim", status: "visited", visitedAt: new Date("2024-05-20"), geo: { lat: 10.7709, lng: 106.6702 }, note: "Hay xem phim ở đây vì màn hình to.", rating: 4, createdBy: USER_ID }
  ]);

  console.log("Seeding Memories (Timeline)...");
  await MemoryModel.create([
    {
      spaceId, title: "Chuyến đi Đà Lạt đầu tiên", caption: "Lạnh nhưng mà vui! Ăn bánh tráng nướng quá chừng.", date: new Date("2024-02-14"), createdBy: USER_ID, tags: ["Du lịch", "Đà Lạt"], locationId: locations[0]._id,
      photos: [{ url: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=1000&auto=format&fit=crop", publicId: "da_lat_1", width: 1000, height: 667 }]
    },
    {
      spaceId, title: "Kỷ niệm 1 tháng quen nhau", caption: "Đi ăn buffet hải sản no nê ở nhà hàng view sông.", date: new Date("2024-03-01"), createdBy: USER_ID, tags: ["Kỷ niệm", "Ăn uống"],
      photos: [{ url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1000&auto=format&fit=crop", publicId: "food_1", width: 1000, height: 667 }]
    },
    {
      spaceId, title: "Cùng nhau xem phim Dune 2", caption: "Phim quá hay, nhạc Hans Zimmer đỉnh của chóp.", date: new Date("2024-03-10"), createdBy: USER_ID, tags: ["Xem phim"], locationId: locations[9]._id,
      photos: [{ url: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1000&auto=format&fit=crop", publicId: "cinema_1", width: 1000, height: 667 }]
    },
    {
      spaceId, title: "Sinh nhật bất ngờ", caption: "Không ngờ lại được tổ chức sinh nhật hoành tráng thế này 🎂", date: new Date("2024-04-20"), createdBy: USER_ID, tags: ["Sinh nhật"],
      photos: [{ url: "https://images.unsplash.com/photo-1530103862676-de88924ce140?q=80&w=1000&auto=format&fit=crop", publicId: "birthday_1", width: 1000, height: 667 }]
    },
    {
      spaceId, title: "Lần đầu nấu ăn chung", caption: "Bếp suýt cháy nhưng mà ngon!", date: new Date("2024-05-15"), createdBy: USER_ID, tags: ["Nấu ăn"],
      photos: [{ url: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=1000&auto=format&fit=crop", publicId: "cooking_1", width: 1000, height: 667 }]
    }
  ]);

  console.log("Seeding Vault (Wishlist & Capsules)...");
  await WishlistItemModel.create([
    { spaceId, itemName: "Son MAC Ruby Woo", forWhom: "partner", price: 650000, pointCost: 1000, bought: false, note: "Đợi dịp lễ mua tặng", createdBy: USER_ID },
    { spaceId, itemName: "Bàn phím cơ Keychron", forWhom: "me", price: 1500000, pointCost: 5000, bought: true, note: "Đã tự mua!", createdBy: USER_ID },
    { spaceId, itemName: "Chuyến đi Phú Quốc", forWhom: "partner", price: 5000000, pointCost: 20000, bought: false, note: "Mục tiêu cuối năm nay", createdBy: USER_ID },
    { spaceId, itemName: "Cặp vé Concert", forWhom: "me", price: 2000000, pointCost: 8000, bought: false, note: "Đợi BlackPink về Việt Nam", createdBy: USER_ID },
    { spaceId, itemName: "Nhẫn đôi", forWhom: "partner", price: 3000000, pointCost: 15000, bought: true, note: "Đã mua nhân dịp kỷ niệm", createdBy: USER_ID }
  ]);

  await TimeCapsuleModel.create([
    { spaceId, creatorId: USER_ID, title: "Gửi chúng ta của 1 năm sau", message: "Hy vọng lúc này 2 đứa đã để dành đủ tiền đi Nhật bản!", unlockDate: new Date("2025-01-01"), isOpened: false },
    { spaceId, creatorId: USER_ID, title: "Bí mật 1", message: "Anh không biết đâu, hôm đó em đã lén ăn cái bánh cuối cùng.", unlockDate: new Date("2024-05-01"), isOpened: true },
    { spaceId, creatorId: USER_ID, title: "Tâm thư gửi anh", message: "Hôm nay trời mưa to, tự dưng thấy nhớ anh quá. Lúc anh mở kén này ra chắc là đang mùa đông rồi. Nhớ giữ ấm nhé!", unlockDate: new Date("2024-12-24"), isOpened: false },
    { spaceId, creatorId: USER_ID, title: "Chuyện hôm đi dạo", message: "Hôm đó em đã định nói yêu anh nhưng lại ngại quá. May mà anh nói trước =))", unlockDate: new Date("2024-06-01"), isOpened: true },
    { spaceId, creatorId: USER_ID, title: "Kỷ niệm 1000 ngày", message: "Hôm nay là ngày kỷ niệm 1000 ngày yêu nhau. Chúc hai đứa mình luôn hạnh phúc như thế này.", unlockDate: new Date("2026-08-15"), isOpened: false }
  ]);

  console.log("Seeding Media Library...");
  await MediaItemModel.create([
    { spaceId, kind: "music", title: "Perfect - Ed Sheeran", note: "Bài hát kỷ niệm của 2 đứa", url: "https://open.spotify.com/track/0tgVpDi06ZXBcAWUXMU5zP", provider: "spotify", createdBy: USER_ID },
    { spaceId, kind: "music", title: "Lover - Taylor Swift", note: "Bật lúc nấu ăn bao chill", url: "https://open.spotify.com/track/1dGr1c8CrMLDpV6mPbImSI", provider: "spotify", createdBy: USER_ID },
    { spaceId, kind: "food_video", title: "Cách nấu Bún Bò Huế ngon tuyệt đỉnh", note: "Video hướng dẫn chi tiết", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", provider: "youtube", createdBy: USER_ID },
    { spaceId, kind: "food_video", title: "Làm bánh Flan siêu mịn", note: "Cuối tuần rảnh rỗi thử làm", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", provider: "youtube", createdBy: USER_ID },
    { spaceId, kind: "recipe", title: "Món tủ: Bò bít tết", note: "Cuối tuần nào rảnh cùng làm nhé", createdBy: USER_ID, recipe: { ingredients: ["Thăn bò 500g", "Bơ Tỏi", "Tiêu đen", "Khoai tây"], steps: ["Ướp bò 15p", "Áp chảo 3p mỗi mặt", "Thêm bơ tỏi rưới lên", "Ăn kèm khoai tây chiên"], cookTime: "20 phút", servings: "2 người", coverImage: "https://images.unsplash.com/photo-1600891964092-4316c288032e?q=80&w=800&auto=format&fit=crop" } },
    { spaceId, kind: "recipe", title: "Salad cá ngừ", note: "Ăn kiêng giảm cân", createdBy: USER_ID, recipe: { ingredients: ["Cá ngừ hộp", "Xà lách", "Cà chua bi", "Sốt mayonaise"], steps: ["Trộn đều tất cả", "Thưởng thức"], cookTime: "5 phút", servings: "1 người", coverImage: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop" } }
  ]);

  console.log("Seeding Rewards & Tasks...");
  await RewardAccountModel.create({ spaceId, userId: USER_ID, balance: 2500 });
  await RewardTaskModel.create([
    { spaceId, title: "Đấm lưng 15 phút", points: 50 },
    { spaceId, title: "Nấu ăn tối", points: 100 },
    { spaceId, title: "Rửa bát", points: 30 },
    { spaceId, title: "Đi vứt rác", points: 10 },
    { spaceId, title: "Khen người yêu xinh", points: 20 }
  ]);
  await RewardVoucherModel.create([
    { spaceId, title: "Voucher 1 chầu trà sữa Phúc Long", cost: 500, redeemed: false },
    { spaceId, title: "Bao đi xem phim IMAX", cost: 1500, redeemed: false },
    { spaceId, title: "Được miễn rửa bát 1 ngày", cost: 300, redeemed: true, redeemedBy: USER_ID, redeemedAt: new Date() },
    { spaceId, title: "Quyền chọn món ăn hôm nay", cost: 200, redeemed: false },
    { spaceId, title: "Chuyến du lịch Vũng Tàu 2N1Đ", cost: 10000, redeemed: false }
  ]);
  await RewardLogModel.create([
    { spaceId, taskId: "task-id-1", userId: USER_ID, points: 50, doneAt: new Date("2024-06-10") },
    { spaceId, taskId: "task-id-2", userId: USER_ID, points: 100, doneAt: new Date("2024-06-12") },
    { spaceId, taskId: "task-id-3", userId: USER_ID, points: 30, doneAt: new Date("2024-06-15") }
  ]);

  console.log("Seeding Roadmap & PlanItems (Calendar)...");
  await RoadmapPlanModel.create([
    { spaceId, title: "Đi du lịch Nhật Bản mùa thu", description: "Ngắm lá đỏ ở Kyoto, ăn sushi ở Tsukiji", category: "Du lịch", targetDate: new Date("2025-11-15"), status: "planning", createdBy: USER_ID },
    { spaceId, title: "Mua nhà nhỏ ở ngoại ô", description: "Có sân vườn để trồng rau và nuôi chó", category: "Tương lai", status: "idea", createdBy: USER_ID },
    { spaceId, title: "Học chung một ngôn ngữ mới", description: "Học tiếng Hàn để đi du lịch Seoul", category: "Học tập", status: "planning", createdBy: USER_ID },
    { spaceId, title: "Sửa sang lại phòng ngủ", description: "Sơn lại tường màu pastel, mua thêm kệ sách", category: "Nhà cửa", status: "done", createdBy: USER_ID },
    { spaceId, title: "Tổ chức đám cưới", description: "Đám cưới nhỏ ngoài trời ở Đà Lạt", category: "Tương lai", status: "idea", createdBy: USER_ID }
  ]);

  const today = new Date();
  const tmr = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const yesterday = subDays(today, 1);
  
  const formatDate = (d: Date) => format(d, "yyyy-MM-dd");

  await PlanItemModel.create([
    { spaceId, title: "Ăn sáng Bún Bò", note: "Ăn ở quán quen", date: formatDate(today), bucket: "morning", time: "08:00", order: 1, status: "planned", createdBy: USER_ID },
    { spaceId, title: "Đi dạo công viên", note: "Chụp vài tấm ảnh film", date: formatDate(today), bucket: "afternoon", time: "16:00", order: 1, status: "planned", createdBy: USER_ID },
    { spaceId, title: "Xem phim ở rạp", note: "Book vé IMAX lúc 20h", date: formatDate(today), bucket: "evening", time: "20:00", order: 1, status: "planned", createdBy: USER_ID },
    
    { spaceId, title: "Đi làm lủi thủi", note: "Nhớ nhắn tin nha", date: formatDate(tmr), bucket: "morning", time: "09:00", order: 1, status: "planned", createdBy: USER_ID },
    { spaceId, title: "Nấu ăn tối cùng nhau", note: "Làm bò bít tết", date: formatDate(tmr), bucket: "evening", time: "19:00", order: 1, status: "planned", createdBy: USER_ID },
    
    { spaceId, title: "Mua sắm cuối tuần", note: "Ghé siêu thị mua đồ", date: formatDate(nextWeek), bucket: "morning", time: "10:00", order: 1, status: "planned", createdBy: USER_ID },
    { spaceId, title: "Dọn dẹp nhà cửa", note: "Chia nhau ra làm", date: formatDate(yesterday), bucket: "noon", time: "14:00", order: 1, status: "done", createdBy: USER_ID },
  ]);

  console.log("Seeding Special Dates...");
  await SpecialDateModel.create([
    { spaceId, title: "Sinh nhật bạn", date: new Date("2002-10-16"), isAnnual: true, notifyBefore: [1, 7], createdBy: USER_ID },
    { spaceId, title: "Sinh nhật người ấy", date: new Date("2003-05-20"), isAnnual: true, notifyBefore: [1, 7], createdBy: USER_ID },
    { spaceId, title: "Kỷ niệm ngày quen nhau", date: new Date("2023-01-01"), isAnnual: true, notifyBefore: [1, 3], createdBy: USER_ID },
    { spaceId, title: "First Kiss", date: new Date("2023-02-14"), isAnnual: true, notifyBefore: [], createdBy: USER_ID }
  ]);

  console.log("==========================================");
  console.log("✅ MASSIVE SEED COMPLETED SUCCESSFULLY!");
  console.log("All tabs now have rich, realistic test data.");
  console.log("==========================================");

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
