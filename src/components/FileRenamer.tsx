import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUpload,
  FiX,
  FiDownload,
  FiCheck,
  FiClock,
  FiFile,
  FiAlertCircle,
} from "react-icons/fi";
import JSZip from "jszip";

// Define a custom type that includes all File properties
type CustomFile = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  slice: (start?: number, end?: number, contentType?: string) => Blob;
  arrayBuffer: () => Promise<ArrayBuffer>;
  stream: () => ReadableStream;
  text: () => Promise<string>;
};

interface FileWithPreview extends CustomFile {
  preview?: string;
  newName?: string;
}

interface HistoryEntry {
  timestamp: number;
  oldName: string;
  newName: string;
  fileType: string;
}

interface JSZipMetadata {
  percent: number;
  currentFile: string;
}

const FileRenamer: React.FC = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [baseFileName, setBaseFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isRenaming, setIsRenaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("fileRenameHistory");
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("fileRenameHistory", JSON.stringify(history));
    } catch (err) {
      console.error("Failed to save history:", err);
    }
  }, [history]);

  // Cleanup function for progress intervals and file previews
  useEffect(() => {
    return () => {
      // Clear all intervals
      Object.values(progressIntervals.current).forEach(clearInterval);
      // Revoke all object URLs
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType.startsWith("video/")) return "🎥";
    if (fileType.startsWith("audio/")) return "🎵";
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("word")) return "📝";
    if (fileType.includes("excel")) return "📊";
    return "📁";
  };

  const getFileType = (file: File): string => {
    if (!file.type) {
      // Try to determine type from extension
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      switch (ext) {
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
          return "image/" + ext;
        case "mp4":
        case "webm":
          return "video/" + ext;
        case "mp3":
        case "wav":
          return "audio/" + ext;
        case "pdf":
          return "application/pdf";
        case "doc":
        case "docx":
          return "application/msword";
        case "xls":
        case "xlsx":
          return "application/vnd.ms-excel";
        default:
          return "application/octet-stream";
      }
    }
    return file.type;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    try {
      const newFiles = acceptedFiles.map((file) => {
        if (file.size > 1024 * 1024) {
          simulateFileUploadProgress(file.name);
        }

        const type = getFileType(file);
        const preview = type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;

        return {
          name: file.name,
          size: file.size,
          type,
          lastModified: file.lastModified,
          slice: file.slice.bind(file),
          arrayBuffer: file.arrayBuffer.bind(file),
          stream: file.stream.bind(file),
          text: file.text.bind(file),
          preview,
        } as FileWithPreview;
      });

      setFiles((prev) => [...prev, ...newFiles]);
      setError(null);
    } catch (err) {
      setError("Failed to process dropped files. Please try again.");
      console.error("Drop error:", err);
    }
  }, []);

  const simulateFileUploadProgress = (fileName: string) => {
    let progress = 0;
    // Clear any existing interval for this file
    if (progressIntervals.current[fileName]) {
      clearInterval(progressIntervals.current[fileName]);
    }

    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress > 100) {
        progress = 100;
        clearInterval(interval);
        delete progressIntervals.current[fileName];
      }
      setUploadProgress((prev) => ({
        ...prev,
        [fileName]: Math.min(progress, 100),
      }));
    }, 500);

    progressIntervals.current[fileName] = interval;
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "video/*": [".mp4", ".webm", ".mov"],
      "audio/*": [".mp3", ".wav"],
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/msword": [".doc", ".docx"],
      "application/vnd.ms-excel": [".xls", ".xlsx"],
      "application/zip": [".zip"],
      "application/x-rar-compressed": [".rar"],
      "application/json": [".json"],
      "text/html": [".html", ".htm"],
      "text/css": [".css"],
      "text/javascript": [".js"],
      "application/xml": [".xml"],
      // Add more file types as needed
    },
  });

  const handleRemoveFile = (index: number) => {
    const removedFile = files[index];
    if (removedFile.preview) {
      URL.revokeObjectURL(removedFile.preview);
    }
    // Clear any ongoing progress simulation
    if (progressIntervals.current[removedFile.name]) {
      clearInterval(progressIntervals.current[removedFile.name]);
      delete progressIntervals.current[removedFile.name];
    }
    setFiles(files.filter((_, i) => i !== index));
    setUploadProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[removedFile.name];
      return newProgress;
    });
  };

  const handleBaseNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Remove any characters that could cause issues in filenames
    const sanitizedValue = value.replace(/[<>:"/\\|?*]/g, "");
    setBaseFileName(sanitizedValue.trim());
    setError(null);
  };

  const handleRename = () => {
    if (!baseFileName) {
      setError("Please enter a base name for the files.");
      return;
    }

    if (files.length === 0) {
      setError("No files to rename.");
      return;
    }

    try {
      // First, create the new history entries
      const historyEntries: HistoryEntry[] = files.map((file, index) => {
        const extension = file.name.split(".").pop() || "";
        const newName = `${baseFileName}_${index + 1}.${extension}`;
        return {
          timestamp: Date.now(),
          oldName: file.name,
          newName,
          fileType: file.type, // file.type is already guaranteed to be a string from our CustomFile type
        };
      });

      // Update history once
      setHistory((prev) => [...historyEntries, ...prev.slice(0, 49)]);

      // Then update files with new names
      const newFiles = files.map((file, index) => {
        const extension = file.name.split(".").pop() || "";
        const newName = `${baseFileName}_${index + 1}.${extension}`;
        return {
          ...file,
          newName,
        };
      });

      setFiles(newFiles);
      setIsRenaming(true);
      setError(null);
      setTimeout(() => setIsRenaming(false), 1500);
    } catch (err) {
      console.error("Rename error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to rename files. Please try again."
      );
    }
  };

  const handleDownload = async () => {
    if (!baseFileName) {
      setError("Please enter a base name for the files.");
      return;
    }
    if (files.length === 0) {
      setError("Please add some files first.");
      return;
    }

    try {
      const zip = new JSZip();
      let totalSize = 0;
      files.forEach((file) => (totalSize += file.size));
      let processedSize = 0;

      setUploadProgress((prev) => ({ ...prev, download: 0 }));

      // Process files in chunks to prevent memory issues
      const chunkSize = 5; // Process 5 files at a time
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (file) => {
            try {
              const extension = file.name.split(".").pop() || "";
              const newName =
                file.newName ||
                `${baseFileName}_${files.indexOf(file) + 1}.${extension}`;

              // Read file as ArrayBuffer to handle large files better
              const arrayBuffer = await file.arrayBuffer();
              zip.file(newName, arrayBuffer);

              processedSize += file.size;
              setUploadProgress((prev) => ({
                ...prev,
                download: Math.min((processedSize / totalSize) * 100, 99), // Cap at 99% until final zip
              }));
            } catch (err) {
              console.error(`Error processing file ${file.name}:`, err);
              throw new Error(`Failed to process file ${file.name}`);
            }
          })
        );
      }

      const content = await zip.generateAsync(
        {
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6,
          },
        },
        (metadata) => {
          if (metadata.percent) {
            setUploadProgress((prev) => ({
              ...prev,
              download: 99 + metadata.percent / 100, // Final 1% for zip generation
            }));
          }
        }
      );

      // Create and trigger download
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${baseFileName}_files.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setError(null);
      // Reset download progress after a short delay
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, download: 0 }));
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create download. Please try again.";
      setError(errorMessage);
      console.error("Download error:", err);
      setUploadProgress((prev) => ({ ...prev, download: 0 }));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-100 flex items-center gap-2"
        >
          <FiAlertCircle className="flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-100 hover:text-white"
          >
            <FiX />
          </button>
        </motion.div>
      )}

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
          <p className="text-sm text-gray-400 mt-2">
            Supports images, videos, documents, and more
          </p>
        </motion.div>
      </div>

      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Enter base name for files..."
              value={baseFileName}
              onChange={handleBaseNameChange}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-primary focus:outline-none"
            />
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRename}
                disabled={!baseFileName || files.length === 0}
                className="px-6 py-2 bg-primary rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isRenaming ? <FiCheck /> : "Rename Files"}
              </motion.button>
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowHistory(!showHistory)}
                className="px-4 py-2 bg-gray-700 rounded-lg flex items-center gap-2"
              >
                <FiClock />
              </motion.button>
            </div>
          </div>

          {/* File Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getFileIcon(file.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate mb-1">{file.name}</div>
                      {file.newName && (
                        <div className="text-xs text-primary truncate mb-1">
                          → {file.newName}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>

                  {uploadProgress[file.name] !== undefined &&
                    uploadProgress[file.name] < 100 && (
                      <div className="mt-2">
                        <div className="h-1 bg-gray-600 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: "0%" }}
                            animate={{ width: `${uploadProgress[file.name]}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* History Panel */}
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-8 bg-gray-800 rounded-lg p-4"
              >
                <h3 className="text-lg font-semibold mb-4">Recent Renames</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 text-sm p-2 hover:bg-gray-700 rounded"
                    >
                      <span>{getFileIcon(entry.fileType)}</span>
                      <div className="flex-1">
                        <div className="text-gray-400">{entry.oldName}</div>
                        <div className="text-primary">→ {entry.newName}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add download progress bar */}
      {uploadProgress.download > 0 && uploadProgress.download < 100 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-4 right-4 w-64 bg-gray-800 p-4 rounded-lg shadow-lg"
        >
          <div className="text-sm mb-2">Creating download...</div>
          <div className="h-1 bg-gray-600 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${uploadProgress.download}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default FileRenamer;
