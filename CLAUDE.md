# Vivu No Plan — quy ước khi sửa repo này

## Tài sản thương hiệu — tông, giờ, và các bẫy đã trả giá

> **Đính chính đã đo (2026-08-31):** 8 file trong `common-page/` **KHÔNG trong
> suốt** — 0% pixel có alpha, nền trắng đục. Chỉ bộ `logo-icon/` mới có alpha
> thật. Hệ quả: spot phải đặt trên mặt trắng và dùng `object-contain`; thả lên
> thẻ có màu là nó tự vẽ một khung trắng quanh mình.

Đọc file này trước khi thêm/đổi bất cứ ảnh nào của thương hiệu (mark, ảnh minh
hoạ, icon). Mục tiêu: người sau không phải đoán ảnh nào đi đâu, không phải dò
lại vì sao một tấm không hiện, và không lặp lại bốn cái bẫy đã trả giá thật ở
cuối file.

### 1. Ba LOẠI tài sản — khác nhau vì công dụng, không phải vì thư mục

Bốn thư mục dưới `public/brand-image/` chứa **ba loại tranh khác nhau**, không
phải bốn biến thể của cùng một thứ:

| Loại | Thư mục | Hình dạng | Dùng ở đâu |
|---|---|---|---|
| Cảnh rộng | `morning-tone/`, `afternoon-tone/` | tỉ lệ ~16:9, lấp một dải hoặc nền cả trang | banner, hero, empty-state lớn |
| Minh hoạ đơn lẻ | `common-page/` | một vật thể, nền trong suốt, không dựng cảnh | chip, empty-state nhỏ, góc thẻ |
| Logo | `logo-icon/` | mark thật, alpha thật | header, sidebar, dialog |

**`morning-tone/` và `afternoon-tone/`** đóng cùng một tập vai trò ở hai bảng
màu khác nhau (sáng: xanh ngọc, chiều: hổ phách ấm) — cùng file `hero-desk.png`
tồn tại ở cả hai thư mục, khác nội dung nhưng cùng vai trò. Đây là cảnh rộng,
lấp trọn một dải hoặc nền trang.

**`common-page/`** không phải "một biến thể nhỏ hơn" của cảnh rộng — nó là một
LOẠI tranh khác: một vật thể duy nhất, nền trong suốt, không có bối cảnh xung
quanh. Lý do tách riêng: nhét một cảnh rộng vào một chip 96px hay một góc thẻ
là **cắt thành một vệt mờ**, không phải thu nhỏ đẹp. Cố ý **không mang tông** —
một cái hộp thư trên nền trống không có gì ấm hay lạnh, nên nó đọc đúng ở cả
hai bảng màu, và vì thế dùng được ở những chỗ cả hai tông cùng đi qua.

**`logo-icon/`** là mark, có alpha thật (không nền trắng), tồn tại ở cả hai
tông × hai biến thể (`wordmark`, `icon`) × hai bản vẽ mỗi cặp — xem mục 3.

Nguồn sự thật cho asset nào tồn tại, ở tông nào: `ART` (cảnh rộng) và `SPOT`
(minh hoạ đơn lẻ) trong `src/lib/tone.ts`. Đừng ghép chuỗi đường dẫn tay —
luôn qua `artSrc(name, tone)` / `spotSrc(name)` / `logoSrc(variant, tone, hour?)`.

### 2. Luật tông (sáng/chiều)

- Cookie `vivu_tone` giữ **lựa chọn**: `"morning"` | `"afternoon"` | `"auto"`.
- `"auto"` đổi tông theo đồng hồ máy người đọc, mốc là 12:00
  (`AFTERNOON_FROM_HOUR` trong `tone.ts`).
- Server đọc cookie và render đúng tông ngay lần đầu khi có lựa chọn tường
  minh; chỉ `"auto"` mới cần client sửa lại sau mount, vì chỉ đồng hồ của
  người đọc mới biết giờ thật — server không có thông tin đó.
- `artSrc(name, tone)` rơi về tông còn lại khi ảnh xin không tồn tại ở tông đó
  (`entry.tones` không chứa `tone`) — ảnh nhạt hơn một nấc, không vỡ trang.
- `ART` trong `src/lib/tone.ts` là nơi khai **cái gì thật sự tồn tại**. Đọc nó
  trước khi giả định một vai trò đã có ở cả hai tông.

### 3. Luật giờ (mark đổi bản vẽ theo giờ chẵn/lẻ)

`logoSrc(variant, tone, hour?)` nhận thêm tham số `hour` tuỳ chọn. Mỗi tông ×
biến thể có **hai** bản vẽ (không phải một):

```
wordmark: morning → [wordmark-morning, wordmark-dual]
          afternoon → [wordmark-afternoon, wordmark-afternoon-2]
icon:     morning → [icon-morning, icon-duotone]
          afternoon → [icon-afternoon, icon-afternoon-2]
```

Giờ chẵn → bản đầu, giờ lẻ → bản hai (`pair[hour % 2]`). Không có `hour` (gọi
không truyền, hoặc lúc chưa biết giờ) → luôn trả bản đầu.

**Vì sao có luật này**: mỗi tông được vẽ **hai** bản wordmark và **hai** bản
icon, không phải một. Chọn cố định một bản là bỏ phí bản còn lại đã trả tiền
vẽ. Đổi theo giờ dùng hết cả hai, và đổi tối đa hai lần trong lúc ai đó đang mở
app đọc như "app đang sống" chứ không như một lỗi giật hình.

**Áp dụng ở**: `BrandMark` (`src/components/layout/brand-mark.tsx`) — nơi duy
nhất gọi `logoSrc` với `hour`. Mọi nơi `<BrandMark>` render (`side-nav.tsx`,
`app-header.tsx`, cả hai dùng `variant="wordmark"` mặc định) tự động được luật
này mà không cần sửa gì ở nơi gọi.

Cách `BrandMark` tránh hydration mismatch: `hour` khởi tạo `undefined`, không
đọc `new Date().getHours()` lúc render — vì server không biết giờ địa phương
của người đọc, một hàm trả lời khác nhau ở server và ở client chính là hydration
mismatch. Bỏ trống `hour` khiến `logoSrc` trả về bản đầu của cặp một cách xác
định, đúng bằng thứ server render — nên bản thân giá trị `undefined` đã đóng
vai "chưa sẵn sàng", không cần thêm cờ `ready` riêng. Giờ thật được nạp vào sau
khi mount (`useEffect`), rồi giữ mới bằng một timer nhắm đúng mốc đầu giờ tiếp
theo (`msUntilNextHour`, cùng hình dạng với `msUntilNextToneChange` trong
`tone.ts`, nhưng nhắm mọi giờ chứ không riêng mốc 12h).

### 4. Thêm asset mới — làm theo thứ tự

1. **Đặt tên theo CÁI GÌ TRONG TRANH**, không theo chỗ sẽ dùng nó
   (`wheel-food.png`, không phải `homepage-banner-3.png`).
2. **Bỏ đúng thư mục** theo bảng ở mục 1 — cảnh rộng vào `morning-tone/` hoặc
   `afternoon-tone/`, minh hoạ đơn lẻ vào `common-page/`.
3. **Đăng ký vào `ART`** (cảnh rộng) hoặc `SPOT` (minh hoạ đơn lẻ) trong
   `src/lib/tone.ts`. Với `ART`, khai `tones` **trung thực** — chỉ liệt kê tông
   nào file thật sự tồn tại, đừng khai `BOTH` rồi để một tông rơi vào fallback
   âm thầm.
4. **Kiểm file có thật trên đĩa** trước khi báo xong — đăng ký sai tên hoặc
   thiếu file không tự báo lỗi, nó chỉ lặng lẽ rơi về tông kia hoặc 404. Lệnh
   kiểm mọi khai báo `ART`/`SPOT` so với đĩa:

   ```bash
   # ART: từng entry { file: "...", tones: BOTH|ONLY_MORNING|ONLY_AFTERNOON }
   # phải có file ở đúng (các) thư mục tông mà `tones` khai
   awk '/^export const ART = \{/,/^\} satisfies/' src/lib/tone.ts \
     | grep -E '"[a-z0-9.-]+\.png"' \
     | while IFS= read -r line; do
         file=$(echo "$line" | grep -oE '"[a-z0-9.-]+\.png"' | tr -d '"')
         tones=$(echo "$line" | grep -oE 'BOTH|ONLY_MORNING|ONLY_AFTERNOON')
         [ "$tones" != "ONLY_AFTERNOON" ] && { [ -f "public/brand-image/morning-tone/$file" ] || echo "MISSING: public/brand-image/morning-tone/$file"; }
         [ "$tones" != "ONLY_MORNING" ] && { [ -f "public/brand-image/afternoon-tone/$file" ] || echo "MISSING: public/brand-image/afternoon-tone/$file"; }
       done

   # SPOT: mỗi entry là "ten-vat-the.png", phải có trong common-page/
   awk '/^export const SPOT = \{/,/^\} as const;/' src/lib/tone.ts \
     | grep -oE '"[a-z0-9.-]+\.png"' | tr -d '"' \
     | while IFS= read -r file; do
         [ -f "public/brand-image/common-page/$file" ] || echo "MISSING: public/brand-image/common-page/$file"
       done
   ```

   Không in dòng `MISSING:` nào là sạch. (Chạy lần cuối lúc viết tài liệu này:
   36 khai báo, 0 thiếu.)

### 5. Bốn bẫy đã trả giá — đừng lặp lại

**Bẫy 1 — iOS launch image cần PNG truecolour, không phải palette PNG.**
Triệu chứng: ảnh tải qua HTTP 200 bình thường, mở trong trình duyệt hiện đúng
— tối ưu palette PNG "sống sót qua review" chính vì mọi decoder thường đều đọc
được nó. Nhưng đường nạp launch-image của Safari kén hơn: nó cần PNG truecolour,
palette PNG bị nó **âm thầm bỏ qua** dù link và media query đều đúng. Luật: 24
ảnh trong `public/splash/` phải luôn là RGB truecolour (kiểm bằng `file
public/splash/*.png`, phải thấy `8-bit/color RGB`, không phải `color palette`).

**Bẫy 2 — `apple-mobile-web-app-capable` mở khoá launch image; Next chỉ phát
`mobile-web-app-capable`.** Triệu chứng: icon đã mở app kiểu standalone (không
thanh trình duyệt) nên trông như PWA đã cấu hình đúng — dễ tưởng nhầm launch
image cũng đã ổn. Nhưng iOS 15.4+ chỉ tôn trọng tên chuẩn `mobile-web-app-capable`
cho *display standalone*; đường nạp launch-image lại là code WebKit cũ hơn,
đọc riêng tên có tiền tố `apple-`. Thiếu `<meta name="apple-mobile-web-app-capable">`
thì 24 link splash đúng tuyệt đối vẫn bị đọc và bỏ qua. Xem
`src/components/layout/apple-splash-links.tsx`.

**Bẫy 3 — media query của splash phải khớp CHÍNH XÁC kích thước máy báo cáo;
một link không kèm media query có thể che mất link đúng.** Từng thử thêm một
link fallback không media query, lý do "có splash mờ còn hơn trắng màn" — sai:
Safari chọn link ĐẦU TIÊN khớp; một link không điều kiện khớp MỌI thiết bị theo
định nghĩa, nên nếu Safari chọn nó trước rồi từ chối vì sai kích thước, kết quả
là **không splash nào cả** — tệ hơn cả việc không có entry, vì nó có thể che
mất entry đúng đứng sau. Danh sách `SPLASH` trong `apple-splash-links.tsx` chỉ
gồm các link có device-width/height/dpr/orientation tường minh, không có
catch-all. Máy không nằm trong bảng thì không có splash — đó là thất bại trung
thực, sửa bằng cách thêm đúng kích thước máy đó vào bảng.

