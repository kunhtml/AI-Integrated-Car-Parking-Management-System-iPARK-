#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ESP32 servo
#include <ESP32Servo.h>

// ================== PIN MAP (ESP32 OUT) - BẢN RÚT GỌN ==================
// ID thiết bị: Python dùng để tự dò port COM (không phụ thuộc số COM).
// OUT = cổng RA. Đổi sang "IN" nếu flash firmware này cho cổng vào.
#define DEVICE_ID       "OUT"

#define PIN_BUZZER      14
#define PIN_SERVO       13

// RFID RC522 (SPI VSPI)
#define SS_PIN          5
#define RST_PIN         27
#define SPI_SCK         18
#define SPI_MISO        19
#define SPI_MOSI        23

// LCD I2C
#define I2C_SDA         21
#define I2C_SCL         22

// ================== LCD / RFID / SERVO ==================
LiquidCrystal_I2C lcd(0x27, 16, 2);
MFRC522 mfrc522(SS_PIN, RST_PIN);
Servo cua_ra;

// ==== Biến RFID ====
int readsuccess;
byte readcard[10];
char str[32] = "";
String StrUID;

// ===== Scan mode for adding new RFID from website =====
bool scanMode = false;

// ===== Anti-spam UID print =====
String lastUIDPrinted = "";
unsigned long lastUIDTime = 0;

// ==== Biển số OCR từ Python (OUT:) ====
String bienSoOCR = "";

// ===== HÀM NORMALIZE BIỂN SỐ =====
// Chuyển về UPPERCASE, loại bỏ dấu gạch ngang và khoảng trắng
// Ví dụ: "29A-1234" -> "29A1234", "29a1234" -> "29A1234"
String normalizePlate(String plate) {
  plate.trim();
  plate.toUpperCase();
  plate.replace("-", "");
  plate.replace(" ", "");
  return plate;
}

// ==== Cấu trúc quản lý thẻ ====
struct TheXe {
  String uid;
  String hoten;
  String bienso;
  bool laResident;
  bool daGanBienSo;
  bool status;         // true = active, false = bị khóa
};

// ===== Danh sách thẻ tối đa 100 =====
const int MAX_THE = 100;
TheXe dsThe[MAX_THE];
int soThe = 0; // ban đầu rỗng, thẻ sẽ được add/update từ Python qua Serial

// ================== Helpers ==================
void coiCanhBao(int soLan, int delayTime = 200) {
  for (int i = 0; i < soLan; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(delayTime);
    digitalWrite(PIN_BUZZER, LOW);
    delay(delayTime);
  }
}

void LCD_SaiBienSo() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Sai bien so!");
  lcd.setCursor(0, 1);
  lcd.print("Check again");
}

void LCD_SaiThe() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("The khong hop");
  lcd.setCursor(0, 1);
  lcd.print("Check again");
}

void LCD_GuestChuaGan() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Guest chua gan");
  lcd.setCursor(0, 1);
  lcd.print("Bien so");
}

void LCD_TheBiKhoa() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("The bi khoa!");
  lcd.setCursor(0, 1);
  lcd.print("Lien he quan ly");
}

String normalizeUid(String u) {
  u.trim();
  u.toUpperCase();
  u.replace(":", "");
  u.replace("-", "");
  u.replace(" ", "");
  return u;
}

// ===== Quản lý mảng thẻ =====
int findIndexByUID(const String &uid) {
  for (int i = 0; i < soThe; i++) {
    if (normalizeUid(dsThe[i].uid) == normalizeUid(uid)) return i;
  }
  return -1;
}

void removeAt(int idx) {
  if (idx < 0 || idx >= soThe) return;
  for (int i = idx; i < soThe - 1; i++) {
    dsThe[i] = dsThe[i + 1];
  }
  soThe--;
}

