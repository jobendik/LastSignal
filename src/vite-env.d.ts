/// <reference types="vite/client" />

// Stylesheet side-effect imports — resolved by Vite at build time but need
// declarations for tsc --noEmit to pass under moduleResolution: Bundler with types: [].
declare module "*.css";

// Raw text imports via ?raw Vite feature.
declare module "*?raw" {
  const content: string;
  export default content;
}
