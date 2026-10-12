// --- CẤU HÌNH KẾT NỐI ESP32 ---
let ESP32_IP = "http://192.168.1.76"; // Cập nhật theo IP thực tế trên ESP32 của bạn

let activeProtocol = "HTTP"; 
let bleCharacteristic = null; 

// Cấu hình MQTT WebSocket
let mqttClient = null;
const mqttHost = "broker.hivemq.com";
const mqttPort = 8000; // Cổng WebSocket mặc định của HiveMQ
const mqttTopicSend = "thong_xyz123_farm/control";

// Hàm chuyển tab
function switchTab(tabId, element) {
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(`tab-${tabId}`).classList.add('active');
    element.classList.add('active');

    if (tabId === 'settings') {
        updateSettingsUI();
    } else if (tabId === 'schedule') {
        fetchSchedulesFromESP(); // Tự động đồng bộ lịch trình từ ESP32 khi vào tab Lịch trình
    }
}

// --- CẬP NHẬT TRẠNG THÁI GIAO THỨC & BADGE TRÊN HEADER ---
function setConnectionProtocol(status, protocolName, ipStr = "") {
    const statusBadge = document.getElementById('connection-status');
    const protocolDisplay = document.getElementById('current-protocol-display');

    if (status === "online") {
        let shortBadgeText = "Online";
        if (protocolName.includes("Wi-Fi") || protocolName.includes("HTTP")) {
            shortBadgeText = "Wi-Fi";
        } else if (protocolName.includes("Bluetooth") || protocolName.includes("BLE")) {
            shortBadgeText = "Bluetooth";
        } else if (protocolName.includes("MQTT")) {
            shortBadgeText = "MQTT";
        }

        if (statusBadge) {
            statusBadge.innerText = shortBadgeText;
            statusBadge.className = "status-badge online";
        }
        
        if (protocolDisplay) {
            if (shortBadgeText === "Wi-Fi") {
                protocolDisplay.innerHTML = `🌐 Đã kết nối (Wi-Fi HTTP) <br><span style="font-size: 12px; color: #666;">IP: ${ipStr}</span>`;
            } else if (shortBadgeText === "Bluetooth") {
                protocolDisplay.innerHTML = `📡 Đã kết nối (Bluetooth BLE) <br><span style="font-size: 12px; color: #666;">Thiết bị: ${ipStr}</span>`;
            } else if (shortBadgeText === "MQTT") {
                protocolDisplay.innerHTML = `☁️ Đã kết nối (MQTT Cloud) <br><span style="font-size: 12px; color: #666;">Broker: ${ipStr}</span>`;
            }
        }
    } else {
        if (statusBadge) {
            statusBadge.innerText = "Offline";
            statusBadge.className = "status-badge offline";
        }
        if (protocolDisplay) {
            protocolDisplay.innerText = "🔌 Chưa kết nối (Offline)";
        }
    }
}

function updateSettingsUI() {
    const protocolDisplay = document.getElementById('current-protocol-display');
    if (!protocolDisplay) return;

    if (activeProtocol === "HTTP") {
        protocolDisplay.innerHTML = `🌐 Đã kết nối (Wi-Fi HTTP) <br><span style="font-size: 12px; color: #666;">IP: ${ESP32_IP.replace("http://", "")}</span>`;
    } else if (activeProtocol === "BLE") {
        protocolDisplay.innerHTML = `📡 Đã kết nối (Bluetooth BLE) <br><span style="font-size: 12px; color: #666;">Thiết bị: Thong_Farm_ESP32</span>`;
    } else if (activeProtocol === "MQTT") {
        protocolDisplay.innerHTML = `☁️ Đã kết nối (MQTT Cloud) <br><span style="font-size: 12px; color: #666;">Broker: broker.hivemq.com</span>`;
    } else {
        protocolDisplay.innerText = "🔌 Chưa kết nối (Offline)";
    }
}

function switchProtocol(protoName) {
    activeProtocol = protoName;
    console.log("Đã chuyển sang giao thức:", protoName);

    const statusBadge = document.getElementById('connection-status');
    if (statusBadge) {
        statusBadge.innerText = "Đang kết nối";
        statusBadge.className = "status-badge online";
    }

    if (protoName === "HTTP") {
        fetchStatusFromESP();
    } else if (protoName === "BLE") {
        connectBLE();
    } else if (protoName === "MQTT") {
        initMQTT();
    }
    
    updateSettingsUI();
}

