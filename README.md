# Joshua Noel — Personal Site

A single-page personal site for Joshua Noel, an automations engineer based in
Trinidad. It's a small static site built with plain HTML, CSS, and vanilla
JavaScript. No framework, no build step.

## Structure

- `index.html` — page content: intro, "what I work on", and contact.
- `styles.css` — design tokens and styling. The CSS custom properties at the
  top control the palette and spacing, so most of the look can be changed from
  one place.
- `script.js` — light entrance animations using an IntersectionObserver.

## Running locally

Open `index.html` directly in a browser, or serve the folder with any static
server:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.
