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

## Tối ưu tốc độ tải: đo trước, và đo cho đúng thứ

`/map` từng mất **6,0s** mới hiện bản đồ trên hồ sơ điện thoại bị bóp (4G chậm, CPU ×4, 390×740).
Bốn ý tưởng "hiển nhiên" đầu tiên đều **không cải thiện gì**, mỗi cái đều đo được:

| Thử | Kết quả đo |
|---|---|
| `preconnect` tới tile server | 6382 → 6059ms (−0,3s, gần như nhiễu) |
| Hâm nóng style/sprite/glyph ngay trong HTML | 6262ms — asset về sớm thật, nhưng JS chậm lại đúng bằng đó |
| Cho warm-up chạy `priority:"low"` | 6348ms — Chrome không nhường băng thông qua origin khác |
| Đổi sang style nhẹ hơn (`positron`) | 0 byte tiết kiệm: cùng sprite, cùng font |

Lý do chung: **link đã bão hòa băng thông**. Sắp xếp lại thứ tự chỉ chia lại cùng một cục bytes.
Trên đường truyền như vậy, chỉ có hai thứ ăn tiền: **bớt bytes**, hoặc **đừng tải lại lần sau**.

Phép thử tách bạch: cho service worker phục vụ **toàn bộ** 413 KB asset bản đồ từ đĩa mà vẫn xóa HTTP cache
⇒ vẫn 6,9s. Nghĩa là asset bản đồ **không phải** nút thắt — nút thắt là **chunk JS của chính app**.
Cache thêm `/_next/static/` thì rơi xuống **1,6s**. Đừng tối ưu phần mình *đoán* là nặng; hãy tắt từng phần đi mà đo.

### Service worker `public/sw.js` — hợp đồng hẹp, đừng nới

Nó chỉ trả lời **hai** thứ: `tiles.openfreemap.org`, và `/_next/static/` của chính mình.
**Không bao giờ** đụng HTML, RSC payload, tRPC, upload — nhờ vậy không tồn tại kịch bản "deploy xong user vẫn thấy bản cũ".
`/_next/static/` an toàn vĩnh viễn vì Next băm nội dung vào tên file và trả `immutable`: build mới **không thể** dùng lại URL cũ.
Đã thử thật: cài SW ở build N, deploy build N+1, mở lại bằng đúng máy đó → chạy đúng, chunk đổi thì tải mới, chunk cũ lấy từ cache.
Ai muốn thêm route vào SW: phải chứng minh URL đó bất biến, không thì đừng.

### Bẫy khi đo — đã dính đủ, đừng dính lại

- **Tile không xuất hiện trong Network của CDP.** MapLibre tải tile từ **Web Worker**, page target không thấy. Suýt kết luận sai về tổng payload. Muốn đếm thì đọc qua Cache API hoặc attach vào worker target.
- **Lấy mẫu màu phải nằm TRONG canvas bản đồ.** Bản probe đầu lấy một ô cố định trên màn hình, đọc trúng hình nền trang trước và báo "map xong sau 536ms" trong khi map còn chưa bắt đầu tải.
- **Profile Chrome rò rỉ giữa các lần đo.** `rm -rf` báo *Directory not empty* = còn tiến trình giữ thư mục ⇒ lần đo sau ăn cache của lần trước và cho số đẹp giả. Mỗi lần đo một thư mục riêng, đo xong mới xoá.
- **Server đo phải có env.** `npx next start` trần thiếu `MONGODB_URI`/`BETTER_AUTH_SECRET` ⇒ mọi route 307 về `/sign-in`, probe báo `>60s` như thể app hỏng. Và nếu `kill` cổng không ăn, server **cũ (build cũ)** vẫn phục vụ ⇒ đang đo một bản code khác. Luôn kiểm `curl -b <jar> /map` trả **200** trước khi tin bất kỳ con số nào.
- **Cookie jar hết hạn theo DB.** Phiên chết thì mọi thứ 307; tạo lại tài khoản test rồi đo.
- Muốn nói "nhanh hơn X lần" thì phải **dựng lại bản gốc trên cùng server đó** rồi đo, đừng so với con số ghi từ hôm trước.

### `reach.js` báo `/map` mobile mất 278px — là dương tính giả

Probe đó đo cuộn **cấp trang**. Trên mobile danh sách nằm trong `MapSheet`, một bottom sheet có
`min-h-0 flex-1 overflow-y-auto overscroll-contain` tự cuộn bên trong (`map-sheet.tsx`).
Đã kiểm tay: 975px nội dung trong khung 664px, **cuộn tới đáy được**, phần tử cuối ở y=678.
Bản trước khi sửa cũng y hệt ⇒ không phải hồi quy. Đừng "sửa" lại chỗ này.

### `git checkout -- <file>` xoá luôn việc đang làm

Sau khi thêm dòng đánh dấu để mô phỏng deploy, tôi dọn bằng `git checkout -- locations-page.tsx` —
nó revert **cả file** về HEAD, cuốn theo thay đổi tách chunk vừa viết. Dọn sửa đổi tạm thì dùng
`sed -i '/marker/d'`, đừng dùng lệnh revert cả file khi file đó đang có việc chưa commit.

## Tìm địa điểm: nhà cung cấp nào tôn trọng cái gì (đã đo)

TrackAsia nhận `location` + `radius` ở cả ba endpoint nhưng **hành xử khác hẳn nhau**.
Đo thật, cùng một truy vấn `Jollibee`, bias Đà Nẵng (16.0544, 108.2022), bán kính 25km:

| Endpoint | Kết quả |
|---|---|
| `place/textsearch` | 20 kết quả, **chỉ 1 cái trong thành phố**, còn lại 550–800 km. Bán kính gần như bị bỏ qua |
| `place/nearbysearch` | tôn trọng bán kính nhưng **bỏ qua từ khoá** — trả về ATM, quán cháo, tiệm yến |
| `place/autocomplete` | **10/10 đều ở Đà Nẵng**. Đây là cái duy nhất dùng được |
| `textsearch` + tên tỉnh ghép vào query | 3 kết quả, đều đúng — nhưng ít hơn autocomplete |

Vì vậy `suggestPlaces` dùng **autocomplete**. Ba hệ quả phải nhớ:

- **Autocomplete không trả toạ độ, và không có tham số nào thêm được.** Đã thử `fields=geometry`, `details=true`, `strictbounds` — không cái nào đổi gì. Toạ độ chỉ có qua `place/details`.
- **Khoảng cách km về SAU danh sách, không cùng lúc.** Mỗi dòng cần 1 lần `details`; đo 8 lần **song song vẫn mất 1.658 ms** (1 lần đơn lẻ 294 ms — provider chỉ cho song song ~1,4×). Chặn danh sách để chờ km là đánh đổi cái người ta để ý nhất (gợi ý hiện ra khi đang gõ) lấy cái để ý nhì. Nên: dòng render ngay, km điền vào **ô đã giữ chỗ sẵn** (`w-14 text-right`) — cột hiện muộn mà không giữ chỗ sẽ đẩy chữ sang ngang ngay dưới mắt người đọc.
- **`placeCoords` cache theo `place_id`, KHÔNG theo vị trí.** Một chỗ thì không di chuyển: cache server (Map, trần 2000) + `staleTime: Infinity` ở client ⇒ lần gặp lại là miễn phí, và **kéo bản đồ hay đi bộ ngoài đường không được refetch**. Khoảng cách tính ở client từ toạ độ đã có.
- **Khoảng cách phải đo từ GPS của người dùng, không phải điểm bias.** `myGeo` là prop riêng (`liveUser`), tách khỏi `near`. Không có fix GPS thì **để trống**, đừng lặng lẽ đo từ tâm bản đồ — "3,2 km" buộc phải nghĩa là 3,2 km tính từ họ.
- Thứ tự dòng giữ theo relevance của autocomplete, **không sắp lại theo km sau khi km về**: km tới muộn hơn dòng, sắp lại lúc đó là đảo hàng ngay dưới ngón tay.
- **`place_id` của autocomplete và textsearch là hai hệ khác nhau** — đo được 0/10 trùng. Không thể gộp kết quả hai endpoint để lấy toạ độ.
- Dòng kết quả hiện **địa chỉ 2 dòng** thay cho "x km". Phường và thành phố nằm ở **cuối** địa chỉ, nên `truncate` cắt đúng phần cần đọc — dùng `line-clamp-2`.

`sort` theo khoảng cách **không cứu được** textsearch: nó chỉ sắp xếp lại những gì API đã trả, còn 9 chi nhánh gần mà API không trả thì vẫn vô hình.

### Đừng để khung nhìn mặc định nói thay vị trí người dùng

`near` từng là `mapCenter ?? liveUser`, mà `onLoad` của bản đồ bắn `onCenterChange` ngay bằng
`DEFAULT_CENTER` = Sài Gòn. Ai mở app ở tỉnh khác cũng bị **ghim bias về Sài Gòn**, tìm gì cũng ra
kết quả cách vài trăm km trong khi cùng thương hiệu đó có chi nhánh ngay góc đường.

Nay: `onLoad` **không** báo tâm bản đồ, `onMoveEnd` chỉ báo khi `e.originalEvent` tồn tại (người
thật kéo, không phải camera tự bay theo pin/lộ trình), và thứ tự là `liveUser ?? mapCenter`.
Cố ý xem thành phố khác vẫn hoạt động đúng — vì lúc đó người ta đã kéo bản đồ thật.

## Dán link Maps: hai lỗi chồng nhau, một cái ngẫu nhiên

Triệu chứng: "hôm qua dán được, hôm nay báo lỗi không tạo được" trên cả Mac lẫn iPhone.

1. **`district` là bắt buộc mà không cách nào điền.** Toạ độ trong link **chỉ giải mã được ở server**
   (link ngắn phải đi theo redirect; link Share từ điện thoại không chứa toạ độ, phải geocode tên chỗ).
   Việc đó xảy ra lúc `create`, nên trình duyệt không có `geo` ⇒ query `areaAt` không chạy ⇒ khu vực
   rỗng ⇒ Zod `min(1)` chặn nguyên lượt lưu. Chọn địa điểm từ ô tìm kiếm thì có `geo` nên lại chạy được
   — đó là lý do "lúc được lúc không" theo cách người dùng thao tác.
2. **Không retry khi mạng chớp.** Log bắt được `TypeError: fetch failed` ở hop đầu (DNS chưa ấm /
   container serverless mới khởi động). Resolver `break` ngay, mà link ngắn **chưa kịp** trở thành
   `/maps/place/…` nên cũng không còn tên chỗ để geocode ⇒ trả `null`. Chạy lại đúng link đó thì được.

Cách chữa, cả ba tầng — đừng bỏ tầng nào:
- `location.geoFromUrl` giải mã link **ngay khi dán** (debounce 400ms) → pin rơi xuống → `areaAt` tự điền khu vực **trước** khi bấm lưu.
- `resolveFinalUrl` **thử lại 1 lần** cho lỗi mạng; **không** retry khi timeout (deadline sinh ra để được tôn trọng).
- `districtSchema` bỏ `min(1)`; handler gọi `withArea()` suy khu vực từ chính toạ độ vừa giải mã, bí lắm mới ghi `"Chưa rõ khu vực"`. **Một cú dán hợp lệ không bao giờ được phép hard-fail.**

`areaAtPoint()` (`src/server/lib/area-at-point.ts`) ưu tiên TrackAsia reverse-geocode (có key sẵn,
trả thẳng đơn vị hành chính 2025: `administrative_area_level_2` = phường, `_1` = tỉnh), Nominatim chỉ
là dự phòng vì bị giới hạn tần suất.

## Hỏi trước khi phá: dùng `ConfirmModal`, không dùng `window.confirm`

Xoá chuyến đi là chỗ cuối cùng còn dùng `window.confirm()`. Hộp thoại hệ thống bỏ qua toàn bộ chữ và
màu của app, **không có cách nào** đánh dấu đâu là câu trả lời phá huỷ, và trên iOS còn in tên host
lên trên câu hỏi. Mọi hành động phá huỷ khác trong app đều đã hỏi bằng giọng của app.

`src/components/ui/confirm-modal.tsx` là em sinh đôi của `AlertModal`: cùng `<Modal>` shell, cùng vòng
tròn tone, cùng tỉ lệ — một cái **hỏi**, một cái **báo**. Có `tone: danger | warning | question` và
`pending` (nút giữ nguyên trong lúc request bay, để bấm lần hai không kích thêm một lần xoá).

Dùng nó thay vì dựng tay cái thứ N. Trong repo vẫn còn 2 dialog xác nhận dựng tay ở `locations-page`
("Kết thúc chuyến đi?" và "người kia đã kết thúc") — chưa chuyển vì chúng nằm trong luồng dẫn đường
vừa sửa, nhưng đó là việc nên làm khi có dịp.

### Escape chỉ được đóng dialog TRÊN CÙNG

Mỗi shell nghe `keydown` trên `document`, nên trước đây một confirm xếp trên form sẽ bị Escape đóng
**cả hai** — đóng luôn cái mà câu hỏi đang nói về. Nay dùng đúng quy tắc mà trap của Tab đã dùng:
portal append theo thứ tự mở, nên shell **cuối cùng trong document order** là cái trên cùng
(`[data-dialog-shell="true"]`). Modal lồng nhau vốn đã được thiết kế cho — chỉ Escape là bị bỏ sót.

⚠️ Bẫy đo: `Input.dispatchKeyEvent` của CDP **không tới được** listener trên `document` cho phím
Escape — thử cả `keyDown` và `rawKeyDown` đều không đóng nổi một modal đơn lẻ. Cách phân biệt là
**thử với 1 modal trước**: nếu 1 modal cũng không đóng thì lỗi ở probe, không ở code. Kiểm bằng
`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))` phát ngay trong trang.

## `?.` trên một ref chưa sẵn sàng = im lặng đốt mất cơ hội duy nhất

Map luôn mở ở Sài Gòn dù user đã bật định vị và không ở Sài Gòn. Effect "bay về vị trí lần đầu" **có
sẵn** và đúng logic, nhưng:

```ts
centredOnFirstFix.current = true;      // bật cờ TRƯỚC
mapRef.current?.easeTo({ ... });       // rồi mới gọi — và ref có thể đang null
```

Vị trí gần như **luôn thắng** cuộc đua đó: hàm lấy fix lúc vào trang nhận `maximumAge: 5 phút` nên
trả về từ cache **tức thì**, còn MapLibre còn phải tải bundle 267 KB + style + sprite + 6 file font.
Nên `mapRef.current` là `null`, `?.` nuốt luôn lệnh, mà cờ thì đã bật ⇒ **một no-op im lặng và map
nằm ở toạ độ mặc định suốt phiên**. (Việc tách chunk maplibre làm cửa sổ đua này rộng thêm.)

**Luật:** cờ "chỉ làm một lần" chỉ được bật **sau khi việc đã thực sự xảy ra**.

Bản sửa đầu của tôi gác bằng `mapReady` set trong `onLoad` của MapLibre — và **cũng sai**, theo hướng
ngược lại: `load` chỉ phát khi **style đã nạp**, nên tile server chậm hoặc lỗi là camera **không bao
giờ** di chuyển. Đổi một cuộc đua thành một phụ thuộc vào mạng.

Thứ nó thật sự cần là **object map**, mà react-map-gl trao ngay khi mount, rất lâu trước mọi việc liên
quan tới style — lệnh camera không cần style đã nạp. Nên bản cuối **chỉ chờ cái ref** (poll 200ms) và
không phụ thuộc gì khác.

Cách kiểm không phụ thuộc việc tile có render hay không: **đếm số pin đã lưu còn nằm trong khung**. Mọi
pin test đều ở Sài Gòn, nên GPS giả lập ở Đà Nẵng mà camera đúng thì phải là **0**:

| GPS giả lập | pin Sài Gòn trong khung |
|---|---|
| Đà Nẵng, **trước** khi sửa | 22 |
| Đà Nẵng, **sau** khi sửa | **0** |
| Sài Gòn (đối chứng) | 23 |

⚠️ Bẫy đo đã dính: so ảnh chụp 2 lần (Đà Nẵng vs Sài Gòn) cho ra "khác biệt 0,4/255 ⇒ map không đổi"
— **vô nghĩa**, vì trong lần chạy đó nền bản đồ không render (chỉ có marker), nên hai ảnh đều gần như
trắng. Luôn kiểm xem phép đo có thật sự nhìn thấy thứ mình tưởng không.

### Service worker không được làm hỏng request khi cache lỗi

`cacheFirst` gọi `cache.put` mà không bọc try/catch: hết quota, cửa sổ riêng tư, hoặc trình duyệt tắt
site data đều làm `event.respondWith` bị reject ⇒ **request thất bại hẳn**. Một cache không lưu được
thì vẫn phải để trang tải bình thường. Nay cả `caches.open` lẫn `cache.put` đều bọc, lỗi thì rơi về
`fetch` thẳng.

## Vẽ lại đường mà không đổi danh sách rẽ = chỉ sai đường

Bug tôi tự tạo ra ngay ở lượt thêm chỉ dẫn từng khúc rẽ: `setRouteLegs` chỉ được gọi **một chỗ** —
lúc vẽ đường lần đầu. Cả hai nhánh vẽ lại đường (lệch tuyến) đều không cập nhật, mà một chuyến
nhiều chặng còn ghi đè `legGeometries` chứ không đụng tới `routeLegs`.

Hậu quả: đi lệch → bản đồ vẽ lại đúng đường vòng → **giọng nói vẫn đọc các khúc rẽ của tuyến đã bỏ**.
Tệ hơn cả im lặng, vì nó sai một cách tự tin.

**Luật:** hai state cùng mô tả một sự thật thì phải có **một nguồn**. Nay `activeManeuvers` đọc
`legGeometries ?? routeLegs` (bản mà reroute giữ mới nhất đứng trước), và nhánh một-điểm-đến cũng
gọi `setRouteLegs`. Khi thêm state phái sinh từ một API, hãy **grep tất cả chỗ gọi API đó**, đừng chỉ
chỗ đầu tiên.

## Bám đường: vẽ vị trí TRÊN đường, và lấy hướng từ con đường

GPS trong hẻm phố Việt Nam lệch 15–25 m là bình thường, nên chấm vị trí đi xuyên qua nhà và qua sông
trong khi người ta đang chạy trên đường. Nay khi đang bám một tuyến, thứ được **vẽ** là hình chiếu của
vị trí lên tuyến, và **hướng** lấy từ hướng con đường tại đoạn đó chứ không từ la bàn (điện thoại nằm
trong túi báo hướng nó đang nằm, còn la bàn lúc dừng đèn đỏ thì quay vòng vòng).

**Ngưỡng `SNAP_MAX_M = 30` là phần quan trọng nhất, không phải phần bám.** Quá ngưỡng đó thì người ta
thật sự đang ở chỗ khác — hẻm song song, rẽ nhầm, cầu vượt bắc qua đường — và ghim chấm vào tuyến sẽ
**vẽ ra một lời nói dối tự tin**. Lúc đó trả về vị trí thật.

Đã kiểm bằng đường thẳng giả lập: lệch 15 m → bám đúng lòng đường, hướng 90°/0° đúng; lệch 100 m →
**không** bám.

## Map tối ban đêm — và cái bẫy nó suýt kéo theo

`liberty` → `dark` sau 18h (kiểm lại mỗi phút, vì chuyến đi bắt đầu 17h50 sẽ bước sang tối giữa đường).
Đổi style gần như miễn phí: `dark` dùng **chung sprite** và chỉ cần một tập con font của `liberty`, mà
service worker đã cache cả hai.

⚠️ **Bẫy suýt dính:** hai style đặt tên layer nhãn nước **khác nhau** — `liberty` có
`water_name_point_label` + `water_name_line_label`, `dark` chỉ có `water_name`. Chuyển sang map tối là
**mất nhãn Biển Đông**, trả biển về "South China Sea". Đã thêm cả ba tên vào danh sách, và
`applyEastSeaLabel` nay chạy trên **mọi** lần style nạp (`onStyleData`), không chỉ lần đầu — đổi style
thay cả style nên override cũng mất theo.

Kiểm bằng cách chạy chính hàm đó trên **style JSON thật của cả hai**: liberty đổi 2 layer, dark đổi 1;
lần chạy thứ hai đổi 0 nhờ chốt chống bọc lồng. Đo độ sáng vùng bản đồ: **24/255 ban đêm** vs
**226/255 ban ngày**.

## Lịch sử chuyến đi: ghi cái đã đi được, không ghi cái đã định đi

`ride.record` nhận **quãng đã đi thật** = quãng theo kế hoạch trừ phần còn lại lúc kết thúc — chuyến bỏ
dở không đi hết kế hoạch. Bỏ qua chuyến **dưới 60 giây hoặc dưới 100 m**: một cú chạm nhầm không được
để lại kỷ niệm.

## Bám tuyến: đừng quét cả polyline mỗi nhịp GPS

`remainingAlongRoute` quét **toàn bộ** polyline để tìm điểm bám, rồi cộng dồn **toàn bộ** phần còn lại
— hai vòng O(n), chạy mỗi nhịp GPS, trong lúc màn hình sáng và GPS đang stream. Tuyến 19 km trong phố
có ~3.000 điểm.

Hai thay đổi, đo trên tuyến giả lập 3.000 điểm với 748 nhịp GPS:
- **Cửa sổ trượt**: tìm từ chỗ bám lần trước (`hintIdx − 20 … +200`) thay vì từ đầu — người ta đi tiến,
  không nhảy cóc. Nếu điểm bám tốt nhất trong cửa sổ vẫn xa hơn 120 m thì **quét lại toàn bộ**: đó đúng
  là lúc đã lệch tuyến thật, và lúc đó đúng quan trọng hơn rẻ.
- **Mảng cộng dồn** dựng một lần cho mỗi tuyến ⇒ quãng còn lại thành **một phép trừ**.

| | thời gian |
|---|---|
| quét toàn bộ (cũ) | 133 ms |
| cửa sổ trượt (mới) | **15 ms** → nhanh **9×** |

Kết quả **giống hệt** bản cũ (lệch 0,00 m ở cả quãng còn lại lẫn độ lệch tuyến), và ca nhảy lệch xa với
hint sai vẫn ra đúng 142 m nhờ nhánh quét lại.

⚠️ Hình học nay ở `src/lib/route-geometry.ts`, **tách khỏi hook**, để test được bằng Node thuần. Đó
chính là cách bắt được cả tốc độ lẫn tính đúng đắn — không có React thì không cần trình duyệt.

⚠️ Bài học lúc tách: đừng dùng regex để "bốc" hàm ra khỏi file. Kịch bản của tôi lấy nhầm cả
`PING_COOLDOWN_MS`, `PingResult`, `PartnerLocation` — xoá 166 dòng. Cách an toàn: **viết module mới,
test nó, rồi mới sửa file cũ để import**, không cắt-dán tự động.

## Kéo bản đồ ra xem thì đừng giật về sau 2 giây

`isUserInteracting` tự tắt sau **2.000 ms**, nên đang dẫn đường mà kéo map ra xem ngã tư phía trước thì
vừa thả tay là camera nhảy về chấm của mình. 2 giây ngắn hơn chính hành động nó cắt ngang.

Nay dừng bám là **dừng hẳn**, và có nút **"Về vị trí của tôi"** để quay lại — đúng cách mọi app bản đồ
làm. Người dùng quyết định khi nào bám tiếp, không phải cái timer.

