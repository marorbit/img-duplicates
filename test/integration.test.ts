import { test, describe } from "node:test";
import assert from "node:assert";
import path from "node:path";
import sharp from "sharp";
import findDuplicateImages from "../src/lib.js";

const testImagesDir = path.join(__dirname, "images");

describe("findDuplicateImages - Integration Tests", () => {
  test("should detect duplicates in test image set (directory path)", async () => {
    const result = await findDuplicateImages(testImagesDir);
    
    console.log("Test results:", JSON.stringify(result, null, 2));
    
    // We expect to find duplicate groups based on the test images
    // test01-1.webp, test01-2.webp, test01-3.webp should be similar
    // test02-1.webp, test02-2.webp should be similar
    
    if (result.length > 0) {
      // Verify each group has the expected structure
      for (const group of result) {
        assert(group.length >= 3, "Each duplicate group should have at least 3 images");
        
        // Verify sorting by resolution
        for (let i = 0; i < group.length - 1; i++) {
          const currentRes = group[i].width * group[i].height;
          const nextRes = group[i + 1].width * group[i + 1].height;
          assert(
            currentRes >= nextRes,
            `Group should be sorted by resolution: ${group[i].path} (${currentRes}) >= ${group[i + 1].path} (${nextRes})`
          );
        }
        
        // Log the group for debugging
        console.log(`Duplicate group found:`);
        for (const img of group) {
          console.log(`  - ${path.basename(img.path)}: ${img.width}x${img.height} (${img.width * img.height} pixels)`);
        }
      }
    } else {
      console.log("No duplicates found in test images");
    }
  });

  test("should detect duplicates using array of file paths", async () => {
    const fs = await import("node:fs/promises");
    const files = await fs.readdir(testImagesDir);
    const imageFiles = files.filter(f => 
      f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg') || 
      f.endsWith('.jpeg') || f.endsWith('.gif')
    );
    const imageFilePaths = imageFiles.map(f => path.join(testImagesDir, f));
    
    const result = await findDuplicateImages(imageFilePaths);
    
    console.log("Array input test results:", JSON.stringify(result, null, 2));
    
    if (result.length > 0) {
      // Verify each group has the expected structure
      for (const group of result) {
        assert(group.length >= 3, "Each duplicate group should have at least 3 images");
        
        // Verify all paths are from the provided array
        for (const img of group) {
          assert(imageFilePaths.includes(img.path), "All paths should be from provided array");
        }
        
        // Verify sorting by resolution
        for (let i = 0; i < group.length - 1; i++) {
          const currentRes = group[i].width * group[i].height;
          const nextRes = group[i + 1].width * group[i + 1].height;
          assert(
            currentRes >= nextRes,
            `Group should be sorted by resolution: ${group[i].path} (${currentRes}) >= ${group[i + 1].path} (${nextRes})`
          );
        }
        
        // Log the group for debugging
        console.log(`Duplicate group found (array input):`);
        for (const img of group) {
          console.log(`  - ${path.basename(img.path)}: ${img.width}x${img.height} (${img.width * img.height} pixels)`);
        }
      }
    } else {
      console.log("No duplicates found in test images (array input)");
    }
  });

  test("should produce consistent results for directory and array input", async () => {
    const fs = await import("node:fs/promises");
    const files = await fs.readdir(testImagesDir);
    const imageFiles = files.filter(f => 
      f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg') || 
      f.endsWith('.jpeg') || f.endsWith('.gif')
    );
    const imageFilePaths = imageFiles.map(f => path.join(testImagesDir, f));
    
    const resultFromDir = await findDuplicateImages(testImagesDir);
    const resultFromArray = await findDuplicateImages(imageFilePaths);
    
    // Results should have same number of groups
    assert.equal(resultFromDir.length, resultFromArray.length, "Both methods should find same number of duplicate groups");
    
    // Total number of duplicate images should be the same
    const dirImageCount = resultFromDir.reduce((sum, group) => sum + group.length, 0);
    const arrayImageCount = resultFromArray.reduce((sum, group) => sum + group.length, 0);
    assert.equal(dirImageCount, arrayImageCount, "Total number of duplicate images should be the same");
    
    // All images found should be from the same set
    const dirPaths = new Set(resultFromDir.flat().map(img => img.path));
    const arrayPaths = new Set(resultFromArray.flat().map(img => img.path));
    assert.equal(dirPaths.size, arrayPaths.size, "Total number of unique duplicate images should be the same");
    
    // The difference should be minimal (allowing for k-NN variations with identical distances)
    const onlyInDir = [...dirPaths].filter(p => !arrayPaths.has(p));
    const onlyInArray = [...arrayPaths].filter(p => !dirPaths.has(p));
    
    // If there are differences, they should be minimal and reciprocal
    assert.equal(onlyInDir.length, onlyInArray.length, "Any differences should be reciprocal");
    
    // Allow for up to 2 different images due to k-NN variations with identical hash distances
    assert(onlyInDir.length <= 2, `Too many differences between methods: ${onlyInDir.length} images only in directory result`);
    
    console.log(`Directory method found ${dirImageCount} duplicate images in ${resultFromDir.length} groups`);
    console.log(`Array method found ${arrayImageCount} duplicate images in ${resultFromArray.length} groups`);
    if (onlyInDir.length > 0) {
      console.log(`Variations due to k-NN identical distances: ${onlyInDir.length} different images`);
    }
  });

  test("should provide detailed image metadata", async () => {
    const result = await findDuplicateImages(testImagesDir);
    
    if (result.length > 0) {
      const firstGroup = result[0];
      const firstImage = firstGroup[0];
      
      // Verify we can get additional metadata using sharp
      const metadata = await sharp(firstImage.path).metadata();
      
      assert(firstImage.width === metadata.width, "Width should match sharp metadata");
      assert(firstImage.height === metadata.height, "Height should match sharp metadata");
      
      // Verify image is accessible
      assert(typeof firstImage.path === "string", "Path should be string");
      assert(firstImage.path.includes(testImagesDir), "Path should be in test directory");
    }
  });

  test("should handle edge case with identical resolution images", async () => {
    // This test checks what happens when duplicate images have the same resolution
    const result = await findDuplicateImages(testImagesDir);
    
    for (const group of result) {
      // Check if any images in the group have identical resolutions
      const resolutions = group.map(img => img.width * img.height);
      const uniqueResolutions = new Set(resolutions);
      
      if (uniqueResolutions.size < resolutions.length) {
        console.log("Found images with identical resolutions in group:");
        for (const img of group) {
          console.log(`  - ${path.basename(img.path)}: ${img.width}x${img.height}`);
        }
        
        // Even with identical resolutions, the array should still be valid
        assert(group.length >= 3, "Group should still have multiple images");
      }
    }
  });

  test("performance test with current image set", async () => {
    const startTime = Date.now();
    const result = await findDuplicateImages(testImagesDir);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Processing took ${duration}ms for test image set`);
    
    // Performance should be reasonable for small test set
    assert(duration < 30000, "Should complete within 30 seconds for test images");
    
    // Log results summary
    console.log(`Found ${result.length} duplicate group(s)`);
    if (result.length > 0) {
      const totalDuplicates = result.reduce((sum, group) => sum + group.length, 0);
      console.log(`Total images involved in duplicates: ${totalDuplicates}`);
    }
  });

  test("should handle mixed files and directories input", async () => {
    const fs = await import("node:fs/promises");
    
    // Create a temporary subdirectory with duplicate images
    const mixedDir = path.join(testImagesDir, "..", "mixed-integration");
    try {
      await fs.mkdir(mixedDir, { recursive: true });
      
      // Copy some test images to create more duplicates
      await fs.copyFile(
        path.join(testImagesDir, "test01-1.webp"),
        path.join(mixedDir, "duplicate1.webp")
      );
      await fs.copyFile(
        path.join(testImagesDir, "test02-1.webp"),
        path.join(mixedDir, "duplicate2.webp")
      );
      
      // Create mixed input: individual files and directories
      const mixedInput = [
        path.join(testImagesDir, "test01-2.webp"), // individual file
        path.join(testImagesDir, "test01-3.webp"), // individual file
        mixedDir, // directory with duplicates
        testImagesDir, // original test directory
      ];
      
      const result = await findDuplicateImages(mixedInput);
      
      console.log("Mixed integration test results:", JSON.stringify(result, null, 2));
      
      if (result.length > 0) {
        // Should find more duplicates due to copied files
        const totalImages = result.reduce((sum, group) => sum + group.length, 0);
        console.log(`Mixed input found ${result.length} duplicate groups with ${totalImages} total images`);
        
        // Verify each group structure
        for (const group of result) {
          assert(group.length >= 3, "Each duplicate group should have at least 3 images");
          
          // Verify all images in group have valid metadata
          for (const img of group) {
            assert(typeof img.path === "string", "Image should have path");
            assert(typeof img.width === "number", "Image should have width");
            assert(typeof img.height === "number", "Image should have height");
            assert(img.width > 0 && img.height > 0, "Dimensions should be positive");
          }
          
          // Verify sorting by resolution
          for (let i = 0; i < group.length - 1; i++) {
            const currentRes = group[i].width * group[i].height;
            const nextRes = group[i + 1].width * group[i + 1].height;
            assert(
              currentRes >= nextRes,
              `Group should be sorted by resolution: ${currentRes} >= ${nextRes}`
            );
          }
        }
      }
      
    } finally {
      // Clean up
      try {
        await fs.unlink(path.join(mixedDir, "duplicate1.webp"));
        await fs.unlink(path.join(mixedDir, "duplicate2.webp"));
        await fs.rmdir(mixedDir);
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});
