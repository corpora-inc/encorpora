import { useState, useEffect } from "react";
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";

async function loadImageFromAppData(filePath: string): Promise<string | null> {
  try {
    const contents = await readFile(filePath, {
      baseDir: BaseDirectory.AppLocalData,
    });
    // Tauri readFile returns an ArrayBuffer-backed Uint8Array; TS 6's stricter
    // BlobPart type (ArrayBufferView<ArrayBuffer>) needs the cast.
    const blob = new Blob([contents as BlobPart], { type: "image/png" });
    const imageUrl = URL.createObjectURL(blob);
    return imageUrl; // Or the imageUrl from Blob for more control
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
}

export const useLoadImage = (filePath: string | undefined | null) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setImageUrl(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    loadImageFromAppData(filePath)
      .then((url) => {
        setImageUrl(url);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load image");
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      if (imageUrl && imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [filePath]);

  return { imageUrl, isLoading, error };
}
