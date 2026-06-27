import fs from 'fs';
import path from 'path';

const files = [
  'public/pwa-192x192.png',
  'public/pwa-512x512.png',
  'public/maskable-icon-512x512.png',
  'public/apple-touch-icon.png'
];

let allValid = true;

for (const file of files) {
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${file}`);
    allValid = false;
    continue;
  }
  
  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    console.error(`File is empty: ${file}`);
    allValid = false;
    continue;
  }
  
  // Read first 8 bytes
  const buffer = Buffer.alloc(8);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 8, 0);
  fs.closeSync(fd);
  
  // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  const isPNG = buffer[0] === 0x89 &&
                buffer[1] === 0x50 &&
                buffer[2] === 0x4E &&
                buffer[3] === 0x47 &&
                buffer[4] === 0x0D &&
                buffer[5] === 0x0A &&
                buffer[6] === 0x1A &&
                buffer[7] === 0x0A;
                
  if (isPNG) {
    console.log(`[PASS] ${file} is a valid PNG image (size: ${stats.size} bytes)`);
  } else {
    console.error(`[FAIL] ${file} has invalid signature: ${buffer.toString('hex')}`);
    allValid = false;
  }
}

process.exit(allValid ? 0 : 1);
