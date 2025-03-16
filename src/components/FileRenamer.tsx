import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUpload,
  FiX,
  FiDownload,
  FiCheck,
  FiClock,
  FiImage,
  FiVideo,
  FiMusic,
  FiFolder,
  FiAlertCircle,
  FiTrash2,
  FiGrid,
  FiFileText,
  FiEdit3,
  FiFile,
  FiBook,
  FiTable,
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

// Toast interface
interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "loading";
  duration?: number;
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const progressIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const [selectedFileType, setSelectedFileType] = useState<string>("all");

  // Toast functions
  const showToast = (
    message: string,
    type: Toast["type"],
    duration: number = 3000
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, duration };
    setToasts((prev) => [...prev, newToast]);

    if (type !== "loading") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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

  // Group files by type
  const fileGroups = useMemo(() => {
    const groups: { [key: string]: FileWithPreview[] } = {
      images: files.filter((f) => f.type.startsWith("image/")),
      videos: files.filter((f) => f.type.startsWith("video/")),
      audio: files.filter((f) => f.type.startsWith("audio/")),
      documents: files.filter(
        (f) =>
          f.type.includes("pdf") ||
          f.type.includes("word") ||
          f.type.includes("excel") ||
          f.type.includes("text/plain")
      ),
      others: files.filter(
        (f) =>
          !f.type.startsWith("image/") &&
          !f.type.startsWith("video/") &&
          !f.type.startsWith("audio/") &&
          !f.type.includes("pdf") &&
          !f.type.includes("word") &&
          !f.type.includes("excel") &&
          !f.type.includes("text/plain")
      ),
    };
    return groups;
  }, [files]);

  // Get filtered files based on selected type
  const filteredFiles = useMemo(() => {
    if (selectedFileType === "all") return files;
    return fileGroups[selectedFileType] || [];
  }, [files, selectedFileType, fileGroups]);

  // Get file type counts
  const fileTypeCounts = useMemo(
    () => ({
      all: files.length,
      images: fileGroups.images.length,
      videos: fileGroups.videos.length,
      audio: fileGroups.audio.length,
      documents: fileGroups.documents.length,
      others: fileGroups.others.length,
    }),
    [files, fileGroups]
  );

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/"))
      return <FiImage className="w-6 h-6 text-blue-400" />;
    if (fileType.startsWith("video/"))
      return <FiVideo className="w-6 h-6 text-purple-400" />;
    if (fileType.startsWith("audio/"))
      return <FiMusic className="w-6 h-6 text-green-400" />;
    if (fileType.includes("pdf"))
      return <FiFileText className="w-6 h-6 text-red-400" />;
    if (fileType.includes("word"))
      return <FiBook className="w-6 h-6 text-blue-500" />;
    if (fileType.includes("excel"))
      return <FiTable className="w-6 h-6 text-green-500" />;
    return <FiFile className="w-6 h-6 text-gray-400" />;
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

  const handleClearAll = () => {
    if (files.length === 0) {
      showToast("No files to clear!", "error");
      return;
    }

    // Clear all file previews
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });

    // Clear all intervals
    Object.values(progressIntervals.current).forEach(clearInterval);
    progressIntervals.current = {};

    // Reset all state
    setFiles([]);
    setBaseFileName("");
    setUploadProgress({});
    setSelectedFileType("all");
    showToast("All files cleared successfully!", "success");
  };

  const handleRemoveFile = (index: number) => {
    const removedFile = files[index];
    if (removedFile.preview) {
      URL.revokeObjectURL(removedFile.preview);
    }
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
    showToast(`Removed ${removedFile.name}`, "success");
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
      showToast("Please enter a base name for the files.", "error");
      return;
    }

    if (filteredFiles.length === 0) {
      showToast("No files to rename.", "error");
      return;
    }

    try {
      // First, create the new history entries
      const historyEntries: HistoryEntry[] = filteredFiles.map(
        (file, index) => {
          const extension = file.name.split(".").pop() || "";
          const newName = `${baseFileName}_${index + 1}.${extension}`;
          return {
            timestamp: Date.now(),
            oldName: file.name,
            newName,
            fileType: file.type,
          };
        }
      );

      // Update history once
      setHistory((prev) => [...historyEntries, ...prev.slice(0, 49)]);

      // Then update files with new names
      const newFiles = files.map((file) => {
        if (!filteredFiles.includes(file)) return file;

        const index = filteredFiles.indexOf(file);
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

      showToast(
        `Renamed ${filteredFiles.length} files successfully!`,
        "success"
      );
    } catch (err) {
      console.error("Rename error:", err);
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to rename files. Please try again.",
        "error"
      );
    }
  };

  const handleDownload = async () => {
    if (!baseFileName) {
      showToast("Please enter a base name for the files.", "error");
      return;
    }
    if (filteredFiles.length === 0) {
      showToast("Please add some files first.", "error");
      return;
    }

    const toastId = showToast("Preparing files for download...", "loading");

    try {
      const zip = new JSZip();
      let totalSize = 0;
      filteredFiles.forEach((file) => (totalSize += file.size));
      let processedSize = 0;

      setUploadProgress((prev) => ({ ...prev, download: 0 }));

      // Process files in chunks to prevent memory issues
      const chunkSize = 5; // Process 5 files at a time
      for (let i = 0; i < filteredFiles.length; i += chunkSize) {
        const chunk = filteredFiles.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (file) => {
            try {
              const extension = file.name.split(".").pop() || "";
              const newName =
                file.newName ||
                `${baseFileName}_${
                  filteredFiles.indexOf(file) + 1
                }.${extension}`;

              const arrayBuffer = await file.arrayBuffer();
              zip.file(newName, arrayBuffer);

              processedSize += file.size;
              setUploadProgress((prev) => ({
                ...prev,
                download: Math.min((processedSize / totalSize) * 100, 99),
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

      showToast("Files downloaded successfully!", "success");
      removeToast(toastId);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to create download. Please try again.";
      showToast(errorMessage, "error");
      removeToast(toastId);
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
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className={`p-4 rounded-lg shadow-lg flex items-center gap-2 min-w-[300px] ${
                toast.type === "success"
                  ? "bg-green-500 text-white"
                  : toast.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-blue-500 text-white"
              }`}
            >
              {toast.type === "success" && (
                <FiCheck className="flex-shrink-0" />
              )}
              {toast.type === "error" && (
                <FiAlertCircle className="flex-shrink-0" />
              )}
              {toast.type === "loading" && (
                <svg
                  className="animate-spin h-5 w-5 flex-shrink-0"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <span className="flex-1">{toast.message}</span>
              {toast.type !== "loading" && (
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-white/80 hover:text-white"
                >
                  <FiX />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FiEdit3 className="text-primary" />
          File Renamer
        </h1>
        {files.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClearAll}
            className="px-4 py-2 bg-red-500 text-white rounded-lg flex items-center gap-2 hover:bg-red-600"
          >
            <FiTrash2 />
            Clear All
          </motion.button>
        )}
      </div>

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
          <div className="flex flex-col gap-4 mb-6">
            {/* File type filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedFileType("all")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  selectedFileType === "all"
                    ? "bg-primary text-white"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <FiGrid />
                All ({fileTypeCounts.all})
              </button>
              {fileTypeCounts.images > 0 && (
                <button
                  onClick={() => setSelectedFileType("images")}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    selectedFileType === "images"
                      ? "bg-primary text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  <FiImage />
                  Images ({fileTypeCounts.images})
                </button>
              )}
              {fileTypeCounts.videos > 0 && (
                <button
                  onClick={() => setSelectedFileType("videos")}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    selectedFileType === "videos"
                      ? "bg-primary text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  <FiVideo />
                  Videos ({fileTypeCounts.videos})
                </button>
              )}
              {fileTypeCounts.audio > 0 && (
                <button
                  onClick={() => setSelectedFileType("audio")}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    selectedFileType === "audio"
                      ? "bg-primary text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  <FiMusic />
                  Audio ({fileTypeCounts.audio})
                </button>
              )}
              {fileTypeCounts.documents > 0 && (
                <button
                  onClick={() => setSelectedFileType("documents")}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    selectedFileType === "documents"
                      ? "bg-primary text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  <FiFileText />
                  Documents ({fileTypeCounts.documents})
                </button>
              )}
              {fileTypeCounts.others > 0 && (
                <button
                  onClick={() => setSelectedFileType("others")}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    selectedFileType === "others"
                      ? "bg-primary text-white"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  <FiFolder />
                  Others ({fileTypeCounts.others})
                </button>
              )}
            </div>

            {/* Rename controls */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="flex-1 relative">
                <FiEdit3 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter base name for files..."
                  value={baseFileName}
                  onChange={handleBaseNameChange}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRename}
                  disabled={!baseFileName || filteredFiles.length === 0}
                  className="px-6 py-2 bg-primary rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isRenaming ? <FiCheck /> : <FiEdit3 />}
                  <span>
                    Rename{" "}
                    {selectedFileType !== "all" ? selectedFileType : "Files"}
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDownload}
                  disabled={!baseFileName || filteredFiles.length === 0}
                  className="px-6 py-2 bg-gradient-to-r from-primary to-secondary rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <FiDownload />
                  <span>
                    Download{" "}
                    {selectedFileType !== "all" ? selectedFileType : "All"}
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowHistory(!showHistory)}
                  className="px-4 py-2 bg-gray-700 rounded-lg flex items-center gap-2 hover:bg-gray-600"
                >
                  <FiClock />
                  <span className="sr-only">History</span>
                </motion.button>
              </div>
            </div>
          </div>

          {/* File Grid - Update to use filteredFiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredFiles.map((file, index) => (
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
                    <div className="flex-shrink-0">
                      {getFileIcon(file.type)}
                    </div>
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
                      <div className="flex-shrink-0">
                        {getFileIcon(entry.fileType)}
                      </div>
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
