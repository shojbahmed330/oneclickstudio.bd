
import { Validator } from './services/Validator';
import * as fs from 'fs';
import * as path from 'path';

function getAllFiles(dir: string, fileList: Record<string, string> = {}): Record<string, string> {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.next'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else {
      const relativePath = path.relative(process.cwd(), filePath);
      fileList[relativePath] = fs.readFileSync(filePath, 'utf8');
    }
  });
  return fileList;
}

const allFiles = getAllFiles(process.cwd());
const validator = new Validator();
const errors = validator.validateOutput(allFiles, allFiles, []);

console.log(JSON.stringify(errors, null, 2));
