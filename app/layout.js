import "./globals.css";

export const metadata = {
  title: "Have I Been Paid?",
  description: "Track freelance invoices and timecards",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Google Identity Services — required for Drive login */}
        <script src="https://accounts.google.com/gsi/client" async defer></script>
        {/* Cursive signature fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Allura&family=Clicker+Script&family=Dancing+Script:wght@700&family=Great+Vibes&family=Italianno&family=Marck+Script&family=Pinyon+Script&family=Sacramento&family=Satisfy&family=Tangerine:wght@700&family=Yellowtail&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
