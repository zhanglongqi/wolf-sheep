import { defineConfig } from "vite";

// Served from https://<user>.github.io/wolf-sheep/ via GitHub Pages, so
// asset URLs must be prefixed with the repo name instead of the domain root.
export default defineConfig({
  base: "/wolf-sheep/",
});