bool parseActive(String s) {
  s.trim();
  s.toLowerCase();
  return (s == "active" || s == "available" || s == "in-use" || s == "1" || s == "true" || s == "on");
}

bool parseResident(String s) {
  s.trim();
  s.toLowerCase();
  return (s == "resident" || s == "res" || s == "1" || s == "true");
}

// Protocol: ADD|uid|owner|plate|type|status
//           UPDATE|uid|owner|plate|type
//           DELETE|uid
//           DISABLE|uid
//           ENABLE|uid
String getToken(const String &s, int index, char delim = '|') {
  int start = 0;
  for (int i = 0; i < index; i++) {
    int p = s.indexOf(delim, start);
    if (p == -1) return "";
    start = p + 1;
  }
  int end = s.indexOf(delim, start);
  if (end == -1) end = s.length();
  return s.substring(start, end);
}

void upsertCard(String uid, const String &hoten, const String &plate, bool laResident, bool active) {
  uid = normalizeUid(uid);
  int idx = findIndexByUID(uid);
  if (idx == -1) {
    if (soThe >= MAX_THE) {
      Serial.println("ERR|FULL");
      return;
    }
    idx = soThe;
    soThe++;
  }

  dsThe[idx].uid = uid;
  dsThe[idx].hoten = hoten;
  dsThe[idx].bienso = plate;
  dsThe[idx].laResident = laResident;
  dsThe[idx].daGanBienSo = (plate.length() > 0);
  dsThe[idx].status = active;
}

void LCD() {
  lcd.setCursor(0, 0);
  lcd.print("     Please     ");
  lcd.setCursor(0, 1);
  lcd.print("Check your card ");
}

void LCD_TRUE() {
  lcd.clear();
  lcd.setCursor(5, 0);
  lcd.print("Goodbye");
  lcd.setCursor(0, 1);
  lcd.print("See you again  ");
}

// ================== RFID ==================
void array_to_string(byte array[], unsigned int len, char buffer[]) {
  for (unsigned int i = 0; i < len; i++) {
    byte nib1 = (array[i] >> 4) & 0x0F;
    byte nib2 = (array[i] >> 0) & 0x0F;
    buffer[i * 2 + 0] = nib1 < 0xA ? '0' + nib1 : 'A' + nib1 - 0xA;
    buffer[i * 2 + 1] = nib2 < 0xA ? '0' + nib2 : 'A' + nib2 - 0xA;
  }
  buffer[len * 2] = '\0';
}

// ===== Chẩn đoán lỗi không đọc được thẻ =====
// Dùng API có từ thư viện MFRC522 1.1.15 (tương thích cả 1.4.5+).
void diagStatusName(byte status, char *buf, int len) {
  // So sanh so thuan vi (khong dung constant de tuong thich moi ban thu vien)
  const char *name = "KHC";
  switch (status) {
    case 0: name = "OK"; break;
    case 1: name = "ERROR (loi lien lac)"; break;
    case 2: name = "COLLISION"; break;
    case 3: name = "TIMEOUT (co the: chua thay the)"; break;
    case 4: name = "NO_ERROR"; break;
    case 5: name = "CRC_ERROR"; break;
  }
  strncpy(buf, name, len - 1);
  buf[len - 1] = '\0';
}

