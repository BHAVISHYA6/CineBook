import React, { useState } from 'react';
import { Upload, X, Check, Image as ImageIcon, AlertCircle } from 'lucide-react';
import api from '../services/api';

export const ImageUpload = ({ value, onChange, label = 'Poster Image' }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(value || '');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image (JPEG, PNG, or WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image file must be under 5MB.');
      return;
    }

    // Local instant preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post('/api/admin/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedUrl = res.data?.data?.url;
      setPreview(uploadedUrl);
      onChange(uploadedUrl);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to upload image to Cloudinary.');
      setPreview(value || '');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview('');
    onChange('');
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-300">{label}</label>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}

      {preview ? (
        <div className="relative group w-32 h-44 rounded-xl overflow-hidden border border-gray-700 bg-gray-900 shadow-md">
          <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 rounded-full bg-red-600/80 text-white hover:bg-red-600 shadow-lg transition"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {isUploading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] text-gray-300">Uploading...</span>
            </div>
          )}
        </div>
      ) : (
        <label className="w-32 h-44 border-2 border-dashed border-gray-700 hover:border-red-500 rounded-xl flex flex-col items-center justify-center p-4 text-center cursor-pointer bg-[#0b0f19] transition group">
          <ImageIcon className="w-8 h-8 text-gray-500 group-hover:text-red-400 mb-2 transition" />
          <span className="text-xs font-semibold text-gray-400 group-hover:text-white">
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </span>
          <span className="text-[10px] text-gray-600 mt-1">PNG, JPG up to 5MB</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
};
