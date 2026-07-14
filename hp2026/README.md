# The GovLab — Homepage (proposal)

Single self-contained, responsive `index.html` (desktop + mobile via CSS media queries).
No build step. Open the file or serve the folder.

## Files
- `index.html` — the page
- `assets/` — logos and the three "Latest" thumbnails referenced locally

## Notes
- Most project-tile logos load live from each project’s own domain; the local `assets/` files are the GovLab logo, the Burnes and Smarter Crowdsourcing SVGs, and the three blog thumbnails.
- The three "The Latest" cards are hard-coded with current posts — wire these to the blog feeds when integrating.
- Fonts/icons load from Google Fonts + Font Awesome CDNs.