int getid() {
  byte status;
  char name[40];
  static unsigned long lastFailLog = 0;

  status = mfrc522.PICC_IsNewCardPresent();
  if (status != MFRC522::STATUS_OK) {
    // 8 = NO_TAG_DET: chip RC522 lien lac duoc qua SPI nhung khong bat duoc
    // song tu the -> loi cam ung/antenna hoac the ra xa.
    // Cac ma khac (duoi 4 / READER_ERROR) -> loi chip hoac day SPI.
    // Throttle: chi in 1 lan / 5s de khong spam serial.
    if (millis() - lastFailLog >= 5000) {
      lastFailLog = millis();
      diagStatusName(status, name, sizeof(name));
      Serial.print("[RFID-DIAG] IsNewCardPresent: 0x");
      Serial.print(status, HEX);
      Serial.print(" -> ");
      Serial.println(name);
    }
    return 0;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    // Ghost detection binh thuong khi khong co the -> chi in 1 lan / 5s.
    if (millis() - lastFailLog >= 5000) {
      lastFailLog = millis();
      Serial.println("[RFID-DIAG] PICC_ReadCardSerial: FAILED (loi doc serial the)");
    }
    return 0;
  }

  byte uidSize = mfrc522.uid.size;
  if (uidSize > 10) uidSize = 10;
  for (byte i = 0; i < uidSize; i++) {
    readcard[i] = mfrc522.uid.uidByte[i];
  }
  array_to_string(readcard, uidSize, str);
  StrUID = String(str);
  StrUID.trim();
  StrUID.toUpperCase();
  // PICC_GetType: 1 = MIFARE (hop le), 0/99 = khong biet
  Serial.print("[RFID-DIAG] Card type code: ");
  Serial.println(mfrc522.PICC_GetType(readcard[0]));
  mfrc522.PICC_HaltA();
  return 1;
}

// ================== Mở cửa ==================
// Không còn IR vật cản: giữ barrier mở 3 giây rồi tự đóng.
void mo_cua() {
  cua_ra.write(100);
  LCD_TRUE();
  coiCanhBao(2, 100);

  delay(5000);
  cua_ra.write(10);
}

// ================== Xử lý RA ==================
void senddata() {
  readsuccess = getid();
  if (!readsuccess) return;

  // Luôn phát UID giống firmware cũ; Python tự lọc theo phiên quét.
  if (StrUID != lastUIDPrinted || (millis() - lastUIDTime) > 1500) {
    Serial.println("UID:" + StrUID);
    lastUIDPrinted = StrUID;
    lastUIDTime = millis();
  }

  // ===== SCAN MODE: chỉ gửi UID về Python, KHÔNG validate thẻ =====
  if (scanMode) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("UID SENT");
    lcd.setCursor(0, 1);
    lcd.print(StrUID.substring(0, 16));

    // TỰ THOÁT SCAN MODE SAU 1 LẦN QUÉT
    scanMode = false;

    return;   // CỰC QUAN TRỌNG: KHÔNG CHẠY LOGIC MỞ BARRIER
  }
  // ==============================================================



  bool found = false;

  for (int i = 0; i < soThe; i++) {
    if (dsThe[i].uid == StrUID) {
      found = true;

      // Thẻ bị khóa -> không mở barie
      if (!dsThe[i].status) {
        Serial.println("The bi khoa!");
        LCD_TheBiKhoa();
        coiCanhBao(3);
        return;
      }

      if (dsThe[i].laResident) {
        // Normalize both plates before comparison: UPPERCASE + no hyphen
        String ocrNorm = normalizePlate(bienSoOCR);
        String dbNorm = normalizePlate(dsThe[i].bienso);

        Serial.print("OCR normalized: '"); Serial.print(ocrNorm); Serial.print("' ");
        Serial.print("DB normalized: '"); Serial.print(dbNorm); Serial.println("'");

        if (ocrNorm.equals(dbNorm)) {
          Serial.println("Resident OK -> Mo cua");
          Serial.println("DATA,DATE,TIME," + StrUID + ',' + dsThe[i].hoten + ',' + bienSoOCR + ",Out");
          mo_cua();
          bienSoOCR = "";
        } else {
          Serial.println("Sai bien so resident khi RA!");
          LCD_SaiBienSo();
          coiCanhBao(2);
        }
      } else {
        // Guest
        if (dsThe[i].daGanBienSo) {
          // Guest đã có biển số -> so sánh với normalize
          String ocrNorm = normalizePlate(bienSoOCR);
          String dbNorm = normalizePlate(dsThe[i].bienso);

          Serial.print("OCR normalized: '"); Serial.print(ocrNorm); Serial.print("' ");
          Serial.print("DB normalized: '"); Serial.print(dbNorm); Serial.println("'");

          if (ocrNorm.equals(dbNorm)) {
            Serial.println("Guest OK -> Mo cua");
            Serial.println("DATA,DATE,TIME," + StrUID + ",Guest," + bienSoOCR + ",Out");
            mo_cua();

            // Reset guest sau khi ra
            dsThe[i].bienso = "";
            dsThe[i].daGanBienSo = false;
            bienSoOCR = "";
          } else {
            Serial.println("Sai bien so guest khi RA!");
            LCD_SaiBienSo();
            coiCanhBao(2);
          }
        } else {
          Serial.println("Guest chua co bien so gan tu luc vao!");
          LCD_GuestChuaGan();
          coiCanhBao(2);
        }
      }
    }
  }

  if (!found) {
    Serial.println("UID:" + StrUID);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Dang xac minh");
    lcd.setCursor(0, 1);
    lcd.print("Vui long doi...");
  }
}

