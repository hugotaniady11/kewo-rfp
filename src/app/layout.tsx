import "./globals.css";
import AuthLayout from "@/components/auth";

export const metadata = {
  title: "Next.js Radix Auth App",
  description: "Simple global auth layout",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthLayout>{children}</AuthLayout>
      </body>
    </html>
  );
}
