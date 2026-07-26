import { AuthForm } from "@/features/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-intro" aria-label="เกี่ยวกับ iROUP Portal">
        <div>
          <span className="auth-product-mark" aria-hidden="true">
            iR
          </span>
          <h2>งานวิเทศสัมพันธ์<br />จัดการได้ในที่เดียว</h2>
          <p>
            ดูงานเร่งด่วน ติดตาม MOU บริหาร Mobility การเดินทาง
            และข้อมูลผู้ติดต่อภายในจากพื้นที่ทำงานเดียวกัน
          </p>
        </div>
      </section>
      <section className="auth-form-region">
        <AuthForm />
      </section>
    </main>
  );
}