// --- KẾT NỐI BLUETOOTH BLE TRỰC TIẾP ---
async function connectBLE() {
    try {
        if (!navigator.bluetooth) {
            alert("Trình duyệt không hỗ trợ Web Bluetooth! Hãy sử dụng Chrome trên Android hoặc máy tính.");
            return;
        }

        console.log("🔍 Đang quét thiết bị 'Thong_Farm_ESP32'...");
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'Thong_Farm_ESP32' }],
            optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
        bleCharacteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a9');

        activeProtocol = "BLE";
        setConnectionProtocol("online", "Bluetooth BLE", device.name);
        alert("📱 Kết nối Bluetooth BLE thành công!");

        device.addEventListener('gattserverdisconnected', () => {
            console.log("🔌 Đã ngắt kết nối Bluetooth.");
            setConnectionProtocol("offline", "Offline");
            bleCharacteristic = null;
        });

    } catch (error) {
        console.error("Lỗi kết nối BLE:", error);
        alert("Không thể kết nối Bluetooth: " + error);
        setConnectionProtocol("offline", "Offline");
    }
}

// --- KẾT NỐI MQTT CLOUD QUA WEBSOCKET ---
function initMQTT() {
    if (mqttClient && mqttClient.isConnected()) {
        setConnectionProtocol("online", "MQTT Cloud", mqttHost);
        return;
    }

    let clientId = "web_client_" + Math.random().toString(16).substring(2, 8);
    mqttClient = new Paho.MQTT.Client(mqttHost, mqttPort, clientId);

    mqttClient.onConnectionLost = function (responseObject) {
        if (responseObject.errorCode !== 0) {
            console.warn("⚠️ Mất kết nối MQTT:", responseObject.errorMessage);
            setConnectionProtocol("offline", "Offline");
        }
    };

    mqttClient.connect({
        onSuccess: function () {
            console.log("☁️ Đã kết nối thành công tới MQTT Broker!");
            setConnectionProtocol("online", "MQTT Cloud", mqttHost);
            alert("☁️ Đã kết nối thành công với MQTT Cloud!");
        },
        onFailure: function (message) {
            console.error("❌ Kết nối MQTT thất bại:", message.errorMessage);
            alert("Không thể kết nối MQTT Cloud: " + message.errorMessage);
            setConnectionProtocol("offline", "Offline");
        },
        useSSL: false
    });
}

// --- HÀM TỔNG GỬI LỆNH XUỐNG ESP32 (HỖ TRỢ HTTP, BLE & MQTT) ---
function sendCommandToESP(payloadObj, successCallback) {
    const jsonStr = JSON.stringify(payloadObj);
    console.log(`📤 [Giao thức: ${activeProtocol}] Gửi lệnh:`, jsonStr);

    if (activeProtocol === "HTTP") {
        fetch(`${ESP32_IP}/control?data=${encodeURIComponent(jsonStr)}`, { method: 'GET' })
        .then(res => {
            if (res.ok) {
                if (successCallback) successCallback();
            } else {
                throw new Error("HTTP Error");
            }
        })
        .catch(err => {
            console.warn("Lỗi kết nối HTTP:", err);
            setConnectionProtocol("offline", "Offline");
        });

    } else if (activeProtocol === "BLE") {
        if (!bleCharacteristic) {
            alert("Chưa kết nối Bluetooth BLE! Vui lòng bấm kết nối Bluetooth trước.");
            return;
        }
        const encoder = new TextEncoder();
        bleCharacteristic.writeValue(encoder.encode(jsonStr))
        .then(() => {
            console.log("✅ Gửi lệnh qua BLE thành công!");
            if (successCallback) successCallback();
        })
        .catch(err => {
            console.error("Lỗi ghi dữ liệu BLE:", err);
            alert("Gửi lệnh qua BLE thất bại.");
        });

    } else if (activeProtocol === "MQTT") {
        if (!mqttClient || !mqttClient.isConnected()) {
            alert("MQTT chưa kết nối! Đang thử kết nối lại...");
            initMQTT();
            return;
        }
        
        let message = new Paho.MQTT.Message(jsonStr);
        message.destinationName = mqttTopicSend;
        mqttClient.send(message);
        
        console.log(`☁️ Đã gửi lệnh qua MQTT Topic [${mqttTopicSend}]:`, jsonStr);
        if (successCallback) successCallback();
    }
}

