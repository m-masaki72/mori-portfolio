import sharp from 'sharp';
import { readdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const dir = 'public/projects';

if (!existsSync(dir)) process.exit(0);

const pngs = readdirSync(dir).filter(f => extname(f) === '.png');

await Promise.all(pngs.map(async (file) => {
    const webp = join(dir, basename(file, '.png') + '.webp');
    if (existsSync(webp)) return;
    await sharp(join(dir, file)).webp({ quality: 85 }).toFile(webp);
    console.log(`converted: ${file} → ${basename(webp)}`);
}));
