import React from "react";
import FileRenamer from "./components/FileRenamer";
function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
          File Renamer
        </h1>
        <FileRenamer />
      </div>
    </div>
  );
}

export default App;