**Bẫy 4 — đọc tông hoặc giờ lúc RENDER là hydration mismatch.** `new
Date().getHours()` (hay đọc cookie tông) gọi trực tiếp trong thân component sẽ
cho server một câu trả lời và client một câu trả lời khác — server không biết
múi giờ hay cookie phía trình duyệt của người đọc. Triệu chứng: React cảnh báo
hydration mismatch, hoặc tệ hơn, âm thầm dựng lại cả cây sau khi thấy client
không khớp server. Luật: giá trị phụ thuộc đồng hồ/cookie phải khởi tạo bằng
giá trị server-safe (mặc định trung tính hoặc `undefined`) rồi nạp giá trị thật
trong `useEffect` sau mount — xem `ToneProvider` (tông) và `BrandMark` (giờ,
mục 3) làm cùng một hình dạng.

## KHÔNG bịa dữ liệu của người dùng — trống thì để trống

Lúc tạo space, hệ thống chèn sẵn hai dòng: **"Ngày kỷ niệm"** và **"Sinh nhật"**,
cả hai gán bằng **ngày hôm nay**. Comment trong code gọi chúng là
"clearly-placeholder", nhưng **không có gì trong giao diện nói thế**: chúng hiện
trong đồng hồ đếm ngược, trên lịch, trên `/home`, đọc y như do người dùng tự
nhập. User mở app lên thấy app khẳng định ngày kỷ niệm của họ là ngày họ bấm
đăng ký, và sinh nhật cũng vậy — một thứ chưa ai từng nhập.

**Luật:** không bao giờ tạo sẵn dữ liệu mà chỉ NGƯỜI DÙNG mới biết đúng hay sai.

| Được tạo sẵn | Không được tạo sẵn |
|---|---|
| Sự thật hệ thống biết chắc: ngày space được tạo | Ngày kỷ niệm, sinh nhật, tên người thân |
| Cấu trúc rỗng: cột kanban, tab | Nội dung giả trong cấu trúc đó |
| Mặc định trung tính có thể đổi: màu chủ đề | Bất cứ thứ gì tỏ ra là lựa chọn của người dùng |

**Ba câu hỏi trước khi `insertMany` lúc khởi tạo:**
1. Giá trị này hệ thống **biết chắc** hay chỉ **đoán**? Đoán thì đừng ghi.
2. Nếu người dùng không bao giờ sửa nó, họ có bị hiểu sai điều gì không?
3. Giao diện có **nói rõ** đây là mẫu không? Không nói được thì nó không phải mẫu
   — nó là dữ liệu sai.

*"Để đồng hồ đếm ngược không rỗng"* không phải lý do. **Empty state là câu trả lời
đúng cho trạng thái rỗng** — app này đã có sẵn `EmptyState` cho việc đó. Lấp chỗ
trống bằng dữ liệu bịa là đổi một khoảng trống trung thực lấy một lời nói dối.

Đã lỡ ship rồi thì **nói ra**, đừng lặng lẽ backfill: bản ghi cũ có thể đã được
người dùng sửa thành đúng, ghi đè lên là xoá việc của họ.

## Nhịp dọc phải KHỚP giữa các route

`/home` rộng 760px, `/activity` 672px, `/search` 900px, các route khác 1400px —
cả bốn đều tự viết cột riêng thay vì dùng `PageShell`. Băng ảnh đầu trang thì
route này 192px, route kia 140px. Hệ quả: chuyển trang là **nội dung bắt đầu ở
một độ cao khác**, đọc như trang đang tự sắp lại chứ không phải như một thiết kế.

**Luật:**
- Màn hình trong app dùng `PageShell` + `PageHeader`. Muốn cột hẹp hơn thì **giới
  hạn phần NỘI DUNG bên trong**, không thu nhỏ cả shell — nền, băng ảnh và nhịp
  trang phải giống nhau ở mọi route.
- Băng ảnh có **một chiều cao duy nhất**, khai ở `PageHeader`, không route nào tự
  đặt lại.
- Thêm route mới thì **đo `top` của phần tử nội dung đầu tiên** và so với một
  route đã có. Lệch quá vài px là sai.

**Rộng hết cỡ ≠ tốt hơn.** Một dòng chữ kéo dài 1400px khó đọc hơn ở 700px —
khoảng 70 ký tự một dòng là giới hạn thật của mắt, không phải sở thích. Nên:
**shell rộng hết, nội dung tự giới hạn**, và chỗ nào có thừa bề ngang thì dùng
làm **cột thứ hai** chứ đừng kéo dài dòng chữ.

**Một dòng chữ ngắn không đáng một hàng riêng.** Đồng hồ đếm ngược từng chiếm
trọn một hàng ngang chỉ để nói *"còn 362 ngày"*, trong khi băng ảnh ngay trên nó
trống gần hết bề ngang. Trước khi thêm một dải mới, hỏi: **thứ này có nhét được
vào chỗ đang trống ở trên không?**

## Thao tác không hoàn tác được thì PHẢI HỎI — và phải quét cả hệ thống

`plan-item-card.tsx` xoá một việc **ngay lần chạm đầu tiên**, trong khi tám chỗ
xoá khác trong app đều mở modal hỏi trước. Nút thùng rác đó nằm cách nút bút chì
9px trong một hàng năm nút icon — chỗ dễ chạm nhầm nhất sản phẩm, đặt lên đúng
thứ không lấy lại được. User mất dữ liệu thật rồi mới báo.

**Luật:** mọi thao tác không hoàn tác được đều đi qua `ConfirmButton`
(`src/components/ui/confirm-button.tsx`), không có ngoại lệ vì "nút nhỏ", "chỉ
là icon", "người dùng chắc biết mình làm gì".

Cụ thể là những gì:

| Loại | Ví dụ trong repo | Bắt buộc |
|---|---|---|
| Xoá bản ghi | kỷ niệm, địa điểm, kế hoạch, chuyến đi, wishlist, media, trò chơi, ngày đặc biệt | modal hỏi |
| Xoá hàng loạt | "Xoá hết ảnh" trong form kỷ niệm | modal hỏi, nêu **số lượng** |
| Rời / ngắt liên kết | rời space, gỡ người kia | modal hỏi, nêu **hậu quả** |
| Ghi đè không khôi phục | thay ảnh bìa, reset cấu hình | modal hỏi |
| Kết thúc phiên đang chạy | kết thúc chuyến đi đang dẫn đường | modal hỏi |

**Câu chữ trong modal phải nói ĐÚNG cái sắp mất**, không dùng câu chung chung.
`"${item.title}" sẽ bị xoá khỏi ngày này. Không hoàn tác được.` đọc xong biết
ngay mình sắp xoá gì; *"Bạn có chắc không?"* thì không.

**Khi sửa một chỗ, quét cả repo** — lỗi kiểu này không bao giờ đứng một mình:

```bash
# Xét 6 dòng trước mỗi lời gọi xoá: callback onConfirm thường nhiều dòng nên
# grep một dòng sẽ báo oan, mà lệnh báo oan thì lần sau không ai chạy nữa.
grep -rn -B6 "remove\.mutate\|delete\.mutate\|destroy\.mutate" src --include=*.tsx \
 | grep -E "\.mutate" | while IFS= read -r l; do
     f=${l%%:*}; n=$(echo "$l" | cut -d: -f2)
     sed -n "$((n>6?n-6:1)),${n}p" "$f" | grep -q "onConfirm\|ConfirmButton" \
       || echo "  ✗ CHƯA HỎI: ${f#src/}:$n"
   done
# In ra dòng nào là còn chỗ xoá thẳng, không hỏi.
```

Thêm nút xoá mới mà không chạy lệnh trên trước khi báo xong = làm chưa xong.

## Trạng thái TOÀN CỤC thì không được component nào tự sở hữu

Cuộn trang chết trên Android, phải tắt app mở lại. Nguyên nhân: `Modal` và
`BottomSheet` mỗi cái tự lưu `document.body.style.overflow` lúc mở rồi trả lại
lúc đóng. Đúng với **một** hộp thoại, sai ngay khi có **hai** — mà app này chồng
hộp thoại liên tục (xác nhận đè lên form, form đè lên sheet):

```
A mở   -> lưu ""        đặt hidden
B mở   -> lưu "hidden"  đặt hidden      <- B chép nhầm khoá của A
A đóng -> trả về ""                      <- cuộn mở lại trong khi B còn mở
B đóng -> trả về "hidden"                <- KHOÁ CHẾT, không còn gì để đóng
```

Dòng cuối là thứ user gặp: chỉ reload mới thoát, mà tắt app mở lại chính là
reload.

**Luật:** thứ gì nằm ngoài component — `body.style`, `document.title`,
`window` listener, khoá cuộn, wake lock, tham số URL — thì **đếm tham chiếu ở
một module dùng chung**, không để mỗi instance tự lưu-và-trả.
Mẫu: `src/lib/body-scroll-lock.ts` — acquire đầu tiên chụp giá trị thật, release
cuối cùng trả lại, ở giữa là no-op.

**Ba câu tự hỏi trước khi viết `useEffect` đụng vào cái gì ngoài component:**
1. Hai bản của component này mở cùng lúc thì sao?
2. Bản A unmount trong khi B còn sống thì sao? (`memory-timeline` làm đúng thế:
   đóng modal cảnh báo và mở modal sửa trong **cùng một handler**)
3. Component chết vì lỗi/điều hướng, cleanup không chạy — có để lại rác không?

**Kiểm bằng cách tái hiện, không phải bằng lý luận.** Trước khi vá, hãy dựng
đúng chuỗi thao tác và đọc giá trị toàn cục lúc **đã đóng hết**:

```js
// đóng hết rồi mà vẫn thấy "hidden" với 0 dialog => còn rò rỉ
JSON.stringify({body: document.body.style.overflow,
  dialogs: [...document.querySelectorAll('[role=dialog]')]
    .filter(d => d.getBoundingClientRect().width > 0).length})
```

Vá xong chạy lại đúng kịch bản đó. Không so trước–sau thì không biết mình sửa
đúng chỗ hay chỉ vá triệu chứng.

### Hộp thoại chồng nhau: kèm theo cả a11y

Chồng hộp thoại còn hỏng nhiều thứ khác ngoài cuộn, phải kiểm đủ:

- **Escape** chỉ được đóng cái TRÊN CÙNG, không đóng cả chồng. `useDialogA11y`
  đã so `node` với phần tử cuối trong danh sách portal — giữ nguyên cơ chế đó,
  đừng thêm listener riêng.
- **Focus trap** thuộc về cái trên cùng; cái dưới phải nhả.
- **Đóng xong focus phải quay về** đúng nút đã mở nó, không nhảy về `<body>`.
- **`aria-modal` + `role="dialog"`** trên đúng phần tử, và `aria-labelledby` trỏ
  tới tiêu đề thật — không phải một `<div>` trang trí.
- **Ảnh trang trí** `alt=""` + `aria-hidden`; **con số badge** là glyph nên phải
  đưa vào `aria-label` của link bọc ngoài (xem `unread-badge.tsx`).
- **`prefers-reduced-motion`**: luật toàn cục trong `globals.css` chỉ chạm CSS
  transition. **Cuộn bằng script và animation của framer-motion phải tự hỏi**
  `window.matchMedia("(prefers-reduced-motion: reduce)")`.

## Đo trên THIẾT BỊ THẬT NGƯỜI TA DÙNG, không phải khổ màn tiện tay

Hai lần liên tiếp báo "đã sửa" rồi user mở máy của họ ra vẫn hỏng:

| Lần | Tôi đo ở | User dùng | Sót gì |
|---|---|---|---|
| Ô lịch | 1440×900 | 1440×**740** | `short:` (≤760px) ép ô cao còn 52px |
| Hero landing | 1440×900 / 1920×1221 | MacBook Air **1440×745** | ảnh co còn 27% màn |
| Splash PWA | Android | iOS | Safari bỏ qua manifest, cần `apple-touch-startup-image` |

**Danh sách khổ màn bắt buộc đo** khi đụng layout:

```
Ngang: 360 · 390 · 414 · 768 · 1024 · 1280 · 1440 · 1920
Cao:   745 (MacBook Air 13") · 800 (MacBook Pro 14") · 900 · 1080
       690 (zoom 125%) · 620 (zoom 150%) · 560 (zoom 175%)
```

`short:` = `max-height: 700px`, `shorter:` = `max-height: 620px`. **Ngưỡng
`short` từng là 760px và đó là bug** — nó bắt trúng mọi laptop Mac. Trước khi
thêm `short:` vào chỗ nào, hỏi: *máy bình thường có rơi vào đây không?*