// --- 1. ĐIỀU KHIỂN THỦ CÔNG & ĐẾM NGƯỢC ---
const valveTimers = {};
const valveRemainingSeconds = {};

function toggleValve(valveId) {
    const checkbox = document.getElementById(`toggle-${valveId}`);
    const statusText = document.getElementById(`status-text-${valveId}`);
    const box = document.getElementById(`valve-box-${valveId}`);
    
    const minutesInput = document.getElementById(`valve-m-${valveId}`);
    const secondsInput = document.getElementById(`valve-s-${valveId}`);

    if (checkbox.checked) {
        let minutes = parseInt(minutesInput.value) || 0;
        let seconds = parseInt(secondsInput.value) || 0;
        let totalSeconds = (minutes * 60) + seconds;

        box.style.borderColor = "#2e7d32";

        sendCommandToESP({
            type: "manual",
            action: "ON",
            valve: valveId
        });

        if (totalSeconds === 0) {
            statusText.innerText = "Đang mở (Vô hạn)";
            statusText.style.color = "#2e7d32";
        } else {
            valveRemainingSeconds[valveId] = totalSeconds;
            updateCountdownDisplay(valveId);

            valveTimers[valveId] = setInterval(() => {
                valveRemainingSeconds[valveId]--;
                
                if (valveRemainingSeconds[valveId] <= 0) {
                    clearInterval(valveTimers[valveId]);
                    checkbox.checked = false;
                    toggleValve(valveId); 
                    statusText.innerText = "Đã xong (Đã tắt)";
                    statusText.style.color = "#d32f2f";
                } else {
                    updateCountdownDisplay(valveId);
                }
            }, 1000);
        }
    } else {
        if (valveTimers[valveId]) {
            clearInterval(valveTimers[valveId]);
        }
        box.style.borderColor = "#ddd";
        statusText.innerText = "Đang Tắt";
        statusText.style.color = "#666";

        sendCommandToESP({
            type: "manual",
            action: "OFF",
            valve: valveId
        });
    }
}

function updateCountdownDisplay(valveId) {
    let remSec = valveRemainingSeconds[valveId];
    let m = Math.floor(remSec / 60);
    let s = remSec % 60;
    const statusText = document.getElementById(`status-text-${valveId}`);
    statusText.innerText = `Đang bật (Còn ${m}p ${s}s)`;
    statusText.style.color = "#2e7d32";
}

function toggleMasterPump() {
    for (let i = 1; i <= 6; i++) {
        const checkbox = document.getElementById(`toggle-${i}`);
        if (checkbox && checkbox.checked) {
            checkbox.checked = false;
            if (valveTimers[i]) clearInterval(valveTimers[i]);
            document.getElementById(`status-text-${i}`).innerText = "Đang Tắt";
            document.getElementById(`valve-box-${i}`).style.borderColor = "#ddd";
        }
    }

    sendCommandToESP({
        master_pump: "OFF"
    });
    alert("🚨 Đã kích hoạt khẩn cấp: Đã khóa toàn bộ hệ thống bơm và đóng tất cả các van!");
}

// --- 2. XỬ LÝ LỊCH TRÌNH TỰ ĐỘNG & ĐỒNG BỘ ---
function toggleScheduleAccordion(id) {
    const body = document.getElementById(`schedule-body-${id}`);
    const icon = document.getElementById(`toggle-icon-${id}`);
    if (body.style.display === "none") {
        body.style.display = "block";
        icon.innerText = "▲ Thu gọn";
    } else {
        body.style.display = "none";
        icon.innerText = "▼ Mở rộng";
    }
}

function toggleSelectValve(element) {
    if (element.style.backgroundColor === "rgb(46, 125, 50)" || element.style.backgroundColor === "#2e7d32") {
        element.style.background = "#fafafa";
        element.style.color = "#333";
        element.style.borderColor = "#ccc";
    } else {
        element.style.background = "#2e7d32";
        element.style.color = "white";
        element.style.borderColor = "#2e7d32";
    }
}

function toggleSelectDay(element) {
    if (element.style.backgroundColor === "rgb(46, 125, 50)" || element.style.backgroundColor === "#2e7d32") {
        element.style.background = "#fafafa";
        element.style.color = "#333";
        element.style.borderColor = "#ccc";
    } else {
        element.style.background = "#2e7d32";
        element.style.color = "white";
        element.style.borderColor = "#2e7d32";
    }
}

