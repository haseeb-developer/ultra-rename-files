import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { FiUpload, FiX, FiDownload } from "react-icons/fi";
import JSZip from "jszip";

interface FileWithPreview extends File {
  preview?: string;
  newName?: string;
}

const FileRenamer: React.FC = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [baseFileName, setBaseFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(
      acceptedFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        })
      )
    );
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleBaseNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBaseFileName(e.target.value);
  };

  const handleDownload = async () => {
    if (!baseFileName || files.length === 0) return;

    const zip = new JSZip();

    files.forEach((file, index) => {
      const extension = file.name.split(".").pop();
      const newName = `${baseFileName}_${index + 1}.${extension}`;
      zip.file(newName, file);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = "renamed_files.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div {...getRootProps()}>
        <motion.div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/10" : "border-gray-600"
          }`}
          animate={{ scale: isDragging ? 1.02 : 1 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <input {...getInputProps()} />
          <FiUpload className="mx-auto text-4xl mb-4 text-primary" />
          <p className="text-lg">
            Drag & drop files here, or click to select files
          </p>
        </motion.div>
      </div>

      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Enter base name for files..."
              value={baseFileName}
              onChange={handleBaseNameChange}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-primary focus:outline-none"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleDownload}
              disabled={!baseFileName || files.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <FiDownload />
              Download All
            </motion.button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <AnimatePresence>
              {files.map((file, index) => (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative p-4 rounded-lg bg-gray-700 group"
                >
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiX />
                  </button>
                  <div className="text-sm truncate mb-2">{file.name}</div>
                  <div className="text-xs text-gray-400">
                    New name: {baseFileName}_{index + 1}.
                    {file.name.split(".").pop()}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default FileRenamer;
