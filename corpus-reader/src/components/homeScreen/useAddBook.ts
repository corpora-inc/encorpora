import { useState } from "react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { generatePdfCover } from "@/lib/getPdfCover";

interface FilePickResult {
  message: string;
  file_path: string | null;
}

export function useAddBook(onBookAdded: () => void) {
  const [loadingBooks, setLoadingBooks] = useState(false);

  const handleAddBookToLibrary = async () => {
    try {
      setLoadingBooks(true);
      
      // Show initial loading toast
      const loadingToast = toast.loading("Selecting and processing book...");
      
      const result = await invoke("pick_file") as FilePickResult;
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Handle case when user cancels file selection
      if (!result.file_path) {
        if (result.message === "No file selected by the user.") {
          // Don't show error for user cancellation
          return;
        }
        toast.error("No file was selected. Please try again.");
        return;
      }

      // Determine file type for better messaging
      const isPdf = result.file_path.includes("pdf");
      const isEpub = result.file_path.includes("epub");
      const fileType = isPdf ? "PDF" : isEpub ? "EPUB" : "book";

      // Handle different result messages
      if (result.message === "File already exists") {
        toast.warning(`This ${fileType} is already in your library.`);
        return;
      }

      // Show success message for file processing
      if (result.message.includes("processed successfully")) {
        toast.success(`${fileType} added to library successfully!`);
      }

      // Generate PDF cover if needed
      if (isPdf && result.file_path) {
        try {
          const coverToast = toast.loading("Generating book cover...");
          await generatePdfCover(result.file_path, result.file_path);
          toast.dismiss(coverToast);
          toast.success("Book cover generated successfully!");
        } catch (coverError) {
          console.error("PDF cover generation failed:", coverError);
          toast.warning("Book added successfully, but cover generation failed.");
        }
      }

      onBookAdded();
    } catch (error) {
      console.error("Error opening file dialog or adding book:", error);
      
      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("EPUB")) {
        toast.error("Could not process the EPUB file. Please check the file format.");
      } else if (errorMessage.includes("PDF")) {
        toast.error("Could not process the PDF file. Please check the file format.");
      } else if (errorMessage.includes("metadata")) {
        toast.error("Could not read book information. The file may be corrupted.");
      } else {
        toast.error("Failed to add book to library. Please try again.");
      }
    } finally {
      setLoadingBooks(false);
    }
  };

  return {
    loadingBooks,
    handleAddBookToLibrary,
  };
}