// ================== Nhận biển số / lệnh từ Python ==================
void docBienSoTuPython() {
  static String buffer = "";

  while (Serial.available() > 0) {
    char c = Serial.read();

    if (c == '\n') {
      buffer.trim();
      Serial.print("Raw from Python: '");
      Serial.print(buffer);
      Serial.println("'");

      if (buffer.startsWith("OUT:")) {
        bienSoOCR = buffer.substring(4);
        bienSoOCR.trim();
        Serial.println("Camera OUT -> bienSoOCR = '" + bienSoOCR + "'");
      }
      else if (buffer.startsWith("REG:")) {
        int commaIndex = buffer.indexOf(',');
        if (commaIndex > 4) {
          String uid = buffer.substring(4, commaIndex);
          String plate = buffer.substring(commaIndex + 1);
          uid.trim(); plate.trim();

          for (int i = 0; i < soThe; i++) {
            if (dsThe[i].uid == uid) {
              dsThe[i].bienso = plate;
              dsThe[i].daGanBienSo = true;
              Serial.println("Guest " + uid + " da duoc cap bien so " + plate);
            }
          }
        }
      }

      // Python gửi GET_ID để xác nhận danh tính thiết bị (tự dò port COM).
      else if (buffer.equals("GET_ID")) {
        Serial.println("ID:" + String(DEVICE_ID));
      }

      else if (buffer.equals("SCAN_ON")) {
        scanMode = true;
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Scan mode ON");
        lcd.setCursor(0, 1);
        lcd.print("Tap RFID card");
        Serial.println("OK|SCAN_ON");
      }
      else if (buffer.equals("SCAN_OFF")) {
        scanMode = false;
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("SCAN MODE OFF");
        Serial.println("OK|SCAN_OFF");
      }


      // ===== CRUD thẻ từ Website/Python =====
      else if (buffer.equals("RESET_CARDS")) {
        soThe = 0;          //  reset số lượng thẻ trong mảng        
        Serial.println("OK|RESET_CARDS");
      }

      else if (buffer.startsWith("ADD|")) {
        String uid   = getToken(buffer, 1);
        String name  = getToken(buffer, 2);
        String plate = getToken(buffer, 3);
        String type  = getToken(buffer, 4);
        String st    = getToken(buffer, 5);

        uid.trim(); name.trim(); plate.trim(); type.trim(); st.trim();
        bool isResident = parseResident(type);
        bool active = parseActive(st);
        upsertCard(uid, name, plate, isResident, active);

        Serial.println("OK|ADD|" + uid);
      }
      else if (buffer.startsWith("UPDATE|")) {
        String uid   = getToken(buffer, 1);
        String name  = getToken(buffer, 2);
        String plate = getToken(buffer, 3);
        String type  = getToken(buffer, 4);

        uid.trim(); name.trim(); plate.trim(); type.trim();
        bool isResident = parseResident(type);

        int idx = findIndexByUID(uid);
        bool active = true;
        if (idx != -1) active = dsThe[idx].status;

        upsertCard(uid, name, plate, isResident, active);
        Serial.println("OK|UPDATE|" + uid);
      }
      else if (buffer.startsWith("DELETE|")) {
        String uid = getToken(buffer, 1);
        uid.trim();
        int idx = findIndexByUID(uid);
        if (idx != -1) {
          removeAt(idx);
          Serial.println("OK|DELETE|" + uid);
        } else {
          Serial.println("ERR|NOT_FOUND");
        }
      }
      else if (buffer.startsWith("DISABLE|")) {
        String uid = getToken(buffer, 1);
        uid.trim();
        int idx = findIndexByUID(uid);
        if (idx != -1) {
          dsThe[idx].status = false;
          Serial.println("OK|DISABLE|" + uid);
        } else {
          Serial.println("ERR|NOT_FOUND");
        }
      }
      else if (buffer.startsWith("ENABLE|")) {
        String uid = getToken(buffer, 1);
        uid.trim();
        int idx = findIndexByUID(uid);
        if (idx != -1) {
          dsThe[idx].status = true;
          Serial.println("OK|ENABLE|" + uid);
        } else {
          Serial.println("ERR|NOT_FOUND");
        }
      }

      // Lệnh thủ công từ web/Python - giữ lại từ code gốc
      else if (buffer.equals("OPEN_GATE")) {
        Serial.println("Nhan lenh mo barie thu cong!");
        cua_ra.write(100);
        digitalWrite(PIN_BUZZER, HIGH);
        delay(100);
        digitalWrite(PIN_BUZZER, LOW);
      }
      else if (buffer.equals("CLOSE_GATE")) {
        Serial.println("Nhan lenh dong barie thu cong!");
        cua_ra.write(10);
        digitalWrite(PIN_BUZZER, HIGH);
        delay(100);
        digitalWrite(PIN_BUZZER, LOW);
      }

      buffer = "";
    } else {
      buffer += c;
    }
  }
}

