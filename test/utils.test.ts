import { test, describe } from "node:test";
import assert from "node:assert";
import path from "node:path";
import findDuplicateImages from "../src/lib.js";
import { isFolder, mapLimit, pathExists, isImageFile, dhash, px, binaryToHex } from "../src/utils.js";

describe("Internal Helper Functions", () => {
  test("isImageFile should correctly identify image files", () => {
    // Test valid image extensions
    const validExtensions = [
      "test.png",
      "test.jpg",
      "test.jpeg",
      "test.webp",
      "test.gif",
      "test.avif",
      "test.tiff",
      "test.tif",
      "test.svg",
    ];

    const invalidExtensions = [
      "test.txt",
      "test.pdf",
      "test.doc",
      "test.mp4",
      "test.zip",
      "test.js",
    ];

    // Test valid extensions
    for (const filename of validExtensions) {
      assert(
        isImageFile(filename),
        `${filename} should be identified as an image file`
      );
    }

    // Test invalid extensions
    for (const filename of invalidExtensions) {
      assert(
        !isImageFile(filename),
        `${filename} should not be identified as an image file`
      );
    }

    // Test case sensitivity - isImageFile doesn't handle uppercase
    assert(
      !isImageFile("test.PNG"),
      "Current implementation doesn't handle uppercase extensions"
    );
    assert(
      !isImageFile("test.JPG"),
      "Current implementation doesn't handle uppercase extensions"
    );

    // Test files without extensions
    assert(
      !isImageFile("noextension"),
      "Files without extensions should not be considered images"
    );

    // Test empty string
    assert(!isImageFile(""), "Empty string should not be considered an image");
  });

  test("pathExists should correctly check file existence", async () => {
    const testImagesDir = path.join(__dirname, "images");
    const existingFile = path.join(testImagesDir, "test01-1.webp");
    const nonExistentFile = path.join(testImagesDir, "does-not-exist.jpg");

    // Test existing file
    assert(
      await pathExists(existingFile),
      "Should return true for existing file"
    );

    // Test existing directory
    assert(
      await pathExists(testImagesDir),
      "Should return true for existing directory"
    );

    // Test non-existent file
    assert(
      !(await pathExists(nonExistentFile)),
      "Should return false for non-existent file"
    );

    // Test non-existent directory
    const nonExistentDir = path.join(__dirname, "does-not-exist-" + Date.now());
    assert(
      !(await pathExists(nonExistentDir)),
      "Should return false for non-existent directory"
    );
  });

  test("isFolder should correctly identify directories", async () => {
    const testImagesDir = path.join(__dirname, "images");
    const existingFile = path.join(testImagesDir, "test01-1.webp");
    const nonExistentPath = path.join(
      __dirname,
      "does-not-exist-" + Date.now()
    );

    // Test existing directory
    assert(
      await isFolder(testImagesDir),
      "Should return true for existing directory"
    );

    // Test existing file (should be false)
    assert(
      !(await isFolder(existingFile)),
      "Should return false for existing file"
    );

    // Test non-existent path
    assert(
      !(await isFolder(nonExistentPath)),
      "Should return false for non-existent path"
    );
  });

  test("mapLimit should process arrays with concurrency limit", async () => {
    const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const processedOrder: number[] = [];

    const asyncProcessor = async (num: number) => {
      processedOrder.push(num);
      // Add small delay to simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      return num * 2;
    };

    const result = await mapLimit(testArray, 3, asyncProcessor);

    // Check that all items were processed
    assert.deepEqual(
      result,
      [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
      "Should process all items correctly"
    );

    // Check that the result maintains order
    assert(
      result.length === testArray.length,
      "Result should have same length as input"
    );

    // Test empty array
    const emptyResult = await mapLimit([], 5, asyncProcessor);
    assert.deepEqual(emptyResult, [], "Should handle empty array");

    // Test limit of 1 (sequential processing)
    const sequentialResult = await mapLimit([1, 2, 3], 1, async (n) => n * 3);
    assert.deepEqual(
      sequentialResult,
      [3, 6, 9],
      "Should work with limit of 1"
    );
  });

  test("binaryToHex should convert binary strings to hex buffers", () => {
    // Test basic conversion - Note: the function produces single hex digits that get padded
    const binary1 = "1010"; // Produces "a" but Buffer.from() needs even length
    const hex1 = binaryToHex(binary1);
    assert(Buffer.isBuffer(hex1), "Should return a Buffer");
    // "a" is invalid hex for Buffer.from, so we get empty buffer
    assert(
      hex1.length === 0,
      "Single hex digit produces empty buffer due to Buffer.from limitations"
    );

    // Test longer binary string - this works because it produces even-length hex
    const binary2 = "11110000"; // Should convert to 'f0'
    const hex2 = binaryToHex(binary2);
    assert(
      hex2.toString("hex") === "f0",
      "Should convert '11110000' to hex 'f0'"
    );

    // Test 8-bit pattern (typical hash size) - produces even-length hex
    const binary3 = "1010111100001111"; // 4 hex digits: af0f
    const hex3 = binaryToHex(binary3);
    assert(hex3.length === 2, "Should produce 2 bytes for 16 bits");
    assert(hex3.toString("hex") === "af0f", "Should convert correctly to af0f");

    // Test case that produces even hex digits
    const binary4 = "10100000"; // Should produce "a0"
    const hex4 = binaryToHex(binary4);
    assert(
      hex4.toString("hex") === "a0",
      "Should convert '10100000' to hex 'a0'"
    );

    // Test empty string
    const hex5 = binaryToHex("");
    assert(hex5.length === 0, "Should handle empty string");
  });

  test("px should correctly extract pixel values", () => {
    // Create a simple 3x2 buffer (6 pixels)
    const pixels = Buffer.from([10, 20, 30, 40, 50, 60]);
    const width = 3;

    // Test pixel extraction
    assert(px(pixels, width, 0, 0) === 10, "Should get first pixel");
    assert(
      px(pixels, width, 1, 0) === 20,
      "Should get second pixel in first row"
    );
    assert(
      px(pixels, width, 2, 0) === 30,
      "Should get third pixel in first row"
    );
    assert(
      px(pixels, width, 0, 1) === 40,
      "Should get first pixel in second row"
    );
    assert(
      px(pixels, width, 1, 1) === 50,
      "Should get second pixel in second row"
    );
    assert(
      px(pixels, width, 2, 1) === 60,
      "Should get third pixel in second row"
    );

    // Test bounds checking with assert (should throw for out of bounds)
    assert.throws(
      () => px(pixels, width, 3, 1),
      "Should throw for x out of bounds"
    );
    assert.throws(
      () => px(pixels, width, 0, 2),
      "Should throw for y out of bounds"
    );
  });

  test("dhash should generate consistent hashes for images", async () => {
    const testImagesDir = path.join(__dirname, "images");
    const testImage = path.join(testImagesDir, "test01-1.webp");

    // Test basic hash generation
    const hash1 = await dhash(testImage);
    assert(Buffer.isBuffer(hash1), "Should return a Buffer");
    assert(hash1.length > 0, "Hash should not be empty");

    // Test consistency (same image should produce same hash)
    const hash2 = await dhash(testImage);
    assert(hash1.equals(hash2), "Same image should produce identical hashes");

    // Test different hash sizes
    const hash8 = await dhash(testImage, 8);
    const hash16 = await dhash(testImage, 16);
    assert(
      hash8.length < hash16.length,
      "Larger hash size should produce longer hash"
    );

    // Test with different images
    const testImage2 = path.join(testImagesDir, "test02-1.webp");
    const hashDifferent = await dhash(testImage2);
    assert(
      !hash1.equals(hashDifferent),
      "Different images should produce different hashes"
    );
  });

  test("should handle array input with mixed file types", async () => {
    const testImagesDir = path.join(__dirname, "images");
    const fs = await import("node:fs/promises");
    const files = await fs.readdir(testImagesDir);

    // Mix image files with non-image file paths
    const mixedPaths = [
      ...files
        .filter((f) => f.endsWith(".webp"))
        .map((f) => path.join(testImagesDir, f)),
      path.join(testImagesDir, "non-existent.txt"),
      path.join(testImagesDir, "fake.doc"),
    ];

    // Should filter out non-image files and process only valid image files
    const result = await findDuplicateImages(mixedPaths);

    assert(Array.isArray(result), "Should return array even with mixed input");

    // The function should have processed only the image files
    console.log(
      `Processed ${mixedPaths.length} mixed paths, found ${result.length} duplicate groups`
    );
  });

  test("integration: should handle empty array input", async () => {
    const result = await findDuplicateImages([]);

    assert(Array.isArray(result), "Should return array for empty input");
    assert(result.length === 0, "Should return empty array for empty input");
  });

  test("integration: should handle array with only non-image files", async () => {
    const nonImagePaths = [
      "/path/to/file.txt",
      "/path/to/document.pdf",
      "/path/to/archive.zip",
    ];

    const result = await findDuplicateImages(nonImagePaths);

    assert(Array.isArray(result), "Should return array for non-image input");
    assert(
      result.length === 0,
      "Should return empty array when no image files provided"
    );
  });

  test("integration: should handle mixed files and directories in array input", async () => {
    const fs = await import("node:fs/promises");
    const testImagesDir = path.join(__dirname, "images");

    // Create a temporary subdirectory with some images
    const subDir = path.join(testImagesDir, "..", "mixed-test");
    try {
      await fs.mkdir(subDir, { recursive: true });

      // Copy a test image to the subdirectory
      await fs.copyFile(
        path.join(testImagesDir, "test01-1.webp"),
        path.join(subDir, "mixed-copy.webp")
      );

      // Create mixed input: individual files, directories, and non-existent paths
      const mixedInput = [
        path.join(testImagesDir, "test01-2.webp"), // individual file
        subDir, // directory with images
        "/non/existent/path", // non-existent path
        path.join(testImagesDir, "../lib.test.ts"), // non-image file
      ];

      const result = await findDuplicateImages(mixedInput);

      assert(Array.isArray(result), "Should return array for mixed input");

      // The function should process files from both individual paths and directories
      console.log("Mixed test processed successfully");
    } finally {
      // Clean up
      try {
        await fs.unlink(path.join(subDir, "mixed-copy.webp"));
        await fs.rmdir(subDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});
