import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, isProcessing }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'application/zip': ['.zip', '.scorm'],
      'application/x-zip-compressed': ['.zip']
    },
    multiple: false,
    disabled: isProcessing
  } as any);

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-[32px] p-12 transition-all duration-300 text-center",
        isDragActive ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-orange-300 hover:bg-slate-50",
        isProcessing && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "w-20 h-20 rounded-3xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg",
          isDragActive ? "bg-orange-100 text-orange-600 shadow-orange-100" : "bg-slate-100 text-slate-400 shadow-slate-100"
        )}>
          {isProcessing ? (
            <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-10 h-10" />
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-2xl font-black text-slate-900 leading-tight">
            {isProcessing ? "Processing..." : "Upload Policy or SCORM"}
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
            Drop a PDF, PPTX, or a <b>previously exported project ZIP</b> here to start/continue editing your module.
          </p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black text-slate-600 shadow-sm uppercase tracking-widest">
            <FileText className="w-3 h-3 text-orange-500" />
            PDF / PPTX / TXT
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-xl text-[10px] font-black text-orange-600 shadow-sm uppercase tracking-widest">
            <Upload className="w-3 h-3" />
            SCORM ZIP (RE-EDIT)
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-2xl">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-indigo-900 font-bold animate-pulse">Extracting data...</p>
          </div>
        </div>
      )}
    </div>
  );
};