// ================== SETUP / LOOP ==================
void setup() {
  Serial.begin(9600);

  // I2C
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.clear();

  // Servo
  cua_ra.setPeriodHertz(50);
  cua_ra.attach(PIN_SERVO, 500, 2400);
  cua_ra.write(10);

  // Buzzer
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // SPI + RFID (chỉ định rõ chân cho chắc)
  SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI, SS_PIN);
  mfrc522.PCD_Init();
  delay(250);

  // Chẩn đoán khởi động: RC522 v2.0 hop le phai co PCD_ID = 0x92.
  // Neu 0x00/0xFF hoac getPCDIDName hien "UNKNOWN" -> day SPI long,
  // cap nguon sai (nhap 5V thay 3.3V) hoac module RC522 chet.
  Serial.print("CLEARDATA");
  // 0x37 = giay den PCD_ID (CommandAndStatus). RC522 hop le phai tra 0x92.
  Serial.print("[RFID-DIAG] PCD_ID=0x");
  Serial.print(mfrc522.PCD_ReadRegister((MFRC522::PCD_Register)0x37), HEX);
  Serial.println(" (mong doi 0x92)");

  // Báo danh tính cho Python tự dò port COM (không phụ thuộc số COM).
  // Python gửi GET_ID để lấy lại ID bất cứ lúc nào (VD khi ESP32 reset).
  Serial.println("ID:" + String(DEVICE_ID));

  LCD();
  delay(250);

}

void loop() {
  docBienSoTuPython();

  if (!scanMode) {
    LCD();
  }

  senddata();

  // Nghỉ 50ms giữa 2 vòng để không đốt CPU/ESP32 và không spam serial
  // khi không có thẻ (ghost detection của RC522).
  delay(50);
}
