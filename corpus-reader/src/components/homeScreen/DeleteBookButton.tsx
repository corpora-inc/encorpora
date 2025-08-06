import { cn, deleteBookCompletely } from "@/lib/utils";
import { Trash2Icon } from "lucide-react"
import { useState } from "react";

interface DeleteBookButtonProps {
    bookId: number;
    bookTitle: string;
    onBookDeleted?: () => void; // Callback to notify parent component
    isMobile?: boolean; // Whether the device is mobile
}

const DeleteBookButton: React.FC<DeleteBookButtonProps> = ({ bookId, bookTitle, onBookDeleted, isMobile = false }) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteBook = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmation = await window.confirm(`Are you sure you want to delete "${bookTitle}"? This action cannot be undone.`);
        if (confirmation) {
            setIsDeleting(true);
            try {
                await deleteBookCompletely(bookId);
                onBookDeleted?.(); // Notify parent component to refresh the library
            } catch (error) {
                console.error("Failed to delete book:", error);
                alert("Failed to delete book. Please try again.");
            } finally {
                setIsDeleting(false);
            }
        }
    };

    // On mobile, always show the button. On desktop, show only on hover
    const visibilityClasses = isMobile 
        ? "opacity-75" 
        : "opacity-0 group-hover:opacity-100";

    return (
        <button
            onClick={handleDeleteBook}
            disabled={isDeleting}
            className={cn(visibilityClasses, `z-50 cursor-pointer transition-all duration-300 bg-red-500/80 hover:bg-red-600/90 backdrop-blur-sm rounded-full p-1.5 shadow-lg`)}
            title="Delete book"
        >
            <Trash2Icon className="w-4 h-4 text-white" />
        </button>
    )
}

export default DeleteBookButton;