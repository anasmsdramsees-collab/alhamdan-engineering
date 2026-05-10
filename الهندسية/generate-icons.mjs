// Run with: node generate-icons.mjs
// Generates PNG icons from canvas (requires node >= 18 with --experimental-vm-modules or use sharp)
// Simple approach: create SVG icons directly

import { writeFileSync } from 'fs';

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#1e40af"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
    font-family="Arial, sans-serif" font-weight="bold" fill="white"
    font-size="${size * 0.45}">ح</text>
</svg>`;

writeFileSync('public/icon-192.svg', svg(192));
writeFileSync('public/icon-512.svg', svg(512));
console.log('SVG icons created');