**Khác biệt nền tảng phải tra, không được suy từ Android sang iOS:**

| Thứ | Android/Chrome | iOS/Safari |
|---|---|---|
| Splash khi cài | tự dựng từ manifest | **chỉ** từ `apple-touch-startup-image` khớp đúng độ phân giải |
| `start_url` | có đọc | **không đọc** — dùng URL lúc bấm "Thêm vào MH chính" |
| Chiều cao viewport | `100vh` ổn | phải `100dvh`, thanh địa chỉ co giãn |
| `:hover` | có chuột | dính lại sau khi chạm — phải gói trong `@media (hover: hover)` |

Có 24 file splash trong `public/splash/` khớp `apple-splash-links.tsx`. **Sinh
ảnh và sửa bảng phải đi cùng nhau** — thiếu file hoặc thiếu query đều ra màn
trắng, và không bên nào báo lỗi.

## Làm bất kỳ mảng UI nào: liệt kê ĐỦ TRẠNG THÁI, rồi kiểm ĐỦ CHUYỂN TIẾP

Một component không phải một màn hình. Nó là **một tập trạng thái** cộng với
**mọi đường đi giữa chúng** — và bug nằm ở các đường đi nhiều hơn ở các trạng
thái. Bảng điều khiển bản đồ đã ra ba lỗi cùng lúc chỉ vì tôi dựng trạng thái
"mở", nhìn thấy đẹp, rồi coi là xong.

### 1. Liệt kê trạng thái trước khi code

Với mỗi mảng UI, viết ra và **dựng thật** từng cái:

| Nhóm | Phải có |
|---|---|
| Dữ liệu | rỗng · **đang tải** · 1 mục · nhiều mục · **nội dung dài nhất có thật** · lỗi |
| Đóng/mở | đóng · đang mở · mở · đang đóng |
| Tương tác | mặc định · hover · **focus bàn phím** · active · disabled · đang gửi |
| Ngữ cảnh | 1 thành viên vs **2 thành viên** · sidebar mở vs thu gọn · đã/chưa đăng nhập |

Ba lần trong repo này "sạch" hoá ra là chưa từng dựng đúng trạng thái:
space cá nhân giấu mất nút "Gặp ở giữa" (ca toolbar rộng nhất), tài khoản mới bị
`SpaceGuard` đá về onboarding nên 12 route đo cùng một trang, và seed hỏng khiến
`/timeline` được chụp lúc trống trơn.

### 2. Kiểm chuyển tiếp theo CẶP, và A→B→A phải quay về ĐÚNG A

Không chỉ xem trạng thái cuối. Đi qua từng đường, **cả hai chiều**, rồi **đo**:

```js
// trước khi gập và sau khi mở lại — hai bộ số phải trùng từng pixel
{col:{x:288,w:368,h:900}, bar:{x:304,y:16,w:336,h:130}}
```

Lệch một pixel nghĩa là layout đã bị **dựng lại** chứ không phải hiện lại — đó
chính là bug "mở ra thấy layout khác lúc đầu".

### 3. Chuyển tiếp phải MƯỢT — nghĩa là phải animate được

**`display`, `hidden`, unmount: KHÔNG animate được.** Có `transition` cũng vô
nghĩa; nó sẽ giật cái đùng. Muốn ẩn/hiện có hiệu ứng thì đổi thứ animate được:

```jsx
// SAI — giật, và dựng lại layout khi quay về
!open && "lg:hidden"
!open && "lg:max-w-0 lg:p-0"

// ĐÚNG — mượt, không tháo gì, quay về đúng chỗ cũ
"transition-[opacity,transform] duration-300 ease-out",
!open && "pointer-events-none -translate-x-6 opacity-0"
```

- `pointer-events-none` khi ẩn, không thì vẫn bấm trúng thứ vô hình.
- Đừng animate `width`/`height`/`max-width` nếu nội dung bên trong co giãn theo:
  nó sẽ reflow suốt quá trình. Ưu tiên `opacity` + `transform`.

**Reduced-motion đã lo sẵn ở hai chỗ, đừng thêm class thừa:**
`globals.css` dập mọi CSS transition/animation, và `<MotionConfig
reducedMotion="user">` trong `providers.tsx` lo phần framer-motion. Guard CSS
**không** chạm được animation chạy bằng JS — trước khi có `MotionConfig`, 21
trong 23 file dùng framer-motion vẫn nhảy múa với người đã tắt chuyển động.
Việc cần làm là **đừng chọc thủng hai lớp đó**: đừng animate bằng
`requestAnimationFrame`/`setInterval` tự chế, và nếu buộc phải thì đọc
`useReducedMotion()`.

### 4. Cách kiểm, không phải cách đoán

Lái trình duyệt qua chuỗi thật (`/tmp/driver.mjs`), chụp **mỗi bước**, và
`getBoundingClientRect` trước/sau. Xem thêm mục "Quét tĩnh KHÔNG đủ" bên dưới.


## Tông ảnh sáng/chiều (`src/lib/tone.ts`)

Ảnh có hai bảng màu: **morning** (xanh ngọc) và **afternoon** (hổ phách ấm).
Chọn tay hoặc theo đồng hồ — trước 12h là sáng, sau là chiều. Cookie `vivu_tone`
giữ **lựa chọn** (`morning`/`afternoon`/`auto`).

**Khác hoàn toàn `theme-presets.ts`.** Cái kia là màu nhấn của cặp đôi, lưu trên
space. Tông chỉ đổi ảnh nên là lựa chọn **theo thiết bị**.

- Thêm ảnh mới → **đăng ký vào `ART`** kèm `tones` liệt kê tông nào thật sự có
  file. Xin tông không có thì tự rơi về tông còn lại — ảnh nhạt hơn, không vỡ.
- `artSrc(name, tone)` / `logoSrc(variant, tone)` là hai cửa duy nhất. Đừng ghép
  chuỗi đường dẫn tay.
- Đặt tên asset **theo vai trò** (`wheel-food.png`), không theo công cụ sinh ra.

### Hai bẫy đã trả giá, đừng lặp

**1. Script chặn trong `<head>` KHÔNG quyết được attribute React quản lý.**
`<html data-tone={...}>` do React render ⇒ **hydration khôi phục giá trị của
server**, xoá sạch thứ script vừa ghi. Cách đúng: **server đọc cookie** cho lựa
chọn tường minh (render đúng ngay lần đầu), chỉ `auto` mới cần client sửa sau
mount vì server không biết múi giờ người đọc.

**2. Effect chạy lần commit đầu với state KHỞI TẠO, không phải state sắp có.**
Effect "theo đồng hồ" chạy khi `preference` còn là `"auto"` mặc định — trước cả
effect đọc cookie — nên nó **đè lên lựa chọn đã lưu**. Phải có cờ `ready` do
effect đọc cookie bật lên. Triệu chứng: chọn Chiều, reload, ra Sáng.

### Đăng ký ảnh KHÔNG phải là dùng ảnh — phải đếm chỗ RENDER

Sau khi đổi tên 30 asset và dựng xong `ART` + `ToneProvider`, hệ thống chạy đúng
100% mà user vẫn báo *"không thấy hình ở đâu hết"*. Đo ra: **16 ảnh đã đăng ký,
đúng 3 ảnh được render** — cả 3 đều nằm trong empty state, nên tài khoản có dữ
liệu thì không bao giờ thấy tấm nào. Không có gì hỏng; chỉ là chưa ai đặt ảnh
vào chỗ người ta nhìn.

Phép đo đúng **không phải** `grep` file trong `public/`, cũng không phải đếm
entry trong `ART`. Phải mở trình duyệt, vào từng route, đếm `<img>` thật:

```bash
# đăng ký vs. thật sự được tham chiếu trong code
grep -rhoE 'art="[a-zA-Z]+"|name="[a-zA-Z]+"|art: "[a-zA-Z]+"' src --include=*.tsx | ...
# rồi mở browser đếm <img> có brand-image trên từng route
```

Và nhớ **route mặc định mở tab nào**: `/vault` mở tab "Kế hoạch", `/calendar` mở
tab "Tháng", `/activity` của space mới đã có sẵn 2 sự kiện. Ba route đó "không
ra ảnh" mà **không phải lỗi** — empty state có ảnh nằm ở tab khác.

### Chỗ ĐƯỢC đặt ảnh, và chỗ KHÔNG

| Đặt | Vì |
|---|---|
| Trang marketing (`/`, `/tinh-nang`, 4 trang tính năng) | người ta tới để xem sản phẩm trông thế nào |
| Empty state **lần đầu** (chưa có gì) | không có nội dung thì ảnh là thứ duy nhất nói được |
| Onboarding | màn đầu sau đăng ký, chưa có gì để hiện |
| **KHÔNG** đặt ở empty state do **lọc/tìm không ra** | ảnh to đẩy mất bộ lọc đang cần sửa |
| **KHÔNG** đặt banner ở `/home` | màn dùng hằng ngày, banner đẩy nội dung xuống mỗi lần mở |
| **KHÔNG** đặt ở cột kanban / panel nhỏ | ảnh 16:9 ép vào cột hẹp thành vệt mỏng |
| **KHÔNG** đặt 2 ảnh lớn trên cùng một màn | `agenda-view` lấy ảnh, `special-dates-panel` giữ icon — chúng render cùng chỗ |

Và **đừng đụng vào ảnh đã tối ưu có chủ đích**: hero trang chủ là LCP element,
dùng webp/jpg đã cắt sẵn kèm comment giải thích; auth shell cố ý dùng chung ảnh
đó để vào trang đăng nhập vẫn thấy là cùng một sản phẩm. Thay bằng PNG 4MB là
phá đúng thứ người trước đã đo.

### `next/image` không có `sizes` thì tải bản 1920 cho khung 352px

`EmptyState` cap ảnh ở `max-w-[min(22rem,80%)]` = 352px, nhưng không khai
`sizes` ⇒ next mặc định `100vw` ⇒ **đo được `w=1920` phục vụ vào khung 352px**.
Khai `sizes="352px"` thì xuống `w=750`. Hễ ảnh có `max-w` cứng thì phải nói cho
next biết bề rộng thật.

### Ảnh `loading=lazy` dưới màn hình: `img.src` là bản TO NHẤT — đừng báo oan

Detector của tôi đọc `currentSrc || src`. Ảnh lazy chưa cuộn tới thì `currentSrc`
rỗng, rơi về `src` — mà next/image đặt `src` = **bản `w=3840`**, và
`naturalWidth === 0`. Nhìn vào tưởng "tải ảnh 3840 rồi hỏng". Cuộn tới rồi đo
lại: cả 5 tấm đều chọn `w=828` và tải xong. **Trước khi kết luận ảnh hỏng, phải
cuộn nó vào viewport rồi đo lại.**

### `overflow-x: auto` KHÔNG phải là cắt — chỉ `hidden`/`clip` mới cắt

Bộ dò tràn khung coi mọi ancestor có `overflow` khác `visible` là "khung cắt",
nên báo thanh tab `/library` tràn 37px ở 360px. Đo thật: `clientWidth 360 /
scrollWidth 413`, đẩy `scrollLeft` thì **cuộn được 53px và tab cuối hiện đủ** —
cuộn ngang chính là thiết kế. Chỉ so mép với ancestor `overflow-x: hidden|clip`.

## Trước khi tự nghĩ ra một luồng, xem người ta làm thế nào

Ca thật: ô tìm trên `/map` từng được dựng theo kiểu tự chế — gõ chữ thì lọc pin
đã lưu, còn muốn tìm chỗ mới thì phải **để ý thấy một cái nút riêng rồi bấm**,
và nó tra được **đúng một** kết quả. Không ai làm bản đồ theo kiểu đó. Mọi ứng
dụng bản đồ đều giải bài này giống nhau — **gõ → hiện danh sách → chọn một** —
và người dùng đã thuộc hình dạng đó từ trước khi mở app này.

Nên trước khi code một tính năng có tiền lệ:

- **Tra xem ứng dụng lớn làm thế nào** (bản đồ, tìm kiếm, lịch, giỏ hàng…).
  Mẫu quen thuộc thắng mẫu thông minh, vì người dùng không phải học lại.
