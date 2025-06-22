import sharp from "sharp";
import fs from "node:fs/promises";
import assert from "assert";

/**
 * Checks if a given path points to a directory.
 * @param path - The file system path to check
 * @returns Promise that resolves to true if the path is a directory
 */
export async function isFolder(path: string) {
  try {
    return (await fs.stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Processes an array with a concurrency limit to avoid overwhelming the system.
 * @param array - Array of items to process
 * @param limit - Maximum number of concurrent operations
 * @param iteratee - Async function to apply to each item
 * @returns Promise that resolves to an array of results
 */
export async function mapLimit<T, R>(
  array: T[],
  limit: number,
  iteratee: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < array.length; i += limit) {
    const batch = array.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(iteratee));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Checks if a file exists at the given path.
 * @param filePath - The path to check
 * @returns Promise that resolves to true if the file exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determines if a file is a supported image format based on its extension.
 * @param path - The file path to check
 * @returns True if the file extension indicates a supported image format
 */
export function isImageFile(path: string) {
  return (
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".webp") ||
    path.endsWith(".gif") ||
    path.endsWith(".avif") ||
    path.endsWith(".tiff") ||
    path.endsWith(".tif") ||
    path.endsWith(".svg")
  );
}

export function px(pixels: Buffer, width: number, x: number, y: number) {
  const pixel = width * y + x;
  assert(pixel < pixels.length);
  return pixels[pixel];
}

export function binaryToHex(s: string) {
  let output = "";
  for (let i = 0; i < s.length; i += 4) {
    const bytes = s.slice(i, i + 4);
    const decimal = parseInt(bytes, 2);
    const hex = decimal.toString(16);
    output += hex;
  }
  return Buffer.from(output, "hex");
}

/**
 * Computes a difference hash (dHash) for an image, creating a perceptual fingerprint.
 *
 * The dHash algorithm works by:
 * 1. Converting the image to grayscale
 * 2. Resizing to a small grid (hashSize x hashSize+1)
 * 3. Comparing adjacent pixels to create a binary hash
 * 4. Converting the binary string to a hexadecimal buffer
 *
 * This creates a hash that is resilient to minor changes like compression,
 * resizing, and slight color adjustments while being sensitive to structural changes.
 *
 * @param path - Path to the image file
 * @param hashSize - Size of the hash grid (default: 8, creates 64-bit hash)
 * @returns Promise that resolves to a Buffer containing the image hash
 * @throws {Error} When the image cannot be processed by Sharp
 */
export async function dhash(path: string, hashSize = 8) {
  const height = hashSize;
  const width = height + 1;

  // Covert to small gray image
  const pixels = await sharp(path)
    .grayscale()
    .resize({ width, height, fit: "fill" })
    .raw()
    .toBuffer();

  let difference = "";
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < height; col++) {
      // height is not a mistake here...
      const left = px(pixels, width, col, row);
      const right = px(pixels, width, col + 1, row);
      difference += left < right ? 1 : 0;
    }
  }
  return binaryToHex(difference);
}