import { SITE_NAME } from "@/lib/site";
import { BootVeilDismiss } from "./boot-veil-dismiss";

/**
 * Nối tiếp ảnh khởi động của hệ điều hành cho tới khi màn đầu có dữ liệu thật.
 *
 * Hệ điều hành bỏ ảnh khởi động ở **khung hình đầu tiên** của trang, mà khung
 * hình đầu tiên của app này là khung xương: `/home` là client component, toàn
 * bộ nội dung treo sau một truy vấn. Nên người ta thấy splash đẹp → màn xương
 * trắng → mới tới nội dung. Tấm này lấp đúng khoảng giữa.
 *
 * ⚠️ Đây là **server component**, và đó là cả vấn đề của bản trước.
 * Bản trước là client component bắt đầu bằng `useState(false)` rồi mới bật lên
 * trong `useEffect`, nên nó KHÔNG có trong HTML máy chủ trả về và cũng không có
 * trong lần vẽ đầu của client — tức nó mọc ra SAU thứ nó định che. Quay màn
 * hình máy thật thấy đúng thế: splash 4,5s → giao diện trắng → rồi mới tới tấm
 * phủ, và nó ở lại thêm 6 giây nữa. Một tấm che đến sau chỉ là một bức tường.
 *
 * Nên: có sẵn trong HTML, và chỉ hiện ở app ĐÃ CÀI — điều kiện ấy do CSS quyết
 * (`@media (display-mode: standalone)`), không do JavaScript, để nó đúng ngay
 * từ byte đầu tiên. Trên tab trình duyệt thường nó `display: none` và không ai
 * thấy gì; nếu để JS quyết thì mỗi lần tải lại trên web là một mảng navy chớp
 * lên — tệ hơn thứ nó định chữa.
 *
 * Chiều cao dùng `100vh` chứ không `dvh` hay `%`: `vh` là khung lớn và KHÔNG
 * co lại khi thanh điều hướng của máy hiện ra hay ẩn đi, nên nội dung căn giữa
 * không nhảy. (Ảnh splash của chính Android thì nhảy 4px vì hệ điều hành tự bố
 * trí lại theo inset — chỗ đó app không với tới được.)
 */
export function BootVeil() {
  return (
    <div id="boot-veil" aria-hidden="true">
      <div id="boot-veil-inner">
        {/* Cùng dấu hiệu và cùng nền với ảnh khởi động, để chỗ giao nhau không
            nhìn ra được. `eager` + `high` vì đây là thứ DUY NHẤT trên màn. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="" width={120} height={120} fetchPriority="high" />
        <p>{SITE_NAME}</p>
      </div>
      <BootVeilDismiss />
    </div>
  );
}
