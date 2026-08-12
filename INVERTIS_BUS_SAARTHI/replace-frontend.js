const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const frontendSrc = path.join(__dirname, 'frontend', 'src');
const files = walk(frontendSrc);

let filesChanged = 0;

for (const file of files) {
  if (file.includes('translations.js')) continue; // Skip translations, already did it

  let content = fs.readFileSync(file, 'utf8');
  let newContent = content
    .replace(/student_id/g, 'passenger_id')
    .replace(/student_name/g, 'passenger_name')
    .replace(/studentId/g, 'passengerId')
    .replace(/student/g, 'passenger')
    .replace(/Student/g, 'Passenger')
    .replace(/STUDENT/g, 'PASSENGER');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    filesChanged++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Done. Changed ${filesChanged} files.`);
