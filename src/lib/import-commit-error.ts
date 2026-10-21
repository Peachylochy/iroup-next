export function importCommitErrorMessage(message: string): string {
  if (message.endsWith("_EXISTING_RECORD_REQUIRES_RECONCILIATION")) {
    return "พบรายการที่มีอยู่แล้ว จึงยกเลิกการนำเข้าทั้งชุด ข้อมูลเดิมและข้อมูลที่เจ้าหน้าที่เพิ่มเติมยังไม่เปลี่ยนแปลง กรุณาตรวจเทียบรายการซ้ำกับข้อมูลปัจจุบันก่อนเตรียมชุดนำเข้าใหม่";
  }
  return message;
}
