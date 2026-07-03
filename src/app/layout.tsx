import type { Metadata } from "next";
import "./globals.css";
import { Topbar } from "@/components/Topbar";
import { AboutProvider } from "@/components/AboutProvider";

export const metadata: Metadata = {
  title: "Thunder/Lightning",
  description: "A Love Letter to Music Videos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AboutProvider>
          <Topbar />
          {children}
        </AboutProvider>
      </body>
    </html>
  );
}
