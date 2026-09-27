import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plan My Trip - Multi-Agent Travel Planning System",
  description: "Your Journey, Perfectly Crafted with Intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
