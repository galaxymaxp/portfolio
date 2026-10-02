# Portfolio

Dark, minimal portfolio with interactive 3D objects and scroll + mouse parallax.
React Three Fiber, drei, Lenis, Vite.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

- Edit your name, text and projects in `src/content.js`.
- 3D shapes live in `src/objects.jsx`; camera, fog and lighting in `src/Scene.jsx`.
- Scrolling moves the camera down the z axis; the mouse shifts it sideways, so near objects move more than far ones.
- Hover an object to spin it up, click a project object to open its card (Esc closes).
