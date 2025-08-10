// frontend/src/lib/pdfCover.js
import * as pdfjsLib from "pdfjs-dist";
import { writeFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";

// Disable worker entirely
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

export async function generatePdfCover(pdfPath: string, outputPath: string) {
  try {
    const pdfUrl = convertFileSrc(pdfPath);
    const pdf = await pdfjsLib.getDocument({
      url: pdfUrl,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    await writeFile(outputPath.replace(".pdf", ".png"), uint8Array);
    return outputPath;
  } catch (error) {
    console.error("PDF cover generation failed:", error);
    throw error;
  }
}
