import "./globals.css";

export const metadata = {
  title: "Market Signal Console",
  description: "Interactive portfolio screening dashboard for signals, sectors, rankings, and risk metrics.",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
