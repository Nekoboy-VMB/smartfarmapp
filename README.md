# Vườn nhà — bản web cài trên điện thoại

Đây là bản PWA tách riêng. Bản HTML gốc vẫn nằm ở `../esp32-irrigation-configurator.html`; chỉnh giao diện mới thì cần chép thay đổi sang `index.html` trong thư mục này trước khi xuất bản.

## Cài lên máy chủ HTTPS

Thư mục này là website tĩnh, không cần backend. Đưa toàn bộ nội dung thư mục lên dịch vụ hosting tĩnh có HTTPS (ví dụ GitHub Pages, Cloudflare Pages hoặc Netlify). Không mở bằng `file://`: cài PWA và service worker cần HTTPS.

## Cài trên điện thoại

- Android: mở đường dẫn HTTPS bằng Chrome, chọn menu ⋮ → **Install app** hoặc **Add to Home screen**.
- iPhone: mở đường dẫn HTTPS bằng Safari, nhấn **Share** → **Add to Home Screen**.

## Kết nối bộ tưới

Webapp dùng cùng Device ID `7f4ed1671e6d10e6` và topic MQTT của ESP. Ở chế độ **Tự động**, webapp tự kết nối MQTT và ưu tiên MQTT khi ESP online; nếu MQTT mất kết nối, webapp chuyển sang BLE nếu BLE đang kết nối. Trên trình duyệt hỗ trợ BLE, lần đầu cần bấm **Kết nối BLE** một lần để cấp quyền; những lần sau webapp có thể tự kết nối lại thiết bị đã ghi nhớ. Có thể nhập JSON đã xuất từ trình duyệt đang dùng để khôi phục lịch và các thiết lập hiển thị trên webapp.

ESP32 cần được nối Wi-Fi và nạp firmware MQTT trước. Khi đã cấu hình Wi-Fi, ESP tự chạy lịch đã lưu kể cả khi webapp đóng hoặc điện thoại mất mạng.

BLE qua web dùng được trên trình duyệt có Web Bluetooth sau khi người dùng cấp quyền một lần. Safari trên iPhone không cung cấp Web Bluetooth cho trang này; trên iPhone dùng MQTT tự động qua Wi-Fi/internet. APK Android dùng BLE native và có thể tự nối lại ESP đã được chọn trước đó.

## Bảo mật

Thiết bị hiện dùng HiveMQ public: MQTT TCP 1883 cho ESP và WSS 8884 cho webapp. Đây là broker công cộng không xác thực/ủy quyền; topic theo Device ID không phải biện pháp bảo mật. Chỉ dùng trong giai đoạn thử nghiệm và không chia sẻ topic. Muốn điều khiển từ xa an toàn, cần chuyển cả ESP và webapp sang broker riêng có tài khoản, TLS và quyền truy cập theo thiết bị.

Lịch được lưu trên ESP32 và đồng bộ sang máy tính/điện thoại khi webapp kết nối bằng BLE hoặc MQTT. Nếu lịch đang lưu trong trình duyệt khác với ESP32, webapp sẽ hỏi bạn muốn tải danh sách từ ESP xuống hay giữ danh sách trên trình duyệt và gửi lên ESP. Các tùy chọn giao diện vẫn được lưu riêng trong từng trình duyệt.

Danh sách tối đa 8 mạng Wi-Fi được lưu trên ESP32 nên dùng chung giữa các điện thoại. Chọn SSID đã lưu để kết nối lại mà không nhập mật khẩu; có thể chọn mạng qua MQTT hoặc BLE. Thêm/cập nhật mạng mới cần BLE để mật khẩu không bị gửi qua broker MQTT công cộng. Trạng thái chỉ đồng bộ tên mạng, không tiết lộ mật khẩu.
