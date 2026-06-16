import { useRef, useState } from 'react';
import { uploadToCloudinary } from '../../utils/cloudinary';
import toast from 'react-hot-toast';

export default function PhotoUpload({ onUpload, onDelete, hasPhoto = false, compact = false }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      onUpload(url);
    } catch {
      toast.error('Photo upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const uploadBtn = (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className={compact
        ? 'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-primary bg-primary/8 hover:bg-primary/15 transition-colors disabled:opacity-50 whitespace-nowrap'
        : 'flex items-center gap-2 px-4 py-2 bg-surface-container border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50'
      }
    >
      {uploading
        ? <><span className="material-symbols-outlined animate-spin text-[13px]">progress_activity</span> {compact ? 'Uploading…' : 'Uploading...'}</>
        : <><span className="material-symbols-outlined text-[13px]">upload</span> {compact ? 'Upload' : 'Upload Photo'}</>
      }
    </button>
  );

  const deleteBtn = hasPhoto && onDelete && (
    <button
      type="button"
      onClick={onDelete}
      className={compact
        ? 'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-error bg-error/8 hover:bg-error/15 transition-colors whitespace-nowrap'
        : 'flex items-center gap-2 px-4 py-2 bg-error/10 border border-error/20 rounded-xl text-sm font-medium text-error hover:bg-error/20 transition-colors'
      }
    >
      <span className="material-symbols-outlined text-[13px]">delete</span> {compact ? 'Delete' : 'Delete Photo'}
    </button>
  );

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className={compact ? 'flex items-center gap-1.5' : 'flex items-center gap-2'}>
        {uploadBtn}
        {deleteBtn}
      </div>
    </>
  );
}
