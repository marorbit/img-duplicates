# Image Duplicate Finder CLI tool and JavaScript library

A CLI tool and JavaScript library for detecting duplicate and visually similar images across your file system. Using perceptual hashing algorithms, it can identify images that are essentially the same even when they differ in resolution, file format, compression level, or have very minor edits.

**Compatible JavaScript runtimes: Node.js, Deno and Bun**

## CLI Usage

### Installation

#### Node.js
Requires [Node.js](https://nodejs.org/) to be installed.

Run directly without installation:
```bash
npx img-duplicates [options] <source...>
```

Or install globally:
```bash
npm install -g img-duplicates
```
**Note:** Depending on how you installed Node.js, the above command may require admin rights.

#### Deno
Requires [Deno](https://deno.land/) to be installed.
You can run the tool directly from npm:
```bash
deno run --allow-read --allow-write --allow-env --allow-ffi --allow-sys npm:img-duplicates [options] <source...>
```

#### Bun
Requires [Bun](https://bun.sh/) to be installed.
You can run the tool directly with:
```bash
bunx img-duplicates [options] <source...>
```

Or install globally:
```bash
bun install -g img-duplicates
```

### Usage

After installation, the CLI tool is globally available:

```bash
img-duplicates [options] <source...>
```

### Arguments

- `source` - One or more directories or image files to search for duplicates

### Options

- `-h, --hash-size <size>` - Hash size for perceptual hashing (default: 8)
- `-d, --max-duplicates <num>` - Maximum number of duplicates per image (default: 100)
- `-m, --max-distance <dist>` - Maximum distance for similarity matching (default: 5)
- `--delete` - Delete duplicate images (keeps highest resolution, asks for confirmation)
- `--force-delete` - Delete duplicate images without confirmation
- `--help` - Show this help message
- `--version` - Show version number

### Examples

```bash
# Search a directory for duplicates (Node.js)
img-duplicates /path/to/images
# or with npx
npx img-duplicates /path/to/images

# Search multiple directories (Deno)
deno run --allow-read --allow-write --allow-env --allow-ffi --allow-sys npm:img-duplicates /path/to/dir1 /path/to/dir2

# With custom settings (Bun)
bunx img-duplicates --hash-size 16 --max-distance 3 /path/to/images

# Mix files and directories (npx)
npx img-duplicates /path/to/image1.jpg /path/to/image2.png /path/to/directory

# Delete duplicates with confirmation
img-duplicates --delete /path/to/images

# Delete duplicates without confirmation (use with caution!)
img-duplicates --force-delete /path/to/images
```

**Note**: When using `--delete` or `--force-delete`, the image with the highest resolution in each duplicate group will be kept, and all others will be deleted.

## Programmatic Usage

### Installation

#### Node.js
```bash
npm install img-duplicates
```

#### Deno
No installation needed, import directly from npm:
```typescript
import findDuplicateImages from 'npm:img-duplicates';
```

#### Bun
```bash
bun add img-duplicates
```

### Usage

#### Node.js / Bun
```typescript
import findDuplicateImages from 'img-duplicates';

const duplicates = await findDuplicateImages('/path/to/images', {
  hashSize: 8,
  maxDuplicates: 100,
  maxDistance: 5
});

console.log(duplicates);
```

#### Deno
```typescript
import findDuplicateImages from 'npm:img-duplicates';

const duplicates = await findDuplicateImages('/path/to/images', {
  hashSize: 8,
  maxDuplicates: 100,
  maxDistance: 5
});

console.log(duplicates);
```

### API

#### `findDuplicateImages(source, options?)`

- `source`: `string | string[]` - Path to a directory or array of paths to directories/files
- `options`: `Object` (optional)
  - `hashSize`: `number` - Hash size for perceptual hashing (default: 8)
  - `maxDuplicates`: `number` - Maximum number of duplicates per image (default: 100)
  - `maxDistance`: `number` - Maximum distance for similarity matching (default: 5)

**Returns**: `Promise<Array<Array<{ path: string; width: number; height: number }>>>`

Each group of duplicates is sorted by resolution (highest resolution first).

## Supported Image Formats

All image formats supported by [sharp](https://sharp.pixelplumbing.com/#formats):

- PNG (.png)
- JPEG (.jpg, .jpeg)
- WebP (.webp)
- GIF (.gif)
- AVIF (.avif)
- TIFF (.tiff, .tif)
- SVG (.svg)

## How It Works

The tool uses:
1. **Perceptual Hashing (dHash)** - Creates a hash based on the visual content of the image
2. **k-d Tree** - For efficient similarity search
3. **Hamming Distance** - To measure similarity between hashes

This allows finding images that are visually similar, even if they have different resolutions, compression, or minor edits.

## License

MIT
