# Vivu No Plan — quy ước khi sửa repo này

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
