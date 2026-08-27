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
