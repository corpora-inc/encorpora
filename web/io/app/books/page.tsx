"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import booksData from "@/data/books.json";
import { withBasePath } from "@/lib/basePath";

interface Book {
  id: string;
  title: string;
  description: string;
  amazonUrl: string;
  coverImage: string;
  featured: boolean;
}

export default function BooksPage() {
  const books = booksData as Book[];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 sm:px-6 py-16 sm:py-24">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
            Books
          </h1>
          <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
            Concise, fact-dense, and beautifully structured.
          </p>
        </div>

        {books.map((book) => (
          <motion.div
            key={book.id}
            className="flex flex-col md:flex-row items-center gap-10 md:gap-16 mb-16"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {/* Cover image */}
            <div className="flex-shrink-0 w-64 sm:w-72 md:w-80">
              <div className="relative">
                <div className="absolute inset-0 bg-gray-200 rounded-lg transform rotate-2 scale-[1.02]" />
                <img
                  src={withBasePath(book.coverImage)}
                  alt={book.title}
                  className="relative rounded-lg shadow-xl w-full h-auto"
                />
              </div>
            </div>

            {/* Book details */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4 leading-tight">
                {book.title}
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed mb-8 max-w-lg">
                {book.description}
              </p>
              <a
                href={book.amazonUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  className="bg-black hover:bg-gray-800 text-white font-medium rounded-lg px-8"
                >
                  Buy on Amazon <span className="ml-2">&rarr;</span>
                </Button>
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
