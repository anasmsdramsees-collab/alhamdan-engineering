// Pure Node.js PNG generator - no dependencies
import { createWriteStream } from 'fs';
import { createDeflate } from 'zlib';
import { Buffer } from 'buffer';

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const combined = Buffer.concat([typeBytes, data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(combined));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function makePNG(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB color type
  // rest zeros (compression, filter, interlace)

  // IDAT - raw pixel data with filter bytes
  const rowSize = size * 3;
  const raw = Buffer.alloc((rowSize + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (rowSize + 1);
    raw[row] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      const px = row + 1 + x * 3;
      const cx = x - size / 2, cy = y - size / 2;
      const rad = size * 0.2;
      // Rounded rect check
      const inRect = Math.abs(cx) < size/2 - rad && Math.abs(cy) < size/2 - rad;
      const corner = Math.abs(cx) >= size/2 - rad && Math.abs(cy) >= size/2 - rad;
      const dist = Math.sqrt((Math.abs(cx) - (size/2 - rad))**2 + (Math.abs(cy) - (size/2 - rad))**2);
      const inside = inRect || (!corner) || dist < rad;
      if (inside) { raw[px] = r; raw[px+1] = g; raw[px+2] = b; }
      else { raw[px] = 248; raw[px+1] = 250; raw[px+2] = 252; } // bg color
    }
  }

  const deflated = require('zlib').deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { writeFileSync } from 'fs';

// Blue: #1e40af = rgb(30, 64, 175)
writeFileSync('public/icon-192.png', makePNG(192, 30, 64, 175));
writeFileSync('public/icon-512.png', makePNG(512, 30, 64, 175));
console.log('PNG icons created!');