- **Tra chuẩn a11y của mẫu đó.** Autocomplete có mẫu WAI-ARIA combobox sẵn:
  `role="combobox"`, `aria-expanded`, `aria-activedescendant`, phím ↑↓ Enter
  Escape Tab. Tự chế dropdown là tự tay bỏ hết những cái đó.
- **Tra con số, đừng đoán.** Debounce ~300ms, tối thiểu 2–3 ký tự, cache truy
  vấn lặp — đây là những con số đã có người đo, không cần nghĩ lại.
- **Tra API trước khi tự dựng.** TrackAsia đã có `place/autocomplete` và
  `place/details` kiểu Google Places từ đầu; tự viết một luồng geocode một-kết-
  quả là bỏ qua thứ có sẵn tốt hơn.

Chi phí của việc bỏ qua bước này không phải là code xấu — mà là **giao cho người
dùng một thứ họ phải học lại**, trong khi bản chuẩn thì họ đã biết dùng.

### Tìm kiếm địa điểm phải bám vị trí — và phải test đúng đường app đi

Gõ `trà sữa` từng trả về Ninh Bình, Vĩnh Long, An Giang. API không hề sai:
cùng câu đó kèm `location` thì ra toàn quán gần. Không kèm thì giữa hàng chục
nghìn kết quả tốt ngang nhau, thứ tự **về cơ bản là ngẫu nhiên**.

- **Bias theo khung nhìn của bản đồ**, không phải theo GPS. Đây là chuẩn của mọi
  autocomplete đặt cạnh bản đồ, và là nguồn **luôn có câu trả lời**: GPS có thể
  bị từ chối, danh sách đã lưu có thể rỗng, còn bản đồ thì lúc nào cũng đang
  hiển thị một chỗ nào đó — đúng chỗ người ta đang nhìn.
- **Đừng để tồn tại nhánh "không bias".** `suggestPlaces` nay không nhận nữa:
  truy vấn không bias không phải truy vấn trung lập, nó là truy vấn tệ.
- **Điểm bias nằm trong cache key** ⇒ làm tròn về lưới ~0.05° (~5km) trước khi
  đưa vào query. Không làm thì kéo bản đồ vài trăm mét là thêm một request cho
  kết quả không thể khác, vì bán kính bias tới 25km.

Nhưng bài học nặng hơn nằm ở chỗ khác: **bug sống sót vì mọi bài test đều tự tay
truyền `location` vào.** Đường mà app thật sự đi — không có toạ độ — chưa từng
chạy một lần nào. Test cái tham số **có mặt** thì chỉ chứng minh nhánh đó chạy
được; cái hỏng luôn là nhánh còn lại.

Nên với mọi tham số tuỳ chọn: **chạy thử đúng cái mặc định mà app sẽ gửi**, rồi
mới tin. Và trước khi tin là "API trả sai", gọi thẳng API một phát để tách bạch
lỗi ở đâu — ở đây API đúng ngay từ đầu, sai nằm hoàn toàn phía client.

### Quét "toàn bộ" phải gồm 3 TRẠNG THÁI TÀI KHOẢN, không chỉ 3 kích thước

Quét bao nhiêu viewport cũng vô nghĩa nếu chỉ có một loại tài khoản. Đủ bộ là:

| Trạng thái | Cách dựng | Thấy được gì |
|---|---|---|
| **có dữ liệu** | seed 48 bản ghi | tràn do nội dung dài |
| **có space, RỖNG** | tạo tài khoản + `space.create`, **không seed** | empty state thật |
| **chưa có space** | chỉ đăng ký | `/onboarding` |
| **chưa đăng nhập** | `sign-out` | marketing, auth, **404** |

**Cái bẫy đã dính:** định test empty state bằng tài khoản mới toanh — nhưng
`SpaceGuard` đá thẳng về `/onboarding`, nên **cả 12 route đo đúng một trang** và
báo sạch. Empty state thật cần tài khoản **có space nhưng không có dữ liệu**.

Nên sweep phải **ghi lại `location.pathname` sau khi load** và báo `redirected`
nếu khác route yêu cầu. Không có phép đó thì một chuỗi redirect đọc ra y hệt một
kết quả hoàn hảo.

Đừng quên: `not-found.tsx`, `error.tsx`, `global-error.tsx`, `/forgot-password`,
`/reset-password?token=…` — không nằm trong danh sách route sinh từ `page.tsx`
theo cách thông thường.

### Trang 404 là URL CÔNG KHAI nằm trong layout app

Đây là trang public duy nhất render bên trong layout app, nên khách gõ sai URL
thấy **toàn bộ sidebar + bottom nav riêng tư**, kèm 2 nút chỉ đá họ về đăng nhập.

Trang không tự ẩn được chrome do layout render phía trên nó, và chrome không
nhận ra 404 qua `pathname`. Cách nối: **trang đặt `data-chromeless`, CSS đọc**
(`body:has([data-chromeless]) [data-app-chrome]{display:none}`). Đọc phiên bằng
`cookies()` để đổi cả CTA.

### Quét tĩnh KHÔNG đủ — phải LÁI trình duyệt qua từng luồng

Mọi sweep trước chỉ load route rồi đo lúc đứng yên. Lái thật qua 10 luồng
(34 bước, chụp + assert sau **mỗi** bước) ra thêm 5 bug mà sweep tĩnh không thấy:

- Panel danh sách giữ `lg:overflow-visible` ⇒ 4.665px nội dung tràn ra cột
  `overflow:hidden` ⇒ lưu xong là focus cuộn mất toolbar, **không có thanh cuộn
  để kéo lại**. Đo được: cột `scrollHeight 4908` trong khung 900px.
- Kéo sheet lên hết cỡ trên điện thoại thì toolbar (`z-40`) và search (`z-30`)
  **đè lên thẻ đầu** vì sheet cũng `z-30`.
- Dropdown `Select` portal + `fixed` **sống lâu hơn trigger**: gập cột đi thì
  menu mắc kẹt trên bản đồ, không gì đóng được.
- Danh sách gợi ý báo **"không tìm thấy"** ngay trong cửa sổ debounce — tuyên bố
  thất bại trước khi kịp tìm.
- CTA vòng quay là gradient hồng trong khi cả app dùng terracotta.

Bộ lái ở `/tmp/driver.mjs` (CDP): `goto → click/type/select → wait → screenshot
→ health-check`. Health-check mỗi bước: tràn ngang, `map-view` có hộp không,
dialog lọt màn, **trapped content** (`scrollHeight > clientHeight` trong hộp
`overflow:hidden`), console error.

Hai bẫy của chính bộ lái, đừng nhầm với bug app:
- **Đợi quá ngắn** → tưởng search hỏng. Debounce 300ms + mạng ~800–1500ms ⇒ chờ ≥3.5s.
- **`offsetParent` luôn `null` với `position: fixed`** ⇒ lọc kiểu đó là không bao
  giờ tìm thấy nút nổi. Dùng `getClientRects().length > 0`.

### Nút chỉ có icon: `title` KHÔNG phải tên khả truy cập

4 chỗ có `title` mà thiếu `aria-label`. Trình đọc màn hình không đọc `title` như
tên, và script cũng không tìm ra nút. Rà bằng:
`grep -rn '<button\|<a ' src --include=*.tsx` rồi lọc thẻ có `title=` mà không có
`aria-label=`.

### Gợi ý địa điểm: `textsearch` chứ không phải `autocomplete`

`place/autocomplete` **chỉ trả tên + địa chỉ** — không toạ độ, không khoảng cách.
Muốn hiện "cách bao xa" thì phải gọi `place/details` cho **từng** gợi ý = 8
request mỗi lần tìm. `place/textsearch` trả **geometry ngay trong cùng một
request** ⇒ tính được khoảng cách, **và** lúc chọn cũng không cần details nữa.

**Phải tự sắp xếp.** Thứ tự của API gần như bỏ qua `location` bias: tìm "trà sữa"
từ Sài Gòn mà kết quả đầu cách **1.068 km**. Sắp theo khoảng cách tăng dần rồi
mới `slice(0,8)`.

### Hộp `fixed inset-0` vẫn có thể thành 0×0 — đo, đừng đoán

Gập cột công cụ làm **map biến mất**. Hai lần sửa hụt: ẩn cột thì ẩn luôn map
(map nằm *trong* cột); cho cột `max-w-0` thì map `fixed inset-0` ra **rect 0×0**
dù `top/left/right/bottom` đều `0px` và **chuỗi tổ tiên sạch** (không transform/
filter/backdrop/contain — đã probe từng cái).

Kết luận đúng không phải là tìm cho ra thủ phạm CSS, mà là: **map là lớp nền của
cả trang, đừng đặt nó trong một container có thể bị thu/ẩn.** Đưa ra ngoài là hết
cả lớp vấn đề. Sweep nay có check `map-collapsed` (rect < 50px) để không tái diễn.

### `hidden` KHÔNG thắng `lg:grid` — cùng breakpoint thì cascade quyết, không phải thứ tự viết

```js
// SAI: hàng lọc vẫn hiện trên desktop dù toggle nói đóng
cn("flex lg:grid lg:grid-cols-2", !open && "hidden")

// ĐÚNG: đóng thì đừng phát ra utility display nào khác
cn("gap-2", open ? "flex lg:grid lg:grid-cols-2" : "hidden")
```

Cùng đặt `display` ở cùng breakpoint thì **thứ tự trong file CSS quyết**, không
phải thứ tự trong lời gọi `cn()`. Đây là họ hàng của bug `cn()` thiếu `twMerge`
đã ghi bên dưới — cùng một cái bẫy "class viết sau chưa chắc thắng".

### Trên bản đồ, chỉ CÔNG CỤ mới được nổi vĩnh viễn — danh sách thì không

Thu hẹp cột và thêm nút gập **không** sửa được gốc: mọi thứ vẫn xếp thành **một
cụm dọc vĩnh viễn** (toolbar → search → 3 select → toàn bộ danh sách chạy tới
đáy màn, thẻ cuối bị chém). Ở 1920, nơi map thừa cả nghìn pixel, bức tường vẫn y
nguyên. Và gập là all-or-nothing: mất luôn cả công cụ.

Luật: trên một trang bản đồ, thứ được nổi thường trực chỉ là **ô tìm kiếm + vài
nút**. Bộ lọc nấp sau một chip. Danh sách là **ngăn kéo**, mặc định đóng, mở
bằng chip có kèm số lượng. Đó là hình dạng mọi ứng dụng bản đồ dùng, và nó giữ
map làm trang chứ không phải làm nền.

### Khi map thành `fixed` ở mọi bề rộng, mọi thứ khác phải tự nâng z-index

`/map` desktop nay giống mobile: map `fixed inset-0 z-0` full-bleed, công cụ nổi
thành **một cột trái**, sidebar nổi luôn trên map. Đổi xong thì **ô tìm kiếm và
hàng lọc biến mất** — chúng vẫn để `lg:z-auto` từ thời map là ô tĩnh trong lưới.
**Phần tử `fixed` sơn đè lên nội dung tĩnh bất kể thứ tự DOM**, nên cả hai chui
xuống dưới map. Luật: chuyển gì sang `fixed` thì rà lại **mọi anh em cùng tầng**
xem có `z-index` chưa.

Kèm: lưới thẻ `sm:grid-cols-2` nằm trong panel 27rem cho mỗi thẻ ~200px ⇒ tên
quán rớt mỗi dòng một chữ. Panel hẹp thì ép `lg:grid-cols-1`.

### Modal: mặc định hẹp, và phải nói cho biết còn cuộn

- **Mọi dialog đều `max-w-2xl` vì đó là bề rộng duy nhất có.** Form 3 ô rộng
  672px trông như layout bỏ cuộc. `<Modal size>` mặc định nay là `lg` (512px);
  chỉ cái nào thật sự nhiều nội dung mới xin `xl`.
- **Dialog `max-h-[90dvh]` cắt thân form bằng một đường viền phẳng** — đọc ra
  thành "hết form" chứ không phải "còn nữa". `ModalContent` nay **mờ dần ở mép
  nào còn nội dung phía sau** (đo `scrollHeight/scrollTop`, có `ResizeObserver`).
