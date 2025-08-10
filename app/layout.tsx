// layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script"; // ✅ Import Next.js Script component

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Anchor Group Investments - Banking Platform",
  description:
    "Experience the future of banking with real-time transactions, multi-currency support, and enterprise-grade security.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}

        {/* ✅ Tawk.to script added here using Next.js Script component 
        <Script
          id="tawk-to"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
              (function() {
                var s1 = document.createElement("script"),
                    s0 = document.getElementsByTagName("script")[0];
                s1.async = true;
                s1.src = 'https://embed.tawk.to/689647daaf0a4f19272074fb/1j25ghbbm';
                s1.charset = 'UTF-8';
                s1.setAttribute('crossorigin', '*');
                s0.parentNode.insertBefore(s1, s0);
              })();
            `,
          }}
        /> */}
      </body>
    </html>
  );
}
