const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.py') || file.endsWith('.md')) {
        results.push(file);
      }
    }
  });
  return results;
}

const rootDir = __dirname;
let allFiles = [];
['modules', 'ui', 'scripts'].forEach(folder => {
  allFiles = allFiles.concat(walk(path.join(rootDir, folder)));
});
allFiles.push(path.join(rootDir, 'main.py'));
allFiles.push(path.join(rootDir, 'README.md'));
allFiles.push(path.join(rootDir, 'QUICKSTART.md'));

let filesChanged = 0;

for (const file of allFiles) {
  if (!fs.existsSync(file)) continue;

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
