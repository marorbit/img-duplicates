#!/usr/bin/env node

import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { access, unlink } from "node:fs/promises";
import { createInterface } from "node:readline";
import findDuplicateImages from "./lib";

interface CLIOptions {
  source: string[];
  hashSize: number;
  maxDuplicates: number;
  maxDistance: number;
  delete: boolean;
  forceDelete: boolean;
  help: boolean;
  version: boolean;
}

const HELP_TEXT = `
Duplicate Image Finder

Usage: img-duplicates [options] <source...>

Arguments:
  source                One or more directories or image files to search for duplicates

Options:
  -h, --hash-size <size>     Hash size for perceptual hashing (default: 8)
  -d, --max-duplicates <num> Maximum number of duplicates to find per image (default: 100)
  -m, --max-distance <dist>  Maximum distance for similarity matching (default: 5)
  --delete                   Delete duplicate images (keeps highest resolution, asks for confirmation)
  --force-delete             Delete duplicate images without confirmation
  --help                     Show this help message
  --version                  Show version number

Examples:
  img-duplicates /path/to/images
  img-duplicates /path/to/dir1 /path/to/dir2
  img-duplicates --hash-size 16 --max-distance 3 /path/to/images
  img-duplicates /path/to/image1.jpg /path/to/image2.png /path/to/dir
  img-duplicates --delete /path/to/images
  img-duplicates --force-delete /path/to/images

Note: When using --delete or --force-delete, the image with the highest resolution
      in each duplicate group will be kept, and all others will be deleted.
`;

async function parseArguments(): Promise<CLIOptions> {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        "hash-size": {
          type: "string",
          short: "h",
        },
        "max-duplicates": {
          type: "string",
          short: "d",
        },
        "max-distance": {
          type: "string",
          short: "m",
        },
        delete: {
          type: "boolean",
        },
        "force-delete": {
          type: "boolean",
        },
        help: {
          type: "boolean",
        },
        version: {
          type: "boolean",
        },
      },
      allowPositionals: true,
    });

    return {
      source: positionals,
      hashSize: values["hash-size"] ? parseInt(values["hash-size"]) : 8,
      maxDuplicates: values["max-duplicates"]
        ? parseInt(values["max-duplicates"])
        : 100,
      maxDistance: values["max-distance"]
        ? parseInt(values["max-distance"])
        : 5,
      delete: values.delete || false,
      forceDelete: values["force-delete"] || false,
      help: values.help || false,
      version: values.version || false,
    };
  } catch (error) {
    console.error("Error parsing arguments:", error.message);
    process.exit(1);
  }
}

async function validatePaths(paths: string[]): Promise<string[]> {
  const resolvedPaths: string[] = [];

  for (const path of paths) {
    const resolvedPath = resolve(path);
    try {
      await access(resolvedPath);
      resolvedPaths.push(resolvedPath);
    } catch (error) {
      console.error(`Error: Path does not exist: ${path}`);
      process.exit(1);
    }
  }

  return resolvedPaths;
}

function validateOptions(options: CLIOptions): void {
  if (options.hashSize < 1 || options.hashSize > 32) {
    console.error("Error: Hash size must be between 1 and 32");
    process.exit(1);
  }

  if (options.maxDuplicates < 1) {
    console.error("Error: Max duplicates must be at least 1");
    process.exit(1);
  }

  if (options.maxDistance < 0) {
    console.error("Error: Max distance must be non-negative");
    process.exit(1);
  }

  if (options.delete && options.forceDelete) {
    console.error(
      "Error: Cannot use both --delete and --force-delete at the same time"
    );
    process.exit(1);
  }
}

function formatResults(
  duplicates: Array<Array<{ path: string; width: number; height: number }>>,
  showDelete: boolean = false
): void {
  if (duplicates.length === 0) {
    console.log("No duplicate images found.");
    return;
  }

  console.log(`Found ${duplicates.length} group(s) of duplicate images:\n`);

  duplicates.forEach((group, index) => {
    console.log(`Group ${index + 1}:`);
    group.forEach((image, imageIndex) => {
      const resolution = `${image.width}x${image.height}`;
      let marker = "";
      if (imageIndex === 0) {
        marker = showDelete
          ? "(highest resolution - will be kept)"
          : "(highest resolution)";
      } else if (showDelete) {
        marker = "(will be deleted)";
      }
      console.log(`  ${image.path} [${resolution}] ${marker}`);
    });
    console.log("");
  });
}

async function askForConfirmation(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function deleteDuplicates(
  duplicates: Array<Array<{ path: string; width: number; height: number }>>,
  forceDelete: boolean = false
): Promise<void> {
  if (duplicates.length === 0) {
    return;
  }

  const filesToDelete: string[] = [];

  // Collect all files to delete (skip the first one in each group as it has the highest resolution)
  duplicates.forEach((group) => {
    for (let i = 1; i < group.length; i++) {
      filesToDelete.push(group[i].path);
    }
  });

  if (filesToDelete.length === 0) {
    console.log("No files to delete.");
    return;
  }

  console.log(`\nAbout to delete ${filesToDelete.length} duplicate image(s):`);
  filesToDelete.forEach((file) => console.log(`  ${file}`));
  console.log("");

  let shouldDelete = forceDelete;
  if (!forceDelete) {
    shouldDelete = await askForConfirmation(
      "Do you want to proceed with deletion?"
    );
  }

  if (!shouldDelete) {
    console.log("Deletion cancelled.");
    return;
  }

  let deletedCount = 0;
  let errorCount = 0;

  for (const file of filesToDelete) {
    try {
      await unlink(file);
      console.log(`Deleted: ${file}`);
      deletedCount++;
    } catch (error) {
      console.error(`Failed to delete ${file}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(
    `\nDeletion completed: ${deletedCount} files deleted, ${errorCount} errors.`
  );
}

async function main(): Promise<void> {
  const options = await parseArguments();

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (options.version) {
    console.log("1.0.0");
    process.exit(0);
  }

  if (options.source.length === 0) {
    console.error("Error: No source paths provided");
    console.log(HELP_TEXT);
    process.exit(1);
  }

  validateOptions(options);
  const validatedPaths = await validatePaths(options.source);

  try {
    console.log("Searching for duplicate images...");

    const duplicates = await findDuplicateImages(validatedPaths, {
      hashSize: options.hashSize,
      maxDuplicates: options.maxDuplicates,
      maxDistance: options.maxDistance,
    });

    const shouldDelete = options.delete || options.forceDelete;
    formatResults(duplicates, shouldDelete);

    if (shouldDelete) {
      await deleteDuplicates(duplicates, options.forceDelete);
    }
  } catch (error) {
    console.error("Error finding duplicates:", error.message);
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