- `ModalHeader` có thêm `description` + `icon` (tuỳ chọn) — một dòng nói dialog
  này để làm gì, thay vì nhét thành đoạn đầu của thân form.

### Chụp cả tab con và modal, không chỉ route

Trang `/shot?r=<route>&click=<nhãn>` load route rồi **click phần tử có nhãn đó**
trước khi chụp — đủ để soi từng tab (`Wishlist`, `Ngân sách`, `Nhật ký`…) và
từng modal (`+ Thêm`, `Thêm dự định`…). Thêm `&only=1&w=&h=` để chụp **một khung
không thu nhỏ** khi cần nhìn chi tiết như dải mờ cuộn.

### Gập/mở một panel: TRƯỢT + MỜ, đừng tháo layout ra

Gập bằng `max-w-0` + `display:none` cho từng khối gây đúng ba lỗi cùng lúc:

1. **Giật cái đùng** — `display` **không animate được**, bất kể transition.
2. **Mở lại ra layout khác** — tháo rồi dựng lại nghĩa là mọi thứ tính lại ở
   **bề rộng mà animation đang đi qua**, nên hàng công cụ wrap khác lúc đầu.
3. Phải nhớ ẩn từng khối con, và quên một cái là hỏng (đã từng ẩn cả map).

Cách đúng khi panel nằm trên nền `fixed` full-bleed: **không tháo gì cả**, chỉ
`-translate-x-6 opacity-0 pointer-events-none` + transition. Nội dung giữ nguyên
kích thước nên không reflow, và bản đồ phía dưới vốn đã chiếm hết màn.

Kiểm bằng cách **đo trước khi gập và sau khi mở lại** — hai bộ số phải trùng
từng pixel. Nếu lệch là layout đã bị dựng lại.

### Nút nổi phải né sidebar bằng state THẬT, đừng bằng biến CSS tưởng tượng

Nút "mở lại" đặt `left-[calc(var(--map-panel-left,7rem))]` — biến đó **không tồn
tại ở đâu trong repo**, nên luôn rơi về fallback 7rem và **nằm đè lên sidebar**
đang mở (rộng tới 17rem). Đọc `useSidebar().isCollapsed` như `NavigationMiniDock`
vẫn làm. Kiểm bằng cách so hình chữ nhật hai phần tử ở **cả hai** trạng thái
sidebar, đừng chỉ trạng thái mặc định.

### So BỀ RỘNG con-với-cha là chưa đủ — phải so MÉP

Check cũ hỏi "con có rộng hơn lòng cha không". Nó **không bao giờ** thấy một
phần tử **hẹp hơn cha nhưng bị đẩy lệch ra khỏi mép** — đúng thứ xảy ra khi một
item `shrink-0` nằm trong hàng flex đã đầy. Nút "+ Thêm" thò ra khỏi thẻ toolbar
**48px ở 1440, 80px ở 1152**, qua cả padding lẫn góc bo, mà mọi sweep đều báo
sạch.

Phép đo đúng: so mép con với **content-box của cha** cả hai bên.

```js
const padL=parseFloat(ps.paddingLeft)||0, padR=parseFloat(ps.paddingRight)||0;
const bL=parseFloat(ps.borderLeftWidth)||0, bR=parseFloat(ps.borderRightWidth)||0;
const innerL=pr.left+bL+padL, innerR=pr.right-bR-padR;
const esc = Math.max(r.right-innerR, innerL-r.left);   // >1.5px là thoát khung
```

**Hai thứ bắt buộc phải loại trừ, không thì báo oan liên tục:**
- **Lề âm** (`-mx-*`) — kỹ thuật tràn mép có chủ đích.
- **Transform.** Và **Tailwind v4 phát ra `scale` / `rotate` / `translate` thành
  thuộc tính riêng**, không phải shorthand `transform` — chỉ check `transform`
  thì swatch `scale-110` vẫn báo 2px mãi. Phải check cả bốn.

**Sửa thì đừng chỉ cho cha `flex-wrap`.** Cụm nút là **một** flex item; cha chỉ
có thể đẩy cả cụm xuống dòng chứ không bẻ được nó. Chính cụm đó cũng phải
`flex-wrap`, và thứ có thể co (tiêu đề) phải bỏ `shrink-0`.

**Test với space 2 NGƯỜI.** Space cá nhân giấu mất nút "Gặp ở giữa" — tức là
giấu luôn ca toolbar rộng nhất. Tạo mã mời bằng `space.createInvite` rồi
`space.joinByCode` từ tài khoản thứ hai.

### Hộp cao cố định mà không clip thì nội dung SƠN RA NGOÀI — không check ngang nào bắt được

Sidebar `fixed inset-y-4` = cao đúng bằng viewport − 32px, `justify-between`,
**không `overflow` gì cả**. Logo + 10 link + 3 dòng chân cần ~644px; zoom 150%
cửa sổ chỉ còn 568px ⇒ **~76px nav sơn ra ngoài khung bo tròn**. Trang không hề
tràn, nên mọi phép đo cũ (đều nhìn theo chiều ngang, hoặc cần tổ tiên có clip)
đều mù.

Bộ dò cho đúng hình dạng này:

```js
// hộp có position + nội dung cao hơn chính nó + overflow-y: visible
if ((cs.position === "fixed" || cs.position === "absolute" || cs.position === "sticky")
    && cs.overflowY === "visible" && el.scrollHeight - el.clientHeight > 2)
```

Nó tìm ra sidebar trên **mọi route app, 4 mức zoom, 264px tràn**. Kèm luật:
**hộp nào có chiều cao cố định thì phải có chỗ cho phần thừa** — `overflow-hidden`
ở ngoài + `min-h-0 flex-1 overflow-y-auto` ở danh sách bên trong.

### Route con cũng phải test — `/trips/[id]` là chỗ tôi tự gây hồi quy

Thêm `whitespace-nowrap` vào `Button` (đúng) làm 3 nhãn tab của trang chi tiết
chuyến đi không co được nữa ⇒ tràn 25px ở 320px. **Chỉ lòi ra khi test route
động.** Lấy id thật từ `trip.list` rồi đưa `/trips/<id>` vào danh sách quét.

### Firefox trên máy này KHÔNG dùng được cho headless

Bản **snap**: headless lỗi `RenderCompositorSWGL failed mapping default
framebuffer` nên không render, `--screenshot` không ra file, và tiến trình của
chính mình cũng **`kill: Permission denied`** (namespace snap). Dọn tay:
`snap stop firefox` hoặc `systemctl --user restart snap.firefox.*`.

Dùng headless Chrome, nhưng **ghi PID lúc launch và chỉ giết theo PID**
(`/tmp/chrome-run.sh`). **KHÔNG BAO GIỜ `pkill -x chrome`** — nó khớp luôn
trình duyệt người dùng đang mở và `-9` là mất sạch tab.

### Đo xong vẫn phải NHÌN — và nhìn HẾT route, không phải vài cái

Sweep 228 lượt render báo 0 lỗi. Rồi chụp ảnh từng route thì ra 6 lỗi nữa,
không cái nào là tràn: **CTA của trang chủ nằm dưới mép màn ở zoom 150%**, tab
kéo giãn 1150px, nhãn nút gãy đôi, avatar giãn cách 150px, ô lịch cao 145px nên
tháng 6 tuần chỉ thấy 4. Script đo *tràn*; **cân đối, mật độ, thứ có trong tầm
mắt hay không thì phải nhìn**.

Cách rẻ để nhìn hết: trang tạm `/matrix?r=<route>` render **cùng route trong 3
iframe** (390×844, 960×600, 1440×900) đặt cạnh nhau, `transform: scale(.46)`,
rồi chụp **một** ảnh mỗi route. 19 ảnh là duyệt được cả hệ thống.

Hai cái bẫy đã dính:

- **Seed hỏng thì đang chụp màn hình rỗng mà tưởng là layout.** `/timeline` và
  tab hộp thời gian chụp lúc không có dữ liệu vì 1 tag dài quá 24 ký tự làm
  hỏng *toàn bộ* memory, và `capsule.create` nhận `z.date()` nên qua HTTP phải
  kèm meta superjson `{"values":{"unlockDate":["Date"]}}`. **Kiểm số bản ghi
  từng collection trước khi tin ảnh.**
- **Đừng kết luận từ ảnh đã thu nhỏ.** Tôi đã định "sửa" `/search`, `/activity`,
  `/home` vì tưởng chúng kéo dài hết màn — đọc code thì cả ba **đã cap sẵn**
  (`max-w-[900px]`, `max-w-2xl`, `max-w-[760px]`). Nhìn ra nghi vấn → **đọc code
  xác nhận** rồi mới sửa.

Và vài luật rút ra:

- **Tab phân đoạn là điều khiển, không phải banner** — rộng bằng chữ của nó,
  đừng `w-full`.
- **Nhãn nút không bao giờ xuống dòng** (`whitespace-nowrap` đã vào `Button`).
  Không vừa thì hàng bao quanh phải wrap, hoặc đổi nhãn ngắn hơn.
- **Nhãn 2–3 chữ thì cho wrap, đừng `truncate`** — "Hộp thời gi…" tệ hơn hai dòng.

### Zoom trình duyệt = viewport nhỏ lại CẢ HAI CHIỀU — phải test theo CẶP

Lượt quét đầu chạy 9 bề rộng nhưng **giữ nguyên chiều cao 900px**, nên không
thấy gì. Trong khi MacBook 1440×900 zoom 150% là trang **960×600** — và 600px
chiều cao mới là chỗ vỡ. Bảng quy đổi:

| Máy | 125% | 150% | 175% | 200% |
|---|---|---|---|---|
| MBA 13" 1440×900 | 1152×720 | **960×600** | 823×514 | 720×450 |
| MBP 14" 1512×982 | 1210×786 | 1008×655 | 864×561 | 756×491 |

Nên: **test theo cặp rộng×cao**, và nhớ hai điều nữa —

- **Trang ở trạng thái nghỉ không phải chỗ zoom cắn.** Phải **mở dialog ra rồi
  mới đo**: dialog là `fixed`, cao theo nội dung, căn giữa — ở 600px chiều cao
  thì nút bấm của nó nằm dưới mép màn và trang phía sau không cuộn nó lên được.
- Repo này có sẵn variant theo chiều cao: **`short:`** (≤760px) và
  **`shorter:`** (≤620px) trong `globals.css`. Dùng chúng cho padding, banner,
  gap, mật độ lưới. Breakpoint theo bề rộng **không nhìn thấy** vấn đề này —
  960px vẫn được đọc là "desktop".

Vài cái đã cắn thật:

- `aspect-square` cho ô lịch: đúng trên điện thoại, **sai trên màn rộng-mà-thấp**
  (7 cột ⇒ ô cao 94px ⇒ chỉ thấy 4 tuần). Màn thấp thì chặn chiều cao.
- Kích thước cố định theo breakpoint bề rộng (`md:h-[400px]`) **không biết** màn
  còn bao nhiêu chiều cao. Dùng `min(400px, 70vw, 48vh)` — tự chọn ràng buộc nào
  đang siết.
- **Đừng hard-code lề âm để tràn mép.** `ScrollStrip` dùng `-mx-4` trong khi
  `PageShell` thu gutter còn 12px ở `shorter:` ⇒ tràn 4px, trang có thanh cuộn
  ngang. Nay gutter công bố qua `--page-gutter`, lề âm huỷ đúng cái đó.
- Một cột căn giữa `max-w-md` trên màn 1440px là **bỏ trống hai phần ba** — và
  chính cái xếp chồng đó đẩy nội dung rớt khỏi màn khi zoom. Xếp ngang vừa dùng
  hết bề rộng vừa giảm nửa chiều cao cần.

### Quét responsive: dựng tài khoản thật rồi ĐO, đừng ngắm ảnh

Cách đã dùng và nên dùng lại (19 route × 9 bề rộng 320→1920, 1384 lỗi → 26):

