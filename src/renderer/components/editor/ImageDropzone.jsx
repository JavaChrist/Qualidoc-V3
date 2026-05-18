import { useState, useCallback, useEffect, useRef } from 'react';
import { Image as ImageIcon, Upload, Clipboard, X, Edit3 } from 'lucide-react';
import { useUiStore } from '../../store/useUiStore.js';
import { isInElectron } from '../../utils/storage.js';

/**
 * Zone de dépôt d'image avec :
 * - Drag & drop
 * - Sélection fichier (Electron dialog ou input)
 * - Coller depuis presse-papier (Ctrl+V via Electron clipboard)
 * - Aperçu avec bouton supprimer / éditer (annotations)
 */
export default function ImageDropzone({ value, onChange, onAnnotate, height = 200 }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);
  const notify = useUiStore((s) => s.notify);

  const setImage = useCallback(async (dataUrl) => {
    if (!dataUrl) return;
    if (isInElectron && window.qualidoc?.image?.optimize) {
      const optimized = await window.qualidoc.image.optimize({ dataUrl, maxWidth: 1600, quality: 85 });
      onChange(optimized);
    } else {
      onChange(dataUrl);
    }
  }, [onChange]);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      notify('error', 'Format de fichier non supporté');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target.result);
    reader.readAsDataURL(file);
  }, [setImage, notify]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onPaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        e.preventDefault();
        const file = it.getAsFile();
        handleFile(file);
        return;
      }
    }
  }, [handleFile]);

  useEffect(() => {
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [onPaste]);

  const openFileDialog = async () => {
    if (isInElectron && window.qualidoc?.dialog?.openImage) {
      const dataUrl = await window.qualidoc.dialog.openImage();
      if (dataUrl) setImage(dataUrl);
    } else {
      inputRef.current?.click();
    }
  };

  const pasteFromClipboard = async () => {
    if (isInElectron && window.qualidoc?.clipboard?.readImage) {
      const dataUrl = await window.qualidoc.clipboard.readImage();
      if (dataUrl) setImage(dataUrl);
      else notify('warning', 'Aucune image dans le presse-papier');
    } else {
      notify('info', 'Utilisez Ctrl+V pour coller');
    }
  };

  if (value) {
    return (
      <div className="relative group">
        <img
          src={value}
          alt=""
          className="w-full rounded border border-unitep-border object-contain bg-slate-50"
          style={{ maxHeight: height * 1.5 }}
        />
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAnnotate && (
            <button
              onClick={onAnnotate}
              className="p-1.5 bg-white rounded shadow hover:bg-unitep-navy hover:text-white transition-colors"
              title="Annoter"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={openFileDialog}
            className="p-1.5 bg-white rounded shadow hover:bg-slate-100"
            title="Remplacer"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onChange(null)}
            className="p-1.5 bg-white rounded shadow hover:bg-unitep-danger hover:text-white transition-colors"
            title="Supprimer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      style={{ height }}
      className={`border-2 border-dashed rounded-md flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
        isDragging
          ? 'border-unitep-navy bg-unitep-navy/5'
          : 'border-unitep-border bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
      }`}
      onClick={openFileDialog}
    >
      <ImageIcon className="w-8 h-8 text-slate-400" />
      <div className="text-sm font-medium text-slate-600">
        {isDragging ? 'Déposez l\'image ici' : 'Glisser-déposer une image'}
      </div>
      <div className="flex gap-2 mt-1">
        <button onClick={(e) => { e.stopPropagation(); openFileDialog(); }} className="btn-secondary text-xs py-1 px-2">
          <Upload className="w-3 h-3" /> Parcourir
        </button>
        <button onClick={(e) => { e.stopPropagation(); pasteFromClipboard(); }} className="btn-secondary text-xs py-1 px-2">
          <Clipboard className="w-3 h-3" /> Coller (Ctrl+V)
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
