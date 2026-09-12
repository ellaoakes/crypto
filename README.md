# Kitty — pilot landing page

A basic, no-build static website for the group-trip coordination business
described in the business plan (working name: "Kitty" is a placeholder,
easy to swap). It's built for where the business actually is right now —
pre-launch, validating the idea by hand — so it's a waitlist/pilot page
rather than a full product site.

## Structure

```
index.html      Single-page site: hero, problem, how it works, pricing, FAQ, waitlist form
css/styles.css  All styling, no framework
js/main.js      Mobile nav toggle + waitlist form handling
favicon.svg
```

No build step, no dependencies. Open `index.html` directly in a browser,
or serve the folder with any static file server, e.g.:

```
python3 -m http.server 8000
```

## Deploying

Any static host works as-is: GitHub Pages, Netlify, Vercel, Cloudflare
Pages. Push this repo and point the host at the root directory.

## Things to swap before this goes live

- **Brand name.** "Kitty" is a placeholder that fits the shared-deposit-pot
  idea — replace throughout `index.html` (logo, title, footer) once a real
  name is chosen.
- **Email address.** `hello@kitty.trip` appears in the footer and in the
  waitlist form's mailto link — replace with a real inbox.
- **Waitlist form.** The form currently opens the visitor's email client
  via a `mailto:` link (`js/main.js`) so it works with zero backend. Once
  you're ready to collect signups properly, wire it to a form service
  (Formspree, Netlify Forms, a simple serverless function) instead.
- **Legal/regulatory copy.** The FAQ answers on deposit safety and data
  collection are placeholders reflecting the plan's stated intent (a
  regulated payments partner, a plain-English privacy notice) — replace
  with the real text once that's in place, and take legal advice before
  taking any real payment, as the business plan itself flags.
- **Manchester/pilot framing.** Update or remove the pilot section once
  the concierge phase (business plan, section 8) has moved on.

## Content source

Copy on this page is drawn directly from the business plan's summary,
problem hypotheses, MVP feature list, and pricing model, kept deliberately
honest about the pre-validation stage rather than describing a finished
product.
