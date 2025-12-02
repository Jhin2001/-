import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Image, Film, File, Trash2, Check, CloudOff, AlertTriangle } from 'lucide-react';
import api, { MediaFile } from '../services/api';
import { useToast } from './ToastProvider';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  allowedTypes?: 'image' | 'video' | 'all';
  isConnected?: boolean;
}

const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({ 
  isOpen, onClose, onSelect, allowedTypes = 'all', isConnected 
}) => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen]);

  const loadFiles = async () => {
    if (!isConnected) {
        // Local Mode: Load from localStorage simulation
        try {
            const local = localStorage.getItem('pqms_local_media');
            if (local) setFiles(JSON.parse(local));
        } catch(e) { console.warn("Local media read failed", e); }
        return;
    }

    setLoading(true);
    try {
      const list = await api.admin.getMediaFiles();
      setFiles(list);
    } catch (e) {
      console.error("Failed to load media", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
         await handleUpload(e.target.files[0]);
     }
  };

  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          await handleUpload(e.dataTransfer.files[0]);
      }
  };

  const handleUpload = async (file: File) => {
      setUploading(true);
      
      // Determine type
      const isVideo = file.type.startsWith('video');
      const isImage = file.type.startsWith('image');
      if (!isVideo && !isImage) {
          toast.error("只支持图片或视频文件");
          setUploading(false);
          return;
      }

      const fileType = isVideo ? 'video' : 'image';

      if (isConnected) {
          try {
              const newFile = await api.admin.uploadFile(file);
              setFiles(prev => [newFile, ...prev]);
              toast.success("上传成功");
          } catch (e: any) {
              toast.error(`上传失败: ${e.message}`);
          }
      } else {
          // Local Simulation using FileReader (Base64) or ObjectURL
          const reader = new FileReader();
          reader.onload = (e) => {
              const result = e.target?.result as string;
              const newFile: MediaFile = {
                  id: `local-${Date.now()}`,
                  name: file.name,
                  url: result, // Base64
                  type: fileType,
                  size: file.size,
                  uploadTime: new Date().toISOString()
              };
              const updated = [newFile, ...files];
              setFiles(updated);
              // Save to local storage (Only small files will work well)
              try {
                localStorage.setItem('pqms_local_media', JSON.stringify(updated));
                toast.success("上传成功 (本地模拟)");
              } catch(err) {
                  toast.error("本地存储空间不足");
              }
          };
          reader.readAsDataURL(file);
      }
      setUploading(false);
  };

  // Filter based on allowedTypes
  const filteredFiles = files.filter(f => {
      if (allowedTypes === 'all') return true;
      return f.type === allowedTypes;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4">
       <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95">
          
          {/* Header */}
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
             <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                 {allowedTypes === 'video' ? <Film size={20}/> : <Image size={20}/>}
                 媒体资源库
             </h3>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                 <X size={24} />
             </button>
          </div>

          {/* Toolbar / Status */}
          <div className="p-4 border-b bg-white flex justify-between items-center">
             <div className="flex items-center gap-2 text-sm text-gray-500">
                 {isConnected ? (
                     <span className="text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 flex items-center gap-1">
                         <Check size={12}/> API 连接正常
                     </span>
                 ) : (
                     <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 flex items-center gap-1">
                         <CloudOff size={12}/> 本地模拟模式 (文件仅本地可见)
                     </span>
                 )}
                 <span>共 {filteredFiles.length} 个文件</span>
             </div>
             
             <div className="flex gap-2">
                <input 
                   type="file" 
                   ref={fileInputRef} 
                   className="hidden" 
                   onChange={handleFileSelect}
                   accept={allowedTypes === 'video' ? "video/*" : allowedTypes === 'image' ? "image/*" : "image/*,video/*"}
                />
                <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={uploading}
                   className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                >
                   {uploading ? (
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   ) : (
                       <Upload size={18} />
                   )}
                   上传文件
                </button>
             </div>
          </div>

          {/* Drag & Drop Zone / Grid */}
          <div 
             className={`flex-1 overflow-y-auto p-6 bg-gray-100 relative transition-colors ${dragActive ? 'bg-blue-50' : ''}`}
             onDragEnter={() => setDragActive(true)}
             onDragLeave={() => setDragActive(false)}
             onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
             onDrop={handleDrop}
          >
             {dragActive && (
                 <div className="absolute inset-0 border-4 border-dashed border-blue-400 rounded-xl flex items-center justify-center bg-blue-50/80 z-10 pointer-events-none">
                     <div className="text-blue-600 font-bold text-xl">释放文件以上传</div>
                 </div>
             )}

             {files.length === 0 && !loading ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                     <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                         <Upload size={32} />
                     </div>
                     <p>暂无文件，请上传或拖拽文件至此</p>
                 </div>
             ) : (
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                     {filteredFiles.map(file => (
                         <div 
                           key={file.id} 
                           className="group relative bg-white rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden aspect-square flex flex-col"
                           onClick={() => {
                               onSelect(file.url);
                               onClose();
                           }}
                         >
                            {/* Preview Area */}
                            <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                                {file.type === 'image' ? (
                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center text-gray-500">
                                        <Film size={32} />
                                        <span className="text-[10px] mt-1 uppercase">VIDEO</span>
                                    </div>
                                )}
                                
                                {/* Overlay on Hover */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button className="bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-bold shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                                        选择
                                    </button>
                                </div>
                            </div>
                            
                            {/* Footer Info */}
                            <div className="p-2 text-xs border-t bg-white">
                                <div className="font-medium truncate text-gray-700" title={file.name}>{file.name}</div>
                                <div className="text-gray-400 flex justify-between mt-1">
                                    <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                                    <span>{new Date(file.uploadTime).toLocaleDateString()}</span>
                                </div>
                            </div>
                         </div>
                     ))}
                 </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default MediaLibraryModal;