## Giọng chỉ đường: mô phỏng cả chuyến đi mới lòi ra 2 bug chết người

Phần voice viết xong, build xanh, `tsc` xanh, mắt đọc thấy hợp lý — và **hỏng nặng**. Chỉ khi tách
logic ra hàm thuần (`src/lib/turn-announcer.ts`) rồi cho một chuyến 3 km chạy qua nó mới thấy:

**Bug 1 — cả chuyến chỉ đọc 1 câu cho mỗi khúc rẽ, ở mốc 500 m, rồi im bặt.**
```ts
const STAGES = [500, 200, 80, 40];
const stage = STAGES.find((s) => metres <= s);   // ← ở 180m trả về 500, không phải 200
```
`find` trên mảng **giảm dần** luôn trả về phần tử **xa nhất** khớp. Khoá `idx:500` bị đánh dấu đã đọc
ngay lần đầu, nên 200/80/40 **không bao giờ chạy** — im lặng đúng lúc cần chỉ dẫn nhất. Sửa:
`STAGES.filter(s => metres <= s).at(-1)` lấy mốc **gần nhất**.

**Bug 2 — lướt qua khúc rẽ mà không vào trong 25 m thì bộ đếm kẹt vĩnh viễn.** Ngã tư rộng, GPS lệch,
làn ngoài cùng — đều đủ để không bao giờ chạm ngưỡng, và app đếm ngược tới một góc đã ở sau lưng cho
hết chuyến. Sửa: **khúc kế tiếp gần hơn khúc hiện tại ⇒ khúc hiện tại đã ở sau lưng**. Và giải quyết
trọn trong một nhịp GPS chứ không một khúc mỗi nhịp.

Bộ test mô phỏng 6 tình huống, giữ lại mà chạy khi đụng vào phần này: chạy đều cả chuyến · **dừng đèn
đỏ nhích 40 lần** (không được lặp câu) · nhịp GPS thưa nhảy qua nhiều mốc (phải đọc mốc **gần** nhất) ·
qua khúc rẽ · tới đích · mỗi nhịp tối đa 1 câu.

⚠️ Bài test cũng có bug: khoá chống lặp của nó thay mọi chữ số bằng `#`, nên 4 mốc hợp lệ của cùng một
khúc rẽ bị gộp thành "lặp". **Đọc output rồi mới tin dòng ✗/✓** — một bài test sai làm bạn đi sửa thứ
không hỏng.

### `getVoices()` KHÔNG đồng bộ — và đó là lý do giọng đọc sai ngữ âm

`speechSynthesis.getVoices()` trả **mảng rỗng** cho tới khi engine nạp xong và bắn `voiceschanged`.
Hỏi nó ngay lúc câu chỉ dẫn đầu tiên thì nhận "không có giọng Việt", và app đọc tiếng Việt bằng **giọng
Anh** — không phải giọng lơ lớ, mà là **không nghe ra chữ gì**. Nay danh sách được cache và làm mới
theo sự kiện.

Hai lỗi cùng họ đã sửa kèm: `cancel()` rồi `speak()` **ngay trong cùng một tick** bị Chrome nuốt luôn
câu (phải `setTimeout(…, 0)`), và hàng đợi bị `paused` thì nhận câu mà không phát (phải `resume()`).

## Flex bóp con: nút `h-11` bị vẽ cao 25px

Cho trang cài đặt tự cuộn (`flex-1 min-h-0 overflow-y-auto`) đã sửa được nút Đăng xuất bị nav che —
nhưng **đẻ ra lỗi khác ngay tại nút đó**, và mất một hôm mới lộ ra.

Hộp đó vừa là **flex column** vừa là **thứ cuộn**, nên flex xếp các con vào một chiều cao **cố định**
TRƯỚC khi có chuyện cuộn. `flex-shrink` mặc định là 1, và `min-height: auto` của một flex item bằng
chiều cao **nội dung** của nó ⇒ thứ nào có chiều cao *được đặt* thay vì *mọc theo nội dung* thì bị bóp
xuống bằng chữ của chính nó.

```
đo ở desktop 1280:  Đăng xuất  h=25   ← khai h-11 (44px)
                    Xoá không gian h=44
                    Lưu ảnh        h=44
```

Chỉ mình nó dính vì nó là **con trực tiếp** duy nhất là một control — mọi nút khác nằm trong `Card`, thấp
hơn một tầng, flex với không tới.

**Sửa ở container, không ở nút:** thêm `[&>*]:shrink-0`. Đặt lên nút thì control tiếp theo thả vào đây
lại phải tự khám phá lại cái bẫy này.

⚠️ Dấu hiệu nhận biết: `h-*` khai đúng mà DOM ra chiều cao bằng đúng `line-height`. Kiểm bằng
`getBoundingClientRect()`, đừng tin class. `PageShell` KHÔNG dính vì hộp cuộn của nó chứa một `div`
block (`space-y-6`), không phải flex.

## `mobileHidden` từng có nghĩa là "không vào được từ điện thoại"

`NAV_ITEMS` đánh dấu `/rides`, `/search`, `/settings` là `mobileHidden` — thanh dưới chỉ chứa 6 đích, là
số vừa ở 390px. Comment ghi *"vẫn vào được từ top bar, nên không có gì bị mồ côi"*. **Chỉ đúng với
`/settings`.** Header mobile có Đồng bộ · Bí mật · Cài đặt — không có Đã đi, không có Tìm kiếm. Hai màn
hình đó là tab trong sidebar desktop và **không có lối vào nào trên điện thoại**, tức thiết bị mà app
được dùng nhiều nhất.

`mobile-more-menu.tsx` thêm nút "Thêm mục khác" mở `BottomSheet`, và nó **đọc từ `NAV_ITEMS`** chứ không
gõ tay: `mobileHidden && !IN_HEADER`. Route mới gắn cờ đó từ nay tự hiện ra thay vì lại lặng lẽ mất tích.

Kiểm chiều rộng ở **cả 320px** (khổ từng làm logo bị cắt mất 61px khi header có 4 icon): 4 icon 40px,
`scrollWidth === clientWidth`, không tràn.

**Luật:** một cờ kiểu "ẩn ở đâu đó" phải kèm **nơi nó xuất hiện thay thế**, và nơi đó phải đọc từ chính
danh sách gốc. Comment nói "vẫn vào được ở chỗ khác" mà không có code bảo đảm thì chỉ là một lời hứa.

### `BottomSheet` KHÔNG tự có padding ngang

Nó chỉ vẽ tấm panel. Mọi chỗ dùng phải tự bọc `px-4` — chỗ dùng sẵn có
(`reaction-bar.tsx`) làm đúng thế, phần "Mục khác" thì quên, nên tiêu đề và dòng mô tả **dính sát mép
trái** trong khi danh sách bên dưới trông có thụt lề nhờ `px-3` của chính nó. Kiểu lỗi khó thấy vì một
nửa nội dung *trông* vẫn đúng.

```
trước: tiêuĐề left=0    môTả left=0    mụcĐầu left=17
sau  : tiêuĐề left=16   môTả left=16   mụcĐầu left=33
```

Bọc kèm `pb-[calc(env(safe-area-inset-bottom)+1rem)]` để hàng cuối không nằm dưới home indicator.

### Chia việc giữa icon header và sheet

Tìm kiếm ra header (một chạm), Bí mật vào sheet (hai chạm): **cái nào được với tới giữa chừng một ý nghĩ
thì đáng một chạm; cái nào người ta đi tới có chủ đích thì chịu được hai.**

`/vault` **không** nằm trong `NAV_ITEMS` — sidebar desktop cũng gắn tay nó ở cuối, vì nó là một đích đến
nhưng không ngang hàng với các mục khác, đưa vào danh sách chung là nó lọt vào thứ tự của thanh dưới.
Sheet khai lại nó trong `EXTRA` theo đúng hình dạng đó.

## Favicon trên Google: index lại trang KHÔNG làm mới logo

Search Console báo thu thập thành công 02:49 ngày 30/08, mà kết quả tìm kiếm vẫn hiện logo cũ. Cả hai
đều đúng: **favicon trong kết quả tìm kiếm do một trình thu thập riêng lấy, theo lịch riêng.** "Yêu cầu
lập chỉ mục" làm mới tiêu đề/mô tả/nội dung — không kéo theo favicon, và Search Console **không có** nút
yêu cầu làm mới favicon.

### Cách truy ra Google đang giữ bản nào

Đừng đoán "chắc là bản cũ". Dựng lại **mọi** phiên bản icon trong lịch sử rồi so với ảnh chụp kết quả:

```bash
for h in $(git log --format='%h' -- public/favicon.ico src/app/icon.png); do
  git show "$h:public/favicon.ico" > /tmp/favhist/$h.ico 2>/dev/null
done
# rồi ghép thành contact sheet, ICO phải chọn frame: im.size=(48,48) trước convert
```

21 bản, khớp đúng một: `f517799` — **25/08 22:32**, commit đầu tiên khiến site được index. Tức Google
lấy favicon **đúng lần đầu site vào index** rồi giữ nguyên qua 4 lần đổi logo và một lần re-crawl.

### Điều đã loại trừ được (nên đừng đi lại)

| nghi ngờ | kết quả đo |
|---|---|
| file sai / hỏng | `/favicon.ico` 200, ICO đa size **16/32/48/64**, đúng khuyến nghị Google |
| robots.txt chặn | không chặn đường dẫn icon nào |
| CDN giữ bản cũ | `cache-control: max-age=0, must-revalidate` |
| validator không đổi | `Last-Modified` đổi **mỗi lần deploy** — Google vẫn không lấy lại ⇒ cache giữ theo **thời gian**, không theo validator |
| mẹo `google.com/s2/favicons?domain=…&sz=64` | **404** — dịch vụ đó khoá theo domain đăng ký được, mà `vercel.app` nằm trong Public Suffix List |

### Đòn bẩy duy nhất còn lại: một URL Google chưa từng tải

Google cache **theo URL**. Nên trỏ `<link rel="icon">` sang `/favicon-v2.ico` (bản sao byte-identical).

⚠️ **`/favicon.ico` ở gốc PHẢI GIỮ, đừng xoá.** Trình duyệt, feed reader và chính fallback của Google hỏi
thẳng đường dẫn đó mà không đọc HTML. File `-v2` là bản sao, không phải bản gốc.

Lần sau cần hích nữa thì **tăng lên `-v3`**, đừng sửa tại chỗ — cái có tác dụng là URL mới, không phải
nội dung mới.

Đây là **một cú hích có xác suất, không phải bản sửa lỗi**: nếu trình thu thập favicon vẫn ưu tiên
`/favicon.ico` ở gốc thì nó không có tác dụng gì. Cách chữa dứt điểm là **domain riêng** — site đang là
một subdomain giữa hàng triệu subdomain `vercel.app`.

## ⛔ CHẾ ĐỘ BẢN ĐỒ ĐÊM ĐÃ GỠ (2026-09-03) — đừng thêm lại theo cách cũ

User chốt gỡ: *"tạm bỏ đi chế độ tối vì nó gây ra bug nhiều quá"*. Bản đồ nay dùng **một style
`liberty` cho cả ngày lẫn đêm**.

Bốn lỗi cộng lại, và **tô màu chỉ chữa được lỗi đầu**:

| lỗi | tô màu chữa được? |
|---|---|
| style xám trung tính, nước cách đất 15 mức sáng | ✅ (xem bên dưới) |
| `dark` **không có layer POI nào** → 18h–6h mất sạch tên quán, tên địa điểm | ❌ |
| nhãn biển nằm ở layer tên khác (`water_name`) → sai nếu quên | ❌ |
| `map-tile-assets.ts` chỉ warm `liberty` → 18h ập tới là **tải nguội giữa chuyến đi** | ❌ |

Muốn làm lại thì **chỉ có một cách đúng**: dùng chính `liberty` cho ban đêm rồi tô lại bằng bảng màu.
Kèm hai việc bắt buộc: **chụp lại màu gốc để hoàn nguyên** (vì `mapStyle` không đổi nữa ⇒ `onStyleData`
không bắn khi toggle), và tô đủ **111 layer** thay vì 47. Bảng màu + phần nối dây nằm ở commit
`30e6902`, lấy lại từ đó chứ đừng viết lại từ đầu.

Phần dưới giữ lại vì các phép đo và luật phối màu vẫn đúng khi nào làm lại.

## Bản đồ đêm "đen xì": style gốc là xám trung tính từ 10 đến 35

Style `dark` của OpenFreeMap tô mọi thứ bằng xám không màu:

```
background rgb(12,12,12)   water rgb(27,27,29)   building rgb(10,10,10)
landuse_park rgb(32,32,32) railway rgb(35,35,35) place_* rgb(101,101,101)
water_name  text hsla(0,0%,0%,0.7)          ← chữ ĐEN trên nước gần đen: vô hình
highway_motorway_inner  line-color nội suy → "#000" từ zoom 6
```

Nước cách đất **15 mức sáng** — không màn hình điện thoại nào ngoài đường phân biệt được. Và cao tốc bị
nội suy về **đen thuần** từ zoom 6, tức mất hẳn ở đúng mức zoom người ta chạy xe.

`src/lib/night-map-palette.ts` tô lại, **giữ nguyên layer / độ rộng / hành vi theo zoom** của style gốc,
chỉ đổi màu qua `setPaintProperty`. Đo sau khi sửa (390×844, vùng bản đồ 780×878):

| | trước | sau |
|---|---|---|
| độ sáng trung bình | 24/255 | **75/255** |
| số màu khác nhau | — | 3219 |
| nền / đường lớn / nước | gần như một màu | `#17212e` 25.7% · `#3b4a5d` 16.2% · `#0c1522` 4.7% |

### Hai luật định hình bảng màu

- **Màu ấm được để dành.** Mọi loại đường đều xanh-xám lạnh, để **đường đi (route)** — vẽ bằng terracotta
  của app lên trên — là thứ ấm duy nhất trên màn hình và không thể bị nhầm với một con cao tốc. Chỉ
  **nhãn** cao tốc lấy màu hổ phách, và nhãn thì nhỏ, không cạnh tranh.
- **Nước TỐI HƠN đất**, không sáng hơn. Đó là cách bản đồ đêm đọc đúng; style gốc làm nước sáng hơn đất
  một chút nên nhìn như một vũng xám.

Ban ngày dùng `liberty`, ban đêm dùng `dark` — **hai style đặt tên layer giống nhau** (`background`,
`water`, …) nên `applyNightPalette` **phải gán cờ `night`**, không thì bản đồ ban ngày bị tô màu đêm.

### ⚠️ Nợ đã biết: style `dark` KHÔNG có layer POI nào

`dark` 47 layer, **0 layer POI**. `liberty` 111 layer, có 5 layer POI, bridge/tunnel riêng, và cả
`fill-extrusion` (nhà 3D). Nghĩa là từ 18h đến 6h bản đồ **mất sạch tên quán, tên địa điểm** — Google
Maps ban đêm vẫn hiện đủ.

Cách chữa đúng là dùng `liberty` cho **cả** ngày và đêm rồi tô lại theo bảng màu. Lợi thêm: đổi ngày↔đêm
sẽ chỉ là đổi paint property thay vì **tải và dựng lại toàn bộ style**. Nhưng phải kèm snapshot màu gốc
để hoàn nguyên khi tắt chế độ đêm, vì `mapStyle` không đổi nữa ⇒ `onStyleData` không còn bắn khi toggle.
**Chưa làm — chờ user quyết.**

### Đo màu: đừng tính lại mean trong vòng lặp

`sum((x-sum(g)/len(g))**2 for x in g)` — biểu thức trong ngoặc tính lại `sum(g)/len(g)` cho **từng** pixel
⇒ O(n²), 700k pixel là 700k×700k phép tính, script treo tới hết 300s timeout. Dùng
`statistics.pstdev(g)`, hoặc tính mean ra biến trước.

## Push không tới: khoá ĐÚNG, deploy ĐÚNG, mà cái nút bật thì TỰ ẨN

Kiểm prod trước khi đoán, và cả hai thứ dễ nghi nhất đều **không sai**:

```
khoá public VAPID có trong bundle prod: /_next/static/chunks/app/layout-*.js  ✓
/sw.js prod GIỐNG HỆT public/sw.js, có cả addEventListener("push") và notificationclick  ✓
cache-control: max-age=0, must-revalidate  (SW tự cập nhật)  ✓
sendNavInvite CÓ gọi sendPushToUser  ✓
```

Lỗi thật nằm ở `push-permission-row.tsx`:

```ts
if (permission === "unsupported" || !key || available.data?.enabled === false) return null;
```

`PushManager` không tồn tại trên **iPhone dùng Safari khi app chưa được cài vào Màn hình chính** — Apple
chỉ cấp push cho app đã cài. Nên đúng cái trường hợp cần hướng dẫn nhất lại là trường hợp **cả dòng biến
mất**: người đi tìm "tại sao không nhận được lời mời" gặp một khoảng trống. Nó lại chỉ nằm trong modal
cài đặt của bản đồ, hai lớp sâu sau một sheet, không ở `/settings`.

Và `PushSetup` **không bao giờ tự hỏi quyền** (đúng — prompt lúc tải trang bị từ chối theo phản xạ, mà từ
chối là gần như vĩnh viễn). Nó chỉ đăng ký khi quyền **đã** được cấp. Cộng lại: không ai cấp quyền ⇒
không có thuê bao ⇒ `sendPushToUser` trả 0 và không ai biết.

**Luật:** một điều khiển không dùng được thì **nói ra lý do**, đừng render `null`. `null` biến "chưa đủ
điều kiện" thành "tính năng không tồn tại", và người dùng không có bước tiếp theo nào.

## Hai kiểu số 0 khác nhau, và im lặng làm chúng giống nhau

`sendPushToUser` cũ trả `Promise<number>` và `return 0` ở **hai** chỗ: server không có khoá, và người đó
không có máy nào đăng ký. Cùng một con số, hai vấn đề hoàn toàn khác, và không cái nào hiện lên đâu.
Caller thì `.catch()` rồi bỏ luôn giá trị trả về.

Nay trả `{ reason: "sent" | "not-configured" | "no-devices", devices, delivered }`, log ở server, và
`sendNavInvite` trả kèm về client. `push.available` cũng trả `myDevices` + **`partnerDevices`** — vì câu
hỏi duy nhất ai cũng hỏi về push là "sao nó không tới", và người gửi đáng được biết là mình đang mời một
người **không có máy nào đăng ký**, thay vì tưởng đã tới.

Bảng 4 dữ kiện hiện thẳng trên `/settings`: đã cài vào MH chính · quyền thông báo · máy này đã đăng ký ·
server gửi được (kèm số máy hai bên). Trước đó **cả bốn đều vô hình**.

## Thuê bao đúc bằng khoá VAPID KHÁC là thuê bao chết vĩnh viễn

`getSubscription() ?? subscribe(...)` dùng lại bất kỳ thuê bao có sẵn — nhưng một thuê bao **bị buộc vào
khoá VAPID lúc nó được tạo**. Đổi cặp khoá xong thì mọi lần gửi tới nó bị dịch vụ push trả **403**, mãi
mãi, và `sendPushToUser` chỉ dọn row khi gặp 404/410 ⇒ nó nằm đó fail vô hạn. Triệu chứng tệ nhất có
thể: **nút báo đã bật, mà thông báo không bao giờ tới.**

`ensurePushSubscription()` so `sub.options.applicationServerKey` với khoá hiện tại, khác thì
`unsubscribe()` rồi tạo lại. Phía server, 403 nay cũng bị dọn row, kèm log nói rõ nguyên nhân là **của
mình** (đổi khoá) chứ không phải của trình duyệt.

## Test UI sau lớp auth: đăng ký qua API công khai, rồi xoá sạch

```
POST /api/auth/sign-up/email                → cookie session
POST /api/trpc/space.create                 → cần header Origin = BETTER_AUTH_URL, thiếu là 403
```

Giả lập iPhone-Safari-chưa-cài bằng CDP: `Emulation.setUserAgentOverride` + `Page.addScript‌ToEvaluate‌OnNewDocument`
xoá `window.PushManager` **trước khi code app chạy** (đặt sau khi navigate là muộn).

Dọn thì nhớ: tên collection **không đồng nhất** (`spaces` số nhiều của mongoose, `user`/`session`/
`account` số ít của better-auth), và `session`/`account` phải xoá theo **bản mồ côi** — xoá theo
`userId: {$in: ids}` trả `deletedCount: 0` vì kiểu dữ liệu khác, trông như đã xong.

## Nút cuối trang bị nav che: khoảng chừa của KHUNG không đi vào phần TRÀN

Trang `/settings` cuộn hết cỡ rồi mà **28 trong 44px của nút "Đăng xuất" vẫn nằm dưới thanh nav**, không
còn gì để cuộn thêm. Đo ở 390×844 (`[data-app-main]`, đã `scrollTop = scrollHeight`):

```
main:        scrollHeight 3356 · clientHeight 844 · paddingBottom 64px · đã ở đáy 2512
nav dưới:    top 769 · cao 76          ← nav cao 76px, khung chỉ chừa 64px
nút:         top 752 · bottom 796      ← bị che 28px
con của main: HEADER 57 · DIV flex-1 min-h-0 = 707 · (844 − 57 − 80)
```

Hai tầng nguyên nhân, và tầng thứ hai mới là tầng thật:

**1. `4rem` < nav.** Thanh nav đo được **76px**, khung chừa `4rem` = 64px ⇒ thiếu 12px với *mọi* trang.

