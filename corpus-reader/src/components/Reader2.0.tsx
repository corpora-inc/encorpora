import { sample } from "@/lib/utils";
import { useEffect, useState } from "react";
import { ReactReader } from "react-reader";
import { useParams } from "react-router-dom";
import { Button } from "./ui/button";
export const Reader = () => {
  const [location, setLocation] = useState(undefined);
  const [epubFile, setEpubFile] = useState<ArrayBufferLike | undefined>(
    undefined
  );
  const { bookPath } = useParams<{ bookPath: string }>();

  const locationChanged = (epubcifi) => {
    setLocation(epubcifi);
  };

  useEffect(() => {
    // This effect runs once when the component mounts
    if (!bookPath) return;
    sample(bookPath)
      .then((file) => {
        const sss = file.buffer;
        console.log("Loaded book:", bookPath, sss);
        setEpubFile(sss);
        console.log("Epub file set:");
        setLocation(undefined); // Reset location when a new book is loaded
      })
      .catch((error) => {
        console.error("Error loading book:", error);
      });
  }, [bookPath]);

  return (
    <div style={{ height: "100vh" }}>
      <Button
        onClick={() => {
          // Navigate back to the home screen
          window.history.back();
        }}
      >
        go back
      </Button>
      <ReactReader
        location={location}
        locationChanged={locationChanged}
        url={epubFile}
      />
    </div>
  );
};
