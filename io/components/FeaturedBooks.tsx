// app/components/FeaturedBooks.tsx
"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

interface Book {
  id: string;
  title: string;
  description: string;
  link: string;
}

const FeaturedBooks = () => {
  const [books, setFeaturedBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("books")
        .select("id, title, description, link")
        .eq("is_featured", true)
        .order("title", { ascending: true });

      setFeaturedBooks(error ? [] : data || []);
      setLoading(false);
    };
    fetchFeatured();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">Loading featured books…</p>
      </div>
    );
  }

  return (
    <section
      id="books"
      className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white relative overflow-hidden"
    >
      {/* Clean, subtle geometric accents */}
      <div className="absolute top-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-gray-50 rounded-full -translate-x-1/2 -translate-y-1/2 z-0 opacity-60" />
      <div className="absolute bottom-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-gray-50 rounded-full translate-x-1/2 translate-y-1/2 z-0 opacity-60" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-black tracking-tight leading-tight">
            Featured Draft Books
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-base sm:text-lg">
            Free preview drafts for effective, distraction-free learning. Every book is concise, fact-dense, and refined for clarity.
          </p>
        </div>

        <AnimatePresence>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
          >
            {books.length === 0 ? (
              <motion.p
                variants={itemVariants}
                className="text-gray-600 col-span-full text-center py-16 italic"
              >
                No featured books at this time.
              </motion.p>
            ) : (
              books.map((book) => (
                <motion.div
                  key={book.id}
                  variants={itemVariants}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  {/* Card corner accents for visual unity with apps */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-black opacity-5 z-10"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-black opacity-5 z-10"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-black opacity-5 z-10"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-black opacity-5 z-10"></div>

                  <Card className="group h-full w-full overflow-hidden bg-white flex flex-col border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 relative z-0">
                    <CardContent className="p-6 flex flex-col h-full relative z-10">
                      <h3 className="text-xl font-bold text-black tracking-tight mb-4">
                        {book.title}
                      </h3>
                      <p className="text-gray-600 flex-grow mb-8 leading-relaxed text-sm sm:text-base">
                        {book.description}
                      </p>
                      <div className="mt-auto">
                        <a
                          href={book.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <Button
                            className="w-full bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-all duration-200 py-3 sm:py-4"
                          >
                            Access Resource <span className="ml-2">&rarr;</span>
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        </AnimatePresence>

        <div className="text-center mt-12 sm:mt-16">
          <a
            href="/books"
            className="text-black font-semibold flex items-center gap-2 border border-gray-200 hover:border-black transition-all duration-200 text-base sm:text-lg px-6 py-3 rounded-full mx-auto w-fit"
          >
            View Complete Collection
            <span className="ml-1">&#8594;</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default FeaturedBooks;
