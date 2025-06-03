# Lemona App Client

## Video Export Requirements

### SharedArrayBuffer Support

For browser-based video export to work, the application requires SharedArrayBuffer support. This has been disabled in most browsers due to security concerns but can be re-enabled with proper headers.

#### Required Headers

The following headers must be set by your web server:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

#### Next.js Configuration

These headers are automatically configured in `next.config.ts` for local development.

#### Production Deployment

For production deployments (Vercel, Netlify, etc.), ensure these headers are set:

**Vercel**: Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        }
      ]
    }
  ]
}
```

**Netlify**: Add to `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

#### Fallback Export

If SharedArrayBuffer is not available, the app will automatically:
1. Download a project bundle (JSON) with all clip metadata
2. Attempt to download individual asset files
3. Provide instructions for using desktop video editing software

## Development

```bash
npm install
npm run dev
```

## Troubleshooting Export Issues

### Asset 404 Errors
- Check if asset IDs exist in the database
- Verify asset files are uploaded to cloud storage
- Check server logs for asset URL generation errors

### Browser Support
- Use Chrome or Firefox for best compatibility
- Ensure HTTPS is enabled (required for SharedArrayBuffer)
- Check browser console for detailed error messages

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