**2. Nội dung tràn khỏi hộp `flex-1 min-h-0`, và khoảng chừa mắc lại phía trên phần tràn.**
`template.tsx` cho mỗi trang một hộp `flex min-h-0 flex-1 flex-col`. `flex-1` = `flex: 1 1 0%` và
`min-h-0` bỏ sàn theo nội dung ⇒ hộp **cao đúng phần còn lại của khung (707px), không nở theo nội dung**.
Trang cài đặt là một div cao 3200px đặt thẳng vào đó ⇒ tràn ra ngoài, và khung (`overflow-y-auto`, "lưới
an toàn") cuộn giúp.

Nhưng khoảng chừa của khung được xếp **từ chiều cao 707px của hộp**, tức nó nằm ở *giữa* vùng cuộn chứ
không ở cuối. Cuộn tới đáy thì sau phần tử cuối chỉ còn **48px** — đúng bằng `pb-12` của chính trang.
`padding-bottom` của khung hay một `<div>` spacer **đều mắc như nhau**: tôi thử spacer 80px in-flow, xác
nhận nó có trong DOM (`h: 80`, con cuối, `paddingBottom: 0px`) mà số đo **không đổi một pixel**.

⇒ **Chỉ padding của CHÍNH phần tử đang tràn mới đi vào vùng cuộn.**

### Sửa ở gốc: trang tự cuộn, như mọi trang khác

Thêm `min-h-0 flex-1 overflow-y-auto overscroll-contain` vào div gốc của `space-settings`. Đó đúng là
việc `PageShell` làm cho các trang khác — và `/settings` là một trong ba trang **không** dùng `PageShell`.

Sau khi sửa: khung thôi cuộn (`scrollHeight == clientHeight == 844`), trang cuộn trong hộp của mình
(3280/707), nút cách nav **53px**, `nútBịNavChe: 0` — kiểm cả bằng số đo lẫn ảnh chụp.

Khung vẫn nâng `4rem` → `5rem` để phủ 76px thật, cho các trang *vừa khít* khung.

⚠️ Kiểm cả `/onboarding` (trang thứ ba không dùng `PageShell`): **không bị** — nó nằm trong
`NAV_HIDDEN_ON` nên không có nav dưới và không áp khung (`overflow: visible`). Xác nhận bằng đo, không
phải suy đoán.

### Bẫy khi đo: đừng tin số nếu chưa biết mình đang cuộn hộp nào

Ba lần đo đầu **sai đối tượng** mà vẫn ra số trông hợp lý:
- Bài test đầu chấm **bản build cũ** vì cổng 3987 do một `next start` giữ (xem mục cổng ở trên).
- Sau khi trang tự cuộn, script vẫn `main.scrollTop = ...` nên nút báo `top: 3264` — "ngoài màn hình
  2445px", nghe như hỏng nặng, thật ra chỉ là **chưa cuộn đúng hộp**.

Cách đo đúng: **đi từ phần tử cần thấy ngược lên**, cuộn *mọi* tổ tiên có `overflow-y: auto|scroll` và
`scrollHeight > clientHeight`, rồi mới đọc `getBoundingClientRect()`. Và luôn in kèm `location.pathname`
+ `h1` để biết chắc đang đứng ở đâu.

### Dựng session để test UI mà không sửa dữ liệu của user

`/settings` khoá sau `mine.isLoading || !mine.data`, cookie jar cũ đã hết hạn (401). Thay vì sửa bảng
`session` trong DB thật, **đăng ký một tài khoản test qua đúng API công khai của app**:

```
POST /api/auth/sign-up/email     → nhận cookie session
POST /api/trpc/space.create      → cần header Origin = BETTER_AUTH_URL (ở đây :4488), thiếu là 403
                                   "Forbidden origin"; tRPC dùng superjson ⇒ body {"json":{...}}
```

Xong việc thì **xoá sạch**: `user` 2, `spaces` 1, `session` 2, `account` 2. Lưu ý tên collection **không
đồng nhất** — `spaces` số nhiều (mongoose) nhưng `user`/`session`/`account` số ít (better-auth); xoá theo
tên đoán sai thì báo `deletedCount: 0` mà trông như đã xong.

## iOS im lặng: CÔNG TẮC TẮT TIẾNG chặn cả giọng đọc của trang web

Ảnh chụp từ máy người dùng có một chi tiết quyết định mà không ai nghĩ tới khi đọc code: **biểu tượng
chuông gạch chéo trên thanh trạng thái** — iOS 17 trở lên hiện nó khi công tắc im lặng đang bật.

Trên iOS, công tắc đó **tắt luôn `speechSynthesis` và Web Audio**, chỉ tha cho `<audio>`/`<video>` HTML
thường. Không có lỗi, không có sự kiện nào báo — utterance vẫn `onstart` rồi `onend` bình thường, chỉ là
không ai nghe được. Đó là lý do "cả voice cả rung đều không hoạt động" xuất hiện cùng lúc: giọng bị công
tắc chặn, còn âm báo dự phòng (Web Audio) cũng bị chặn bởi đúng cái công tắc đó.

Đòn bẩy duy nhất là **hạng mục phiên âm thanh**. Mặc định một trang web nhận `ambient` — theo định nghĩa
là "bị công tắc im lặng tắt". `playback` thì không.

| cách | ghi chú |
|---|---|
| `navigator.audioSession.type = "playback"` | Safari 16.4+, API chuẩn (chỉ Safari cài) |
| phát một `<audio>` im lặng, `loop` | mẹo mọi thư viện audio web đều dùng, cho bản cũ hơn |

`src/lib/audio-session.ts` làm cả hai. Chọn `playback` **không** chọn `transient-solo`: spec lấy đúng ví
dụ "driving directions" cho `transient-solo`, nghe thì trúng, nhưng nó **dừng hẳn** mọi âm thanh khác ⇒
mỗi câu chỉ đường sẽ tắt nhạc của người ta. `playback` chỉ hạ âm lượng nền.

⚠️ **Không có bảo đảm nào.** Apple chưa bao giờ hứa trang web phát được qua công tắc im lặng, báo cáo
khác nhau theo phiên bản iOS. Vì vậy có `audioReport()` + ô tự kiểm tra: máy nào vẫn chặn thì **nói ra
được** thay vì để user đoán app hỏng hay máy đang im lặng.

## iOS: "Thử ngay" nghe được mà chạy thật thì im — hiệu ứng vs cú chạm

Triệu chứng này là một món quà chẩn đoán: nút thử trong Cài đặt **nghe được**, chuyến đi thật thì
**không**. Tức engine, giọng Việt, phiên âm thanh, khoá `enabled` — tất cả đều đúng. Khác nhau duy nhất
là **nơi gọi**.

```
nút thử   : onClick → unlockAudio(); speak(...)      ← TRONG cú chạm
chuyến đi : onClick → setAutoStartWhenRouted(true)
             → chờ route về (async)
             → useEffect thấy isNavigating → speak(...)   ← NGOÀI cú chạm, cách vài giây
```

Luồng phổ biến nhất là chạm "Bắt đầu đi" → **đợi định tuyến** → `nav.start()` gọi từ trong một effect.
Lúc đó user activation mà iOS đòi cho **câu đầu tiên của một lượt truy cập** đã hết từ lâu, và engine
**từ chối trong im lặng** — không lỗi, không sự kiện.

Sửa: tách thành `announceDeparture()` và gọi **từ trong 4 onClick khởi hành**, không từ effect. Effect
chỉ còn là dự phòng cho luồng không có cú chạm (lời mời được nhận → chạy bằng `setTimeout`).

Và câu nói-thật-trong-cú-chạm đó cũng là câu **mở đường âm thanh** cho mọi lời chỉ đường sau đó, vì
không một lời nào trong chuyến có thể nằm trong một cử chỉ. (Suy ra: `primeSpeech(" ")` — một dấu cách —
**không đủ** để mở khoá; phải là chữ thật.)

⚠️ Chỗ nào cú chạm **cũng kích hoạt định tuyến lại** thì đọc **không kèm số**: các con số còn trong state
là của route CŨ, mà đọc sai quãng đường một cách tự tin còn tệ hơn không đọc.

**Luật:** trên iOS, cái gì phải phát ra tiếng thì phải nằm **trong cùng call stack với cú chạm**. Một
`useEffect` bắn sau khi state đổi **không** tính là trong cử chỉ, dù nó chạy ngay sau đó.

## Âm lượng giọng đọc: `volume = 1` là hết, đòn bẩy thật là TIẾNG CHUÔNG

Không nâng được nữa: `SpeechSynthesisUtterance.volume` tối đa là 1, và nó **không vượt được âm lượng hệ
thống**. User bật full máy Android vẫn nghe nhỏ ngoài đường — xin thêm cũng không có.

Đòn bẩy có thật: **một tiếng chuông trước mỗi câu**. Tiếng thuần xuyên qua tiếng ồn giao thông tốt hơn
tiếng nói ở cùng mức, vì tiếng ồn trải khắp phổ còn tiếng chuông thì không. Nó **không** làm câu nói to
hơn — nó làm người nghe **đang chờ** câu đó, và đó mới là phần lớn khác biệt.

Đo bằng `OfflineAudioContext` (render thật, không đoán):

| | peak | RMS | mẫu bị clip | nhảy max giữa 2 mẫu |
|---|---|---|---|---|
| blip cũ (gain 0.18, 1 nốt) | 0.179 | 0.0377 | 0 | 0.0206 |
| chuông mới (gain 0.55, 2 nốt) | 0.543 | 0.1115 | 0 | 0.0837 |

**+9,4 dB**, không clip, không đứt sóng. Hai nốt xuống (1175 → 880 Hz) trong 0,24s: đủ để nhận ra, đủ
ngắn để không ăn mất đầu câu.

Kèm `rate` 1.05 → **1.0**: nhịp nhanh chọn cho một chiếc xe hơi im lặng, sai trên xe máy — chữ bị tiếng
đường ăn mất là những chữ nói nhanh, và nghe nửa vời một tên đường còn tệ hơn nghe chậm một nhịp.

⚠️ `AudioContext` nay **chỉ một cái cho cả app**, đặt ở `audio-session.ts`. iOS cho rất ít context/trang
và chỉ cho tạo trong cử chỉ — hai module mỗi bên tự tạo một cái là cách chắc chắn để **không có cái nào
chạy**. `haptics.ts` nay đi mượn.

## `setTimeout(utter, 0)` giết đúng câu quan trọng nhất trên iOS

`speak()` luôn `cancel()` rồi `setTimeout(utter, 0)`. Cái timeout đó có lý do thật — Chrome **bỏ luôn**
utterance nếu `speak()` đi ngay sau `cancel()` trong cùng một tick.

Nhưng iOS đòi **câu ĐẦU TIÊN của một lượt truy cập** được nói khi cử chỉ người dùng còn trên stack, mà
`setTimeout` thì theo định nghĩa là *sau* cử chỉ. Nên câu duy nhất có thể mở được đường âm thanh — câu
phát ra từ cú chạm "Bắt đầu" — lại là câu chắc chắn tới muộn.

Sửa: **chỉ hoãn khi thật sự có gì để cancel.** `const busy = s.speaking || s.pending` — không có gì trong
hàng đợi thì không có lý do gì phải nhường tick.

Cùng lý do, `primeSpeech()` đổi từ `volume = 0` sang `volume = 1`: một nền tảng quyết định có mở đường âm
thanh hay không dựa trên thứ đang được yêu cầu, thì hỏi nó bằng một utterance **xin không phát ra tiếng
gì** là hỏi sai. Một dấu cách ở âm lượng đầy vẫn không phát ra tiếng — trong nó không có gì để đọc.

## Rung trên iOS: phải click vào `<label>`, click vào `<input>` là vô ích

Mẹo iOS 17.4+ là `<input type="checkbox" switch>`, và bản đầu của `haptics.ts` gọi `input.click()`.
WebKit phát haptic từ **activation behaviour của `<label>`**, nên click nhắm thẳng vào input thì lật được
công tắc mà **không rung gì**. Đây là lỗi thứ hai trên đúng một dòng đó (lỗi đầu: tự set `checked` trước
khi click, huỷ mất chính cái state change sinh ra haptic).

Kiểm trong trình duyệt thật: 3 lần `label.click()` → 3 sự kiện `change`, trạng thái lật đúng ⇒ đường
truyền tới input thông. Bản thân cái rung thì **chỉ quan sát được trên iPhone thật**.

⚠️ **Apple đã bịt haptic-bằng-JavaScript ở iOS 26.5.** Mẹo này chạy từ 17.4 đến 26.4. Máy mới hơn thì
không có đường nào từ web nữa — cần biết phiên bản iOS trước khi kết luận là code sai.

## Giọng dẫn đường, không phải giọng ra lệnh

User: *"Chếch phải ngay như kiểu ra lệnh là không được nha. Chếch phải nào thì user thoải mái. App dẫn
đường chứ không phải app ra lệnh."*

Soát **toàn bộ** chuỗi được đọc (`maneuver-vi.ts`, `departure-voice.ts`, `nav-chatter.ts`), tìm ra **ba**
chỗ mang giọng ra lệnh chứ không chỉ một:

| trước | sau | vì sao |
|---|---|---|
| `Chếch phải ngay vào X` | `Chếch phải vào X nha` · `Chếch trái nào` | `ngay` thêm sự gấp gáp mà cái ngã ba **đã** có; động từ trần ở đúng lúc người ta đang vào khúc rẽ thì nghe như bị điều |
| `rẽ phải gấp` / `rẽ trái gấp` (type 11/14) | `ngoặt phải` / `ngoặt trái` | "gấp" trong tiếng Việt vừa là *gắt* vừa là *khẩn* — mô tả một khúc gắt mà nghe ra thành thúc giục |
| `Đã tới đích` | `Tới rồi!` | đó là câu một cái hệ thống nói. Đây là lúc kết thúc chuyến đi của một người |

### Tiểu từ đặt ở CUỐI, không đặt ở đầu

`Rẽ phải vào Pasteur nha` — chữ quan trọng vẫn ra trước. Tới lúc nghe "nha" thì người ta đã biết rẽ
hướng nào rồi. Đặt softener lên đầu (*"Bạn ơi, rẽ phải…"*) là trì hoãn đúng phần cần nghe.

Chọn tiểu từ theo việc **có tên đường hay không**: `nha` khi có (`Rẽ phải vào Pasteur nha`), `nào` khi
không (`Rẽ trái nào`) — vì `chếch phải nha` đứng một mình mỏng hơn `chếch phải nào`.

### Cái KHÔNG sửa

`Sau 500 mét rẽ phải vào Pasteur` **giữ nguyên**. Đó là câu **tường thuật** lộ trình, không phải câu
lệnh, và user đã nói phần đó tốt rồi. Thêm `nhé` vào đây thì nó lặp 4 lần mỗi khúc rẽ × mọi khúc rẽ.

`Ngay bây giờ` trên banner cũng giữ: nó nằm ở **cột khoảng cách**, trả lời "còn bao xa", không phải ra
lệnh.

**Luật:** trước khi sửa văn phong, **liệt kê hết chuỗi được đọc ra rồi soi từng câu** — chỗ user chỉ ra
thường không phải chỗ duy nhất. Ở đây `gấp` và `Đã tới đích` đều lọt qua mắt cho tới khi lập bảng.

## Tới đích: nói tên chỗ, và nói nó nằm bên tay nào

App **đã** báo tới đích từ trước (`maneuverSentence` xử lý type 4–6: *"Còn 100 mét là tới đích"* →
*"Đã tới đích"*). Thiếu hai thứ: **tên chỗ** và **bên nào**.

Bên nào là câu hỏi duy nhất còn lại lúc cuối chuyến: **route kết thúc ở chỗ đường gần cái quán nhất,
không kết thúc ở cái quán.** Được nói bên nào thì dừng một lần; không được nói thì ngó ngang ngó dọc ở
tốc độ đi bộ giữa dòng xe.

```
7668   Còn 100 mét là tới đích
7704   Còn 80 mét là tới đích
7752   Tới rồi! Cà phê Sỏi Đá nằm bên phải bạn đó.
```

### `destinationSide()` — và 3 trường hợp phải IM

So hướng đi trên **~25m cuối** của polyline với hướng từ điểm cuối polyline tới **cái ghim thật**. Lấy
25m chứ không lấy đoạn cuối, vì đoạn cuối có thể dài 1m và chỉ đâu cũng được.

Trả `null` — không nói gì — ở ba ca mà nói ra còn tệ hơn im:

| ca | vì sao |
|---|---|
| ghim cách đường **< 6m** | nằm ngay trên đường, không có bên nào đúng |
| lệch **< 25°** so với thẳng trước / thẳng sau | sai số nhỏ ở một trong hai hướng là đảo đáp án |
| còn **< 3m** polyline để tính hướng | không xác định được đang hướng mặt về đâu |

Trái/phải là loại logic **rất dễ làm ngược**, nên có test 7 ca (bắc/đông × đông/tây/nam/bắc × thẳng
trước × trên đường × polyline 1 điểm) — cả 7 đúng. Dấu của `((toDest − travel + 540) % 360) − 180`:
**dương là bên phải.**

### Chỉ áp cho CHẶNG CUỐI

Điểm dừng giữa đường cũng sinh maneuver type 4–6. Đọc *"Tới rồi! Cà phê Sỏi Đá ở bên phải"* tại một điểm
dừng giữa chuyến là gọi tên chỗ mà người ta **chưa** tới. `arrivalContext` trả `null` khi
`currentLegIndex < legs.length - 1`.

### Tên + bên đều tuỳ chọn, câu tự dựng theo cái nào có

4 bộ câu: có-tên-có-bên / có-tên / có-bên / không-gì. Thiếu bên **không phải lỗi để xin lỗi** —
`destinationSide` cố tình im ở 3 ca trên, và ở những ca đó thật sự không có bên nào để gọi.

⚠️ `useTurnByTurn` phải gọi **sau** `list`/`selectedName` (dòng ~537/599) vì cần toạ độ điểm đến. Đã
chuyển lời gọi hook xuống dưới — kiểm trước là `turn` không được dùng ở đoạn giữa. Hook vẫn vô điều kiện
nên đổi vị trí là an toàn.

## Đoạn đường dài: chỗ im lặng dài nhất không phải khúc rẽ, mà là 6km giữa hai khúc rẽ

Lời chỉ đường ở khúc rẽ chưa bao giờ là khoảng trống. Khoảng trống là **quãng giữa hai khúc rẽ**: xong
một khúc là im hoàn toàn cho tới 500m trước khúc sau — đủ lâu để user tưởng app ngủ, và đủ lâu để họ
**nhìn màn hình lúc đang chạy**, đúng cái mà giọng đọc sinh ra để tránh.

`src/lib/nav-chatter.ts` + mốc dài trong `turn-announcer.ts`:

| khi nào | nói gì |
|---|---|
| vừa rẽ xong vào đoạn ≥ **1500m** | *"Vào Cộng Hòa rồi. Đường này thẳng 6 ki lô mét, mình nhắc lại khi gần tới nhé."* |
| mốc **4km / 2km** | *"Đang đi tốt lắm. Còn 2 ki lô mét."* |
| mốc **1km** (nêu tên khúc rẽ tới) | *"Chuẩn bị rẽ trái nha, còn 1 ki lô mét."* |
| 500/200/80/ngay | **giữ nguyên** như cũ — đó là câu lệnh, phải ngắn và giống nhau mọi lần |
| vẽ lại đường | *"Ơ, bạn có lựa chọn riêng rồi ư? Mình vừa vẽ lại đường theo lối bạn đi."* |

`ALL_STAGES = [...LONG_STAGES, ...STAGES]` — một danh sách duy nhất, để luật "mốc gần nhất đã vượt" lo
cả hai nửa mà không nửa nào phải biết về nửa kia. Câu nào thuộc mốc `>= 1000` thì dùng `nav-chatter`,
dưới đó dùng `maneuverSentence`.

### Ngưỡng 1500m, không phải 2000m

Đo trên route thật 7,8km: mốc 2000 chỉ bắt được **1 trong 3** đoạn dài, để lọt đoạn **1870m** và
**1512m** — đúng loại đoạn sinh ra khiếu nại. Dưới ~1,5km thì câu 500m tới đủ sớm rồi.

### Câu mở đầu phải TIÊU luôn các mốc đã vượt

Bản đầu đọc hai câu **cách nhau 12m**, cùng một nội dung:
```
192   "1,9 ki lô mét nữa mới tới khúc rẽ tiếp theo..."
204   "Còn 1,9 ki lô mét nữa thôi, vẫn đi thẳng nhé."   ← trùng
```
Vì câu mở đầu bắn ở bước *advance*, còn bước sau đó mốc 2000 mới được xét. Sửa: khi mở đầu, đánh dấu
`${idx}:${far}` cho **mọi** mốc `>= stretch`. Câu mở đầu đã nói con số đó rồi.

### Ba luật viết câu cho giọng đọc

- **Chỉ dấu chấm và dấu phẩy.** `—` không phải dấu ngắt với bộ đọc, nó là ký tự lạ, và mỗi nền tảng xử
  lý một kiểu — thứ cuối cùng mà một câu định nói cho thân thiện cần.
- **Điểm đến không phải khúc rẽ.** `maneuverVerb` trả "đã tới đích" cho type 4–6, nhét vào khuôn câu
  dành cho khúc rẽ thì ra *"sắp tới khúc đã tới đích rồi"*. Phải có nhánh `ARRIVING` riêng.
- **Vẽ lại đường KHÔNG BAO GIỜ nói như đang sửa lỗi user.** Người ta rẽ lối khác thường là có lý do —
  đường chặn, lối tắt họ biết, chỗ muốn ghé — và bị cái điện thoại lên giọng vì mình biết thành phố hơn
  nó là chuyện nhỏ nhưng cộng dồn qua nhiều chuyến. Và chỉ nói **sau khi** có đường mới trong tay: nói
  lúc request còn đang bay là hứa hộ cái mà bản đồ chưa làm được.

`pick(list, seed?)` — `seed` tồn tại để **mô phỏng cả chuyến rồi đọc lại câu**: thứ đang cần kiểm là câu
chữ, mà câu chữ thì không kiểm được nếu mỗi lần chạy một khác. Trong app thì bỏ seed, vì cái hay chính
là không đoán được.

## Khoảng cách chỉ đường: ĐƯỜNG THẲNG là con số sai, và ở khúc quay đầu thì vô nghĩa

User báo thực địa: *"thông báo 500m nữa rẽ nhưng thực tế còn dưới 100m"*, mà chuỗi ngưỡng và câu cuối
thì đúng. Đo trên **route thật** 7,8 km Sài Gòn (Q1 → Tân Bình, có một khúc **quay đầu** trên Cộng Hòa),
mô phỏng đi dọc polyline 12 m/bước, so từng lời đọc với khoảng cách **dọc đường** thật:

```
app nói "Sau 500 mét rẽ phải vào Nam Kỳ Khởi Nghĩa"   thật 608 m   lệch −118
app nói "Sau 200 mét ..."                             thật 296 m   lệch  −98
app nói "Sau 500 mét rẽ phải vào Đường C18"           thật 1219 m  lệch −724
app nói "Rẽ phải NGAY vào Đường C18"                  thật  751 m  lệch −719
```

Hai lỗi, **một gốc: `metres = haversineM(user, turn)`** — đường thẳng qua không khí.

1. **Trên đường cong nó ngắn hơn đường thật ~20%.** Nên câu "500 mét" phát ra khi còn 608 m đường.
2. **Ở khúc quay đầu nó vô nghĩa.** Sau khi quay đầu, mọi khúc rẽ nằm cách đoạn đường trước đó vài mét.
   Luật cũ `toAhead < metres` ("khúc sau gần hơn thì nhảy tới") vì thế **nhảy vượt** khúc quay đầu và
   khoá vào một khúc cách 1219 m, rồi hô "rẽ NGAY" khi còn 751 m đường.

Và nó **ăn mất hẳn 2 khúc rẽ**: `Trần Quốc Toản` (2083 m) và **chính khúc quay đầu** (7196 m) chưa bao
giờ được đọc một câu nào.

### Sửa: đo theo TIẾN ĐỘ DỌC ĐƯỜNG

- Server (`parseLeg`) tính sẵn `alongRouteMeters` cho từng maneuver = `cumulativeMetres(shape)` tại
  `begin_shape_index`. Làm ở server vì polyline **đã** được giải ở đó; client mà tự snap từng khúc rẽ lên
  đường thì ở đoạn quay đầu sẽ snap sai lượt.
- Client (`useTurnByTurn`) đo tiến độ của mình bằng `remainingAlongRoute` trên **đúng polyline của chặng
  đang đi** (đọc turns từ chặng này mà lấy hình học chặng khác là lệch toàn bộ).
- `stepAnnouncer` nhận `travelledM`: `metres = alongRouteMeters − travelled`, và **tiến index theo tiến
  độ** (`travelled >= off(idx) − PASSED_M`) chứ không theo "cái nào gần hơn".

Tiến độ dọc đường là **đơn điệu tăng**, nên không có kiểu hình học nào làm khúc sau trông gần hơn được.

Kết quả đo lại trên cùng route đó: **mọi lời đọc lệch = 0 m**, và cả 2 khúc bị mất đều có đủ chuỗi
500/200/80/ngay — kể cả khúc quay đầu.

⚠️ Giữ nhánh đường-thẳng làm dự phòng cho route chưa khớp được hoặc route cache từ trước khi có
`alongRouteMeters`. Sai vẫn hơn im.

**Luật:** trong chỉ đường, "khoảng cách" luôn có nghĩa là **dọc theo đường**. Dùng haversine tới một khúc
rẽ chỉ đúng khi đường thẳng — mà nếu đường thẳng thì đã chẳng có khúc rẽ nào.

## Ngưỡng đọc: 80m PHẢI nói, 60m im là ĐÚNG

Giả thuyết "chưa rơi vào ngưỡng nên không có gì" — mô phỏng bằng `stepAnnouncer` cho thấy **không phải**:

```
xuất phát cách 80m:  80m → NÓI  ·  60m → im  ·  40m → NÓI
xuất phát cách 60m:  60m → NÓI  ·  40m → NÓI
xuất phát cách 600m: 600m → im · 400m → NÓI · 250m → im · 150m → NÓI · 70m → NÓI · 30m → NÓI
```

`STAGES = [500, 200, 80, 40]`, và một khoảng cách nằm trong ngưỡng nào thì **nói ngay ở lần cập nhật vị
trí đầu tiên** — không cần đi qua ngưỡng trên trước. 60m im vì cùng ngưỡng 80 đã nói. 600m im vì chưa
vào ngưỡng nào. ⇒ Phần quyết định đúng; im lặng nằm ở đường âm thanh, không ở đây.

## Câu chào khởi hành: một câu, và nó gánh ba việc

`src/lib/departure-voice.ts`. Nói **một** câu ngay khi bắt đầu, ~4 giây:

1. Cho hai con số user muốn biết trước khi đi — bao xa, bao lâu — vào đúng lúc còn nhìn được màn hình.
2. **Là bằng chứng giọng đọc hoạt động.** Mọi câu sau đều chờ ngưỡng khoảng cách, nên đường thẳng dài
   một cây số là một cây số im lặng, và user không có cách nào phân biệt giọng hỏng với đường trống.
3. Trên iOS **đây là câu mở đường âm thanh**, vì nó phát ra từ cú chạm bắt đầu chuyến.

Nói với **bất kỳ số nào đang có**, cố tình **KHÔNG đợi** route trả về đủ: đợi là tiêu mất cửa sổ cử chỉ,
mà đó mới là thứ quý. Không có số thì câu tự bỏ phần số đi.

Câu mở đầu **đổi theo ngày, không random**: đa dạng để câu nghe mỗi chuyến không bị nhàm, nhưng một
chuyến xe không phải chỗ để bị bất ngờ — cố định theo ngày thì nó là giọng của app, không phải máy xèng.

## VAPID: kiểm bằng cách VERIFY chữ ký, không phải bằng cách nhìn

Đừng tin cặp khoá vì nó "trông giống base64url". Kiểm thật: `webpush.generateRequestDetails()` trên một
thuê bao giả, tách JWT trong header `Authorization`, rồi `crypto.verify` chữ ký ES256 bằng chính public
key. Đúng thì mới chắc.

```
alg ES256 · aud https://fcm.googleapis.com · k= khớp public key ở env · CHỮ KÝ VERIFY: ĐÚNG
```

Test đầy-đủ-hơn (đăng ký `pushManager.subscribe` trong Chrome headless rồi gửi thật) **treo ở
`serviceWorker.ready`** trong headless — bỏ, không đáng. Cách trên đã bắt được đúng thứ sẽ hỏng nếu khoá
sai.

## `pgrep -f "<chuỗi>"` khớp cả chính lệnh đang chạy — tự giết mình

`for p in $(pgrep -f "cdp-push-"); do kill $p; done` → shell thoát với 144, không in gì. Vì dòng lệnh của
chính nó **có chứa** `cdp-push-`, nên `pgrep -f` trả về luôn PID của mình.

Dùng `pgrep -f` để dọn tiến trình thì phải loại chính mình (`$$`), hoặc lọc theo tên tiến trình
(`pgrep -x`), hoặc lưu PID lúc spawn rồi kill theo PID đó. Liên quan: [[never-pkill-shared-processes]].

## Ảnh gốc: giới hạn 10 MB là của GÓI, và nó bắt user trả giá bằng thời gian chờ

Đo thật bằng cách upload lên đúng tài khoản: gói **Free của Cloudinary chặn cứng ở
10.485.760 byte/ảnh** (`"File size too large. Got 58656604. Maximum is 10485760."`). Không phải code
đặt ra, và **không tắt được** — muốn cao hơn thì phải đổi gói.

Cái đắt không phải lời từ chối, mà là **lúc** nó tới: server chỉ trả lời sau khi đã nhận hết body, nên
ảnh 56 MB **đi hết đường lên rồi mới bị từ chối — đo được 47,6 giây**. Ảnh 9,3 MB lên được nhưng mất
11,4 giây, và đó là từ máy bàn nối dây; qua 4G còn lâu hơn nhiều.

⇒ **Kích thước phải chốt ở client, trước khi byte đầu tiên rời máy.** `src/lib/image-prepare.ts`.

### Luật hẹp có chủ đích: dưới ngưỡng thì KHÔNG ĐỤNG MỘT BYTE

| ảnh | làm gì |
|---|---|
| ≤ 10 MB | trả về **đúng object `File` đó**, không giải mã, không vẽ lại, không nén |
| > 10 MB | thu vừa đủ để lọt, ở mức chất lượng cao nhất còn lọt được |

Ảnh điện thoại thường 2–5 MB nên **không bao giờ đi vào nhánh thu nhỏ**. Kiểm bằng md5 hai đầu: ảnh
3,94 MB tải về từ Cloudinary trùng md5 và trùng từng byte (`4136487`) với bản trên máy.

Chỗ cần nói rõ: với ảnh **trên** 10 MB thì lựa chọn không phải "giữ nguyên hay nén", mà là **"nén một
chút hay mất luôn ảnh"** — gói này không lưu nó nguyên bản được. Thu 25,5 MB / 6000×4000 → 8,2 MB /
4899×3266, vẫn 16 MP.

### Ba cái bẫy trong đường thu nhỏ

- **Safari iOS trả canvas TRẮNG quá ~16,7 triệu điểm ảnh** — không báo lỗi, chỉ ra ảnh rỗng. Nên có
  `MAX_PIXELS = 16_000_000`. Ảnh 48 MP trên iPhone mà không chặn trần thì lưu lên một ô trắng.
- **`createImageBitmap(file, { imageOrientation: "from-image" })`** — thiếu tham số này thì ảnh chụp
  dọc bị **encode nằm ngang**, vì cờ orientation trong EXIF biến mất cùng phần metadata khi vẽ lại.
- **Safari chỉ ENCODE được WebP từ 16.4**, bản cũ hơn **im lặng trả về PNG** chứ không từ chối ⇒ phải
  xét `blob.type` trả về, đừng tin `toBlob("image/webp")` đã chạy là đã ra WebP. Chọn WebP vì cùng dung
  lượng nó giữ nhiều chi tiết hơn JPEG, mà delivery đằng nào cũng `f_auto` nên lưu định dạng gì cũng được.

Giải mã thất bại (HEIC iPhone ở browser không đọc được) **không phải lỗi**: đẩy nguyên bản lên, để
server — nơi hiểu định dạng đó — quyết định.

## `Promise.all` cho 10 ảnh: một ảnh rớt mạng là mất cả chín ảnh đã lên xong

`Promise.all` **reject ngay ảnh lỗi đầu tiên và bỏ hết kết quả**. Nên trên đường truyền điện thoại —
nơi máy chuyển giữa wifi và 4G giữa lúc upload — một ảnh hỏng khiến chín ảnh đã lên tới Cloudinary bị
vứt đi, và user phải chọn lại từ đầu cả 10.

Nay mỗi ảnh đi một đường riêng, mang tiến độ và lỗi của riêng nó: hỏng cái nào thì **chỉ ô đó** xám lại
kèm nút "Thử lại", mọi ảnh khác và mọi thứ đã gõ trong form nằm nguyên. Thêm 2 lần tự thử lại
(700ms, 2s) cho lỗi mạng — **4xx thì không thử lại**, vì đó là phán quyết về chính tấm ảnh đó.

**Dùng `XMLHttpRequest`, không phải `fetch`** — chỉ vì một lý do: nó báo đã đẩy được bao nhiêu
(`xhr.upload.onprogress`). 10 ảnh qua mạng điện thoại là gần một phút, và một phút không có gì nhúc
nhích thì **đọc ra là app treo** dù nó đang chạy.

Kiểm bằng cách chặn `api.cloudinary.com` giữa lúc upload: 3 request (1 + 2 lần thử lại) → hiện
"0 ảnh · 1 lỗi" + 1 nút Thử lại; bỏ chặn, bấm → 200 → "1 ảnh, 0 lỗi".

## Ảnh: lưu ở đâu, ai xem được, và chỗ đã bịt (2026-09-03)

Kiểm bằng Admin API, không đoán:

| lớp | kết quả |
|---|---|
| Qua app/API | **không lộ** — `memory.list` là `protectedProcedure` lọc theo `ctx.spaceId` |
| Liệt kê từ ngoài | **không** — `res.cloudinary.com/<cloud>/image/list/*.json` trả **401** (đã tắt cho cloud này) |
| Đoán URL | **không khả thi** — `public_id` 20 ký tự `[a-z0-9]` ⇒ 36²⁰ ≈ 1,3×10³¹; kiểm 100 mẫu, **không** có tên file gốc |
| Xoá ảnh có xoá thật? | **có** — `destroyAssets` được gọi ở cả sửa (bỏ ảnh) và xoá kỷ niệm |

⚠️ Nhưng `type: upload`, **không** `access_mode`/`access_control` ⇒ **URL công khai, không cần đăng
nhập**. Bảo mật hiện tại là *"URL không đoán được"*, **không phải** *"chỉ người có quyền mới xem"*. URL
lọt ra một lần là mở được vĩnh viễn, không hạn dùng, không thu hồi (trừ khi xoá ảnh). Nâng lên mức thật
cần `type: authenticated` + URL ký có hạn — **user chưa chọn**, và có đánh đổi: URL ký thì CDN không
cache lâu được ⇒ ảnh chậm hơn, và `cloudinary-url.ts` phải gọi server thay vì tự dựng chuỗi.

### Đã bịt: lỗ GHI (signed upload)

`NEXT_PUBLIC_CLOUDINARY_*` nằm trong bundle JS công khai, mà preset là `unsigned` và **không giới hạn
gì** ⇒ ai đọc bundle cũng POST được file bất kỳ vào tài khoản: đốt quota, hoặc đẩy nội dung bất hợp pháp
vào cloud mang tên user.

`routers/upload.ts` phát **chữ ký cho từng lần upload**, chỉ cho thành viên đã đăng nhập:

```
folder = `memories/${ctx.spaceId}`   ← NẰM TRONG chữ ký
```

Folder ở trong chữ ký nên nó là **ranh giới**, không phải quy ước: client không đổi được sang folder của
không gian khác mà chữ ký còn hợp lệ. Và Cloudinary **từ chối** request nếu browser gửi thêm tham số
không được ký — đó chính là tính chất khiến client không tự nới quyền của mình được.

**Lấy chữ ký mới cho MỖI lần thử lại**, không tái dùng: chữ ký mang timestamp mà Cloudinary xét hạn, và
lần retry sau 2 giây backoff trên mạng chậm đúng là chỗ chữ ký cũ bắt đầu hỏng — với triệu chứng trông
y như lỗi mạng.

⚠️ `CLOUDINARY_API_KEY`/`_SECRET` là **optional** trong `env.ts` ⇒ deploy thiếu vẫn boot được, và hỏng
sẽ hiện ra dưới dạng "ảnh không lên được, không rõ vì sao". Nên `sign` **throw** `PRECONDITION_FAILED`
kèm câu tiếng Việt nói rõ thiếu biến nào.

### Còn 1 bước: tắt preset unsigned SAU KHI deploy

Đã siết preset (`folder=memories`, `allowed_formats=jpg,jpeg,png,webp,gif,heic,heif,avif`;
`max_file_size` bị Cloudinary từ chối trên preset unsigned — hạn 10MB của gói vẫn chặn). Nhưng nó **vẫn
`unsigned: true`** vì bản prod đang chạy còn dùng nó. Sau khi deploy bản signed và upload thử thành công:

```bash
curl -u "$KEY:$SECRET" -X PUT \
  "https://api.cloudinary.com/v1_1/<cloud>/upload_presets/my_love" -d "unsigned=false"
```

### Bẫy khi test: "Forbidden origin"

Mọi **mutation** tRPC bị chặn nếu `Origin` của browser ≠ `BETTER_AUTH_URL` (xem
`app/api/trpc/[trpc]/route.ts`). Chạy dev ở cổng khác `BETTER_AUTH_URL` thì upload báo
`Unexpected token 'F', "Forbidden origin" is not valid JSON` — **lỗi của bài test, không phải của app**.
Chạy dev **đúng cổng của `BETTER_AUTH_URL`** (ở đây 4488).

## ⚠️ Preset upload đang MỞ TOANG — và comment trong code nói ngược

`cloudinary-upload.ts` từng ghi *"preset (locked to folder / formats / size in the Cloudinary
dashboard)"*. Hỏi Admin API thì preset `my_love` chỉ có
`['overwrite','type','unique_filename','use_asset_folder_as_public_id_prefix','use_filename','use_filename_as_display_name']`
— **không có** `folder`, `allowed_formats`, `max_file_size`, `incoming_transformation`.

