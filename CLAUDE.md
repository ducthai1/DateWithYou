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
