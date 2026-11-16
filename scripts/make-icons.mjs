// Renders icon/icon.svg into the PNG sizes iOS and the web manifest need.
// Run with: npm run icons
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync('icon/icon.svg')
const outputs = {
  'public/apple-touch-icon.png': 180,
  'public/icon-192.png': 192,
  'public/icon-512.png': 512,
}

for (const [file, size] of Object.entries(outputs)) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(file, png)
  console.log(`${file} (${size}px)`)
}

copyFileSync('icon/icon.svg', 'public/favicon.svg')
console.log('public/favicon.svg')