`NEXT_PUBLIC_CLOUDINARY_*` nằm trong bundle JS công khai ⇒ ai đọc bundle cũng POST được file bất kỳ vào
tài khoản, đốt hạn mức 25 credit của gói Free. Comment đã sửa lại cho đúng sự thật. **Chưa bịt** — cần
user quyết: siết preset, hay chuyển sang **signed upload** (server phát signature, chỉ user đã đăng
nhập upload được).

**Luật:** comment khẳng định một tính chất an toàn ("đã khoá ở dashboard") thì phải **gọi API xác nhận**
rồi mới viết. Comment sai kiểu này còn tệ hơn không có comment, vì nó khiến người sau thôi kiểm tra.

## Test chấm bản CŨ: cổng đã có người giữ, `next dev` chết mà test vẫn "chạy"

Chạy `next dev -p 3987` rồi test, thấy chữ trên form vẫn là bản cũ. Lý do: cổng 3987 đang do một
**`next start`** (bản build từ trước) giữ; `next dev` chết ngay với `EADDRINUSE` (chỉ nằm trong log,
không nổi lên đâu cả), còn `curl` vẫn trả 200 nên trông như server của mình. Bài test hợp lệ hoàn toàn
— nó chỉ đang chấm code cũ.

**Trước khi tin một bài test UI: xem CHÍNH XÁC tiến trình nào đang giữ cổng đó**
(`ss -ltnp | grep <port>`), và tail log của server mình vừa bật.

## Phép thay thế trượt mỏ neo làm bài test "đậu" bằng cách không test gì

Sửa file test bằng `str.replace` mà mỏ neo đã bị chính mình chèn thêm dòng vào từ lượt trước ⇒ Python
`replace` **im lặng không làm gì**, script chạy lại đúng bài cũ và in ra kết quả xanh. Dòng
`>>> ĐÃ CHẶN` không hề xuất hiện, đó là bằng chứng duy nhất cho thấy có chuyện.

**Mọi `str.replace` khi vá file phải `assert s.count(old)==1`.** Và bài test nào có bật/tắt một điều
kiện thì phải **in ra rằng nó đã bật** — nếu không, "không lỗi" và "không test" trông y như nhau.

## Kỷ niệm: ảnh GỐC được nhét vào ô 120px, ba cái mỗi thẻ

`memory-timeline.tsx` render `<img src={p.url}>` — mà `p.url` là `secure_url` Cloudinary trả về lúc
upload, tức **ảnh gốc**. Ảnh điện thoại 4032×3024 (~3–5 MB) được tải về để vẽ một ô vuông ~120px, ba ô
mỗi thẻ. Modal thì tải **lại lần nữa**, vẫn gốc, cho mọi ảnh của kỷ niệm đó — nên mở kỷ niệm lên là
phải đợi tải xong toàn bộ ảnh gốc trước khi thấy gì.

Cloudinary đọc tham số biến đổi ở đoạn ngay sau `/upload/`, nên **cùng một URL đã lưu** phục vụ được
mọi kích thước — không phải upload lại, không phải migrate bản ghi nào. `src/lib/cloudinary-url.ts`:

| dùng ở đâu | biến đổi |
|---|---|
| thumbnail lưới | `c_fill,g_auto,w_400,h_400,f_auto,q_auto,dpr_auto` |
| ảnh trong modal | `c_limit,w_1000,f_auto,q_auto,dpr_auto` |
| lightbox (pinch-zoom) | `c_limit,w_2000,f_auto,q_auto` |

`f_auto` + `q_auto` là phần tiết kiệm lớn nhất **trước cả khi** resize: Cloudinary tự chọn AVIF/WebP và
mức nén hợp ảnh. `dpr_auto` nhân đôi trên màn retina mà không nhân đôi trên laptop.

Hàm chỉ viết lại URL nó nhận ra (`res.cloudinary.com` + `/image/upload/`), **để nguyên** URL lạ, và
**không chồng** biến đổi lên URL đã có sẵn một cái.

### Vỡ layout khi cuộn: kích thước ảnh CÓ lưu nhưng bị router cắt

`photoSchema` lưu `width`/`height`, zod cũng nhận — nhưng projection ở `memory.list` chỉ trả
`{url, publicId}`. Không có kích thước thì client **không giữ chỗ được**, ảnh cao 0px rồi nhảy khi tải
xong. Nay trả về, và modal đặt `style={{aspectRatio}}` từ đó; thumbnail thì `aspect-square` + thuộc
tính `width`/`height`.

⚠️ Khi thêm state phái sinh từ một API, **kiểm cả projection** — dữ liệu có trong DB không có nghĩa là
nó tới được client.

## "Đi 1 mình" vẫn ra giao diện 2 người: ONLINE bị nhầm thành ĐỒNG Ý

Bảy chỗ trong `locations-page` suy ra "chuyến này đi cùng nhau" từ `nav.partnerLocation != null`. Đó
**không phải cùng một câu hỏi**, và nó đúng thường xuyên hơn nhiều — người kia chỉ cần **mở trang Bản đồ
trong vài phút gần đây** là có live location.

Hệ quả trên một chuyến đi một mình, khi người kia tình cờ đang cầm điện thoại:

| dòng | nó làm gì |
|---|---|
| 655 | tự lấy route **của người kia tới đích của mình** → `partnerRouteGeometry` ≠ null → HUD bật cột đôi |
| 896 | ngay lần lấy route đầu đã kéo luôn route người kia |
| 1259 | đọc *"Người kia cũng đang trên đường rồi"* |
| 558 | băng *"Người kia đang dừng xe hoặc kẹt cứng rồi!"* khi họ ngồi yên |
| 1480 | `MeetingFlare` — pháo hoa "gặp nhau" |
| 1507 / 1801 | ghim người kia trên **cả hai** bản đồ |
| ping | nút "Gửi cảm xúc cho người kia" **không có điều kiện nào cả** |

Người kia không hề đồng ý, thậm chí không biết.

### Tín hiệu đúng: lời mời, vì lời mời LÀ sự đồng ý

`const isCompanionTrip = currentTripInviteId != null;` — id này đã tồn tại sẵn (dùng cho
`companion: !!currentTripInviteId` lúc ghi lịch sử), chỉ là không ai dùng nó cho phần hiển thị.

⚠️ **Bẫy thứ tự — bên trong `goToLocation` KHÔNG đọc được state đó.** Chính hàm này `setCurrentTripInviteId(null)`
lúc vào (chuyến thủ công không có lời mời), còn handler nhận-lời-mời set lại ở **dòng ngay sau lời gọi**.
Nên trong hàm state luôn nói "đi một mình", kể cả với chuyến đi chung. Vì vậy `goToLocation` phải nhận
**cờ tường minh** `opts.withPartner`, không được suy từ state.

Ngoài hàm đó thì gate bằng `isCompanionTrip` là đúng, vì effect chạy ở render sau — lúc state đã set.

### Kiểm phải TỚI ĐƯỢC màn dẫn đường thật

Luồng là **4 bước**: `Chỉ đường` → `Đi 1 mình` → `Bắt đầu nào 💕` → `Bắt đầu đi`. Dừng ở bước 1 thì mọi
cờ đều `false` **vì HUD chưa tồn tại**, và bài test sẽ "đậu" mà không kiểm gì. Cách tìm ra đường đi: in
`document.querySelectorAll('button')` ở từng bước thay vì đoán nhãn.

Dựng bối cảnh bug bằng cách ghi thẳng DB: thêm một `userId` giả vào `space.members` + một `livelocations`
mới cho nó — không cần tài khoản thứ hai.

Kết quả với người kia ĐANG có vị trí:
```
đangDẫnĐường true · cộtNgườiKia false · nútGửiCảmXúc false · băngDừngXe false
```

**Luật:** "đang online" không bao giờ là bằng chứng của "đã đồng ý". Mọi tính năng hai người phải gate
bằng **hành động đồng ý được lưu lại**, không phải bằng dấu hiệu hiện diện.

## Masonry (`columns-2`) phá thứ tự đọc — sort xong mà mắt không đi theo thì vô nghĩa

Sắp xếp theo giờ xong, FE vẫn nhìn như chưa sort. Vì `memory-timeline` dùng `sm:columns-2` — CSS
multi-column, tức **masonry**: nó xếp đầy cột trái từ trên xuống rồi mới sang cột phải.

```
DOM (đúng sort):  23:00 · 21:00 · 09:30 · 07:10
columns-2  ⇒   trái: 23:00        phải: 09:30
               trái: 21:00        phải: 07:10      ← đọc ngang: 23:00 rồi 09:30
grid       ⇒   trái: 23:00        phải: 21:00
               trái: 09:30        phải: 07:10      ← đọc ngang đúng thứ tự
```

Masonry gói thẻ khít, không có khoảng trống lởm chởm — và đổi lại nó **phá thứ tự đọc**. Với một danh
sách *có sắp xếp* thì đó là đánh đổi sai: **sort chỉ có ích nếu mắt đi theo nó.**

`grid items-start gap-3 sm:grid-cols-2`. `items-start` để mỗi thẻ giữ chiều cao tự nhiên thay vì bị kéo
giãn cho bằng thẻ bên cạnh — nên **không có gì về bản thân thẻ thay đổi**, chỉ đổi chỗ nó ngồi.

Đo bằng `getBoundingClientRect` chứ không bằng mắt:

```
display: grid · cols: 460px 460px · align: flex-start
hàng 1 (y=209): 23:00 @x318 | 21:00 @x790
hàng 2 (y=599): 09:30 @x318 | 07:10 @x790
hàng 3 (y=938): 06:00 @x318 | 05:00 @x790
chiều cao 377 vs 328 ⇒ không bị stretch
```

⚠️ `home-screen.tsx` cũng dùng `lg:columns-2`. **Để nguyên có chủ đích**: đó là các widget khác loại
nhau, không phải một dãy đã sắp xếp, nên thứ tự đọc không mang thông tin. Grid là khuôn mẫu sẵn có cho
danh sách (`library-page`, `locations-page`, `games-panel` đều dùng).

