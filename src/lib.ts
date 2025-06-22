import path from "node:path";
import sharp from "sharp";
import fs from "node:fs/promises";
import createKDTree from "static-kdtree";
import { dhash, isFolder, isImageFile, mapLimit, pathExists } from "./utils";

/**
 * Configuration options for the duplicate image detection algorithm.
 */
interface Options {
  /**
   * Size of the hash grid used for perceptual hashing.
   * Larger values provide more precision but require more processing time.
   * @default 8
   */
  hashSize?: number;

  /**
   * Maximum number of duplicate images to find for each source image.
   * @default 100
   */
  maxDuplicates?: number;

  /**
   * Maximum Hamming distance between image hashes to consider them as duplicates.
   * Lower values require higher visual similarity.
   * @default 5
   */
  maxDistance?: number;
}

const defaultOptions = {
  hashSize: 8,
  maxDuplicates: 100,
  maxDistance: 5,
};

/**
 * Finds duplicate images based on visual similarity using perceptual hashing.
 *
 * This function analyzes images using difference hashing (dHash) to create perceptual fingerprints
 * and then uses a k-d tree for efficient similarity matching. Images are considered duplicates
 * if their hash distance is within the specified threshold.
 *
 * @param source - Path to a directory containing images, or an array of paths to directories and/or image files
 * @param options - Configuration options for the duplicate detection algorithm
 * @param options.hashSize - Size of the hash grid (default: 8). Larger values provide more precision but slower processing
 * @param options.maxDuplicates - Maximum number of duplicates to find per image (default: 100)
 * @param options.maxDistance - Maximum Hamming distance between hashes to consider images as duplicates (default: 5). Lower values require higher similarity
 *
 * @returns Promise that resolves to an array of duplicate groups. Each group is an array of image objects
 *          containing path, width, and height. Images within each group are sorted by resolution (highest first).
 *
 * @throws {Error} When image metadata cannot be read or when source paths don't exist
 *
 * @example
 * ```typescript
 * // Find duplicates in a single directory
 * const duplicates = await findDuplicateImages('/path/to/images');
 *
 * // Find duplicates across multiple sources with custom settings
 * const duplicates = await findDuplicateImages(
 *   ['/path/to/dir1', '/path/to/dir2', '/path/to/image.jpg'],
 *   {
 *     hashSize: 16,     // Higher precision
 *     maxDistance: 3,   // Stricter similarity
 *     maxDuplicates: 5  // Limit results
 *   }
 * );
 *
 * // Process results
 * duplicates.forEach((group, index) => {
 *   console.log(`Duplicate group ${index + 1}:`);
 *   group.forEach((image, i) => {
 *     const isHighest = i === 0 ? '(highest resolution)' : '';
 *     console.log(`  ${image.path} [${image.width}x${image.height}] ${isHighest}`);
 *   });
 * });
 * ```
 *
 * @since 1.0.0
 */
export default async function findDuplicateImages(
  source: string | string[],
  {
    hashSize = 8,
    maxDuplicates = 100,
    maxDistance = 5,
  }: Options = defaultOptions
): Promise<Array<Array<{ path: string; width: number; height: number }>>> {
  let imageFilePaths: string[];

  if (Array.isArray(source)) {
    // If source is an array of file and directory paths, process each item
    const allImagePaths: string[] = [];

    for (const item of source) {
      // Check if the path exists first
      if (!(await pathExists(item))) {
        continue;
      }

      if (await isFolder(item)) {
        // If it's a directory, read files and add image paths
        try {
          const files = await fs.readdir(item);
          const imageFiles = files.filter(isImageFile).sort(); // Sort for consistent ordering
          const imagePaths = imageFiles.map((f) => path.join(item, f));
          allImagePaths.push(...imagePaths);
        } catch {
          // Skip directories that can't be read
          continue;
        }
      } else if (isImageFile(item)) {
        // If it's an image file, add it directly
        allImagePaths.push(item);
      }
    }

    imageFilePaths = allImagePaths.sort(); // Sort for consistent ordering
  } else {
    // If source is a directory path, read files and create full paths
    const files = await fs.readdir(source);
    const imageFiles = files.filter(isImageFile).sort(); // Sort for consistent ordering
    imageFilePaths = imageFiles.map((f) => path.join(source, f));
  }
  const hashList: Array<Array<number>> = await mapLimit(
    imageFilePaths,
    1,
    async (file: string): Promise<Array<number>> => {
      const hash = await dhash(file, hashSize);
      return [...hash];
    }
  );

  const tree = createKDTree(hashList);

  const duplicateIdxSet = new Set();
  const duplicates: Array<Array<string>> = [];

  for (let i = 0; i < hashList.length; i++) {
    if (duplicateIdxSet.has(i)) {
      continue;
    }

    const hash = hashList[i];
    let duplicatesIdx = tree.knn(hash, maxDuplicates + 1, maxDistance); // +1 to account for the original image

    if (duplicatesIdx && duplicatesIdx.length > 1) {
      // Filter out any indices that have already been processed
      duplicatesIdx = duplicatesIdx.filter((idx) => !duplicateIdxSet.has(idx));

      // Only add if we still have more than one duplicate after filtering
      if (duplicatesIdx.length > 1) {
        // Ensure we don't exceed the maxDuplicates limit
        const limitedDuplicates = duplicatesIdx.slice(0, maxDuplicates);
        const dups = limitedDuplicates.map((i) => imageFilePaths[i]);
        duplicates.push(dups);

        // Mark all found duplicates as processed
        for (const idx of limitedDuplicates) {
          duplicateIdxSet.add(idx);
        }
      }
    }
  }

  // Get metadata for each duplicate group and sort by resolution
  const duplicatesWithMetadata: Array<
    Array<{ path: string; width: number; height: number }>
  > = [];

  for (const files of duplicates) {
    const filesWithMetadata: Array<{
      path: string;
      width: number;
      height: number;
    }> = [];

    for (const file of files) {
      if (await pathExists(file)) {
        try {
          const metadata = await sharp(file).metadata();
          filesWithMetadata.push({
            path: file,
            width: metadata.width || 0,
            height: metadata.height || 0,
          });
        } catch (error) {
          throw new Error(`Could not read metadata for ${file}:`, error);
        }
      }
    }

    // Sort by resolution (width * height) in descending order (highest resolution first)
    filesWithMetadata.sort((a, b) => {
      // First sort by resolution (highest first)
      const resolutionDiff = b.width * b.height - a.width * a.height;
      if (resolutionDiff !== 0) return resolutionDiff;

      // If resolution is the same, sort by filename
      return path.basename(a.path).localeCompare(path.basename(b.path));
    });

    if (filesWithMetadata.length > 0) {
      duplicatesWithMetadata.push(filesWithMetadata);
    }
  }

  return duplicatesWithMetadata;
}
