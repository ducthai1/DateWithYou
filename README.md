# Vivu No Plan 💞

Web đôi mobile-first: lưu kỷ niệm, lên kế hoạch hẹn hò, và góc bí mật cho hai người.
Kiến trúc multi-tenant (mỗi cặp = 1 "Couple Space") nên có thể mở cho nhiều cặp sau này.

## Tech stack

- **Next.js 15** (App Router) + TypeScript + Tailwind v4
- **tRPC v11** + TanStack Query
- **MongoDB** (Mongoose) — Atlas M0 free tier
- **Better Auth** (email + Google OAuth)
- **Mapbox** (bản đồ + Directions proxy server-side)
- **Cloudinary** (ảnh kỷ niệm — unsigned upload)
- Deploy: **Vercel** (zero-cost)

## Tính năng

1. Đăng nhập (email / Google) + Couple Space + mời người yêu qua mã.
2. **Lịch chung (Unified Couple Calendar)** — tab trung tâm: lịch tháng với badge số việc + dot nhãn + thumbnail kỷ niệm + ngày đặc biệt; bấm 1 ngày mở itinerary theo khung giờ (Sáng/Trưa/Chiều/Tối), gán nhãn, người phụ trách, giờ, link địa điểm, check-off, "Lưu thành kỷ niệm"; ngày quá khứ tự hiện kỷ niệm + địa điểm đã đi ("Ngày này năm xưa"). View "Sắp tới" + đếm ngược ngày kỷ niệm/sinh nhật (lặp hàng năm).
3. Bản đồ ăn chơi: thêm/lọc địa điểm, Đã đi / Muốn đi, route preview, chỉ đường.
4. Vòng quay "Hôm nay ăn gì?" — quay địa điểm "Muốn đi" hoặc công thức tự nấu.
5. **Bộ sưu tập** — lưu nhạc / video món ngon / công thức nấu ăn (link + embed YouTube/Spotify; công thức có nguyên liệu + các bước).
6. Dòng kỷ niệm (ảnh + nhãn + embed nhạc/video + ngày), lọc theo nhãn.
7. Góc bí mật: kế hoạch tương lai, wishlist quà, phiếu bé ngoan (điểm/voucher).

## Chạy local

```bash
npm install
cp .env.example .env.local   # rồi điền các giá trị bên dưới
npm run dev                  # http://localhost:3000
```

> Lưu ý: build/dev dùng **webpack** (không Turbopack) vì Better Auth. Nếu gặp lỗi
> `WasmHash ... reading 'length'` sau khi cài thêm package → xoá cache: `rm -rf .next`.

## Biến môi trường (`.env.local`)

| Biến | Lấy ở đâu |
|------|-----------|
| `MONGODB_URI` | MongoDB Atlas → Create free **M0** cluster → Connect → driver string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` (local) / domain thật (prod) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client (Web). Redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google` |
| `RESEND_API_KEY` | resend.com (mời/verify email) — optional cho local |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | mapbox.com → token **public** (render bản đồ), giới hạn theo URL |
| `MAPBOX_SECRET_TOKEN` | mapbox.com → token **secret** (Directions proxy) — KHÔNG để lộ |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | cloudinary.com dashboard |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary → Settings → Upload → **unsigned** preset (khoá folder/format/size) |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary dashboard (server-side, để xoá ảnh) |

## Deploy (Vercel)

1. Push repo lên GitHub (đã có).
2. Vercel → Import project → đặt **tất cả** biến môi trường ở trên (đổi `BETTER_AUTH_URL` thành domain Vercel).
3. Thêm redirect URI production vào Google OAuth client.
4. Deploy. Atlas M0 + Vercel + Mapbox/Cloudinary free → $0.

## Bảo mật đã có

- Cô lập dữ liệu theo `spaceId` (lấy từ session, không tin client).
- Invite code: hash + TTL 7 ngày + dùng 1 lần; join atomic (max 2 người); 1 user = 1 space.
- Điểm phiếu bé ngoan: counter atomic (`$inc` có guard) chống điểm âm; voucher single-use.
- CSRF origin guard cho mutation; URL input chỉ nhận `https://`.
