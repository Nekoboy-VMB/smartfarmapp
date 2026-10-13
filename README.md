# Vườn nhà — bản web cài trên điện thoại

Đây là bản PWA tách riêng. Bản HTML gốc vẫn nằm ở `../esp32-irrigation-configurator.html`; chỉnh giao diện mới thì cần chép thay đổi sang `index.html` trong thư mục này trước khi xuất bản.

## Cài lên máy chủ HTTPS

Thư mục này là website tĩnh, không cần backend. Đưa toàn bộ nội dung thư mục lên dịch vụ hosting tĩnh có HTTPS (ví dụ GitHub Pages, Cloudflare Pages hoặc Netlify). Không mở bằng `file://`: cài PWA và service worker cần HTTPS.

## Cài trên điện thoại

- Android: mở đường dẫn HTTPS bằng Chrome, chọn menu ⋮ → **Install app** hoặc **Add to Home screen**.
- iPhone: mở đường dẫn HTTPS bằng Safari, nhấn **Share** → **Add to Home Screen**.

## Kết nối bộ tưới

Webapp dùng cùng Device ID `7f4ed1671e6d10e6` và topic MQTT của ESP. Chọn **Thiết bị → MQTT → Kết nối MQTT**; khi thấy ESP online, chọn **Tự động** hoặc **MQTT** ở mục Đường kết nối để điều khiển. Có thể nhập JSON đã xuất từ trình duyệt đang dùng để khôi phục lịch và các thiết lập hiển thị trên webapp.

ESP32 cần được nối Wi-Fi và nạp firmware MQTT trước. Khi đã cấu hình Wi-Fi, ESP tự chạy lịch đã lưu kể cả khi webapp đóng hoặc điện thoại mất mạng.

BLE provisioning dùng Web Bluetooth, hiện hỗ trợ tốt trên Chrome Android; Safari trên iPhone không cung cấp Web Bluetooth cho trang này. Có thể cài Wi-Fi bằng Android một lần, sau đó dùng iPhone qua MQTT từ xa.

## Bảo mật

Thiết bị hiện dùng HiveMQ public: MQTT TCP 1883 cho ESP và WSS 8884 cho webapp. Đây là broker công cộng không xác thực/ủy quyền; topic theo Device ID không phải biện pháp bảo mật. Chỉ dùng trong giai đoạn thử nghiệm và không chia sẻ topic. Muốn điều khiển từ xa an toàn, cần chuyển cả ESP và webapp sang broker riêng có tài khoản, TLS và quyền truy cập theo thiết bị.

Lịch được lưu trên ESP32 và đồng bộ sang máy tính/điện thoại khi webapp kết nối bằng BLE hoặc MQTT. Nếu lịch đang lưu trong trình duyệt khác với ESP32, webapp sẽ hỏi bạn muốn tải danh sách từ ESP xuống hay giữ danh sách trên trình duyệt và gửi lên ESP. Các tùy chọn giao diện vẫn được lưu riêng trong từng trình duyệt.