1. **Mongo in-memory dạng replica set** (`MongoMemoryReplSet` — better-auth
   dùng transaction nên `MongoMemoryServer` thường sẽ lỗi *"Transaction numbers
   are only allowed on a replica set"*), chạy `next start` trỏ vào đó.
2. Tạo tài khoản qua `/api/auth/sign-up/email`, tạo space qua tRPC (**phải có
   header `Origin`**, không thì 403 *Forbidden origin*).
3. **Seed dữ liệu xấu tính**: tên dài nhất có thể, URL không có chỗ ngắt, note
   kịch max. Trang rỗng giấu đúng loại tràn cần tìm.
4. Trang tạm `/audit` tự đăng nhập rồi nhồi từng route vào `<iframe>` theo từng
   bề rộng, đo trong iframe, POST kết quả về một server nhỏ ở cổng khác.
5. **Xoá sạch trang tạm sau khi xong.**

Bài học về chính bộ dò — cả bốn đều làm nó nói dối:

- **So với `documentElement.clientWidth`, KHÔNG phải bề rộng iframe.** Thanh
  cuộn ăn ~16px; đo theo số ngoài là tha bổng mọi lỗi tràn nhỏ hơn 16px.
- **Modal chào mừng mở trên mọi trang** ⇒ 972 báo động giả. Set cờ localStorage
  trước khi đo (`dwy:welcomeSeen`).
- **Cha `display:contents` không có hộp** — so bề rộng với nó là vô nghĩa.
- **`scrollWidth` tính cả trang trí cố ý tràn** (icon đặt `-right-4` rồi crop).
  Chỉ tính là lỗi khi **chữ hoặc ảnh trong luồng** bị cắt.
- **Bị nav che ở đầu trang không phải lỗi** — đó là nội dung cuộn tới được. Chỉ
  đo sau khi đã cuộn hết cỡ.

Và mấy cái CSS đã cắn thật:

- `min-h-[280px]` **không bị `h-full` ghi đè** — khác thuộc tính. Truyền `min-h-0`.
- Cho một flex item `min-w-0` để hết tràn có thể làm nó **rớt mỗi dòng một chữ**.
  Tràn vì cạnh nó có control rộng cứng thì hãy **xếp dọc**, đừng ép chữ co.
- `scale` của Tailwind **thay thế** `transform` định vị của MapLibre marker.
- Indicator tab tính bằng `100/tabs.length` **ép mọi tab bằng nhau** ⇒ phải ghim
  `min-w-[400px]` ⇒ nhãn rớt hai dòng. Đo nút đang active thì hết cả chuỗi đó.

### Thứ gì phải TỰ NHÌN mới thấy thì đừng đoán — đo nó

Dock bản đồ thu nhỏ build xanh, tsc sạch, lint 0 — và có **ba** bug, cả ba
chỉ lòi ra khi dựng trang tạm ép nó hiện rồi đo bằng `getBoundingClientRect`:

- Nó nằm **đè 4px dưới thanh nav dưới**. Nav cao 75px chứ không phải 72 như đoán.
- `LocationMapView` mang sẵn `min-h-[280px]` cho bản full trang. **Chiều cao tối
  thiểu là thuộc tính KHÁC với chiều cao**, nên `h-full` không đụng tới nó: canvas
  278px nằm trong khung 104px, marker vị trí rơi xuống dưới vùng nhìn thấy 36px.
  Phải truyền `min-h-0` để `twMerge` xử — xem mục `cn()` bên dưới.
- MapLibre vẽ marker trong lớp **tràn ra ngoài canvas có chủ đích**, nên nó đè lên
  dòng khoảng cách và dock trông như không có chữ nào.

Và một cái sửa hụt: `scale` của Tailwind lên marker **thay thế** `transform`
định vị của MapLibre chứ không cộng vào, làm marker rời khỏi đúng điểm nó đánh dấu.

Nên: trang nào nằm sau đăng nhập hoặc sau một trạng thái khó dựng, muốn biết nó
đúng thì **dựng trang tạm ép trạng thái đó ra, chụp màn hình và ĐO** — rồi xoá
trang tạm. Build xanh không nói gì về chuyện nó trông thế nào.

## PiP / nổi trên app khác: web không làm được, đừng hứa

Yêu cầu "thoát app vẫn thấy khung mini như Google Maps" là **PiP mức hệ điều
hành**, Google Maps làm được vì nó là app native. Ba đường của web đều tắc:

| Đường | Vướng |
|---|---|
| Auto-PiP lúc `visibilitychange` | bắt buộc đang **quay camera/mic** qua `getUserMedia`, và chỉ Chrome desktop |
| Document PiP | chỉ Chrome/Edge **desktop**; Android còn sau cờ |
| Canvas → video PiP | `requestAnimationFrame` **không chạy khi trang bị ẩn** ⇒ cửa sổ đứng hình |

Khung mini đứng hình ở vị trí người ta đã đi qua thì **tệ hơn là không có**. Phần
làm được — và đã làm — là rời khỏi *trang* bản đồ mà chuyến đi vẫn sống.

## Accessibility là bắt buộc, không phải phần thêm

Lý do có mục này: những thứ hỏng ở đây không phải chuyện tinh vi, mà là những
cái cơ bản nhất, và chúng lọt qua vì **không ai kiểm tự động**.

Ba ca thật đã xảy ra:

- Ô tìm kiếm trên `/map` **không có `onKeyDown`**. Gõ địa chỉ xong bấm Enter —
  phím mà ai cũng bấm — thì không có gì xảy ra. Không phải quên xử lý một
  trường hợp hiếm, mà là quên đường đi thường gặp nhất.
- Bốn thẻ chuyển tab trong Két là `<div onClick>`. Người dùng bàn phím
  **không đổi tab được**, tức là cả một khu vực tính năng không tới được.
- Ba overlay tự chế đóng bằng click ra ngoài và **không có một handler Escape
  nào trong cả file**. Không có chuột thì không có đường ra.

### Đã có kiểm tra tự động — đừng tắt nó

`eslint.config.mjs` bật các rule `jsx-a11y` ở mức **error**, nên build đỏ nếu
tái phạm:

| Rule | Bắt cái gì |
|---|---|
| `alt-text` | `<img>` thiếu `alt` (trước đây bị **tắt tay**, đã bật lại) |
| `click-events-have-key-events` | thẻ tĩnh có `onClick` mà không có phím |
| `interactive-supports-focus` | thứ tương tác được mà không focus được |
| `control-has-associated-label` | ô nhập không có tên đọc được |
| `anchor-is-valid`, `aria-props`, `role-has-required-aria-props` | dùng sai ARIA |
| `@typescript-eslint/no-unused-vars` | biến / import không ai dùng |

`no-static-element-interactions` **cố ý để `off`** — nó bắt cả những lớp bọc chỉ
làm `stopPropagation`, vốn không phải điều khiển; gắn `role`/`tabIndex` vào đó
chỉ tạo điểm dừng focus rỗng. Ca thật mà nó nhắm tới đã bị hai rule trên chặn.

`no-unused-vars` từng để `off`, và chính vì thế một đợt dọn dẹp đã **xoá mất ba
lời gọi `useEscapeKey`** mà không ai biết — import vẫn còn, ba overlay lặng lẽ
mất đường thoát bằng bàn phím. Bật nó lên là bắt được ngay.

**Đã kiểm bằng cách cố tình vi phạm:** `<div onClick>` và `<img>` thiếu `alt`
đều bị chặn. **Nút chỉ chứa icon `aria-hidden` thì KHÔNG bị bắt**, kể cả khi
chỉnh `depth` — cái đó phải tự nhớ.

### Những thứ linter không bắt được — phải tự nghĩ

- **Nút chỉ có icon phải có `aria-label`.** Linter không bắt được ca này (đã
  thử), nên nó hoàn toàn nằm ở người viết.
- **`onKeyDown` phải đủ phím.** Nút thì `Enter` **và** `Space`. Ô nhập thì
  `Enter` phải làm đúng hành động chính. Đừng chỉ bắt `Enter` rồi coi là xong.
- **Mọi lớp phủ đóng được phải đóng được bằng `Escape`.** Dùng `<Modal>` hoặc
  `<BottomSheet>` — chúng lo sẵn Escape, bẫy focus và khoá cuộn. Chỉ khi không
  dùng được thì mới tới `useEscapeKey`, và nhớ nó **chỉ lo việc đóng**.
- **Lớp bọc `stopPropagation` phải chặn cả phím.** Có `onClick={e =>
  e.stopPropagation()}` thì phải có `onKeyDown` tương ứng, không thì bấm Enter
  trên nút bên trong vẫn kích hoạt phần tử cha — đúng cái mà lớp bọc sinh ra để
  ngăn.
- **`placeholder` không phải nhãn.** Nó biến mất ngay khi người ta gõ. Ô nhập
  cần `aria-label` hoặc `<label>` thật.
- **Nền mờ của modal là trang trí** — `role="presentation"`, và đường ra bằng
  bàn phím là Escape chứ không phải gắn handler lên tấm nền (không ai focus
  được nó).
- **Đừng tắt rule để build xanh.** Nếu một rule kêu ở chỗ nó sai, hãy tắt đúng
  dòng đó kèm lý do, hoặc sửa cấu hình kèm comment giải thích — như mục
  `no-static-element-interactions` ở trên.

### Trước khi coi là xong

```bash
npx tsc --noEmit && npm run lint && npm run build
```

`npm run lint` phải ra **0 error, 0 warning**. Cảnh báo tồn tại lâu ngày sẽ dạy
người ta bỏ qua cảnh báo, và rồi cái thật cũng bị bỏ qua.

### Thao tác sắp xếp: đổi trên UI trước, gửi ĐÍCH ĐẾN chứ không gửi từng bước

Nút Lên/Xuống cũ `await` mutation rồi `invalidate` cả ngày mới nhúc nhích ⇒ mỗi lần bấm tốn 2 vòng mạng đứng im, và bấm tiếp trong lúc đó thì đánh nhau với cái refetch đang bay.

Ba luật:
- **Đổi chỗ trong cache ngay khi bấm.** Nhớ cập nhật luôn field `order` cho khớp vị trí mới, không thì chỗ nào re-sort lại cache sẽ lật ngược những gì đang hiện trên màn.
- **Gom lệnh 400ms sau lần bấm cuối, và gửi THỨ TỰ CUỐI CÙNG** (`reorder({date,bucket,ids})`), không gửi N lệnh `move`. Gửi đích đến thì: bấm liên tục thu về 1 lệnh ghi, chạy lại 2 lần vẫn ra cùng kết quả, và không có chuyện các lệnh về không đúng thứ tự.
- **Rollback về trước CẢ LOẠT**, không phải trước lần bấm cuối — một lệnh ghi hỏng làm vô hiệu mọi swap trong loạt đó.

Server phải xử lý cả id mà client **không** gửi (người kia vừa thêm thẻ giữa chừng): xếp chúng sau, giữ thứ tự tương đối, đừng đá ra khỏi buổi.

Đo thật: 3 lần bấm cách nhau 90ms ⇒ UI đổi xong trong 275ms **chưa gửi gì**, server khớp sau khi lắng.

### Chặn chiều cao ảnh thì chặn BỀ RỘNG CỘT, đừng bóp ảnh trong khung

`max-h` + `w-auto` làm ảnh thấp lại nhưng **khung vẫn full width** ⇒ hở hai dải trắng hai bên. Máy màn cao không thấy, máy màn thấp thấy ⇒ bị đọc nhầm thành "lỗi thiết bị".

Ảnh 1672×941 thì cột rộng `H × 1672/941` cho ra đúng chiều cao `H` mà ảnh vẫn lấp kín khung ở mọi tổ hợp width–height:

```
[--hero-h:200vh] short:[--hero-h:66vh] shorter:[--hero-h:60vh]
max-w-[min(560px,calc(var(--hero-h)*1672/941))]
```

Dùng biến CSS thay vì `lg:max-w-none`, vì `lg:` sẽ đè mất `shorter:` khi cả hai cùng là media query.

Và **trần đặt quá chặt cũng là lỗi**: 44vh trên cửa sổ 2000×620 vẽ hero rộng 483px — 24% màn hình — cho một hero mà toàn bộ mục đích là bức ảnh.

### Ảnh thiếu bóng đổ: quét bằng máy, đừng chờ người dùng chỉ từng trang

Duyệt mọi `<img>` brand trên mọi route, kiểm tra **cả `box-shadow` lẫn `filter: drop-shadow`**, leo **6 tầng cha** — ảnh tràn viền nằm trong thẻ thì bóng thuộc về cái thẻ, leo 3 tầng sẽ báo oan.

Bỏ qua: logo (là mark đặt lên bề mặt), ảnh nền trang trí `aria-hidden` rộng gần hết màn, và ảnh nhỏ < 48px.

Ảnh tách nền nhận bóng theo **hình** (`drop-shadow`), ảnh đục nhận bóng theo **hộp** (`shadow` + bo góc) — hỏi `brand-cutouts.json` chứ đừng đoán.

### Chrome sập vì `backdrop-filter`, không phải vì rò rỉ JS — đo cả hai

Máy Mac Intel 2019 sập Chrome ở trang lịch. Đo trước, đoán sau:
- **Rò rỉ JS: không có.** Vào/ra route 9 lần, ép GC mỗi vòng: heap phẳng 5MB, DOM nodes 853, listeners 555 — không nhích. Ảnh giải nén tổng < 4MB.
- **Chi phí compositing: có.** 6 lớp `backdrop-filter` cùng lúc, lớn nhất blur 24px trên ~222k px², và bị lấy mẫu lại mỗi khung hình vì phía sau là **ảnh nền `fixed` phủ toàn màn**. Đây là tổ hợp giết tiến trình GPU trên card tích hợp đời cũ.

Bẫy nguy hiểm nhất: **`backdrop-blur` đặt trong một item của danh sách**. Chip đếm trong `calendar-cell.tsx` khiến tháng nào nhiều kế hoạch là **tới 42 lớp compositing riêng** trên một màn. Quy tắc: `backdrop-filter` chỉ dùng cho phần tử **duy nhất trên màn** (thanh nav, modal), tuyệt đối không trong phần tử lặp.

Chữa: bỏ blur ở phần tử lặp và thay bằng `bg-*/90`; giảm bán kính blur ở lớp lớn nhất và bù bằng nền đục hơn; bỏ blur nằm dưới bề mặt đã đục ≥92% (không ai thấy).

Cách đo: `Performance.getMetrics` cho heap/nodes/listeners qua nhiều vòng điều hướng; duyệt DOM đếm `backdropFilter`/`filter: blur` kèm **diện tích** phần tử.

### Bỏ `sticky` khỏi một khối có lớp `absolute inset-0` bên trong = ảnh tràn cả trang

Ảnh của band header phủ kín vùng content, viền band chỉ vẽ đè lên trên. Không phải lỗi clip: lớp ảnh là `absolute inset-0`, nên nó được **định cỡ bởi tổ tiên ĐƯỢC ĐỊNH VỊ gần nhất**. Trước đây band là `sticky` — mà `sticky` là positioned — nên nó "chạy đúng nhờ may". Gỡ `sticky` đi thì không còn gì positioned, ảnh neo lên tận đâu và nở ra cả trang. `z-30` cũng vô tác dụng vì cùng lý do.

Luật: khối nào chứa con `absolute inset-0` thì **phải tự khai `relative`**, đừng dựa vào `sticky`/`fixed` đang có sẵn. Khi gỡ một class định vị, soát ngay các con `absolute` bên trong.

**Đo bằng kích thước, đừng đo bằng "có tràn không":** `getBoundingClientRect` KHÔNG tính clip, nên "ảnh lòi ra ngoài band bao nhiêu px" luôn ra số dương ngay cả khi clip vẫn tốt. Phép đo đúng là **so chiều cao ảnh với chiều cao band** — 158 vs 144 là đúng (dư 10% do `scale-110`), 1100 vs 144 là hỏng.

### Header đứng yên thì phải NẰM NGOÀI vùng cuộn, không phải đè lên

Ghim header bằng `sticky` + một dải nền full-bleed mờ = đúng cái "thanh ngang" bị lộ, vì nội dung trượt **phía sau** nó.

Cách đúng: khung app cao `100dvh` (`flex flex-col overflow-hidden`), header là hàng `shrink-0`, content là `min-h-0 flex-1 overflow-y-auto`. Không sticky, không mask.

Ba thứ phải xử cùng lúc, thiếu một là hỏng:
- **`min-h-0` bắt buộc** — flex item mặc định `min-height:auto` nên sẽ nở theo nội dung thay vì cuộn.
- **Mọi phần tử trung gian phải truyền tiếp flex.** `src/app/template.tsx` (hiệu ứng chuyển trang của App Router) bọc mọi page trong một `motion.div` **không class**; là `display:block` nó cắt đứt chuỗi ⇒ page xin `flex-1` không được gì, nở ra 1242px trong cửa sổ 560px, và `overflow-hidden` của khung **nuốt mất** phần dư (không cuộn tới được).
- **Chỗ dành cho bottom-nav chuyển vào chính hộp cuộn**, không để ở khung ngoài — khung đã cao đúng viewport rồi.

Route marketing/auth giữ nguyên cuộn document: chúng là trang dài, không có app chrome, không có gì để ghim.

### `relative` KHÔNG tạo stacking context — z-index bên trong sẽ tràn ra ngoài

Số ngày trong ô lịch vẽ **đè lên header đang ghim**. Không phải lỗi sticky: ô lịch là `relative` **không có z-index**, nên nó chưa từng mở stacking context, và các `z-20` bên trong nó tranh cùng cấp với layer của trang — cells nằm sau trong DOM nên thắng.

Luật: phần tử có `z-index` bên trong thì phải tự đóng gói bằng `isolate` (hoặc `relative z-0`). Và thang bậc phải rõ: nội dung < header trang (z-30) < thanh app (z-40) < modal (z-50).

Kèm theo: header có ảnh **tách nền** thì phải có nền đặc bên dưới, không thì nội dung cuộn phía sau lộ xuyên qua chính header.

### Dialog cần thao tác trên trang phía sau: ẨN, đừng ĐÓNG

Form thêm địa điểm phải chạm bản đồ để lấy toạ độ. Đưa vào modal là bản đồ bị scrim chặn; mà đóng modal thì **mất sạch những gì đã gõ**, vì các field sống trong children của nó.

Cách đúng: thêm prop `hidden` — giữ mount, chỉ tắt nhìn thấy và `pointer-events`. Kèm một thanh nhắc nổi, vì một dialog vô hình cộng bản đồ đột nhiên bấm được thì không phân biệt được với lỗi.

⚠️ `framer-motion` ghi `opacity` bằng **inline style**, đè mọi class Tailwind. Lần đầu tôi để `hidden && "opacity-0"` thì dialog bấm xuyên qua được nhưng **vẫn hiện nguyên**. Phải đi qua chính `animate={{ opacity: hidden ? 0 : 1 }}`.

Và: `useState(initial)` chỉ đọc đối số **một lần**. Giá trị cha đẩy xuống sau khi form đã mở (toạ độ vừa chạm) sẽ không bao giờ vào form — cần `useEffect` đồng bộ.

### Tháng trong app này là 1-BASED — `Date` mới là 0-based

`/calendar?d=2026-08-31` mở đúng ngày rồi **để lại tháng 7** phía sau khi đóng modal. Nguyên nhân: tách khoá ngày ra rồi lưu `month: m - 1`, tức coi một giá trị **vốn đã 1-based** như tham số `Date`.

Quy ước trong màn lịch, kiểm hết rồi mới sửa: `initialYM` cộng 1 vào `getMonth()`, `calendar-grid` ghi rõ `month: number; // 1-12`, `prev/next` cuộn vòng ở 1 và 12, và server validate `min(1).max(12)`.

**Tháng 1 hỏng nặng hơn lệch tháng**: `m - 1` ra 0, query từ chối, header không render nổi. Ca biên này không lộ ra nếu chỉ thử tháng 8.

Các chỗ `m - 1` còn lại trong lịch đều ĐÚNG — chúng nạp vào `new Date(y, m-1, d)` hoặc `MONTHS[m-1]`, cả hai đều 0-based. Đừng "sửa" bừa: chỉ chỗ nào **lưu** tháng vào state 1-based mới sai.

Nghiệm thu phải chạy lại trên **bản lỗi** trước: nếu test không đỏ với `m - 1` thì nó không chứng minh được gì. Và phải thử tháng 1 lẫn tháng 12.

### Đừng để trạng thái đọc `scrollY` mà lại LÀM ĐỔI chiều cao trang

Header thu gọn theo ngưỡng cuộn tự nuốt đuôi mình: thu gọn bớt ~92px chiều cao trang → trình duyệt **kẹp `scrollY`** xuống mức tối đa mới → `scrollY` nhỏ lại tụt dưới ngưỡng → giãn ra → trang dài lại. Trang chỉ cao hơn cửa sổ một chút thì **không bao giờ ổn định**; thả tay giữa lúc cuộn là giật mãi. Vùng chết (hysteresis) không cứu được, vì cú kẹp nhảy nguyên 92px.

Luật: **thứ điều khiển bởi vị trí cuộn thì không được đổi chiều cao layout.** Đổi opacity/màu/độ mờ thì được.

Hai cách chữa và vì sao chỉ 1 cách sống:
- ~~Dính ở offset ÂM~~ (`top = pin + peek - height`) — hết vòng lặp thật, nhưng **không có `peek` cố định nào vừa**: khối tiêu đề 1 dòng ở route này, 3 dòng ở route kia khi phụ đề xuống dòng trên điện thoại ⇒ luôn có chỗ tiêu đề bị cắt trên đỉnh màn.
- **Dính nguyên chiều cao.** Đúng cái người dùng xin (đừng trôi mất để với tới quick action), và không có gì để hỏng.

Nghiệm thu phải là: cuộn tới nhiều mốc, **buông ra**, rồi lấy mẫu ~70 khung hình xem chiều cao/`scrollY` có đổi không. Đo trong lúc đang cuộn sẽ giấu mất lỗi.

⚠️ Route không có dữ liệu thì **không cuộn được**, và trang không cuộn được thì chẳng chứng minh gì về sticky. Chèn spacer cao 1500px **vào đúng cha của band** — chèn chỗ khác là tự tạo ra đúng lỗi đang đi tìm.

### Ba lý do một class không có tác dụng — kiểm tra bằng computed style, đừng tin mắt

Cùng một buổi dính cả ba, cái sau che cái trước:

1. **Class ghép bằng template literal** (`` `top-[...${VAR}...]` ``) — chuỗi đúng vào tới DOM, nhưng Tailwind **quét văn bản nguồn** nên không sinh luật nào. Kết quả: `top: auto`, sticky chỉ còn cái tên.
2. **Tailwind từ chối phát class**: `top-[min(var(--pin),calc(...))]` không được sinh ra; `[--sheen:rgb(194_105_63/0.20)]` cũng vậy vì dấu `/` bị hiểu là cú pháp opacity. Tránh `min()` lồng và dấu `/`; dùng `rgba(a,b,c,d)` hoặc chọn nhánh bằng **variant** thay vì nhét điều kiện vào trong giá trị.
3. **CSS không nằm trong `@layer` thắng utilities của Tailwind.** `.btn-sheen { --sheen: white }` viết trần đè mọi `[--sheen:…]` đặt trên nút. Mặc định phải nằm ở **fallback của `var()`** (`var(--sheen, …)`), đừng khai trên chính rule đó.

Cả ba đều **không có lỗi build, không cảnh báo**. Cách duy nhất phát hiện: đọc `getComputedStyle` của phần tử thật (kể cả `::after`) ở trình duyệt.

### `sticky` chỉ dính TRONG PHẠM VI CHA — và `relative` lặng lẽ thắng nó

Hai lần cùng một buổi, header có ảnh vẫn trôi mất dù đã thêm `sticky`:

1. Chuỗi class còn sót `art ? "relative" : ""`. `relative` và `sticky` tranh cùng ô `position`, `tailwind-merge` giữ cái viết sau ⇒ `relative` thắng, `sticky` biến mất **không một cảnh báo**. Không cần `relative` cho lớp ảnh tuyệt đối bên trong: `sticky` tự nó đã là phần tử được định vị.
2. Ở `/home`, band nằm trong `<header className="space-y-2">`. Phần tử `sticky` **chỉ dính hết chiều cao của CHA nó**, nên nó trôi đi cùng cái `<header>` cao vài trăm pixel đó. Bỏ khung bọc (trả về fragment) là xong — các route khác vốn đưa `PageHeader` thẳng vào `PageShell`.

Nghiệm thu phải là: cuộn thật rồi đọc `getBoundingClientRect().top`. Nhìn class trong code không phát hiện được cả hai lỗi này.

Band dính mà cao 144px thì chiếm 1/5 màn hình điện thoại cho bức ảnh chẳng ai còn nhìn ⇒ cuộn quá 56px thì **thu gọn** còn tiêu đề + nút (đo được 144→52px). Ngưỡng phải có vùng chết (lên 56, xuống 24), không thì trang kết thúc sát mốc sẽ nhấp nháy qua lại.

### Đo tương phản thì đo PIXEL THẬT — và hộp thoại làm hỏng mọi con số

Tính "nền sau chữ" từ CSS là đoán, khi đã chồng ảnh + gradient wash + thẻ trong suốt. Cách đúng: chụp trang, chụp lần hai với chữ bị làm trong suốt (`color:transparent`), rồi đọc nền thật dưới từng hộp chữ ở ảnh thứ hai.

**Bẫy đã dính:** lần chạy đầu báo 207 chỗ chìm với tỉ số 1.31:1 — vô lý. Nguyên nhân: modal "Chào mừng" đang mở, làm mờ và tối cả trang phía sau. Mọi số đo qua một lớp overlay đều là rác. Nay probe tự `localStorage.setItem('dwy:welcomeSeen','1')` và **từ chối đo** nếu còn `[role="dialog"]`.

Cách tự kiểm probe: tính tay 1 cặp màu đã biết. Nhãn sidebar `#c2693f` trên `#f6e6dc` phải ra 3.21:1 — probe ra đúng 3.21 thì mới tin phần còn lại.

**Và phải đo BẢN CŨ để biết mình có gây ra hay không.** Nền cũ 166 chỗ, nền nét 169 ⇒ việc làm nét chỉ thêm 3, còn 166 là nợ sẵn. Không có phép đo này thì rất dễ nhận vơ hoặc chối bay một hồi quy.

### Điều khiển LUÔN CÓ chiếm mép, điều khiển CÓ ĐIỀU KIỆN lùi vào trong

Ô tìm kiếm bản đồ đặt nút filter ở `right-9` để chừa chỗ cho nút xoá `right-1.5`. Nút xoá chỉ xuất hiện khi đã gõ, nên ô rỗng — trạng thái thường gặp nhất — luôn hở một khoảng 36px ở mép phải.

Luật: thứ luôn hiện diện đặt sát mép; thứ xuất hiện có điều kiện chèn vào trong. Đừng để bố cục lúc rỗng phải trả giá cho thứ chưa tồn tại.

Cùng họ với nó: `input[type="search"]` tự vẽ **nút xoá của trình duyệt** đè lên nút xoá của app ⇒ hai dấu X làm cùng một việc, hình dạng khác nhau. Ẩn cái native (`::-webkit-search-cancel-button`), giữ cái của app vì chỉ nó mới style/label/focus được.

### Một chuyển động, đừng thành hai

Thu gọn panel bản đồ bị "giật sang trái rồi mới mờ dần". Nguyên nhân: `ease-out` **dồn phần lớn quãng đường vào 1/3 đầu**, nên 24px trượt xong gần như tức thì trong khi opacity còn fade hết 300ms — mắt đọc thành hai sự kiện. Thêm nữa, nút "mở lại" mount ngay lập tức ở opacity đầy đủ trong lúc cột còn đang bay ra.

Chữa: quãng dài hơn, đường cong giảm tốc (`cubic-bezier(0.32,0.72,0,1)`), opacity **trễ lại phía sau** chuyển động, và giữ nút mở lại luôn mount rồi cho nó hiện dần **sau** khi cột đã đi.

### Vành focus vẽ NGOÀI hộp — mọi khung cắt đều xén nó

Khung có `overflow` khác `visible` sẽ xén vành focus của con đang được tab tới, vì ring nằm ngoài mép phần tử. Đã dính 3 chỗ cùng lúc: danh sách cuộn trong sidebar (xén ring của **cả 10 mục nav, trên mọi route**), thanh tab `scroll-strip`, và list địa điểm trong `map-sheet`.

Luật: khung cuộn/cắt chứa phần tử focus được thì **phải chừa padding ≥ bề rộng ring** (`py-1`/`px-1` là đủ cho ring 4px), kèm `scroll-my-*` để bàn phím cuộn tới không dán sát mép. Canvas của thư viện ngoài (MapLibre) không chừa được thì cho ring vẽ vào trong: `outline-offset: -3px`.

Gỡ `overflow-hidden` ở khung NGOÀI là chưa đủ — khung cắt thật thường là **cái cuộn ở trong**.

**Cách dò, đừng đoán "nhiều nơi":** duyệt mọi phần tử focus được, leo cây tìm tổ tiên đầu tiên có overflow ≠ visible, so mép hộp + ring với mép khung. Hai cái bẫy của phép dò này:
- **Cắt lớn (vài chục–vài trăm px) KHÔNG phải lỗi ring** — đó là phần tử đang cuộn khuất, chuyện bình thường. Chỉ tính khi hộp phần tử nằm TRỌN trong khung mà vành thì không.
- **Style theo trạng thái thì phép dò hình học không thấy.** `:focus-visible` chỉ khớp khi focus bằng bàn phím; đọc `outline-offset` lúc chưa focus luôn ra giá trị nền. Và `.focus()` bằng script KHÔNG kích hoạt `:focus-visible` — muốn nghiệm thu phải bắn phím Tab thật.

### Ảnh nào đã tách nền: ĐO, đừng nhớ

Cách vẽ một ảnh phụ thuộc vào việc nó có tách nền hay không — tách nền thì để trần kèm bóng đổ theo hình, còn ảnh đục phải có khung/bo góc, nếu không mép chữ nhật cứng sẽ chọi vào nền.

Sự thật đó từng nằm trong một `Set` gõ tay, và nó **sai âm thầm** ngay khi bản tách nền được ghi đè lên đúng tên file cũ: 6/8 ảnh `common-page` thành tách nền mà code vẫn bọc thẻ trắng. Không có lỗi build, không có cảnh báo — chỉ có người dùng nhìn thấy.

Nay `scripts/measure-brand-cutouts.mjs` đọc pixel rồi ghi ra `src/lib/brand-cutouts.json`; `tone.ts` đọc file đó. **Thả ảnh mới vào `public/brand-image` thì chạy lại script.**

Nhận diện bằng **viền ngoài trong suốt (>80%)**, không phải tổng lượng alpha: ảnh khối có vài pixel mềm ở mép không phải ảnh tách nền, còn chủ thể nổi trên nền rỗng thì viền luôn trong suốt. Đo bằng tổng alpha sẽ xếp nhầm cả hai chiều.

### Một sự thật, một nguồn — giờ đã chọn thì buổi phải theo

Form kế hoạch có "Buổi trong ngày" và "Giờ (tuỳ chọn)" sửa độc lập, nên lưu được việc **buổi Sáng mà giờ 19:00**. Hai ô cùng nói về một sự thật thì một ô phải **suy ra** từ ô kia, không phải cả hai cùng ghi.

Nay `bucketForTime()` trong `src/lib/plan-meta.ts` là nguồn duy nhất (Sáng 05–10, Trưa 11–12, Chiều 13–17, Tối 18–04 — Tối là nhánh cuối vì nó vắt qua nửa đêm). Có giờ thì ô buổi khoá lại **và nói rõ vì sao** ("Theo giờ 19:00. Xoá giờ để tự chọn buổi") — khoá mà không giải thích thì bị đọc là hỏng. `create`/`update` ở server áp cùng hàm đó, nên gọi thẳng API cũng không lệch được.

### Đổi nhóm thì phải CẤP LẠI CHỖ trong nhóm mới

`update` đổi `bucket` mà giữ nguyên `order` ⇒ việc mang order 0 rơi vào buổi đã có order 0. Đo thật: sửa A sang buổi Tối cho ra `A=0, X=0, Y=1`.

Trùng số không chỉ xấu — nó làm **hỏng luôn chức năng sắp xếp**, vì `move` tìm hàng xóm bằng `$lt`/`$gt` nghiêm ngặt nên bỏ qua đúng cái bằng nhau: bấm Lên/Xuống hoặc không nhúc nhích, hoặc đổi nhầm cặp rồi nhân thêm trùng (`X=0, Y=0, A=1`).

Hai luật rút ra:
- Đổi khoá-nhóm (bucket/ngày) thì tính lại vị trí — nối vào cuối nhóm đích.
- **Sắp xếp lại thì đổi chỗ theo VỊ TRÍ rồi đánh số lại `0..n-1`**, đừng so sánh giá trị. So giá trị đòi dữ liệu phải sạch sẵn; đánh số lại thì **tự chữa** dữ liệu đã trùng từ trước ngay lần đầu chạm vào — dữ liệu trên máy người dùng đã trùng rồi, không có bản migration nào.
- Mọi chỗ `.sort()` theo `order` phải có **tiebreak tất định** (`|| a.id.localeCompare(b.id)`), nếu không hai lần đọc cùng một dữ liệu lại ra hai thứ tự.

### Dữ liệu mà màn hình đang nói về thì phải với tới được TỪ ĐÓ

`calendar.dayDetail` trả về `memories` kèm ảnh **từ lâu rồi**, nhưng `DayDetail` không hề dựng ra — nên muốn xem hay xoá một tấm ảnh của ngày đó phải rời lịch, sang mục Kỷ niệm mò tay. API có sẵn mà UI bỏ quên thì người dùng vẫn coi là thiếu tính năng.

Khi làm màn hình chi tiết, soát lại **payload đã trả về những gì** trước khi kết luận là thiếu. Và xoá một tấm ảnh thì ghi lại danh sách ảnh của kỷ niệm đó, **đừng xoá cả kỷ niệm** — tiêu đề và lời ghi người ta viết phải sống sót.

## `cn()` phải giữ `tailwind-merge`

`cn()` từng là `classes.join(" ")` thuần. Nghĩa là `className` truyền vào một
component **không ghi đè** class của chính component đó — cả hai cùng nằm trong
thuộc tính và **thứ tự trong file CSS quyết định**. Tailwind phát utility theo
thứ tự thang giá trị, nên `h-11 px-4` của `<Button>` thắng `h-9 px-0` do người
gọi truyền vào, âm thầm.

Kết quả thật: một nút rộng 36px với 32px padding — còn **4px cho icon 16px**,
nhìn ra thành nút rỗng và đã bị báo lỗi đúng như vậy. **Bảy** chỗ trong repo
đang render một kích thước khác với con số viết ngay cạnh nó.

Đừng gỡ `twMerge` ra khỏi `cn()`. Và khi một class ghi đè "không ăn", nghĩ tới
nguyên nhân này trước khi thêm `!important`.

## Vài điều khác về repo này

- **Route công khai phải thêm vào `MARKETING_ROUTES`**
  (`src/components/marketing/feature-pages/slugs.ts`). Sitemap, kiểm tra robots
  và danh sách loại-trừ-vỏ-app đều đọc từ đó. Quên thì khách từ Google bị đá
  sang onboarding.
- **`middleware.ts` đọc `PRIVATE_ROUTES`** trong `src/lib/site.ts`. Thêm route
  riêng tư vào đó là được bảo vệ ở mọi nơi cùng lúc.
- **Metadata cấp trang GHI ĐÈ `openGraph` của layout**, không gộp. Trường nào
  layout đặt mà trang cần thì phải viết lại — đã mất `og:image` một lần và
  `og:site_name` một lần vì chuyện này.
- **Đừng nói app này chỉ dành cho các cặp đôi.** Bạn bè, anh chị em, người ở
  cùng đều dùng. Một không gian hiện giới hạn **hai người** — nói thật điều đó,
  đừng hứa nhóm đông.