// Đồng bộ danh sách lịch trình từ ESP32
function fetchSchedulesFromESP() {
    console.log("📥 Đang đồng bộ danh sách lịch trình từ ESP32...");

    if (activeProtocol === "HTTP") {
        fetch(`${ESP32_IP}/get_schedules`)
        .then(res => res.json())
        .then(data => {
            applySchedulesToUI(data);
        })
        .catch(err => {
            console.warn("Không thể tải lịch trình qua HTTP:", err);
        });
    }
}

function applySchedulesToUI(schedulesList) {
    if (!Array.isArray(schedulesList)) return;

    schedulesList.forEach(sch => {
        let id = sch.id;
        const summary = document.getElementById(`summary-${id}`);
        if (summary) {
            if (sch.start_time && sch.duration > 0) {
                summary.innerText = `Lịch trình #${id}: Đã cấu hình (${sch.start_time}) - Tưới ${sch.duration}s`;
                summary.style.color = "#2e7d32";
            } else {
                summary.innerText = `Lịch trình #${id}: Chưa cấu hình (06:00)`;
                summary.style.color = "#333";
            }
        }

        if (document.getElementById(`sch-time-${id}`)) {
            document.getElementById(`sch-time-${id}`).value = sch.start_time || "06:00";
            document.getElementById(`sch-duration-${id}`).value = sch.duration || 5;
            document.getElementById(`sch-rest-${id}`).value = sch.rest_minutes || 0;
            document.getElementById(`sch-repeat-${id}`).value = sch.repeats || 1;
        }
    });
}

function saveSchedule(id) {
    const timeVal = document.getElementById(`sch-time-${id}`).value;
    const durationVal = parseInt(document.getElementById(`sch-duration-${id}`).value) || 5;
    const restVal = parseInt(document.getElementById(`sch-rest-${id}`).value) || 0;
    const repeatVal = parseInt(document.getElementById(`sch-repeat-${id}`).value) || 1;

    let selectedValves = [];
    document.querySelectorAll(`.valve-select-btn[data-schedule="${id}"]`).forEach(btn => {
        if (btn.style.backgroundColor === "rgb(46, 125, 50)" || btn.style.backgroundColor === "#2e7d32") {
            selectedValves.push(parseInt(btn.getAttribute("data-val")));
        }
    });

    let selectedDays = [];
    document.querySelectorAll(`.day-select-btn[data-schedule="${id}"]`).forEach(btn => {
        if (btn.style.backgroundColor === "rgb(46, 125, 50)" || btn.style.backgroundColor === "#2e7d32") {
            selectedDays.push(btn.getAttribute("data-val"));
        }
    });

    const schedulePayload = {
        type: "save_single_schedule",
        schedule: {
            id: id,
            valves: selectedValves,
            duration: durationVal,
            rest_minutes: restVal,
            repeats: repeatVal,
            start_time: timeVal,
            days: selectedDays
        }
    };

    sendCommandToESP(schedulePayload, () => {
        const summary = document.getElementById(`summary-${id}`);
        summary.innerText = `Lịch trình #${id}: Đã đồng bộ (${timeVal}) - Tưới ${durationVal}s`;
        alert(`💾 Đã lưu và đồng bộ Lịch trình #${id} xuống ESP32!`);
        toggleScheduleAccordion(id);
    });
}

function resetSchedule(id) {
    sendCommandToESP({
        type: "delete_schedule",
        id: id
    }, () => {
        const summary = document.getElementById(`summary-${id}`);
        summary.innerText = `Lịch trình #${id}: Chưa cấu hình (06:00)`;
        alert(`🗑️ Đã xóa lịch trình #${id} trên ESP32`);
    });
}

// --- 3. CÀI ĐẶT WI-FI & TRẠNG THÁI ---
function saveWifiConfig() {
    const ssid = document.getElementById('wifi-ssid').value;
    const pass = document.getElementById('wifi-pass').value;

    if (!ssid) {
        alert("Vui lòng nhập tên Wi-Fi!");
        return;
    }

    fetch(`${ESP32_IP}/save_wifi?ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(pass)}`)
    .then(res => res.text())
    .then(msg => {
        alert("📡 " + msg);
    })
    .catch(err => {
        console.error(err);
        alert("Lỗi kết nối khi lưu Wi-Fi.");
    });
}

