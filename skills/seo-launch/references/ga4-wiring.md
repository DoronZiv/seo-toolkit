# Google Analytics 4 — wire into Next.js root layout

`app/layout.js`:

```js
import Script from "next/script";

const GA_MEASUREMENT_ID = "G-XXXXXXXXXX";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
```

`afterInteractive` strategy: loads after page becomes visible so it doesn't
block first paint. Tracks every page view across every route automatically.

Verify by visiting the live site, then GA4 → Realtime. Should see the
visitor within 30 seconds.