`StaggerList` bọc mỗi con trong một `motion.div` ⇒ chúng thành grid item, đổi sang grid không cần sửa gì
trong đó.

## Thêm khoá sắp xếp thì PHẢI sửa con trỏ keyset — và `time` còn có thể KHÔNG tồn tại

Thêm `time` cho kỷ niệm mà quên `sort` ⇒ hai kỷ niệm cùng ngày vẫn xếp theo `_id` (thứ tự nhập), giờ
hiển thị đúng mà thứ tự sai. Sửa `sort` thành `{ date: -1, time: -1, _id: -1 }` là **một nửa** việc.

Nửa còn lại: `memory.list` phân trang **keyset** trên `(date, _id)`. Đổi khoá sắp xếp mà không đổi con
trỏ thì trang 2 lặp mục hoặc mất mục — và mất mục thì **không ai thấy**, vì trang vẫn trả về đủ số dòng.

### Chỗ dễ sai nhất: `$lt` không khớp qua BSON type

`time` là **tuỳ chọn**. `{ time: { $lt: "17:30" } }` **không bao giờ khớp** một kỷ niệm không có `time`,
vì `$lt` chỉ so trong cùng một BSON type. Nên nhánh untimed phải viết riêng, không thể gộp:

```js
filter.$or = t
  ? [ { date: { $lt: at } },
      { date: at, time: { $lt: t } },
      { date: at, time: null },                    // untimed xếp SAU mọi giờ ⇒ chưa trả cái nào
      { date: at, time: t, _id: { $lt: cursorId } } ]
  : [ { date: { $lt: at } },
      { date: at, time: null, _id: { $lt: cursorId } } ];
```

`{ time: null }` khớp **cả missing lẫn null** — đó là lý do dùng được cho dữ liệu cũ không cần migrate.

Sort giảm dần thì missing xếp **sau** mọi string ⇒ trong một ngày: các mốc có giờ chạy mới-nhất-trước,
rồi tới những cái chỉ biết ngày. Đó là thứ tự **miễn phí** theo BSON, không phải chọn tay.

Con trỏ nay là `ISO|HH:mm|_id`, phần giữa rỗng khi untimed.

### Kiểm phải ĐI QUA ranh giới phân trang

Seed 6 kỷ niệm: 3 có giờ + 2 không giờ cùng một ngày + 1 ngày khác. Rồi so **1 trang (limit 10)** với
**đi hết bằng limit=2**:

```
1 trang : 20:00 → 12:00 → 08:30 → (không giờ) → (không giờ) → 09:00 (14/8)
limit=2 : giống hệt · không trùng · không thiếu
```

Trang 2→3 rơi đúng chỗ chuyển có-giờ → không-giờ, tức đúng nhánh mà keyset naive làm mất mục. Test mà
chỉ đọc một trang thì **không bao giờ** bắt được lỗi này.

Index nâng thành `{ spaceId: 1, date: -1, time: -1 }` để sort vẫn được index phủ, không sort trong RAM.

## Chú thích từng ảnh, 30 ảnh/lượt, và nhắc tên

### Mentions đọc TỪ CHỮ, không giữ state song song

`collectMentions(text, members)` chạy lúc lưu. Giữ một mảng id bên cạnh câu chữ thì nó **trôi** ngay khi
user sửa câu: xoá tên đi mà mention vẫn còn ⇒ người kia bị báo về một caption không còn nhắc họ.

Hai bẫy trong việc dò tên, cả hai đều có test:
- **Phải ĂN phần đã khớp.** Sắp dài-trước là chưa đủ: ký tự sau `"An"` trong `@An Nhiên` là **dấu cách**
  — qua được kiểm biên — nên `An` khớp *bên trong* `An Nhiên` và **cả hai** người bị báo. Thay mỗi lần
  khớp bằng khoảng trắng cùng độ dài trước khi dò tên tiếp.
- **Biên phải dùng `\p{L}\p{N}`, không dùng `\w`.** `\w` coi `ệ` là *không phải* ký tự chữ nên biên rơi
  vào giữa tên tiếng Việt.

10/10 ca đạt, gồm `"@An Nhiên và @An cùng lúc"` → cả hai.

### Chỉ báo tên MỚI khi sửa

`update` so với `mentions` đang lưu và chỉ gửi cho tên **chưa có trước đó**. Không thì sửa lỗi chính tả
trong caption là ping lại toàn bộ, và một kỷ niệm sửa vài lần thành nguồn thông báo lặp cho một chuyện
xảy ra một lần.

### 30 ảnh, nhưng 3 cái bay cùng lúc

Trần không nằm ở document (30 bản ghi ảnh vài KB so với giới hạn 16MB) cũng không ở lưới (đã xin
Cloudinary bản 400px). Nó nằm ở **upload**: 30 file rời điện thoại cùng lúc là 30 request chia nhau một
đường lên, cái nào cũng bò, và trình duyệt giữ phần lớn ở chỗ **không thanh tiến độ nào nhìn thấy**. Nên
nâng số lượng và **chặn số đang bay** — 3, đủ để mọi thanh đang chạy đều nhúc nhích.

### Deep-link cần `memory.get`, không dùng được danh sách đã tải

Timeline phân trang. Một lời nhắc từ sáu tháng trước **không nằm** trong các trang đã tải nên `find` trả
rỗng — thông báo sẽ mở timeline rồi để người ta tự cuộn đi tìm thứ vừa được báo. Thêm `memory.get` và
dùng `toItem` **chung** với `list`, để kỷ niệm mở từ thông báo có đúng hình dạng như trong danh sách —
hai đường cùng render một component, thiếu field ở một đường là một khoảng trống không ai giải thích được.

Đọc `?memory=` bằng `new URLSearchParams(window.location.search)` trong effect, **không** dùng
`useSearchParams` — nó kéo theo yêu cầu Suspense cho một trang không cần, mà đây là đọc một lần lúc mount,
trên client.

### Bài học về công cụ: đừng vá JSX bằng regex nhiều dòng

Sửa khối `<PhotoView>` bằng regex `(?:.*\n)*?` làm hỏng file (`JSX expressions must have one parent`).
Cách đúng: `python -c` in **repr** của đoạn đó rồi `str.replace` nguyên văn.

⚠️ Và cái bẫy khiến tôi mất 3 lần thử: pipeline hiển thị `sed 's/^/  /'` **tự thêm 2 khoảng trắng**, tôi
chép luôn vào mỏ neo nên không bao giờ khớp. In bằng `repr()`, đừng in qua pipeline có trang trí.

## Giờ của kỷ niệm: trường RIÊNG, không gộp vào Date

`time: "HH:mm"` là string riêng, không nhét vào `date`. Lý do: mọi kỷ niệm lưu trước khi có trường này
**giữ nguyên** — không migrate, và không có bản ghi nào tự dưng mọc ra "00:00" cho một giờ chẳng ai ghi.
Hiển thị chỉ khi có: thẻ ghi `15/8/2026 · 17:30`, không có giờ thì chỉ ngày.

## `variant="outline"` KHÔNG đặt màu chữ

Nút mở lịch trong `DatePicker` dùng `variant="outline"`, mà variant đó chỉ đặt viền/nền — **không đặt
màu chữ**. Ngày hiển thị thừa hưởng màu xám của khung xung quanh và **đọc ra như một field bị khoá**:
user tưởng không đổi được ngày nên không thử bấm, dù bấm vào vẫn mở lịch bình thường.

Sửa bằng `text-foreground font-medium` ngay trên nút đó. **Luật:** bất kỳ chỗ nào hiển thị *giá trị
người dùng đã chọn* phải nói bằng màu chữ chính — màu xám là ngôn ngữ của "không dùng được".

## Chạy được route THẬT rồi mới thấy 2 thứ mô phỏng không bao giờ thấy

Có `STADIA_API_KEY` (từ `.env` — xem cuối mục này), gọi thật một tuyến Sài Gòn 10,9 km:

**1. `speed_limit` KHÔNG được trả về — 0/16 maneuver.** Tôi đã dựng badge giới hạn tốc độ dựa trên báo
cáo khảo sát nói Valhalla có trường này. Nó có trong tài liệu, nhưng với `costing: motor_scooter` trên
Stadia thì **không có dữ liệu nào**. Badge đó sẽ **không bao giờ hiện**. Đã gỡ khỏi UI, giữ lại phần
parse (miễn phí, dữ liệu có thể tốt lên) và ghi rõ ở type rằng `null` là **trường hợp thường**, không
phải ngoại lệ.
**Luật:** báo cáo khảo sát — của agent hay của người — là **giả thuyết**, không phải sự thật. Gọi API
một lần rồi hãy dựng UI trên nó.

**2. Một con đường bị đọc tên 4 lần.** Tuyến thật cho ra *"Chếch phải vào Trường Chinh"* **bốn lần**,
vì Valhalla phát một maneuver ở **mỗi lần đường đổi hình dạng**, mà Trường Chinh thì cong nhiều lần.
Bị nhắc bẻ phải vào con đường mình đã chạy hai cây số không phải là chỉ dẫn.

Nay maneuver thuộc nhóm **giữ làn** (9, 16, 22, 23, 24, 25 — chếch, giữ bên, nhập làn) bị bỏ nếu **trùng
tên đường với khúc được giữ ngay trước**. Rẽ thật thì **không bao giờ** bị bỏ, kể cả khi tên đường quen:
rẽ là một quyết định.

| | trước | sau |
|---|---|---|
| khúc đáng thông báo | 15 | **13** |
| số câu đọc cả tuyến | 32 | **27** |
| câu trùng lặp | 1 | **0** |

Đường thay thế cũng đã nghiệm thu thật: `alternates: 2` được chấp nhận (HTTP 200), app trả về **2 tuyến
kèm maneuvers riêng** (17 và 16), và chip "Đường khác" hiện đúng trên giao diện.

### `.env` của repo này là LOCAL, không dùng chung prod

Kiểm trước khi dùng, vì chạy test lên nhầm DB thật là hỏng không cứu được: `MONGODB_URI` trỏ Atlas
(**không** phải localhost) nhưng database tên **`DateWithYou_Local`**, `locations` **rỗng**, và những
địa điểm user từng nhắc **không có ở đó** — DB nháp, không phải prod.

Dù vậy nó vẫn là DB **từ xa dùng chung**, nên khi test tôi chỉ lấy `STADIA_API_KEY` từ đó và giữ mongod
ở máy cho dữ liệu test. **Cách kiểm an toàn:** đọc tên database + đếm document + tìm một bản ghi mà chỉ
prod mới có. Đừng bao giờ ghi trước rồi mới hỏi.

## Thêm tham số vào một request đang chạy được là việc CÓ RỦI RO

Xin `alternates` từ Valhalla để có đường đi thay thế. Nếu nhà cung cấp từ chối tham số đó thì **mọi
route trong app chết** và dẫn đường ngừng hoạt động — tệ hơn hẳn việc không có lựa chọn. Mà máy dev
không có `STADIA_API_KEY` nên **không thử được**.

Nên: gọi kèm `alternates`, gặp 4xx thì **gọi lại lần nữa không kèm**. Hành vi hôm nay là sàn, tính năng
mới là trần. Luật chung cho mọi lần thêm option vào một API đang chạy tốt mà không tự thử được.

Đường thay thế mang theo **cả maneuvers** (dùng chung `parseLeg`): một tuyến nhìn được mà không có
giọng chỉ đường thì chọn nó là bước lùi.

## Chỉ dẫn từng khúc rẽ: dữ liệu đã có sẵn, chỉ là bị bỏ đi

`getRoute` gọi Valhalla nhưng chỉ đọc `legs[].shape/length/time` và **bỏ luôn `legs[].maneuvers`** —
đó chính là danh sách rẽ. Nay trả về `{ type, streetNames, distanceMeters, lat, lng }`, với toạ độ
điểm rẽ **giải sẵn ở server** từ `begin_shape_index` để client không phải biết gì về shape index.

**Câu tiếng Việt tự dựng, không dịch.** Valhalla trả `instruction` bằng tiếng Anh và locale của nó
không có tiếng Việt. `src/lib/maneuver-vi.ts` dựng câu từ ba dữ kiện: loại rẽ + tên đường + khoảng
cách **còn lại lúc này** (không phải độ dài bước — hai cái khác nhau suốt cả bước, và cái dùng được là
cái khoảng cách còn phải đi).

Bốn cái bẫy câu chữ đã sửa sau khi tự chạy bảng thử:
- `1000m` → `"1,0 ki lô mét"`: không ai nói vậy. Ngưỡng chuyển sang km là **975**, không phải 1000 —
  nếu để 1000 thì nhánh mét làm tròn `975 → "1000 mét"`, chỏi ngay với nhánh km bên cạnh.
- `"quay đầu vào Hai Bà Trưng"`: quay đầu **không** "vào" đường nào. Tên đường bị chặn cho type
  12/13 (quay đầu) và 26 (vòng xuyến — tên thuộc về nhánh ra, không thuộc vòng).
- Dưới `IMMINENT_M = 40` thì **bỏ số**: ở khoảng đó câu lệnh là "rẽ phải ngay", con số là nhiễu.
- Lọc maneuver: Valhalla phát một maneuver cho **mọi** thay đổi hình dạng, kể cả "continue" và
  "start". Thông báo hết thì nói liên tục mà không nói gì. Chỉ giữ rẽ thật + điểm đến.

**Thông báo 4 mốc** (500 / 200 / 80 / 40 m), mỗi mốc **một lần cho mỗi khúc rẽ** — `said` là Set khoá
theo `${index}:${stage}`, vì dừng đèn đỏ rồi nhích qua nhích lại không được làm nó đọc lại.

Khoảng cách đo **đường chim bay** tới toạ độ khúc rẽ, không đo dọc theo route: trong phố, trên một
route vốn đã bám đường, hai cách chênh nhau ít hơn mức tai nghe ra, còn cách đo dọc route phải đi hết
polyline **mỗi nhịp GPS**.

**Giọng nói dùng `speechSynthesis`, không dùng file audio thu trước.** Nửa quan trọng của một câu chỉ
dẫn là nửa **không thể thu sẵn**: tên đường và khoảng cách lúc này. Thư viện clip nói được "rẽ phải"
nhưng không bao giờ nói được "rẽ phải vào Nguyễn Thị Minh Khai", còn ghép số từ các mẩu rời là cách
các máy dẫn đường 20 năm trước phát ra tiếng. `speechSynthesis` lại miễn phí, chạy offline, có sẵn trên
cả hai nền tảng. Chỉ đọc **một** câu tại một thời điểm (`cancel()` trước mỗi câu): chỉ dẫn hết giá trị
trong vài giây, một hàng đợi đọc câu của khúc rẽ trước trong khi ngã tư đã lùi lại phía sau còn tệ hơn
im lặng.

## `npm run build` XANH không có nghĩa là trang render được

Prod chết toàn bộ — **mọi** route trả 500, kể cả `/sign-in` — sau một commit mà `tsc`, `lint` và
`next build` đều sạch.

Nguyên nhân: `PushSetup` đăng ký subscription qua một **mutation tRPC**, mà tôi mount nó cạnh
`RegisterMapCache` / `WarmMapAssets` / `PrimeHaptics` — ba cái này chỉ đụng API trình duyệt nên nằm
ngoài `<Providers>` là được. tRPC provider thì nằm **trong** `<Providers>`, nên `useMutation` không có
context để đọc và **throw ngay trong lúc server render mọi trang**.

```
Error: Unable to find tRPC Context. Did you forget to wrap your App inside `withTRPC` HoC?
  at Object.useMutation
```

**Vì sao build vẫn xanh:** những trang này render **theo từng request** (có kiểm đăng nhập), không
prerender lúc build. Lỗi runtime khi render thì build không bao giờ chạm tới. `tsc` cũng không thấy —
context React không phải chuyện của kiểu dữ liệu.

**Luật:** sau lần sửa cuối cùng, **khởi động lại server và gọi thật một trang**. Build xanh chỉ chứng
minh code biên dịch được. Câu lệnh tối thiểu:
```bash
npm run build && <restart> && curl -o /dev/null -w '%{http_code}\n' localhost:3987/sign-in
```

**Cách chẩn đoán nhanh khi prod 500:** phân biệt **API** với **trang**.
- API tRPC trả `401` (không phải 500) ⇒ router nạp được, backend sống ⇒ lỗi nằm ở tầng render.
- Trang trả 500 mà **body vẫn có `<title>` đúng** ⇒ shell đã render rồi mới throw ⇒ lỗi trong cây
  React, không phải ở middleware hay khâu dựng route.
Hai dấu hiệu đó khoanh vùng ngay, trước khi đọc một dòng code nào.

**Ranh giới cần nhớ khi thêm component vào root layout:** chỉ đụng API trình duyệt → ngoài
`<Providers>` cũng được; **gọi bất kỳ hook tRPC / react-query nào → bắt buộc nằm trong**.

## Web Push: thứ duy nhất tới được máy đang khoá — và cách duy nhất iPhone rung

Mọi cách gây chú ý khác trong app (rung, bíp, banner) đều cần **trang đang mở và đang chạy**. Push thì
do hệ điều hành giao, nên dùng đúng cài đặt chuông/haptic của người dùng — và vì WebKit không có
Vibration API, đây cũng là cách duy nhất làm iPhone rung thật.

⚠️ **Trên iOS chỉ hoạt động khi app đã được thêm vào Màn hình chính** (Safari cấp push cho web app đã
cài, không cấp cho tab). Không có đường nào lách từ phía trang, nên UI phải **nói ra điều đó** thay vì
để một cái switch thất bại im lặng.

Kiến trúc:
- `push-subscription` model — **một hàng mỗi thiết bị**, không phải mỗi người: ai có cả điện thoại lẫn
  laptop thì có 2 endpoint và mong cả hai đều báo. `endpoint` là danh tính (unique) nên đăng ký lại
  trên cùng máy là **update**, không sinh hàng mới.
- `sendPushToUser()` — best-effort, **không bao giờ** làm hỏng việc đã gọi nó. Endpoint trả **404/410**
  bị xoá ngay tại đó: đó là cách duy nhất biết trình duyệt đã quên subscription.
- Zod chặn khoá sai kích thước (`p256dh` 65 byte → 87–88 ký tự base64url, `auth` 16 byte → 22). Hàng
  sai kích thước **không bao giờ** gửi được — `web-push` chặn trước khi có request — nên nó sẽ nằm đó
  lỗi mãi mà không bao giờ nhận được cái 410 để bị dọn.
- `PushSetup` (root layout) **không bao giờ xin quyền**, chỉ đăng ký lại khi quyền đã có. Prompt bật
  lúc tải trang bị trả lời "không" theo phản xạ, và một cái "không" gần như là vĩnh viễn. Việc xin
  quyền nằm ở `PushPermissionRow` trong cài đặt bản đồ, **sau một cú bấm**, có câu giải thích trước khi
  hộp thoại hệ thống hiện ra.

Cần 2 biến môi trường (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) — thiếu thì tính năng
**tự tắt**: `push.available` trả false và switch tự ẩn, không có switch chết.

## iOS KHÔNG có Vibration API — `navigator.vibrate` là no-op trên mọi trình duyệt iPhone

Ping từ Android → Android rung đúng; Android → iOS chỉ hiện banner. Vì WebKit chưa bao giờ ship
Vibration API, và mọi trình duyệt trên iOS đều là WebKit. Repo này có 8 chỗ gọi `navigator.vibrate`
trực tiếp — tất cả đều vô hiệu trên iPhone.

`src/lib/haptics.ts` gom lại thành `buzz(pattern, { urgent })`, thử 3 tầng:

1. **Vibration API** — Android/Chrome. Đúng pattern, không cần cử chỉ.
2. **Switch haptic của iOS** — từ iOS 17.4, `<input type="checkbox" switch>` khi toggle sẽ phát một
   nhịp haptic, và toggle bằng script cũng vậy. Đây là **đường duy nhất** một trang web chạm được vào
   Taptic Engine. Element phải **thật sự nằm trong layout** — `display:none` thì không phát gì — nên
   nó nằm ngoài màn hình ở 1×1, `opacity:0`.
3. **Một tiếng bíp ngắn** (AudioContext, không cần file). Không phải haptic, nhưng là tín hiệu duy
   nhất chắc chắn hoạt động trên mọi iPhone. Chỉ dùng cho `urgent` và chỉ khi 2 tầng trên thất bại —
   bíp cho mọi ping nhỏ thì tệ hơn im lặng.

`primeHaptics()` chạy trong **cử chỉ đầu tiên** của phiên (`PrimeHaptics` mount ở root layout):
AudioContext tạo ngoài cử chỉ người dùng sẽ ở trạng thái suspended và **không resume lại được** trên
iOS, nên phải dựng sẵn từ lúc còn có cử chỉ trên stack.

⚠️ **Giới hạn phải nói thật:** iOS không cho trang web rung khi **không** có cử chỉ. Tầng 2 mạnh nhất
ngay sau một cú chạm, và có thể **không làm gì** khi ping tới lúc máy đang nằm im. Cơ chế duy nhất iOS
bảo đảm cho tình huống đó là **Web Push từ PWA đã cài** (iOS 16.4+) — cần service-worker push handler
+ VAPID key. Repo hiện **chưa có** Web Push.

## Đánh dấu chưa đọc: 4 vòng chụp mới ra bản dùng được

Ghi lại vì mỗi vòng đều sai theo một kiểu khác nhau, và chỉ **tự chụp lại** mới thấy:

| Vòng | Làm gì | Sai ở đâu |
|---|---|---|
| v1 | tô cả thẻ + viền trái 3px + chấm + đậm + vạch "MỚI" | cụm 8 dòng chỉ 2 mới mà tô hết → nói quá; cạnh thẻ trắng đọc ra **đục**; viền cắt góc bo; 4 tín hiệu là ồn |
| v2 | thẻ trắng + pill `N mới` + **tô đúng dòng mới** | peach chính là màu accent dùng khắp app (icon, link, nav active) ⇒ đọc ra **hover**, không ra "chưa đọc" |
| v3 | thay tô bằng **chấm tròn** + đậm | ô chấm chiếm 14px ⇒ tên bị cắt nặng hơn: "Sữa đậ…" |
| v4 | ô chấm **chỉ có ở thẻ có tin mới**, chấm nhỏ hơn, gap hẹp hơn | thẻ không có tin mới không mất chiều rộng nào — nhưng phụ đề vẫn chiếm 52% |
| **v5–v6** | ẩn phụ đề trên màn hẹp (`hidden sm:inline`) | **chốt.** Tên hiện đủ, chấm rõ, desktop vẫn có phụ đề |

Hai điều rút ra:
- **Màu accent không dùng được làm dấu "chưa đọc"** trong một app đã dùng accent cho mọi thứ. Chấm
  tròn là glyph quy ước (Gmail, iOS Mail, GitHub) và không cần giải thích.
- **Một mẩu chữ bị cắt cụt tệ hơn là không có.** Thu phụ đề từ 52% xuống 34% chỉ biến "Phường Bến
  Nghé, TP.HCM" thành "Phường B…" — chiếm một phần ba dòng và nói **không gì cả**.

## Modal chuyến đi: một điều kiện sinh ra ba triệu chứng

User báo 3 chuyện tưởng rời rạc: chọn "đi 1 mình / cùng nhau" xong **modal không đóng**; modal
**tự mở lại** vô lý; bấm **Kết thúc** cũng ra modal chẳng để làm gì. Tất cả từ **một** dòng:

```ts
const isManualTrip = !waypoints || waypoints.length === 0;   // trong goToLocation
if (isManualTrip && mobile) setTripChoiceOpen(true);
```

Suy "đây có phải cú Chỉ đường thủ công không" từ việc **có waypoint hay không**. Mà solo planner khi
người dùng **không chọn điểm dừng nào** thì cũng truyền `undefined` ⇒ vẽ lại đường bị tính là một cú
"Chỉ đường" mới ⇒ **mở lại đúng cái sheet vừa được chọn từ đó**. 1,2s sau `nav.start()` phủ toàn màn
lên, sheet nằm lại phía dưới; bấm Kết thúc, lớp phủ mất, sheet cũ lộ ra.

Ba thứ đã sửa:
- **`askChoice` là quyết định của người gọi**, không suy từ dữ liệu. Chỉ nút "Chỉ đường" trên thẻ
  truyền `{ askChoice: true }`.
- **`closeTripDialogs()`** đóng cả `tripChoiceOpen`, `showCompanionChoice`, `soloPlanOpen`,
  `stopPickerOpen` và xoá `plannedStops`. Gọi trong `resetTrip()` **và** khi `nav.isNavigating` bật.
  Trước đó mỗi modal chỉ được đóng bởi kẻ mở modal kế tiếp — sót cái nào thì cái đó nằm lại dưới lớp phủ.
- **Bỏ `setTimeout(..., 1200)`** để khởi hành. 1,2s là *đoán* thời gian định tuyến: nhanh hơn thì map
  nhảy trước khi có đường, chậm hơn thì bắt đầu đi mà **không có đường nào cả**. Nay `routePending`
  mang nghĩa thật cho mọi caller, và một effect khởi hành khi request xong — kèm khả năng **từ chối
  khởi hành nếu định tuyến lỗi**, điều mà timer không làm được.