function resetWifiConfig() {
    if (confirm("Bạn có chắc chắn muốn xóa cấu hình Wi-Fi hiện tại trên thiết bị không?")) {
        fetch(`${ESP32_IP}/clear_wifi`)
        .then(res => res.text())
        .then(msg => {
            alert("🗑️ " + msg);
            document.getElementById('wifi-ssid').value = '';
            document.getElementById('wifi-pass').value = '';
            setConnectionProtocol("offline", "Offline");
        })
        .catch(err => {
            console.error(err);
            alert("Lỗi kết nối khi reset Wi-Fi.");
        });
    }
}

function fetchStatusFromESP() {
    fetch(`${ESP32_IP}/status`)
    .then(res => res.json())
    .then(data => {
        setConnectionProtocol("online", "Wi-Fi HTTP", data.ip);
        if (data.wifi_ssid) {
            document.getElementById('wifi-ssid').placeholder = `Đang kết nối: ${data.wifi_ssid}`;
        }
    })
    .catch(err => {
        console.log("Chưa kết nối được với ESP32 qua HTTP IP:", ESP32_IP);
        setConnectionProtocol("offline", "Offline");
    });
}

// --- TỰ ĐỘNG SINH GIAO DIỆN 6 LỊCH TRÌNH ---
document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById('schedules-container');
    if (!container) return;

    const daysOfWeek = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    let scheduleHtmlContent = '';

    for (let id = 1; id <= 6; id++) {
        scheduleHtmlContent += `
            <div class="schedule-card" id="schedule-card-${id}" style="border: 1px solid #ddd; border-radius: 8px; background: #fff; overflow: hidden;">
                <div class="schedule-header" onclick="toggleScheduleAccordion(${id})" style="padding: 12px 15px; background: #f5f5f5; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
                    <span id="summary-${id}" style="font-size: 14px; color: #333;">Lịch trình #${id}: Chưa cấu hình (06:00)</span>
                    <span id="toggle-icon-${id}" style="font-size: 12px; color: #666;">▼ Mở rộng</span>
                </div>

                <div class="schedule-body" id="schedule-body-${id}" style="display: none; padding: 15px; border-top: 1px solid #eee;">
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label style="font-size: 13px; font-weight: bold;">Chọn van áp dụng:</label>
                        <div class="valve-selector-grid" style="display: flex; gap: 4px; margin-top: 5px;">
                            ${[1,2,3,4,5,6].map(v => `<div class="valve-select-btn" data-schedule="${id}" data-val="${v}" onclick="toggleSelectValve(this)" style="padding: 6px 0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; text-align: center; flex: 1; font-size: 12px; background: #fafafa;">V${v}</div>`).join('')}
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 10px;">
                        <label style="font-size: 13px; font-weight: bold;">Thời gian tưới (giây):</label>
                        <input type="number" id="sch-duration-${id}" value="5" min="1" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 10px;">
                        <label style="font-size: 13px; font-weight: bold;">Thời gian nghỉ giữa các lần (phút):</label>
                        <input type="number" id="sch-rest-${id}" value="0" min="0" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 10px;">
                        <label style="font-size: 13px; font-weight: bold;">Số lần lặp lại:</label>
                        <input type="number" id="sch-repeat-${id}" value="1" min="1" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 10px;">
                        <label style="font-size: 13px; font-weight: bold;">Thời gian bắt đầu:</label>
                        <input type="time" id="sch-time-${id}" value="06:00" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 12px;">
                        <label style="font-size: 13px; font-weight: bold;">Tùy chọn ngày trong tuần:</label>
                        <div class="days-selector-grid" style="display: flex; gap: 3px; margin-top: 5px;">
                            ${daysOfWeek.map(d => `<div class="day-select-btn selected" data-schedule="${id}" data-val="${d}" onclick="toggleSelectDay(this)" style="padding: 6px 0; border: 1px solid #2e7d32; background: #2e7d32; color: white; border-radius: 4px; cursor: pointer; text-align: center; flex: 1; font-size: 11px;">${d}</div>`).join('')}
                        </div>
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary" style="flex: 2; margin-top: 0; padding: 10px;" onclick="saveSchedule(${id})">💾 Lưu Lịch Này</button>
                        <button class="btn-danger" style="flex: 1; margin-top: 0; padding: 10px; background: #757575;" onclick="resetSchedule(${id})">Xóa lịch</button>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = scheduleHtmlContent;
    
    fetchStatusFromESP();
});