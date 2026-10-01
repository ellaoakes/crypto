# OakhavenDevelopments.com

Static marketing site for Oakhaven Developments Limited, featuring Castlegate, Prestbury.

- No build step: upload the contents of this folder to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3) and point `oakhavendevelopments.com` at it.
- Preview locally: `python3 -m http.server 8000` in this folder, then open http://localhost:8000.
- Animations use GSAP + ScrollTrigger (vendored in `assets/vendor`, v3.15.0). With reduced motion or no JavaScript, the page shows the finished house without animation.

## To confirm before launch
- The enquiry form posts to `mailto:enquiries@oakhavendevelopments.com`, which is a placeholder address. Swap it for a real inbox or a form service such as Formspree or Netlify Forms.
- Images are cropped from the supplied CGI collage at about 770px wide. Higher-resolution renders would look sharper on large screens.
