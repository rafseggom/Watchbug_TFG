import fs from 'fs';
import path from 'path';

const srcDir = 'E:\\Proyectos Github\\Watchbug_TFG\\watchbugus-fun\\src';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Add .ts extension to relative imports that don't have one
  // from '../utils/audio' -> from '../utils/audio.ts'
  // But NOT: from './style.css', from './data/jokes.ts', etc.
  content = content.replace(
    /from\s+['"](\.[^'"]*?)(?<!\.ts)(?<!\.js)(?<!\.css)(?<!\.json)['"]/g,
    "from '$1.ts'"
  );
  content = content.replace(
    /from\s+['"](\.\/[^'"]*?)(?<!\.ts)(?<!\.js)(?<!\.css)(?<!\.json)['"]/g,
    "from '$1.ts'"
  );
  
  // Dynamic imports
  content = content.replace(
    /import\(['"](\.[^'"]*?)(?<!\.ts)(?<!\.js)(?<!\.css)(?<!\.json)['"]\)/g,
    "import('$1.ts')"
  );
  content = content.replace(
    /import\(['"](\.\/[^'"]*?)(?<!\.ts)(?<!\.js)(?<!\.css)(?<!\.json)['"]\)/g,
    "import('$1.ts')"
  );
  
  fs.writeFileSync(filePath, content);
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
console.log('Done adding .ts extensions to imports');