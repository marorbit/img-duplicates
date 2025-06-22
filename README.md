# Image Duplicate Finder CLI tool and library for Node.js

A CLI tool and Node.js library for detecting duplicate and visually similar images across your file system. Using perceptual hashing algorithms, it can identify images that are essentially the same even when they differ in resolution, file format, compression level, or have very minor edits.

## Installation

```bash
npm install img-duplicates
```

## CLI Usage

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
# Search a directory for duplicates
img-duplicates /path/to/images

# Search multiple directories
img-duplicates /path/to/dir1 /path/to/dir2

# With custom settings
img-duplicates --hash-size 16 --max-distance 3 /path/to/images

# Mix files and directories
img-duplicates /path/to/image1.jpg /path/to/image2.png /path/to/directory

# Delete duplicates with confirmation
img-duplicates --delete /path/to/images

# Delete duplicates without confirmation (use with caution!)
img-duplicates --force-delete /path/to/images
```

**Note**: When using `--delete` or `--force-delete`, the image with the highest resolution in each duplicate group will be kept, and all others will be deleted.

## Programmatic Usage

```typescript
import findDuplicateImages from 'img-duplicates';

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
