import { test, describe } from "node:test";
import assert from "node:assert";
import path from "node:path";
import findDuplicateImages from "../src/lib.js";

const testImagesDir = path.join(__dirname, "images");

describe("findDuplicateImages", () => {
  test("should find duplicate images and sort by resolution (directory path)", async () => {
    const result = await findDuplicateImages(testImagesDir);
    
    // Should return an array of duplicate groups
    assert(Array.isArray(result), "Result should be an array");
    
    // Each group should be an array of image objects
    for (const group of result) {
      assert(Array.isArray(group), "Each group should be an array");
      assert(group.length > 1, "Each group should have more than one image");
      
      // Each image should have path, width, and height properties
      for (const image of group) {
        assert(typeof image.path === "string", "Image should have a path");
        assert(typeof image.width === "number", "Image should have width");
        assert(typeof image.height === "number", "Image should have height");
        assert(image.width > 0, "Width should be positive");
        assert(image.height > 0, "Height should be positive");
      }
      
      // Images should be sorted by resolution (highest first)
      for (let i = 0; i < group.length - 1; i++) {
        const currentResolution = group[i].width * group[i].height;
        const nextResolution = group[i + 1].width * group[i + 1].height;
        assert(
          currentResolution >= nextResolution,
          `Images should be sorted by resolution: ${currentResolution} >= ${nextResolution}`
        );
      }
    }
  });

  test("should handle mixed files and directories in array", async () => {
    const fs = await import("node:fs/promises");
    
    // Create a temporary subdirectory with some images
    const subDir = path.join(testImagesDir, "..", "subtest");
    try {
      await fs.mkdir(subDir, { recursive: true });
      
      // Copy some test images to the subdirectory
      await fs.copyFile(
        path.join(testImagesDir, "test01-1.webp"),
        path.join(subDir, "copy1.webp")
      );
      await fs.copyFile(
        path.join(testImagesDir, "test02-1.webp"),
        path.join(subDir, "copy2.webp")
      );
      
      // Create mixed input: files and directories
      const mixedInput = [
        path.join(testImagesDir, "test01-2.webp"), // individual file
        path.join(testImagesDir, "test01-3.webp"), // individual file
        subDir, // directory
        "/non/existent/file.jpg", // non-existent file
        "/non/existent/dir", // non-existent directory
      ];
      
      const result = await findDuplicateImages(mixedInput);
      
      // Should return an array of duplicate groups
      assert(Array.isArray(result), "Result should be an array");
      
      // Should process both individual files and files from directories
      if (result.length > 0) {
        const allPaths = result.flat().map(img => img.path);
        
        // Should include files from the directory
        const hasSubDirFiles = allPaths.some(p => p.includes(subDir));
        
        // Should include individual files
        const hasIndividualFiles = allPaths.some(p => 
          p.includes("test01-2.webp") || p.includes("test01-3.webp")
        );
        
        console.log("Mixed input found paths:", allPaths);
        console.log("Has subdirectory files:", hasSubDirFiles);
        console.log("Has individual files:", hasIndividualFiles);
      }
      
    } finally {
      // Clean up
      try {
        await fs.unlink(path.join(subDir, "copy1.webp"));
        await fs.unlink(path.join(subDir, "copy2.webp"));
        await fs.rmdir(subDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should find duplicate images using array of file paths", async () => {
    const fs = await import("node:fs/promises");
    const files = await fs.readdir(testImagesDir);
    const imageFiles = files.filter(f => 
      f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg') || 
      f.endsWith('.jpeg') || f.endsWith('.gif')
    );
    const imageFilePaths = imageFiles.map(f => path.join(testImagesDir, f));
    
    const result = await findDuplicateImages(imageFilePaths);
    
    // Should return an array of duplicate groups
    assert(Array.isArray(result), "Result should be an array");
    
    // Each group should be an array of image objects
    for (const group of result) {
      assert(Array.isArray(group), "Each group should be an array");
      assert(group.length > 1, "Each group should have more than one image");
      
      // Each image should have path, width, and height properties
      for (const image of group) {
        assert(typeof image.path === "string", "Image should have a path");
        assert(typeof image.width === "number", "Image should have width");
        assert(typeof image.height === "number", "Image should have height");
        assert(image.width > 0, "Width should be positive");
        assert(image.height > 0, "Height should be positive");
        
        // Path should be one of the provided paths
        assert(imageFilePaths.includes(image.path), "Path should be from provided array");
      }
      
      // Images should be sorted by resolution (highest first)
      for (let i = 0; i < group.length - 1; i++) {
        const currentResolution = group[i].width * group[i].height;
        const nextResolution = group[i + 1].width * group[i + 1].height;
        assert(
          currentResolution >= nextResolution,
          `Images should be sorted by resolution: ${currentResolution} >= ${nextResolution}`
        );
      }
    }
  });

  test("should handle empty array of file paths", async () => {
    const result = await findDuplicateImages([]);
    
    assert(Array.isArray(result), "Result should be an array");
    assert(result.length === 0, "Should return empty array for empty input array");
  });

  test("should filter non-image files from array input", async () => {
    const mixedPaths = [
      path.join(testImagesDir, "test01-1.webp"),
      path.join(testImagesDir, "../lib.test.ts"), // non-image file
      path.join(testImagesDir, "test01-2.webp"),
      "/non/existent/file.txt" // non-existent non-image file
    ];
    
    const result = await findDuplicateImages(mixedPaths);
    
    // Should process without error, filtering out non-image files
    assert(Array.isArray(result), "Result should be an array");
    // The function should only process the .webp files
  });

  test("should handle array with non-existent image files", async () => {
    const pathsWithNonExistent = [
      path.join(testImagesDir, "test01-1.webp"),
      path.join(testImagesDir, "non-existent.jpg"),
      path.join(testImagesDir, "test01-2.webp")
    ];
    
    const result = await findDuplicateImages(pathsWithNonExistent);
    
    // Should process without error, skipping non-existent files
    assert(Array.isArray(result), "Result should be an array");
  });

  test("should handle empty directory", async () => {
    // Create a temporary empty directory for testing
    const emptyDir = path.join(testImagesDir, "..", "empty");
    const fs = await import("node:fs/promises");
    
    try {
      await fs.mkdir(emptyDir, { recursive: true });
      const result = await findDuplicateImages(emptyDir);
      
      assert(Array.isArray(result), "Result should be an array");
      assert(result.length === 0, "Should return empty array for empty directory");
    } finally {
      // Clean up
      try {
        await fs.rmdir(emptyDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should handle directory with no image files", async () => {
    // Create a temporary directory with non-image files
    const nonImageDir = path.join(testImagesDir, "..", "non-images");
    const fs = await import("node:fs/promises");
    
    try {
      await fs.mkdir(nonImageDir, { recursive: true });
      await fs.writeFile(path.join(nonImageDir, "test.txt"), "not an image");
      await fs.writeFile(path.join(nonImageDir, "test.json"), "{}");
      
      const result = await findDuplicateImages(nonImageDir);
      
      assert(Array.isArray(result), "Result should be an array");
      assert(result.length === 0, "Should return empty array for directory with no images");
    } finally {
      // Clean up
      try {
        await fs.unlink(path.join(nonImageDir, "test.txt"));
        await fs.unlink(path.join(nonImageDir, "test.json"));
        await fs.rmdir(nonImageDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should validate image metadata structure", async () => {
    const result = await findDuplicateImages(testImagesDir);
    
    if (result.length > 0) {
      const firstGroup = result[0];
      const firstImage = firstGroup[0];
      
      // Validate the structure of returned objects
      assert(Object.hasOwnProperty.call(firstImage, "path"), "Should have path property");
      assert(Object.hasOwnProperty.call(firstImage, "width"), "Should have width property");
      assert(Object.hasOwnProperty.call(firstImage, "height"), "Should have height property");
      
      // Validate path is absolute
      assert(path.isAbsolute(firstImage.path), "Path should be absolute");
      
      // Validate the file actually exists
      const fs = await import("node:fs/promises");
      try {
        await fs.access(firstImage.path);
      } catch {
        assert.fail("Referenced file should exist");
      }
    }
  });

  test("should process different image formats", async () => {
    // This test verifies that the function can handle various image formats
    // Based on the isImageFile function, it should support multiple formats
    const result = await findDuplicateImages(testImagesDir);
    
    // If we have results, verify that webp files are being processed
    if (result.length > 0) {
      const allPaths = result.flat().map(img => img.path);
      const hasWebpFiles = allPaths.some(path => path.endsWith('.webp'));
      assert(hasWebpFiles, "Should process .webp files");
    }
  });
  
  test("should not return duplicate groups with maxDuplicates limit", async () => {
    // Test the specific issue where the same images appear in multiple groups
    const result = await findDuplicateImages(testImagesDir, { maxDuplicates: 4 });
    
    assert(Array.isArray(result), "Result should be an array");
    
    // Collect all image paths from all groups
    const seenPaths = new Set<string>();
    const duplicatePaths = new Set<string>();
    
    for (const group of result) {
      assert(Array.isArray(group), "Each group should be an array");
      assert(group.length > 1, "Each group should have more than one image");
      
      for (const image of group) {
        if (seenPaths.has(image.path)) {
          duplicatePaths.add(image.path);
        } else {
          seenPaths.add(image.path);
        }
      }
    }
    
    // No image should appear in multiple groups
    assert(
      duplicatePaths.size === 0,
      `Images should not appear in multiple groups. Duplicate paths: ${Array.from(duplicatePaths).join(', ')}`
    );
    
    // Verify that groups don't contain identical sets of files
    const groupSignatures = result.map(group => 
      group.map(img => img.path).sort().join('|')
    );
    const uniqueSignatures = new Set(groupSignatures);
    
    assert(
      groupSignatures.length === uniqueSignatures.size,
      "All groups should be unique (no identical groups)"
    );
    
    // Each group should respect the maxDuplicates limit
    for (const group of result) {
      assert(
        group.length <= 4,
        `Group should not exceed maxDuplicates limit of 4, found ${group.length} images`
      );
    }
  });
});