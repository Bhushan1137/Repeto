const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Ensure .well-known directory exists in dist
const wellKnownDist = path.join(distDir, '.well-known');
if (!fs.existsSync(wellKnownDist)) {
  fs.mkdirSync(wellKnownDist, { recursive: true });
}

// Copy public files directly to dist to guarantee pure static HTML (no React/Expo interception)
const filesToCopy = [
  { src: path.join(publicDir, 'privacy.html'), dest: path.join(distDir, 'privacy.html') },
  { src: path.join(publicDir, 'privacy.html'), dest: path.join(distDir, 'privacy-policy.html') },
  { src: path.join(publicDir, 'terms.html'), dest: path.join(distDir, 'terms.html') },
  { src: path.join(publicDir, 'terms.html'), dest: path.join(distDir, 'terms-of-service.html') },
  { src: path.join(publicDir, 'account-deletion.html'), dest: path.join(distDir, 'account-deletion.html') },
  { src: path.join(publicDir, 'robots.txt'), dest: path.join(distDir, 'robots.txt') },
  { src: path.join(publicDir, '.well-known', 'assetlinks.json'), dest: path.join(wellKnownDist, 'assetlinks.json') },
];

for (const { src, dest } of filesToCopy) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[post-build] Copied ${path.relative(rootDir, src)} -> ${path.relative(rootDir, dest)}`);
  } else {
    console.warn(`[post-build] Warning: Source file not found: ${src}`);
  }
}

console.log('[post-build] Static legal and compliance pages successfully synced to dist.');
