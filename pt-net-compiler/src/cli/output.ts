import * as fs from 'fs';
import * as path from 'path';

export function writeArtifacts(dir: string, files: Record<string, string>): string[] {
  fs.mkdirSync(dir, { recursive: true });
  return Object.entries(files).map(([name, content]) => {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  });
}
