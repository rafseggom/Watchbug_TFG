import fs from 'fs';
import path from 'path';

const srcDir = 'E:\\Proyectos Github\\Watchbug_TFG\\watchbugus-fun\\src';

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const newLines = lines.map(line => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      // Replace imports like: from '../utils/audio' -> from '../utils/audio.ts'
      // But not: from './style.css', from './data/jokes.ts', etc.
      line = line.replace(
        /from\s+['"](\.[^'"]*?)(?<!\.ts)(?<!\.js)(?<!\.css)(?<!\.json)['"]/g,
        "from '$1.ts'"
      );
      line = line.replace(
        /from\s+['"](\.\/[^'"]*?)(?<!\.ts)(?<!\.js)(?<!\.css)(?<!\.json)['"]/g,
        "from '$1.ts'"
      );
      // Dynamic imports
      line = line.replace(
        /import\(['"](\.[^'"]*?)(?<!\.ts)(?<!\.js)(?<!\.css)(?<!\.json)['"]\)/g,
        "import('$1.ts')"
      );
      line = line.replace(
        /import\(['"](\.\/[^'"]*?)(?<!\.ts)(?<!\.js)(?<!\.css)(?<!\.json)['"]\)/g,
        "import('$1.ts')"
      );
    }
    return line;
  });
  fs.writeFileSync(filePath, newLines.join('\n'));
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(srcDir);
console.log('Done fixing imports');