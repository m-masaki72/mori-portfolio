import sharp from 'sharp';
import { readdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const dir = 'public/screenshots';

if (!existsSync(dir)) process.exit(0);

const sources = readdirSync(dir).filter(f => ['.png', '.jpg', '.jpeg'].includes(extname(f).toLowerCase()));

await Promise.all(sources.map(async (file) => {
    const webp = join(dir, basename(file, extname(file)) + '.webp');
    if (existsSync(webp)) return;
    await sharp(join(dir, file)).webp({ quality: 85 }).toFile(webp);
    console.log(`converted: ${file} → ${basename(webp)}`);
}));
