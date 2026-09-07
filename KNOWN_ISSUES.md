# Known Issues

## Standard of Care numerals do not exactly match the reference

**Status:** Deferred.

The outlined `01`–`04` numerals in the homepage Standard of Care cards still
render differently from the owner-approved root `index.html` reference. The
reference uses Cormorant Garamond at 500 weight and 76px, with a 0.8 line height,
transparent fill, a 1px card-border-colored text stroke, and 0.01em letter
spacing.

An explicit `cormorant.className` was added to each numeral after the shared CSS
font-family declaration did not produce the same appearance. That change is
being retained, but it did not resolve the visual mismatch. Further font-file
and browser-rendering investigation is intentionally deferred.