**Luật:** đừng suy ý định của người dùng từ hình dạng dữ liệu (`có waypoint?`, `initial truthy?`).
Ý định thì truyền thẳng bằng tham số hoặc ghi bằng cờ. Hai lỗi nặng nhất trong repo này —
[toạ độ bị vứt lúc tạo](#) và cái này — cùng một kiểu sai.

## Vẽ đường: không vẽ vệt đã đi, và đường chỉ đường cần viền

Vệt "đã đi" (`traveled`) được vẽ `#4f46e5` dày 8px **opacity 1**, đè lên chính con đường nó thuộc về
— hai màu xanh đánh nhau, và cái quan trọng hơn (đi đâu tiếp) lại là cái nhạt hơn. Đã bỏ hẳn: nơi
mình **đã** đi qua là thứ duy nhất người đang dẫn đường không cần được nhắc. Bỏ luôn phần tích luỹ
trong hook (mỗi nhịp GPS đẩy thêm một điểm vào array).

Đường chỉ đường nay là **2 lớp**: casing tối (`#1e3a8a`) dưới lõi sáng (`#3b82f6`), cả hai
`line-width` theo `interpolate` của zoom (10→4px, 14→9px, 18→14px cho lõi). Một lớp nhạt ở opacity
0.8 lấy màu lẫn từ thứ nó đi qua — đường, nước, công viên — nên **nhạt đi đúng lúc bản đồ rối nhất**.
Casing cho nó một đường biên riêng, đó là cách mọi app bản đồ vẽ route, và nhờ vậy lõi mới dám đặc và
sáng hẳn.

⚠️ Chưa nghiệm thu được bằng hình: `STADIA_API_KEY` không có ở máy dev nên `getRoute` luôn lỗi, không
vẽ được đường để chụp. Bản maplibre trong repo cũng không expose `style-spec` để validate biểu thức
offline. Ai có key thì chụp lại một lần.

## Đã đọc / chưa đọc: mốc đọc phải được ĐỌC TRƯỚC khi bị dịch

Feed gọi `markSeen` ngay khi mount (đó là cách badge tắt), nên nếu render dựa vào mốc **hiện tại** thì
mốc vừa bị dịch lên `now` ⇒ **không có gì là mới**, và người dùng không bao giờ thấy cái nào chưa đọc.

Cách làm (giống GitHub/Slack): `markSeen` trả về **mốc cũ** (`previousSeenAt`), client **đóng băng** giá
trị đó cho cả lượt xem. `undefined` = chưa biết (chưa đánh dấu gì, để tránh loé "tất cả đều mới");
`null` = chưa từng mở feed ⇒ mọi thứ của người kia là mới.

### Đánh dấu phải nằm ĐÚNG trên thứ nó nói về

Bản đầu tô cả thẻ (`bg-accent-soft/40` + viền trái 3px + chấm + chữ đậm + vạch "MỚI"). Tự chụp lại thì
thấy sai hai lần: một cụm 8 dòng mà chỉ 2 dòng mới bị tô **peach toàn bộ** — nói quá về lượng cái mới;
và đặt cạnh các thẻ trắng thì khối peach đó đọc ra **đục** chứ không ra quan trọng. Viền 3px còn cắt
ngang góc bo của thẻ. Bốn tín hiệu xếp chồng là ồn, GitHub/Slack chỉ dùng 1–2.

Bản sau: **thẻ để trắng như mọi thẻ**, và dấu đặt đúng chỗ:
- **pill `N mới`** cạnh tiêu đề — cho biết *bao nhiêu*, đó mới là thứ quyết định có mở ra xem hay không;
- **tô đúng dòng mới** (`bg-accent-soft/70`) + in đậm. Một cụm là cả một loạt cùng loại cùng người, nên
  "người kia đã lưu 8 địa điểm" có thể chứa 6 dòng đọc hôm qua và 2 dòng mới một phút trước.

Bỏ: nền cả thẻ, viền trái, vạch "MỚI". Đã nghiệm thu bằng hình ở cả 390px và 1440px.

**Không đánh dấu hoạt động của chính mình** — việc mình vừa làm 30 giây trước không phải tin mới, và
`unreadCount` ở server cũng đếm theo đúng nguyên tắc đó.

## Toạ độ bị VỨT ĐI lúc tạo — vì so sánh tham chiếu object

Triệu chứng user báo: chọn điểm trên bản đồ, lưu thành công, nhưng **không có nút Chỉ đường**, và
mở Sửa thì ghi **"chưa có vị trí trên bản đồ"**. Tức bản ghi thật sự không có `geo`.

Thủ phạm là đúng một dòng ở `location-form.tsx`:

```ts
geo: (initial && v.googleMapsUrl !== initial.googleMapsUrl && v.geo === initial.geo)
  ? undefined : (v.geo ?? undefined)
```

Ý định ban đầu đúng: **sửa** một chỗ đã có, đổi link mà không đụng pin ⇒ gửi `undefined` để server
suy lại pin từ link mới. Nhưng ba vế đều đúng **trong lúc TẠO**:

- `initial` là `{}` — **object rỗng vẫn truthy**, nên vế 1 luôn đúng kể cả khi tạo mới.
- `v.googleMapsUrl !== initial.googleMapsUrl` → `"link" !== undefined` → đúng.
- `v.geo === initial.geo` → **cùng MỘT object**: chạm bản đồ gọi `setFormInitial(p => ({...p, geo}))`,
  rồi effect đồng bộ gán chính tham chiếu đó vào `v.geo`. So sánh "người dùng có đụng pin không"
  bằng `===` giữa hai biến vốn trỏ cùng chỗ thì **luôn ra "không đụng"**.

⇒ Người dán link (link hỏng) → chạm bản đồ để tự đặt pin → form gửi `geo: undefined` → server đi
giải lại đúng cái link vừa hỏng → **mất sạch toạ độ duy nhất đang có**.

**Luật:** "người dùng có đụng vào field này không" phải **ghi lại bằng cờ** (`geoTouched` ref), đừng
suy ra bằng cách so sánh giá trị — nhất là so sánh tham chiếu với chính cái biến đã copy sang.
Và điều kiện chỉ dành cho edit thì phải kiểm `v.id`, đừng dựa vào `initial` truthy.

Đã chứng minh test biết fail: hoàn nguyên đúng dòng đó, build lại, chạy cùng một probe →
`geo = None`; áp lại bản sửa → `geo = {10.7839825, 106.7009}`.

Bản ghi cũ lỡ mất toạ độ nay hiện nhãn **"Chưa có vị trí"** trên thẻ, để tìm ra mà đặt lại pin —
vì thẻ không có `geo` thì cũng không có nút Chỉ đường, và nếu không nói gì thì trông y như lỗi.

### Sheet thu gọn giấu mất hàng nút

Đo trên 390×844: ở mức thu gọn (`STOPS[0] = 0.16`), khung cuộn của sheet chỉ cao **87px** (681→768),
còn hàng nút của thẻ nằm ở **y=822** — dưới cả mép màn hình. Kéo lên 1 mức là thấy. Nên "lưu xong mà
không thấy Chỉ đường" còn có một nửa nguyên nhân là **không nhìn thấy**, không phải không tồn tại.
`expandSignal` nâng sheet lên mức giữa sau khi lưu, và cuộn body về đầu (danh sách sắp mới-nhất-trước
nên chỗ vừa thêm nằm trên cùng).

## Class Tailwind trỏ vào token KHÔNG TỒN TẠI thì im lặng, không lỗi

`text-destructive-foreground` được dùng ở 2 nơi, mà `--destructive-foreground` **chưa bao giờ được
khai báo** trong `globals.css`. Class vẫn sinh ra `color: var(--destructive-foreground)` — biến rỗng
⇒ chữ **kế thừa màu của nền xung quanh**. Hậu quả: badge số thông báo ra **chữ đen trên nền đỏ**, và
nút xoá ảnh trong `memory-form` thì icon **tàng hình khi hover**.

Không có cảnh báo nào từ build, lint hay tsc. Cách kiểm: `grep -- "--<tên>:" globals.css` trước khi
dùng một class `text-*-foreground`, hoặc grep trong CSS đã build.

Badge số dùng cặp token **riêng** (`--badge: #ef4444` / `--badge-foreground: #fff`), không dùng chung
`--destructive`: badge cần độ bão hoà cao để đọc được ở 18px trên nav, còn `--destructive` được chọn
cho chữ cảnh báo dễ đọc — chỉnh sáng nó lên sẽ âm thầm hạ tương phản của mọi thông báo lỗi.

## Không bao giờ dội JSON của Zod vào mặt người dùng

Toast người dùng chụp lại được:

```
Lưu thất bại: [ { "origin": "string", "code": "too_small", "minimum": 1,
"inclusive": true, "path": [ "district" ], "message": "Too small: expected
string to have >=1 characters" } ]
```

Đúng từng chữ, và **không câu nào** cho biết là thiếu khu vực. Nguyên nhân: `onError` in thẳng
`err.message`, mà tRPC chuyển nguyên `issues` của Zod thành chuỗi JSON.

`readableFormError()` (`src/lib/form-error.ts`) dịch sang tên field **người ta nhìn thấy trên form**
(`district` → "Khu vực", `category` → "Loại địa điểm"…) ⇒ chuỗi trên thành **"Thiếu khu vực"**.
Chuỗi không bắt đầu bằng `[` thì trả về nguyên văn (vd `UNAUTHORIZED`), không đoán bừa.

Hai luật đi kèm:
- Field nào **hệ thống suy được** (khu vực suy từ toạ độ) thì đừng bắt người dùng điền — suy ở handler.
- Field nào **chỉ người dùng biết** (loại địa điểm) thì chặn **ở client** kèm câu nói rõ, đừng để rơi
  xuống server rồi trả về lỗi validate. Nút lưu trước đây chỉ chặn khi thiếu tên ⇒ thiếu loại địa điểm
  là lọt xuống và vỡ đúng kiểu cũ.

**Cập nhật 04/09/2026 — luật này từng chỉ áp cho ĐÚNG MỘT file.** Nó được viết sau sự cố
"district", sửa `location-form.tsx`, rồi dừng ở đó. Bốn tháng sau người dùng chụp lại một bức
tường JSON y hệt, lần này từ form kỷ niệm. Quét ra **48 chỗ** in thẳng `err.message` vào toast —
kể cả một chỗ trong chính `location-form.tsx`. Nay đã bọc `readableFormError()` toàn bộ; câu kiểm
để không tái phát:

```bash
grep -rn "toast(\|setRedeemError(" src/ | grep "\.message" | grep -v "readableFormError"   # phải rỗng
```

Bài học chung: **viết luật mà chỉ sửa chỗ vừa cháy thì luật đó chưa được thi hành.** Sửa xong một
ca thì quét cả repo tìm anh em cùng họ, rồi để lại câu grep làm bằng chứng kiểm tra được.

Hai điểm helper phải xử đúng, phát hiện khi làm việc này:
- Lấy **đoạn CUỐI** của `path`, không phải đoạn đầu. `["photos", 0, "caption"]` mà lấy đoạn đầu thì
  báo "photos chưa hợp lệ" — chỉ sai chỗ. Lấy đoạn cuối ra "Lời kể", đúng ô cần sửa.
- Có số trong `path` nghĩa là field nằm trong danh sách ⇒ nói rõ **mục thứ mấy**, không thì người
  dùng có 30 ảnh mà không biết ảnh nào.
- Tên biến bắt lỗi trong repo này không thống nhất (`err`, `_err`, `_e`, `error`, `res.error`).
  Quét theo tên biến sẽ sót; quét theo `toast(... .message` rồi loại chỗ đã bọc mới đủ.

## API phải nhận lại được CHÍNH CÁI NÓ VỪA NHẢ RA

Triệu chứng người dùng gặp: tạo kỷ niệm mới thì bình thường, **sửa** kỷ niệm cũ thì
`photos.0.caption: expected string, received null`.

Nguyên nhân là một vòng tròn không khép:

| Chiều | Hình dạng |
|---|---|
| đọc ra (`toItem`) | `caption: p.caption \|\| null` · `width: p.width ?? null` |
| form giữ | nguyên si object vừa đọc (`useState(initialMemory.photos)`) |
| gửi lên | `z.string().optional()` ⇒ **null bị từ chối** |

Vậy nên nó **chỉ vỡ ở lần chạm thứ hai** vào một bản ghi. Test tạo-mới chạy xanh mãi mãi.

Ba luật rút ra:

1. **Schema đầu vào phải nhận được đúng shape mà đầu ra phát ra.** Nếu `toItem` nhả `null` cho
   field trống thì input phải `.nullish()` rồi chuẩn hoá về `undefined` — helper `emitted()` trong
   `routers/memory.ts`. Đừng bắt client phải dọn dẹp thứ chính server vừa đưa cho nó.
2. **TypeScript không cứu được, vì kiểu khai bị hẹp hơn sự thật.** `initialMemory.photos` khai là
   `{url, publicId}[]` trong khi API trả thêm `caption/width/height` toàn `null`. Kiểu hẹp hơn thì
   vẫn gán được ⇒ compiler im. Khai kiểu **đúng bằng cái API trả về** (`caption?: string \| null`),
   rồi chuẩn hoá lúc nạp vào state — có vậy compiler mới chỉ ra chỗ lệch.
3. **Test phải đi hết vòng: tạo → đọc → nhét NGUYÊN SI cái vừa đọc vào sửa.** Đây là test duy nhất
   bắt được lớp lỗi này, và nó rẻ. Bản trong `scratchpad/roundtrip.mjs` tái hiện đúng lỗi trên code
   cũ rồi xanh trên code mới.

Cùng họ, chưa từng nổ nhưng đã vá sẵn: ảnh up từ **trước khi có `width/height`** cũng bị nhả ra
`null` ⇒ sửa kỷ niệm chứa ảnh đời đầu sẽ vỡ y hệt.

**Một test chưa từng thấy màu đỏ thì chưa phải test.** Trước khi tin bản vá, `git stash` nó đi rồi
chạy lại test — phải thấy đúng thông báo lỗi người dùng đã chụp. Sao lưu file ra ngoài repo trước
khi đụng vào git.


## Trạng thái chuyến đi: đừng bắt người dùng khai thứ hệ thống đã biết

Yêu cầu ban đầu là "cho quick action ra ngoài, thêm trạng thái đang chuẩn bị / đang diễn ra".
Nhưng gốc rễ nằm chỗ khác: **chuyến đi đã có `startDate` và `endDate`** — hệ thống thừa sức biết
hôm nay có đang trong chuyến hay không, vậy mà vẫn bắt người dùng mở modal cài đặt để *nói cho nó
biết điều nó đã biết*.

Ba luật rút ra:

1. **Field nào suy được từ dữ liệu sẵn có thì đừng hỏi.** `tripStatus()` trong
   `src/lib/trip-status.ts` so ngày, không hỏi ai. Trang chủ hiện khối chuyến khi **hôm nay nằm
   trong khoảng ngày**, KHÔNG chờ ai bật cờ — cặp đôi đang trên đường mà quên bật công tắc chính
   là ca mà màn hình đó phải đúng nhất.
2. **ĐI HẾT ĐƯỜNG — 04/09/2026 bỏ luôn phần đổi tay.** Bản đầu tôi giữ trạng thái lưu trong DB
   cộng một lời mời (`tripNudge`) khi ngày và trạng thái lệch nhau. Chủ sản phẩm bảo bỏ hẳn:
   *"đã chọn khung giờ đi rồi mà"*. Đúng — nửa vời còn tệ hơn cả hai đầu: vẫn có hai nguồn sự
   thật để lệch, cộng thêm một cơ chế đi hoà giải chúng.

   Nay **không có trường `status` trong DB nữa**. `serialize()` suy từ `startDate`/`endDate` mỗi
   lần đọc. Không migration: bản ghi cũ còn khoá `status` thừa, không ai đọc tới — đã kiểm bằng
   cách nhét thẳng vào Mongo một chuyến `status:"completed"` mà ngày đang trong khoảng, đọc ra
   `active`. Đã gỡ: `trip.setStatus`, `TripStatusChips`, `TripNudgeBar`, `normaliseTripStatus`,
   `tripNudge`, và cả file `trip-status-control.tsx`.

   Lợi thêm mà bản có-lưu không có: trạng thái **không bao giờ cũ**. Chuyến thành "đang đi" lúc
   0h ngày khởi hành mà không cần ai mở app.
3. **Trạng thái trùng nghĩa thì gộp, đừng thêm.** "Lên kế hoạch" và "Sắp đi" đều nghĩa là *chưa đi*
   — một ô cho một phân biệt không ai làm. Bộ mới vẫn 3 giá trị: `planning` / `active` / `completed`.

**Di trú không cần migration.** `"upcoming"` đời cũ được `normaliseTripStatus()` gộp về `planning`
**lúc đọc**, và enum trong model vẫn giữ `"upcoming"` để bản ghi cũ còn lưu lại được. Không có
lệnh UPDATE nào chạy trên dữ liệu thật; bản ghi tự đúng khi lần sau được lưu.

### Ba cái bẫy đã sập khi làm việc này

- **`trip.create` chỉ trả `{ id }`** trong khi `update`/`setStatus` trả nguyên chuyến. Đọc
  `.status` trên kết quả create được `undefined` mà **không có lỗi nào** — im lặng, đúng kiểu
  nguy hiểm nhất. Nay cả ba trả cùng một hình dạng.
- **Đặt tuyệt đối chồng lên nhau.** Tên chuyến trong ô lịch từng là `absolute left-1.5 top-2` —
  đúng chỗ vòng tròn "hôm nay". Chuyến khởi hành đúng hôm nay sẽ in tên đè lên số ngày. Cho nó
  **chảy trong hàng flex** cạnh số ngày thì hai thứ không bao giờ đè nhau được nữa.
- **"Tiếp theo: X" rồi ngay dưới là danh sách chỉ có mỗi X.** Dòng dẫn chỉ có nghĩa khi có thứ để
  chọn ra *từ đó*; chỉ hiện khi còn từ 2 việc trở lên.

### Kiểm thử: 3 cái làm test xanh giả

Đã trả giá đủ ba lần trong một buổi:

1. **`npm run build` rồi bật `next dev` trên cùng thư mục build** ⇒ dev server trả **404 cho
   `_next/static/chunks/*`**, trang không hydrate, mà **không có exception nào** — nhìn y hệt
   "đang tải chậm". Xong build thì phải khởi động lại dev server.
2. **Driver CDP vứt hết message không có `id`** nên mọi lỗi console bị nuốt. Trang chết vì JS
   trông không khác gì trang tải chậm. Phải nghe `Runtime.exceptionThrown` + `Log.entryAdded`.
3. **Chờ theo đồng hồ thay vì theo điều kiện.** `setTimeout(1400)` đủ cho trang thứ hai nhưng
   không đủ cho lần biên dịch đầu. Và `goto` chờ chữ "Đang tải…" biến mất thì **vô dụng ở trang
   không bao giờ có chữ đó** — nó trả về ngay khi React chưa vẽ, rồi test báo "không tìm thấy
   nút" cho một tính năng hoạt động hoàn hảo. Luôn chờ **đúng phần tử mình sắp đo**.

Thêm hai chuyện về môi trường:
- Trang chủ khi đã đăng nhập là **`/home`**, không phải `/` (`/` là trang giới thiệu).
- better-auth đặt **2 cookie** (`session_token` + `session_data`). Nạp thiếu một cái là rơi về
  trang giới thiệu, và test sẽ đo nhầm trang.
- Đóng tab CDP sau mỗi lượt (`/json/close/<id>`), không chỉ đóng WebSocket. 17 tab tồn đọng làm
  Chrome treo hẳn lượt sau.
- Tài khoản mới bị **modal chào mừng che kín màn hình** — đặt `localStorage["dwy:welcomeSeen"]="1"`
  trước khi chụp.


## Mention nhìn ra là mention: vì sao KHÔNG dùng contenteditable

Yêu cầu: tên trong caption phải hiện màu, và xoá thì xoá nguyên tên chứ không từng chữ.

**`<textarea>` không tô màu được một phần chữ của chính nó** — không nhét được phần tử nào vào
trong. Có đúng ba đường:

| Cách | Được | Mất |
|---|---|---|
| `contenteditable` + chip `contenteditable="false"` | chip thật, xoá nguyên khối | **gõ tiếng Việt** |
| Lớp phủ: vẽ vệt màu SAU một ô nhập trong suốt | ô nhập vẫn là ô nhập thật | vệt chỉ là nền, không đổi màu chữ |
| Trình soạn thảo (Lexical/Tiptap/Slate) | đủ thứ | nặng, và vẫn dính đúng lỗi IME bên dưới |

**Chọn lớp phủ, và lý do là bộ gõ tiếng Việt.** Telex/UniKey soạn một chữ qua nhiều phím và **tự
xử lý Backspace giữa chừng**; mỗi lần React vẽ lại một vùng `contenteditable` là node văn bản mà
IME đang giữ biến mất ⇒ tài liệu ghi nhận **mất dấu, đảo dấu, con trỏ nhảy về đầu ô**. Không ai gõ
nổi "kỷ niệm" trong đó. `<textarea>` thật giữ nguyên IME, bàn phím điện thoại, dán, hoàn tác.

**Chữ vẫn hiện, chỉ có nền là của lớp dưới — và đây là lý do ĐO ĐƯỢC, không phải phỏng đoán:**
- Lo ban đầu "lớp nền không bám kịp lúc đang soạn" là **SAI**: đo bằng `Input.imeSetComposition`
  thấy nó bám từng bước `k → ky → kyr → kỷ`.
- Cái chặn thật là **`caret-color` hỏng trên iOS Safari** (không nhận màu đặt, không cập nhật khi
  CSS đổi lúc đang gõ). Muốn tô màu chữ thì phải cho chữ của ô nhập trong suốt, mà `caret-color`
  mặc định là `currentColor` ⇒ **con trỏ tàng hình trên iPhone**. Đổi một chút màu lấy việc người
  ta không thấy mình đang gõ ở đâu là lỗ vốn.
- Nên: trong ô nhập là **vệt nền**; ở phần ĐỌC (`MentionText`) không có ô nhập nào bên dưới nên
  chữ mang màu accent + in đậm thoải mái.

### Xoá nguyên tên mà KHÔNG tự sửa chuỗi

`onKeyDown` chỉ **chọn** cả tên rồi **để trình duyệt tự xoá** vùng chọn — không `preventDefault`,
không `setState` tay. Nhờ vậy `Ctrl+Z` vẫn hoàn tác được và thay đổi vẫn đi qua `onChange` như mọi
lần gõ khác. Tự cắt chuỗi rồi set lại là giết luôn undo stack của trình duyệt.

**Phải bỏ qua khi `isComposing`.** Telex gửi Backspace như một phần của việc viết chữ; nuốt phím đó
là làm hỏng việc gõ chứ không phải xoá nhầm.

### Hai lớp phải khớp TUYỆT ĐỐI, và cái bẫy 6px

Lớp vẽ và ô nhập dùng **chung một chuỗi class** (`TEXTAREA_CLASS`), vì lệch một chút là vệt màu
trôi khỏi tên khi caption xuống dòng.

Bẫy đã sập: **`<textarea>` mặc định là `inline-block`**, nên thẻ bọc nó cao hơn chính nó **6px**
(khoảng đệm dòng bên dưới). Lớp vẽ căng theo thẻ bọc ⇒ cao hơn ô nhập ⇒ mọi vệt ở dòng sau lệch
dần. Thêm `block` là hết. Cách kiểm rẻ và chắc:

```js
Math.abs(back.scrollHeight - ta.scrollHeight) <= 1     // xuống dòng giống hệt
["fontFamily","fontSize","lineHeight","letterSpacing","padding","borderWidth","whiteSpace"]
  .filter(k => getComputedStyle(ta)[k] !== getComputedStyle(back)[k])   // phải rỗng
```

Lớp vẽ giữ nguyên `background` của caller (nó mới là lớp sơn nền thật), chỉ bỏ màu chữ và màu
viền; ô nhập nằm trên với `bg-transparent`.

### `data-mention` — mốc để bám, đừng bám vào class

Cả hai nơi đánh dấu tên đều gắn `data-mention`. Trước đó test lọc theo `className.includes(...)`,
đổi một lớp Tailwind là test báo "0 vệt" cho tính năng chạy hoàn hảo.

### Dọn dữ liệu test: better-auth HẠ THƯỜNG HOÁ email

Lần dọn đầu in ra **"còn sót: 0"** trong khi **18 tài khoản test vẫn nằm nguyên trong DB** — regex
của tôi có `mA|fB|pA` mà email lưu xuống là `ma...`, `fb...`, `pa...`. Lọc email thì **luôn**
không phân biệt hoa thường, và đừng tin câu "đã sạch" của chính mình: đếm lại tổng số user và
liệt kê những cái KHÔNG khớp mẫu để biết mình vừa bỏ sót ai.


## "Người kia chưa mở Bản đồ" — bốn lớp của cùng một lỗi

Cả hai đã mở bản đồ, mà mỗi người vẫn thấy một bản đồ trống và một câu báo rằng người kia chưa mở.
Không phải một bug, mà là **bốn chốt chặn nối tiếp**, mỗi cái tự nó đủ để gây ra đúng triệu chứng:

| # | Chốt | Hậu quả |
|---|---|---|
| 1 | Vòng ping có `if (!isNavigating) return` | Mở bản đồ **không ghi gì**; chỉ bấm dẫn đường mới ghi |
| 2 | Trang bản đồ lấy 1 fix rồi để trong state | Vị trí có sẵn nhưng **không gửi đi đâu** |
| 3 | Chỉ biết người kia qua **phản hồi của chính mình** | Máy nào ngừng ghi thì cũng ngừng nghe |
| 4 | `partnerLocation={isCompanionTrip ? … : null}` | Có dữ liệu vẫn **cố ý không vẽ** trừ khi đang đi chung |

**Câu chữ trong app chính là hợp đồng.** "Người kia chưa mở Bản đồ nên chưa thấy vị trí" đã nói
rõ *mở bản đồ là chia sẻ*. Code chưa bao giờ làm thế. Sửa ở đây là **thực hiện đúng lời đã hứa**,
không phải mở rộng phạm vi thu thập vị trí.

### Ba luật rút ra

1. **Đừng chỉ học được về người khác qua phản hồi cho hành động của mình.** Luồng SSE đã đọc bảng
   `livelocations` mỗi giây rồi **vứt vị trí đi**, chỉ lấy "cái chọc". Nay nó đẩy vị trí — và chỉ
   khi `updatedAt` đổi, không thì mỗi giây một gói cho người đang ngồi yên.
2. **Một cờ đừng trả lời hai câu hỏi.** `isCompanionTrip` vừa quyết định "có vẽ tuyến/HUD của người
   kia không" (đúng — đây là thứ đã sửa bug *đi 1 mình mà hiện UI 2 người*), vừa quyết định "có
   biết người kia ở đâu không" (sai). Tách ra: chấm hiện khi biết vị trí, **và biến mất trong suốt
   chuyến ai đó chọn đi một mình**. Sửa kiểu gỡ luôn `isCompanionTrip` là tái tạo bug cũ.
3. **Rời tab không phải là biến mất.** Tab ẩn bị bóp còn ~1 nhịp/phút, mà cửa sổ tươi là 5 phút nên
   vẫn sống. Thứ phải thêm là **ping ngay khi quay lại** (`visibilitychange`), đừng bắt người ta
   chờ hết chu kỳ mới được nhìn thấy. Đo được: quay lại tab → ghi nhận lại trong dưới 3 giây.

Nhịp: dẫn đường 2.5s (độ chính xác cao), **chỉ mở bản đồ 15s** với fix thô, cache 30s — đủ giữ
trong hạn 5 phút mà không đánh thức GPS liên tục trong túi quần.

### Kiểu của context phải SUY RA từ hook

`NavigationInvitesContextValue` là bản chép tay của thứ hook trả về, nên thêm gì vào hook cũng vô
hình ở context cho tới khi nhớ ra phải sửa hai nơi — đúng chỗ vị trí người kia đi tới rồi tắc.
Nay `type … = ReturnType<typeof useNavigationInvites>`.

### Kiểm thử 2 người: MỘT trình duyệt là MỘT người

Bài học đắt nhất buổi này. Mở 2 tab rồi `Network.setCookie` cho từng tab ⇒ **cookie dùng chung cả
profile**, tab sau ghi đè tab trước, **cả hai tab thành cùng một người**. Test chạy xanh/đỏ đều vô
nghĩa. Phải dùng `Target.createBrowserContext` (kho cookie riêng, như hai máy). Kèm theo:
`Browser.grantPermissions` **bắt buộc** truyền `browserContextId`, không thì cấp cho ngữ cảnh mặc
định và trang mới vẫn bị từ chối GPS.

Và: **dòng in ra không phải là khẳng định.** Hai dòng `console.log` in `null` từng nằm giữa một
loạt dấu ✓ khiến bản chạy trông như đã chứng minh phần thời gian thực — trong khi nó chưa kiểm gì
cả. Muốn chắc "đẩy chứ không phải tự hỏi" thì phải nghe ké đúng kết nối SSE của app
(`Page.addScriptToEvaluateOnNewDocument` bọc `EventSource`) rồi **khẳng định** trên số sự kiện đó.


## Badge thông báo trên Android: hệ thống VỨT MÀU, chỉ giữ kênh alpha

Thông báo hiện ra với **ô vuông trắng phau** ở góc trái. Nguyên nhân: `sw.js` dùng
`badge: "/icon-192.png"` — mà `icon-192.png` là **RGB, không có kênh trong suốt**, mọi điểm ảnh đều
đục. Android lấy badge làm **mặt nạ**: giữ alpha, vứt màu, rồi tô lại bằng màu hệ thống. Ảnh đục
toàn phần ⇒ mặt nạ là hình vuông đặc ⇒ ô trắng.

- `icon` là icon lớn bên phải — **màu mè thoải mái**, cái này vẫn hiện đúng.
- `badge` là icon nhỏ trên thanh trạng thái — **bắt buộc là bóng đổ trên nền trong suốt**, 96×96,
  glyph chiếm gần hết khung (Material để glyph ~24dp có lề ~2dp).
- iOS bỏ qua `badge` hoàn toàn và dùng icon app, nên sửa cái này không mất gì bên đó.

Cách kiểm rẻ, không cần điện thoại:
```python
a = list(Image.open(f).convert("RGBA").split()[-1].getdata())
đục = sum(1 for v in a if v > 200) / len(a)     # ~1.0 => Android sẽ vẽ ô vuông
```

**Không có công cụ dựng SVG thì dùng chính Chrome.** Nạp SVG bằng `data:text/html`, rồi
`Page.captureScreenshot { omitBackground: true }`. Lưu ý: **`omitBackground` một mình chưa đủ trên
headless** — phải gọi `Emulation.setDefaultBackgroundColorOverride { color:{r:0,g:0,b:0,a:0} }`
trước, không thì trang bị tô trắng rồi mới chụp và ảnh ra đục 100%.

## Nút nổi đè nhau: đừng đoán chiều cao, hãy ĐO nó

Nút "Về vị trí của tôi" (`absolute bottom-4`, nằm trong component bản đồ) đè lên thanh Tạm dừng /
Kết thúc (lớp phủ `absolute inset-x-0 bottom-0`, do trang vẽ đè lên bản đồ). Hai bên **không phải
tổ tiên của nhau** nên không truyền prop xuống được, và chiều cao thanh **không phải hằng số**:
banner "đang tính lại đường", dải tiến độ chặng, dòng báo lỗi đều lúc có lúc không.

Cách làm: thanh tự đo mình bằng `ResizeObserver` (dùng `getBoundingClientRect().height` — **không**
dùng `contentRect`, vì thanh có `p-4` cộng `env(safe-area-inset-bottom)`), rồi công bố
`--nav-dock-h` lên `documentElement`; nút đọc `bottom: calc(var(--nav-dock-h, 0px) + 1rem)`.
Cùng dạng dữ kiện với safe-area inset: thứ cả trang biết, và mọi thứ vẽ sát mép dưới đều cần.

Đo được: trước khi sửa nút ở 787–828 chồng lên thanh 784–828 (**41px**) ở cả 390px lẫn 1280px; sau
khi sửa hở 32px, biến CSS đọc ra 76px.

### Vào được trạng thái dẫn đường để test

Luồng thật: **Chỉ đường → Lên lộ trình → Bắt đầu đi** (không có bước "Đi 1 mình" khi space chỉ có
một người). Và:

**`element.click()` KHÔNG tạo user activation.** `nav.start()` cần nó (wake lock, âm thanh), nên
bấm bằng script thì hai bước đầu chạy mà bước cuối im lặng không làm gì. Phải dùng
`Input.dispatchMouseEvent` cho bước đó. Khi bấm bằng chuột thật thì phải `scrollIntoView` **rồi
chờ cuộn ổn định mới đọc `getBoundingClientRect`** — đọc trước khi cuộn xong là bấm trượt ra nền,
và triệu chứng giống hệt "không tìm thấy nút".


## Gọi tên người kia, đừng gọi "Người kia"

Space chỉ có hai người **đã mời nhau vào**, nên gọi nhau bằng "Người kia" là cách duy nhất trên
màn hình khiến người quen nghe như người lạ. Nay dùng tên họ đăng ký (hoặc biệt danh space đặt).

`usePartner()` / `usePartnerName()` trong `src/features/space/use-partner.ts` là nơi duy nhất
quyết định "ai là người kia".

**Đọc `isSelf` của server, ĐỪNG so với session ở client.** `locations-page` từng làm
`members.find(m => m.id !== session?.user.id)` — trong khoảng thời gian session chưa về,
`session?.user.id` là `undefined` nên **thành viên ĐẦU TIÊN, kể cả chính mình, được nhận là người
kia**. Server đã trả sẵn `isSelf`; dùng nó thì không có khoảng trống đó.

### Chỗ PHẢI giữ chung chung

Không phải quét sạch mọi chỗ. Ba loại phải giữ nguyên:
- **Fallback** (`m?.name ?? "Người kia"`) — vẫn cần, cho lúc chưa tải xong hoặc space một người.
- **Tour lần đầu** (`welcome-intro`) — chạy khi có thể chưa có ai trong space.
- **Trang giới thiệu** cho khách chưa đăng nhập — không có "người kia" nào để gọi tên.

### Đổi chữ thì phải đổi cả dependency array

18 câu trên `locations-page` chuyển sang tên thật, và 4 `useEffect`/`useCallback` đọc tên đó **thiếu
`partnerName` trong deps**. Không thêm thì tên về muộn hơn lần memo hoá đầu ⇒ câu chữ đóng băng ở
"Người kia" đúng những lần hiếm, khó lần ra nhất. `npm run lint` bắt được cả 4 — cảnh báo
`exhaustive-deps` ở đây là lỗi thật, không phải nhiễu.

### Ghi lại: lỗi hydration CÓ SẴN (chưa sửa)

Trong lúc kiểm phát hiện `Hydration failed…` trên `/home`, `/vault`, `/map`. **Đã xác minh không
phải do thay đổi này**: `git stash` hết rồi chạy lại trên HEAD vẫn y nguyên lỗi đó. Hai nguyên nhân
console chỉ ra:
- `<noscript>` là con trực tiếp của `<html>` trong `RootLayout`
- `<div>` nằm trong `<p>` — `HomeGreeting` bọc `<Skeleton>` (render ra `div`) trong `<p>`

Hệ quả: React vứt HTML dựng sẵn từ server và vẽ lại toàn cây ở client mỗi lần tải trang.

**Luật chung:** thấy lỗi trong lúc test thì phải xác định nó có sẵn hay do mình, bằng cách lùi code
về HEAD chạy lại — đừng mặc định là mình gây ra, cũng đừng mặc định là không.


## Tên trên màn hình chính: `short_name` VÀ thẻ của Apple, hai nơi

Cài web về máy thì lối tắt hiện **"Vivu"** — trùng tên một web khác, không phải sản phẩm này. Tên
lối tắt KHÔNG lấy từ `name` của manifest mà từ:

| Nền tảng | Đọc ở đâu |
|---|---|
| Android / Chrome | `manifest.short_name` |
| iOS / Safari | `<meta name="apple-mobile-web-app-title">` (Next: `metadata.appleWebApp.title`) |

Sửa một chỗ thì nền tảng kia vẫn sai. Cả hai nay đọc `SITE_NAME`, nên không còn bản chép tay để
lệch nhau. "Vivu No Plan" đúng 12 ký tự — sát ngưỡng cả hai hệ cắt chữ, nên là dạng dài nhất còn
hiện trọn.

Kiểm bằng `curl`, đừng mở trang bằng mắt: `curl -s localhost:PORT/manifest.webmanifest` và
`curl -s localhost:PORT/ | grep apple-mobile-web-app-title`. Lưu ý **`/home` trả 307** khi chưa
đăng nhập — grep vào đó ra rỗng và trông y như thẻ bị thiếu.

## Ô nhập trông như bị khoá: chữ đã sửa, còn NỀN thì chưa

Lần trước sửa màu chữ của `DatePicker` mà **để nguyên `bg-background`**. Trong một thẻ trắng
(`--card: #ffffff`), `--background: #F8F9FA` là **ô xám** — và ô xám giữa những ô trắng là cách mọi
form trên đời viết chữ "không nhập được ở đây". Người dùng phải nhắc lần thứ hai.

**Luật:** ô nhập lấy nền theo **bề mặt chứa nó**, không theo nền trang. Trong modal/thẻ thì là
`bg-card`, giống `Input`/`Textarea`. Kiểm bằng số, đừng bằng mắt:

```js
getComputedStyle(ô1).backgroundColor === getComputedStyle(ô2).backgroundColor   // các ô cùng hàng
=== "rgb(255, 255, 255)"                                                        // và bằng nền thẻ
```

Kèm theo: nút xoá giờ đặt `absolute -top-2 -right-2` **thò ra ngoài hàng 8px** và vượt lề phải của
form. Nút phụ trợ của một ô phải nằm **trong** ô (`right-1.5 top-1/2 -translate-y-1/2`), chừa
`pr-9` cho nó — treo ở góc ngoài là mượn chỗ của thứ khác.

## Badge thông báo: dùng CHỮ V của thương hiệu, không phải icon chung chung

Bản đầu tôi vẽ máy bay — đúng kỹ thuật (bóng đổ trên nền trong suốt) nhưng **sai thương hiệu**.
Logo là chữ **V**, nên badge là chữ V khoét ra khỏi khối bo góc (đục 43%). Cách dựng vẫn như cũ:
SVG nạp qua `data:text/html` rồi `Page.captureScreenshot` với
`Emulation.setDefaultBackgroundColorOverride` alpha 0.

**Luật:** icon rút gọn phải rút gọn ĐÚNG dấu hiệu nhận diện. Một glyph đẹp mà không phải logo thì
vẫn là icon của người khác.


## Khung bản đồ nổi khi rời app: KHÔNG làm được trên điện thoại

Người dùng nhớ là đã yêu cầu và tưởng đã có. **Chưa từng làm** — kiểm bằng
`grep -rn "PictureInPicture" src/` (rỗng) và `git log` (không commit nào). Cái đã làm và dễ nhớ
nhầm: `navigation-context.tsx` giữ dẫn đường sống khi chuyển **trang trong app**, và ping vị trí
vẫn chạy khi rời tab. Không cái nào là cửa sổ nổi.

**Và cửa sổ nổi thì web không làm được trên điện thoại.** Document Picture-in-Picture chỉ có ở
Chrome/Edge **máy tính**; Chrome Android, Firefox Android, Safari iOS đều không hỗ trợ. Bong bóng
nổi của Google Maps là API **native** của Android, không phải web. Đây là giới hạn nền tảng, không
phải thiếu code.

Thứ tương đương làm được trên điện thoại: **thông báo thường trú** (`registration.showNotification`
với `tag` cố định + `silent`), cập nhật hướng rẽ + khoảng cách còn lại theo từng bước — Android
hiện nó trên thanh trạng thái và màn khoá.

**Luật:** người dùng nói "bạn làm rồi mà" thì đi kiểm `grep` + `git log`, đừng tin trí nhớ của mình
lẫn của họ. Và trước khi hứa một tính năng nền tảng, tra hỗ trợ trình duyệt trước.

## `<input type="time">` render khác nhau ở mỗi engine — đừng để trình duyệt quyết

iOS Safari vẽ ô **trống trơn** khi chưa có giá trị (không có `--:--` nào), Chrome vẽ `--:--` cộng
control riêng bên phải. Cùng một field, hai bộ mặt, và cái tệ hơn rơi đúng vào điện thoại.

App vốn **đã có** `TimePicker` tự dựng (`--:--` khi rỗng, không control lạ) và lịch dùng nó từ lâu;
chỉ form kỷ niệm còn dùng input thô. Sửa = dùng lại thứ đã có, không viết thêm.

Hai thứ kèm theo:
- **Icon sang TRÁI, màu accent** — giống hệt ô ngày. Ô giờ và ô ngày đứng cạnh nhau trả lời một câu
  hỏi, không nên là ảnh soi gương của nhau, và mép phải để trống cho giá trị.
- **Nút "Bỏ giờ" nằm trong dropdown**, không phải huy hiệu treo trên field. Không có gì bám ngoài
  viền thì không có gì tràn lề.

## Màu nhãn: chữ trắng trên màu pastel là 2.66:1, không đọc được

Nhãn ngoài danh sách bị tô phẳng `bg-accent-soft` — sáu nhãn khác nhau trông như một. Màu là **lý do
tồn tại** của nhãn: nó cho phép liếc mà không cần đọc.

Nhưng chép nguyên style "đã chọn" của bộ chọn thì mang theo cả lỗi của nó. Đo thật, chữ trắng trên
bảng nhãn hiện tại:

| nền | trắng | đen `#1c1917` |
|---|---|---|
| `#c8955a` Ăn uống | **2.66:1** | 6.58:1 |
| `#7fa882` Du lịch | **2.68:1** | 6.52:1 |
| `#c2693f` Kỷ niệm | **3.90:1** | 4.49:1 |

Chuẩn cho chữ nhỏ là 4.5:1; chip trong danh sách là 10px. Nên **màu chữ tính từ nền**
(`readableInk` trong `plan-meta.ts`) chứ không cố định — nhãn màu tối người dùng thêm sau vẫn tự ra
chữ trắng. Áp cho **cả hai** nơi (chip đọc + chip trong bộ chọn), vì "giống nhau" mới là thứ được
yêu cầu.

**ĐẢO LẠI 04/09/2026 — chủ sản phẩm chọn chữ TRẮNG.** Tôi đổi sang chữ đậm vì tỉ số tương phản, và
người dùng nhìn thật rồi bảo *"màu đen nhìn chìm quá"*. Họ đúng ở chỗ con số không đo được: trên
nền pastel mềm, chữ đậm **chìm vào nền** — cũng là lỗi đọc được, chỉ là loại mà WCAG không bắt.
Đây là quyết định thẩm mỹ của chủ sản phẩm sau khi đã nghe số đo, không phải do quên.

`readableInk` nay **mặc định trắng**, chỉ đảo sang đậm khi nền sáng tới mức trắng biến mất hẳn
(ngưỡng 2.5:1). Sáu nhãn có sẵn: 2.66–3.90:1 ⇒ đều trắng. Nhãn vàng nhạt bịa ra để thử: 1.07:1 ⇒
tự đảo sang đậm. Cái ngưỡng đó là **sàn an toàn**, không phải chỗ để cãi lại lựa chọn màu.

**Bẫy khi test:** `TagChip` rơi về màu phẳng trong lúc `space.tags` chưa về, nên đo quá sớm là thấy
"vẫn một màu" và tưởng bản vá hỏng. Chờ palette rồi mới đo.


## Hai chỗ cuộn trên cùng một trang: thủ phạm là `.sr-only`

Trang Hoạt động cuộn hai tầng — hộp trong cuộn 531px MÀ tài liệu cũng cuộn thêm 378px, nên header
trôi đi trong khi danh sách cũng trôi. Đo được ở 390×760: `body.scrollHeight = 760` (vừa khít)
nhưng `html.scrollHeight = 1138`.

**Nguyên nhân:** phần tử `position: absolute` chỉ bị `overflow` cắt khi hộp cắt nằm **giữa nó và
containing block của nó**. Không có tổ tiên nào định vị ⇒ containing block là chính trang ⇒ hộp
cuộn nằm ngoài đường đó và **không cắt gì cả**. `.sr-only` chính là dạng đó: `position:absolute`,
1px, đứng ở vị trí tĩnh sâu trong nội dung đã cuộn. Trang Hoạt động có **15 cái**, mỗi cái kéo dài
vùng cuộn của `html` xuống tới chỗ nó ngồi.

**Sửa:** thêm `relative` cho hộp cuộn (cả hai biến thể của `PageShell`) và cho khung
`MainWrapper`. Một chữ, và nó cắt luôn mọi kẻ trốn cùng loại.

Cách truy (làm lại được cho bug tương tự):
```js
// 1. có đúng hai chỗ cuộn không
document.documentElement.scrollHeight - document.documentElement.clientHeight   // > 0 là có
// 2. ai gây ra: bịt từng con của body rồi đo lại
for (const c of document.body.children) { c.style.display="none"; đo(); c.style.display=""; }
// 3. kẻ trốn: absolute mà cha định vị là body
[...khung.querySelectorAll('*')].filter(e => getComputedStyle(e).position === "absolute"
  && (e.offsetParent === document.body || e.offsetParent === null))
```

**Bẫy khi tái hiện:** tài khoản trống thì KHÔNG tràn — phải có dữ liệu thật (10 kỷ niệm) mới lòi.
Và tràn tăng theo lượng `.sr-only`, nên trang càng dài càng nặng.

## Bottom sheet là idiom của NGÓN TAY, không phải của màn hình hẹp

Bảng chọn cảm xúc dùng `BottomSheet` ở mọi nơi ⇒ trên desktop là một tấm trượt lên từ đáy cửa sổ
1400px để mời chọn 6 emoji. Nay tách theo **loại con trỏ**, không theo bề rộng — cùng phép thử
`select.tsx` đã dùng:

```js
matchMedia("(hover: none) and (pointer: coarse)").matches   // ngón tay -> sheet; chuột -> popover
```

Popover kiểu Facebook: một dải bo tròn neo ngay trên nút, 6 cảm xúc ưu tiên rồi tới `+`; `+` mở
18 cái còn lại, chọn cái nào thì cái đó **được ghim lên đầu hàng** và lưu theo từng người
(`memberProfiles.reactionFavourites`, chuẩn hoá ở server nên hàng luôn đủ 6 và không bao giờ chứa
emoji đã bỏ).

### Hai bẫy đã sập khi làm

- **Mongoose cache model qua hot-reload.** `models.X ?? model(...)` giữ schema CŨ, nên thêm trường
  mới thì mutation trả 200 mà **không ghi được gì**. Khởi động lại dev server là hết. Sửa schema
  xong mà thấy "ghi không vào" thì restart trước khi đi tìm bug.
- **`setMemberProfile` GHI ĐÈ cả bản ghi.** Nó `push({ userId, ...input })`, nên lưu biệt danh là
  xoá sạch avatar emoji + màu đã chọn trước đó. Nay gộp với bản cũ. Bug này có sẵn, không phải do
  thêm trường mới — nhưng thêm trường mới thì nó thành mất dữ liệu thấy được.

**Giới hạn khi test:** headless Chrome ở máy này **không giả lập được** media feature
`pointer`/`hover` (`Emulation.setEmulatedMedia` gọi xong trang vẫn báo `pointer: fine`). Nhánh cảm
ứng được kiểm bằng cách chèn `matchMedia` giả qua `Page.addScriptToEvaluateOnNewDocument` — vẫn là
nhánh thật của component, chỉ là cấp đầu vào bằng tay. Phải nói rõ chỗ này khi báo cáo.

## Khung nổi khi rời app: video PiP LÀM ĐƯỢC, chỉ là không phải Document PiP

Lần trước tôi kết luận "không làm được trên điện thoại" — **đúng một nửa**. Document
Picture-in-Picture (cửa sổ HTML tuỳ ý) thì đúng là chỉ có trên Chrome/Edge máy tính. Nhưng
**video PiP thì Android Chrome có**, và có đường vòng đã được dùng thực tế từ Chrome 71:

```
<canvas> → canvas.captureStream() → gán vào <video> → video.requestPictureInPicture()
```

Vẽ gì vào canvas thì cửa sổ nổi hiện cái đó. Hai lưu ý khi triển khai:
- Canvas WebGL của MapLibre cần `preserveDrawingBuffer: true` mới `captureStream` ra hình (có giá
  về hiệu năng). **Vẽ canvas 2D của riêng mình** (mũi tên rẽ + khoảng cách + ETA) vừa né được
  chuyện đó vừa đọc được hơn ở kích thước PiP.
- iOS: `requestPictureInPicture` có cho `<video>` thật, nhưng đường canvas→stream chưa chắc; phải
  thử trên máy thật.

**Luật:** "API X không hỗ trợ" chưa có nghĩa là "việc đó không làm được". Tìm đường vòng qua API
khác trước khi kết luận là giới hạn nền tảng.


## Vá `.sr-only` xong lại đẻ ra cuộn NGANG — và vì sao

Thêm `relative` cho hộp cuộn đã hết cuộn dọc thừa, nhưng đẻ ra cuộn ngang: trước kia các span
`.sr-only` **thoát hẳn** ra ngoài nên kéo dài tài liệu theo chiều DỌC; kẹp lại rồi thì chúng vẫn
ngồi lệch sang phải và đẩy hộp theo chiều NGANG. Đo được: một span `.sr-only` có mép phải ở
**497px** trên màn 360px.

**Gốc rễ:** span đó nằm trong một ô `truncate` — mà `truncate` là `white-space: nowrap`. Phần tử
`absolute` không khai `left/top` sẽ đứng ở **vị trí tĩnh**, tức là cuối dòng chữ **không bao giờ
xuống dòng** ⇒ toạ độ x vượt xa khung.

Sửa hai tầng:
1. **Gốc:** cho chính ô `truncate` thành `relative`. Containing block của span thành ô đó, mà ô đó
   đã `overflow: hidden` sẵn (do `truncate`) ⇒ bị cắt tại chỗ.
2. **Hàng rào:** `overflow-x-hidden` cho hộp cuộn của `PageShell`. Một cột nội dung **không có
   việc gì phải cuộn ngang**; cái gì rộng hơn nó đều là bug, nên cắt chứ đừng mời người ta cuộn
   sang xem. Triệu chứng người dùng thấy đúng là *"cuộn ngang qua thì không thấy gì dài đến mức
   tràn"* — vì thứ gây ra nó rộng 1px và vô hình.

**Luật:** `sr-only` (hay bất kỳ `absolute` nào không khai toạ độ) phải có tổ tiên `relative` ngay
gần nó. Không thì nó neo vào cả trang và kéo giãn theo hướng khó đoán.

## `tailwind-merge` NUỐT `bg-card` khi thêm class gradient

Thẻ nổi bật ở trang chủ nhìn "chìm" vì nó **không có màu nền nào cả**:

```js
twMerge("border-border bg-card rounded-xl border p-4", "bg-gradient-to-br from-… to-…")
// => "border-border rounded-xl border p-4 bg-gradient-to-br from-… to-…"   ← mất bg-card
```

`bg-card` (background-color) và `bg-gradient-to-br` (background-image) cùng nhóm `bg` với
tailwind-merge, nên cái sau xoá cái trước. Thẻ còn lại một lớp gradient 10% lơ lửng trên ảnh nền
trang ⇒ chữ chìm, trong khi thẻ thường bên cạnh vẫn trắng nét.

**Cách sửa:** lớp màu nhấn đi qua `style={{ backgroundImage: ... }}`, không qua class — `cn()`
không đụng tới nó, `bg-card` giữ nguyên. Kiểm bằng số: `backgroundColor` phải bằng token `--card`
**và** `backgroundImage !== "none"`.

**Luật:** đừng bao giờ đưa cả `bg-<màu>` lẫn `bg-gradient-*` qua cùng một `cn()`. Muốn có cả hai
thì một trong hai phải ra khỏi đường gộp class.

## Chỉ hiện khi hover = không tồn tại trên điện thoại

Tên người kia trên bản đồ dùng `opacity-0 group-hover:opacity-100` — với chuột thì thấy, với ngón
tay thì **không có đường nào chạm tới**. Nay chấm là `<button>`: chạm để bật/tắt tên, tự ẩn sau 4
giây, chuột vẫn hover như cũ.

**Luật:** mọi thông tin chỉ lộ ra khi `:hover` đều phải có lối vào thứ hai bằng chạm hoặc bàn phím.

## Server làm được không có nghĩa là người dùng tới được

`setMemberProfile` lưu `nickname`, `avatarEmoji`, `avatarColor` **từ đầu**, và **không màn hình nào
gọi nó** — người dùng hỏi "đổi biệt danh ở đâu" thì câu trả lời là: không ở đâu cả. Nay Cài đặt có
ô biệt danh (`avatarEmoji`/`avatarColor` vẫn chưa có lối vào).

**Bổ sung 04/09/2026 — biệt danh là của NGƯỜI ĐƯỢC ĐẶT TÊN, không phải của người đặt.** Bản đầu chỉ
cho sửa tên của chính mình. Kiểu Messenger: ai trong space cũng đặt được cho ai, và **cả hai cùng
thấy một giá trị** — vì tên nằm trên `memberProfiles[userId]` của space, không phải nhãn riêng của
từng người xem.

- Mutation riêng `space.setNickname({ userId, nickname })`, **không nhét vào `setMemberProfile`**:
  `avatarEmoji`/`avatarColor` là thứ riêng tư của mỗi người, không nên đi chung một cửa với thứ
  người kia sửa được. `nickname` cũng đã **gỡ khỏi** `setMemberProfile` — một field một đường ghi,
  không thì lại drift như mọi lần.
- Chặn theo `space.members`: không đổi được tên người ngoài space.
- Gộp chứ không ghi đè, nếu không đặt biệt danh sẽ **xoá sạch hàng cảm xúc** của người kia.
- Để trống = xoá biệt danh, tên tài khoản quay lại. `accountName` trả kèm trong `space.members` để
  nhãn nói rõ đang đổi tên của ai kể cả khi biệt danh đang che tên thật.

Chưa làm: đẩy thay đổi qua SSE. Bên kia thấy tên mới ở lần tải lại dữ liệu tiếp theo (React Query
refetch khi quay lại tab), không phải ngay lập tức.

Cách kiểm nhanh một tính năng có thật sự dùng được không:
```bash
grep -rn "tênMutation" src/features/ src/components/   # rỗng = server có, người dùng không tới được
```


## Bấm Lưu giữa lúc đang tải ảnh = mất sạch ảnh

Nút Lưu chỉ khoá theo `!title || create.isPending` — **không biết gì về việc đang tải ảnh**. Bấm
giữa chừng thì: mutation chạy với `photos` chỉ gồm ảnh đã xong (thường **rỗng**) → `onDone()` đóng
form → component unmount → các XHR còn bay thành **mồ côi** (`setPhotos` trên component đã chết
không làm gì cả) → mở lại thấy kỷ niệm **0 ảnh**.

**Cách sửa không phải là khoá nút.** Cú bấm đó có nghĩa là *"giữ cái này lại"*, nên nhớ lấy ý định
thay vì làm theo nghĩa đen: đặt cờ `saveWhenReady`, hàng đợi tải xong thì tự lưu. Nút đổi chữ thành
"Xong ảnh là lưu…" để không ai tưởng nó treo.

Một chi tiết dễ bỏ sót: **nếu có ảnh lỗi thì ĐỪNG tự lưu**. `uploading` tính theo
`pending.some(p => !p.error)` nên nó về false cả khi mọi thứ đều hỏng — tự lưu lúc đó là âm thầm
vứt đúng những tấm mà người ta bấm Lưu để giữ. Báo cho họ, để ảnh lỗi nằm nguyên đó và vẫn thử lại
được.

**Luật:** hành động "kết thúc" (lưu / đóng / điều hướng) phải biết về mọi việc đang chạy dở mà nó
sẽ giết. Kiểm bằng câu hỏi: *bấm cái này lúc X đang chạy thì X đi đâu?*

### Test tải ảnh mà KHÔNG đụng Cloudinary

Chặn ở tầng mạng bằng CDP: `Fetch.enable` với `urlPattern: "*api.cloudinary.com*"`, rồi
`Fetch.fulfillRequest` trả JSON giả sau 4 giây. Vừa điều khiển được thời điểm để bấm "giữa chừng",
vừa **không tạo tài nguyên thật phải đi dọn**. Ảnh thật đính vào qua `DOM.setFileInputFiles`.

Đo được: code cũ lưu ra **0 ảnh**, code mới **6/6**. Một bản vá chưa từng thấy test đỏ thì chưa
chứng minh được gì — `git stash` bản vá đi và chạy lại là bước bắt buộc.


## Ảnh đang tải và ảnh đã xong phải CÙNG MỘT KHUNG

Lưới ảnh trong form kỷ niệm vẽ hai hình dạng khác nhau cho hai trạng thái của **cùng một tấm ảnh**:
đang tải là ô vuông trần `h-20 w-20`, xong rồi là thẻ đầy đủ có ô cảm nhận. Nên mỗi lần một ảnh
tải xong, lưới **đổi hình ngay dưới tay người đang nhìn**.

Cách sửa không phải là thêm skeleton mà là **vẽ sẵn đúng cái khung sẽ có**: ảnh lấy từ file trên
máy (`URL.createObjectURL`) nên hiện ngay từ khung hình đầu tiên, vòng xoay và thanh tiến độ nằm
đè lên nó, và hàng cảm nhận dùng **chính component thật** ở trạng thái `disabled` — không phải một
ô nhại lại, vì nhại thì chỉ *gần* đúng chiều cao và vẫn xê dịch lúc tráo.

Đo được (4 ảnh, chặn Cloudinary để trả chậm 5 giây):

| | đang tải | tải xong |
|---|---|---|
| kích thước thẻ | 146×182 | 146×182 |
| vị trí thẻ đầu | top 653 | top 653 |

**Cái bẫy còn lại là ở CHỖ KHÁC.** Lần đo đầu kích thước đứng yên nhưng `top` nhảy 653 → 612: một
dòng "Đang tải ảnh…" nằm **phía trên** lưới, chỉ tồn tại khi đang tải, nên nó biến mất và kéo cả
lưới lên 41px. Nội dung của nó đã có sẵn trong dòng đếm ngay trên lưới ("4 ảnh · đang tải 4") ⇒ bỏ.

**Luật:** đo cả `top` chứ không chỉ `width/height`. Một khung đứng yên vẫn giật nếu thứ nằm trên nó
biến mất — và người dùng chỉ thấy "nó giật", không thấy thủ phạm ở đâu.

Lưới: `grid-cols-2 sm:grid-cols-4`. Ba cột chừa lại một khoảng trống bên phải ở mỗi hàng đầy;
bốn cột thì kín. Điện thoại giữ 2 — một phần tư bề rộng thì không phân biệt nổi ảnh nào với ảnh nào.


## Nhãn giải thích phải đặt ở ngày ĐẦU TIÊN THẤY ĐƯỢC, không phải ngày đầu thật

Băng chuyến đi trên lịch tháng gắn tên chuyến vào `first: i === 0` — ngày đầu **của chuyến**. Chuyến
31/08 → 05/09 xem ở tháng 9 thì ngày đầu nằm ngoài lưới ⇒ **không ô nào mang tên**, còn lại đúng một
vệt hồng đậm vắt qua 5 ô ảnh. Người dùng hỏi *"viên hồng hồng dày đặc gì vậy? bug gì vậy"* — không
phải vì nó xấu, mà vì **không có gì nói nó là cái gì**.

Tách hai khái niệm:
- `first` / `last` = hai đầu THẬT của chuyến → quyết định bo tròn. Băng đi từ ngoài lưới vào thì
  không bo đầu, nhìn ra là "còn tiếp ở tháng trước".
- `label` = ngày đầu tiên **hiện trong khoảng đang vẽ** → nơi treo tên.

**Luật:** bất cứ dấu hiệu nào vẽ ngang nhiều ô (băng, vệt, khung nối) đều phải có nhãn nằm trong
tầm nhìn hiện tại. Nhãn treo ở "phần tử đầu tiên" của dữ liệu sẽ biến mất mỗi khi khung nhìn cắt qua
giữa chừng — và thứ còn lại luôn trông như lỗi hiển thị.

## Badge: đừng THAY chữ trạng thái bằng con số

Pill trên thẻ chuyến đổi thành `NGÀY 5/6` khi đang đi, **thay cho** chữ "ĐANG ĐI". Kết quả: đúng cái
thẻ mà trạng thái quan trọng nhất lại là cái duy nhất không nói trạng thái. Con số là **thêm vào**,
không phải thay thế: `ĐANG ĐI · NGÀY 5/6` (đo được 132px, không tràn ảnh bìa).


### Link Maps: 4 lỗi làm link từ ĐIỆN THOẠI lệch, link desktop thì chuẩn

User báo: "link từ máy tính chuẩn 100%, link điện thoại lệch khá xa". Đúng, và vì 4 nguyên nhân
riêng biệt — tất cả đều nằm ở chỗ **link điện thoại không chứa marker `!3d!4d`** như link desktop.

**1. Tâm camera được thử TRƯỚC tên chỗ.** `PATTERNS` xếp "chính xác nhất trước" trong **một** danh
sách, và `@lat,lng` (tâm camera) nằm cuối danh sách đó. Nghe như phương án dự phòng an toàn — không
phải: link thiếu marker sẽ khớp camera, **trả về non-null**, nên tên chỗ nằm ngay trong cùng URL
**không bao giờ được tra**. Đo trên link thật: camera cách pin **3,02 km**.

Nay tách thành `EXACT_PATTERNS` và `VIEWPORT_PATTERNS`, thứ tự giải là:
marker → **tên chỗ (bias bằng camera)** → camera. Ca data-only: 3,02 km → **0,80 km**.

Tên chỗ được tra bằng chính `autocomplete` của ô tìm kiếm (endpoint duy nhất tôn trọng bias), và kết
quả bị **bác bỏ nếu lệch camera > 30 km** — vì geocoder tự cảnh báo trong comment của nó: một tên POI
trần được trả "ROOFTOP" tự tin ở **sai tỉnh**. Hai tín hiệu canh nhau: tên cho ra venue, camera cho
biết venue **nào**.

**2. Toạ độ trong đoạn `/place/` không được đọc.** Ghim pin (nhấn giữ bản đồ → Share) — cách chia sẻ
một chỗ *không phải* hàng quán có sẵn — cho ra `/maps/place/10.762622,106.660172/@10.77,106.67,17z`.
Toạ độ chính xác **nằm ngay trong đường dẫn**, mà không pattern nào khớp ⇒ lấy camera, lệch ~1,3 km.
`PLACE_DECIMAL` phải **neo vào `/place/`** và có mốc kết thúc `[/?#]|$`: cặp số thập phân xuất hiện
khắp URL loại này (mức zoom, chỉ số data), khớp lỏng còn tệ hơn không khớp. Đã test 2 bẫy:
`/place/123+Nguyen+Trai` và `/place/12,5+Le+Loi` đều **không** được nhận.

**3. Pin dạng độ-phút-giây.** Google còn viết pin thành `/place/10°45'45.4"N+106°39'36.6"E`.
`PLACE_DMS` chuyển sang thập phân, sai số ~1 m.

**4. `extractFirstUrl` cắt URL tại dấu nháy đơn — lỗi nặng nhất.** Regex loại `'` cùng các ký tự
delimiter của markup, mà link DMS ở trên có dấu phút `'` **không mã hoá**. URL bị cắt còn
`…/maps/place/10%C2%B045`, đoạn cụt đó **vẫn được fetch**, và Google trả về một chỗ ở **Newfoundland,
Canada** cho cái pin ở Sài Gòn. Hàm này chỉ đọc text người dùng dán, **không bao giờ đọc HTML**, nên
không có attribute delimiter nào cần đề phòng.

⚠️ Bài học đo: 3 lỗi đầu lộ ra khi test **hàm thuần**, còn lỗi thứ 4 **chỉ lộ khi chạy qua endpoint
thật** — vì `extractFirstUrl` nằm ở đầu chuỗi xử lý mà test hàm thuần đã bỏ qua. Test dạng link phải
chạy **cả hai tầng**.

Kết quả sau khi sửa, đo qua `location.geoFromUrl` thật:

| dạng link | lệch pin thật |
|---|---|
| link ngắn có marker (desktop) | **0 m** |
| ghim pin — decimal | **0 m** |
| ghim pin — độ phút giây | **1 m** |
| dán kèm chữ + link DMS | **1 m** |
| chỉ có tên + camera (data-only) | 800 m (trước: 3.020 m) |

Một link Google Maps thường chứa **hai** toạ độ; `!3d!4d` là pin thật, `@lat,lng` là tâm camera.
Đừng bao giờ sắp `@lat,lng` lên trước "cho gọn".

⚠️ Khi đọc link từ ảnh chụp màn hình: ô input **cắt chữ ở mép**. Một link tôi lấy từ ảnh bị thiếu
ký tự, trả HTTP 404, và suýt bị kết luận là "resolver hỏng". Đếm độ dài id (`maps.app.goo.gl` thường
17 ký tự) hoặc `curl` xem status trước khi tin.

## Nút cảm xúc lúc dẫn đường: prop thiếu ở đúng bản đồ đang nhìn

`LocationMapView` được render **hai lần** trên trang bản đồ: một bản nền, và một bản trong lớp phủ
dẫn đường (`fixed inset-0 z-50`). Bốn nút 🥵🐌🥺🚨 nằm trên **lớp phủ**, nhưng `partnerPingAction` và
`userPingAction` chỉ được truyền cho **bản nền** — tức bản đang bị lớp phủ che kín. Bấm thì bong bóng
vẽ lên một bản đồ không ai nhìn thấy, và ping của người kia bay qua SSE về đến nơi thì không có chỗ đáp.

Kèm hai đường im lặng trong `sendPingAction`: `if (!p.userGeo) return;` (chưa có GPS) và bộ chặn spam
2.5s. Cả hai đều là `return` trần ⇒ đúng hai tình huống dễ xảy ra nhất lại là hai tình huống không nói gì.
Nay hàm trả `"sent" | "too-soon" | "no-location"`, thiếu GPS thì toast, còn thời gian chờ thì vẽ mờ nút.

**Luật rút ra:** component nào render nhiều hơn một lần thì mọi prop phải được đối chiếu **giữa các bản**,
không chỉ đọc một bản. Grep tên prop và đếm số chỗ xuất hiện — lệch số là nghi ngờ.

## Nạp sẵn bản đồ: đúng chỗ, và tuyệt đối không nạp trên chính /map

`WarmMapAssets` (mount ở root layout) tải trước bundle maplibre + asset tile lúc **idle**, trên trang
người ta đang đọc, để lúc bấm sang bản đồ thì không còn gì phải đợi. Bỏ qua khi `saveData` hoặc mạng 2g.

⚠️ **Phải bỏ qua khi đang ở `/map`.** Nạp trước ngay trên trang bản đồ là xin đúng những byte mà bản đồ
đang xếp hàng chờ, trên đường truyền vốn đã bão hoà: đo được **26,4 giây** mới vẽ xong, so với 3,4s khi
có chặn `pathname.startsWith("/map")`.

`onIdle` của MapLibre là tín hiệu "khung hình này đã đủ", nên bản đồ chỉ hiện ra khi vẽ xong thay vì
ghép dần từng mảng trước mắt người dùng. Có hàng rào 6s để một tile chết không làm màn hình trắng mãi —
**muốn biết bản đo nào là map thật sự vẽ xong thì xem con số có dưới 6000ms không**; trên 6s nghĩa là
hàng rào cứu, không phải map xong.

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
