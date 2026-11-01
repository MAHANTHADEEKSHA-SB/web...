import { defineConfig } from "vite";

// C8: a Content-Security-Policy for the production build only (the dev
// server's hot reload needs a websocket the policy would block).
// font-src allows data: because Vite inlines small font subsets.
// style-src needs 'unsafe-inline' for the inline style attributes used by
// the donut, bars and legend dots.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

export default defineConfig({
  plugins: [
    {
      name: "orbit-csp",
      apply: "build",
      transformIndexHtml: (html) =>
        html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        ),
    },
  ],
});
