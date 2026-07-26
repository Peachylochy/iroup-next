import { expect, test } from "@playwright/test";

test("renders the task-first iROUP operations dashboard", async ({ page }) => {
  await page.goto("/preview");

  await expect(page).toHaveTitle(/iROUP Portal/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "สวัสดีค่ะ วันนี้มีอะไรต้องจัดการบ้าง",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "งานที่ต้องดำเนินการ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /ผู้ติดต่อองค์กรต่างประเทศ ข้อมูลภายใน/,
    }),
  ).toBeVisible();
});

test("search and quick-add controls update the dashboard", async ({ page }) => {
  await page.goto("/preview");

  const search = page.getByRole("searchbox", { name: /ค้นหาข้อมูล/ });
  await search.fill("MOU");
  await expect(page.locator(".priority-row")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: /ผู้ติดต่อที่ควรติดตาม/ }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "เพิ่มข้อมูล" }).click();
  await expect(
    page.getByRole("button", { name: /เพิ่มผู้ติดต่อ/ }),
  ).toBeVisible();
});

test("mobile navigation opens and preserves the internal contact label", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");

  await page.getByRole("button", { name: "เปิดเมนู" }).click();
  const mobileNav = page.getByRole("complementary", {
    name: "เมนูบนมือถือ",
  });
  await expect(mobileNav).toBeVisible();
  await expect(
    mobileNav.getByRole("link", {
      name: /ผู้ติดต่อองค์กรต่างประเทศ ข้อมูลภายใน/,
    }),
  ).toBeVisible();

  await mobileNav.getByRole("button", { name: "ปิดเมนู" }).click();
  await expect(mobileNav).toHaveCount(0);
});

test("unauthenticated users are redirected to the staff sign-in page", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "เข้าสู่ระบบ" }),
  ).toBeVisible();
  await expect(page.getByLabel("อีเมล")).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test("staff can switch to the protected account registration form", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "สร้างบัญชี" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "สร้างบัญชีเจ้าหน้าที่" }),
  ).toBeVisible();
  await expect(page.getByLabel("ชื่อที่แสดงในระบบ")).toBeVisible();
  await expect(page.locator(".auth-field > svg")).toHaveCount(0);
  await expect(
    page.getByText(/บัญชีใหม่จะยังใช้งานไม่ได้จนกว่าผู้ดูแลจะอนุมัติสิทธิ์/),
  ).toBeVisible();
});
