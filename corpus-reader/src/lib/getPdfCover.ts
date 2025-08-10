import * as pdfjsLib from "pdfjs-dist";
import { writeFile } from "@tauri-apps/plugin-fs";
import { readFileSrc } from "./utils";
import { info, error } from "@tauri-apps/plugin-log";

// Disable worker entirely
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

// Detect Android environment
const isAndroid = () => {
  return (
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
  );
};

export async function generatePdfCover(pdfPath: string, outputPath: string) {
  try {
    const pdfUrl = await readFileSrc(pdfPath);
    info(`PDF URL: ${pdfUrl}`);
    info(`PDF Path: ${pdfPath}`);

    // Base configuration
    const config: any = {
      url: pdfUrl,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableAutoFetch: true,
      disableStream: true,
      disableRange: true,
      verbosity: 0,
      maxImageSize: -1,
      cMapPacked: true,
    };

    // Add Android-specific optimizations
    if (isAndroid()) {
      config.disableFontFace = true;
      config.useSystemFonts = true;
    }

    const loadingTask = pdfjsLib.getDocument(config);
    const pdf = await loadingTask.promise;
    info("PDF loaded successfully");

    const page = await pdf.getPage(1);
    info("First page retrieved");

    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not get canvas context");
    }

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      }, "image/png");
    });

    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    await writeFile(outputPath.replace(".pdf", ".png"), uint8Array);
    info(`Cover generated successfully: ${outputPath}`);
    return outputPath;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error(`PDF cover generation failed: ${errorMessage}`);
    console.error("PDF cover generation failed:", err);
    throw err;
  }
}
