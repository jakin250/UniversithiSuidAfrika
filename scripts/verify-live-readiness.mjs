import fs from 'fs';
import path from 'path';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'server.js',
  'public/api-client.js',
  'student-forum/unisa-student-forum-your-campus-your-voice.html',
  'student-bookstore/student-secondhand-bookstore-buy-sell-exchange-textbooks.html',
  'student-marketplace/student-marketplace-buy-sell-trade-on-campus.html'
];

const requiredPageText = new Map([
  ['index.html', ['Universithi SuidAfrika', 'Forum', 'Bookstore', 'Marketplace']],
  ['student-forum/unisa-student-forum-your-campus-your-voice.html', ['Universithi SuidAfrika', 'Forum', 'Bookstore', 'Marketplace', 'heroStartDiscussionBtn']],
  ['student-bookstore/student-secondhand-bookstore-buy-sell-exchange-textbooks.html', ['Universithi SuidAfrika', 'Forum', 'Bookstore', 'Marketplace', 'bookstoreHeroTitle']],
  ['student-marketplace/student-marketplace-buy-sell-trade-on-campus.html', ['Universithi SuidAfrika', 'Forum', 'Bookstore', 'Marketplace', 'marketplaceHeroTitle']]
]);

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing required file: ${file}`);
  }
}

for (const [file, expectedTexts] of requiredPageText) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const contents = fs.readFileSync(fullPath, 'utf8');
  for (const text of expectedTexts) {
    if (!contents.includes(text)) {
      failures.push(`${file} is missing expected text: ${text}`);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!packageJson.scripts?.start) failures.push('package.json is missing a start script.');
if (!packageJson.engines?.node) failures.push('package.json is missing an engines.node deployment constraint.');

if (failures.length) {
  console.error('Live readiness check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Live readiness checks passed.');
