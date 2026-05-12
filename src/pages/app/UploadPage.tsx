import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useTranslation } from 'react-i18next';
import {
  X,
  Image as ImageIcon,
  Check,
  Crop,
  ArrowRight,
  AlertCircle,
  Camera,
  Plus,
  Images,
  Trash2,
  FileText,
  Loader2,
  ShieldCheck
} from 'lucide-react';

import * as pdfjsLib from 'pdfjs-dist';
// Standard Vite approach for pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
import mammoth from 'mammoth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QueuedImage {
  id: string;
  file?: File;                // Original file for optimized compression
  previewUrl: string;          // object URL for display / cropper
  compressedBase64: string | null;  // null = not yet processed
  name: string;
  isCropping: boolean;
  crop: { x: number; y: number };
  zoom: number;
  croppedArea: CropArea | null;
}

const MAX_IMAGES = 10;

// Simple helper for mobile detection
const isMobileUploadDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// ─── Per-image crop panel ─────────────────────────────────────────────────────

function ImageCropPanel({
  img,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onConfirm,
  onSkip,
  isCompressing,
}: {
  img: QueuedImage;
  onCropChange: (crop: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onCropComplete: (croppedAreaPixels: CropArea) => void;
  onConfirm: () => void;
  onSkip: () => void;
  isCompressing: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="omni-card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--omni-text)] flex items-center gap-2">
          <Crop className="w-5 h-5" />
          {t('upload.cropPanel.title')}
        </h3>
      </div>

      <div
        className="relative w-full h-[38vh] lg:h-[380px] bg-gray-900 rounded-xl overflow-hidden mb-4"
        style={{ touchAction: 'none' }}
      >
        <Cropper
          image={img.previewUrl}
          crop={img.crop}
          zoom={img.zoom}
          aspect={4 / 3}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={(_, px) => onCropComplete(px)}
        />
      </div>

      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm text-[var(--omni-text-muted)]">{t('upload.cropPanel.zoom')}</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={img.zoom}
          onChange={e => onZoomChange(Number(e.target.value))}
          disabled={isCompressing}
          className="flex-1"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isCompressing}
          className="flex-1 omni-btn-primary disabled:opacity-50 disabled:cursor-wait"
        >
          {isCompressing
            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
            : <Check className="w-5 h-5 flex-shrink-0" />}
          {isCompressing ? t('upload.cropPanel.processing') : t('upload.cropPanel.confirm')}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={isCompressing}
          className="omni-btn-secondary disabled:opacity-50 disabled:cursor-wait"
        >
          {t('upload.cropPanel.skip')}
        </button>
      </div>
    </div>
  );
}

// ─── Thumbnail strip ──────────────────────────────────────────────────────────

function ThumbnailStrip({
  images,
  activeIdx,
  onSelect,
  onRemove,
}: {
  images: QueuedImage[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  onRemove: (idx: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3 flex-wrap">
      {images.map((img, idx) => (
        <div
          key={img.id}
          className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all
            ${activeIdx === idx
              ? 'border-[var(--omni-accent)] shadow-lg scale-105'
              : 'border-gray-200 hover:border-indigo-300'}`}
          style={{ width: 72, height: 72 }}
          onClick={() => onSelect(idx)}
        >
          <img src={img.compressedBase64 ?? img.previewUrl} alt="" className="w-full h-full object-cover" />

          {/* Status overlay */}
          {img.compressedBase64 ? (
            <div className="absolute inset-0 flex items-end justify-end p-1">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
          ) : img.isCropping ? (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Crop className="w-5 h-5 text-white" />
            </div>
          ) : null}

          {/* Page number */}
          <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold rounded px-1">
            {idx + 1}
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove(idx); }}
            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
            title={t('upload.actions.remove')}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main UploadPage ──────────────────────────────────────────────────────────

export default function UploadPage() {
  const navigate = useNavigate();
  const { user, isDemoMode } = useAuth();
  const { t } = useTranslation();

  const [images, setImages] = useState<QueuedImage[]>([]);
  const [documentFile, setDocumentFile] = useState<{ file: File, text: string } | null>(null);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [hasRestoredUploadRecovery, setHasRestoredUploadRecovery] = useState(false);

  // Diagnostic Logs
  useEffect(() => {
    console.log('[upload-debug] UploadPage mounted', {
      pathname: window.location.pathname,
      href: window.location.href,
      navigation: (performance.getEntriesByType?.('navigation')[0] as any)?.type || 'unknown',
    });

    const onBeforeUnload = () => {
      console.log('[upload-debug] beforeunload');
    };

    const onPageShow = (event: PageTransitionEvent) => {
      console.log('[upload-debug] pageshow', { persisted: event.persisted });
    };

    const onVisibilityChange = () => {
      console.log('[upload-debug] visibilitychange', document.visibilityState);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      console.log('[upload-debug] UploadPage unmounted');
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Recovery: restore from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('omninauka_upload_recovery');

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          const restored: QueuedImage[] = parsed
            .filter(img => img?.id && img?.name && img?.compressedBase64)
            .map(img => ({
              id: img.id,
              name: img.name,
              compressedBase64: img.compressedBase64,
              previewUrl: img.compressedBase64,
              isCropping: false,
              crop: img.crop ?? { x: 0, y: 0 },
              zoom: img.zoom ?? 1,
              croppedArea: img.croppedArea ?? null,
            }));

          if (restored.length > 0) {
            setImages(restored);
            setActiveIdx(0);
          }
        }
      }
    } catch (e) {
      console.warn('Upload recovery restore failed:', e);
      try {
        sessionStorage.removeItem('omninauka_upload_recovery');
      } catch {
        // ignore cleanup failure
      }
    } finally {
      setHasRestoredUploadRecovery(true);
    }
  }, []);

  // Recovery: save to sessionStorage after restore is complete
  useEffect(() => {
    if (!hasRestoredUploadRecovery) return;

    try {
      if (images.length > 0) {
        const lightweightState = images
          .filter(img => img.compressedBase64)
          .map(img => ({
            id: img.id,
            name: img.name,
            compressedBase64: img.compressedBase64,
            isCropping: false,
            crop: img.crop,
            zoom: img.zoom,
            croppedArea: img.croppedArea,
          }));

        if (lightweightState.length > 0) {
          sessionStorage.setItem('omninauka_upload_recovery', JSON.stringify(lightweightState));
        } else {
          sessionStorage.removeItem('omninauka_upload_recovery');
        }
      } else {
        sessionStorage.removeItem('omninauka_upload_recovery');
      }
    } catch (e) {
      console.warn('Upload recovery save failed:', e);
    }
  }, [images, hasRestoredUploadRecovery]);

  // ── helpers ────────────────────────────────────────────────────────────────

  const handleDocumentUpload = async (file: File) => {
    setIsExtractingText(true);
    setError(null);
    try {
      let extractedText = '';
      const arrayBuffer = await file.arrayBuffer();

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        extractedText = fullText.trim();

        if (extractedText.length < 50) {
          setError(t('upload.errors.pdfScan'));
          setIsExtractingText(false);
          return;
        }
      } else if (file.name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value.trim();
      }

      // Truncate to ~25k chars safely for API limit
      if (extractedText.length > 25000) {
        extractedText = extractedText.substring(0, 25000) + '\n[...tekst obcięty ze względu na limit]';
      }

      setDocumentFile({ file, text: extractedText });
    } catch (err) {
      console.error('Doc extraction error:', err);
      setError(t('upload.errors.docRead'));
    } finally {
      setIsExtractingText(false);
    }
  };

  const addFiles = useCallback((rawFiles: File[]) => {
    setError(null);
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validDocTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    const hasImages = images.length > 0;
    const hasDoc = documentFile !== null;

    const droppedDocs = rawFiles.filter(f => validDocTypes.includes(f.type) || f.name.endsWith('.docx') || f.name.endsWith('.pdf'));
    const droppedImages = rawFiles.filter(f => validImageTypes.includes(f.type));

    if (droppedDocs.length > 0 && droppedImages.length > 0) {
      setError(t('upload.errors.mixedTypes'));
      return;
    }

    if (droppedDocs.length > 0) {
      if (hasImages) {
        setError(t('upload.errors.imagesExist'));
        return;
      }
      if (droppedDocs.length > 1 || hasDoc) {
        setError(t('upload.errors.oneDocOnly'));
        return;
      }
      const doc = droppedDocs[0];
      if (doc.size > 10 * 1024 * 1024) {
        setError(t('upload.errors.docTooLarge'));
        return;
      }
      handleDocumentUpload(doc);
      return;
    }

    if (droppedImages.length > 0) {
      if (hasDoc) {
        setError(t('upload.errors.docExists'));
        return;
      }

      const available = MAX_IMAGES - images.length;
      const toAdd: QueuedImage[] = [];
      const isMobile = isMobileUploadDevice();

      console.log('[upload-debug] addFiles called', {
        count: droppedImages.length,
        isMobile,
        files: droppedImages.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
        })),
      });

      for (const f of droppedImages.slice(0, available)) {
        if (f.size > 10 * 1024 * 1024) {
          setError(t('upload.errors.imageTooLarge'));
          continue;
        }

        const newId = `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        toAdd.push({
          id: newId,
          file: f,
          previewUrl: URL.createObjectURL(f),
          compressedBase64: null,
          name: f.name,
          isCropping: !isMobile, // MOBILE NO-CROP: Skip cropper on mobile
          crop: { x: 0, y: 0 },
          zoom: 1,
          croppedArea: null,
        });
      }

      if (toAdd.length === 0) return;
      const newImages = [...images, ...toAdd];
      console.log('[upload-debug] setting images', {
        previous: images.length,
        adding: toAdd.length,
        next: newImages.length,
      });
      setImages(newImages);
      setActiveIdx(newImages.length - toAdd.length);

      // MOBILE NO-CROP: Trigger compression immediately for the new images
      if (isMobile) {
        toAdd.forEach(async (img) => {
          console.log('[upload-debug] triggering auto-compression for mobile', img.id);
          const result = await compressAndStore(img.previewUrl, null, img.file);
          if (result) {
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, compressedBase64: result } : p));
          } else {
            console.error('[upload-debug] auto-compression failed', img.id);
          }
        });
      }
    }
  }, [images, documentFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: addFiles,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: MAX_IMAGES,
    multiple: true,
    disabled: images.length >= MAX_IMAGES || documentFile !== null,
  });

  const removeImage = (idx: number) => {
    const img = images[idx];
    URL.revokeObjectURL(img.previewUrl);
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    setActiveIdx(Math.min(activeIdx, Math.max(0, next.length - 1)));
  };

  const updateImage = (idx: number, patch: Partial<QueuedImage>) => {
    setImages(prev => prev.map((img, i) => i === idx ? { ...img, ...patch } : img));
  };

  // ── compression ───────────────────────────────────────────────────────────

  const compressAndStore = async (imageUrl: string, area?: CropArea | null, originalFile?: File): Promise<string | null> => {
    setIsCompressing(true);
    try {
      const compressionOptions = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };

      if (!area && originalFile) {
        try {
          const compressed = await imageCompression(originalFile, compressionOptions);
          return await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(compressed);
            reader.onloadend = () => {
              const b64 = reader.result as string;
              resolve(b64.length > 4_500_000 ? null : b64);
            };
          });
        } catch (err) {
          console.error("Direct compression failed", err);
        }
      }

      const image = new Image();
      image.src = imageUrl;
      await new Promise(resolve => { image.onload = resolve; });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      if (area) {
        canvas.width = area.width;
        canvas.height = area.height;
        ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
      } else {
        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);
      }

      return await new Promise<string | null>((resolve, reject) => {
        canvas.toBlob(async blob => {
          if (!blob) { resolve(null); return; }
          try {
            const compressed = await imageCompression(blob as File, compressionOptions);
            const reader = new FileReader();
            reader.readAsDataURL(compressed);
            reader.onloadend = () => {
              const b64 = reader.result as string;
              resolve(b64.length > 4_500_000 ? null : b64);
            };
          } catch { reject(new Error('Compression failed')); }
        }, 'image/jpeg', 0.95);
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleConfirmCrop = async () => {
    const img = images[activeIdx];
    if (!img) return;
    const result = await compressAndStore(img.previewUrl, img.croppedArea, img.file);
    if (!result) { setError(t('upload.errors.compressionError')); return; }
    updateImage(activeIdx, { compressedBase64: result, isCropping: false });
    // Auto-advance to next unprocessed image
    const nextUnprocessed = images.findIndex((im, i) => i > activeIdx && !im.compressedBase64);
    if (nextUnprocessed !== -1) setActiveIdx(nextUnprocessed);
  };

  const handleSkipCrop = async () => {
    const img = images[activeIdx];
    if (!img) return;
    const result = await compressAndStore(img.previewUrl, null, img.file);
    if (!result) { setError(t('upload.errors.compressionError')); return; }
    updateImage(activeIdx, { compressedBase64: result, isCropping: false });
    const nextUnprocessed = images.findIndex((im, i) => i > activeIdx && !im.compressedBase64);
    if (nextUnprocessed !== -1) setActiveIdx(nextUnprocessed);
  };

  // ── analyze (upload + DB insert) ──────────────────────────────────────────

  const handleAnalyze = async () => {
    if (images.length === 0 && !documentFile) return;

    setIsAnalyzing(true);
    setError(null);

    // ── DOCUMENT FLOW ──
    if (documentFile) {
      if (!user || isDemoMode) {
        sessionStorage.setItem('demoImageBase64', 'document_placeholder');
        sessionStorage.setItem('currentSessionId', 'demo-session');
        await new Promise(r => setTimeout(r, 2000));
        navigate('/app/analysis');
        return;
      }

      try {
        const fileExt = documentFile.file.name.split('.').pop() || 'pdf';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('study-materials')
          .upload(filePath, documentFile.file, { cacheControl: '3600', upsert: false });

        if (uploadError || !uploadData) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: sessionData, error: dbError } = await supabase
          .from('study_sessions')
          .insert({
            user_id: user.id,
            image_url: uploadData.path,
            raw_ocr_text: documentFile.text,
            folder_id: null,
          })
          .select()
          .single();

        if (dbError || !sessionData) {
          await supabase.storage.from('study-materials').remove([uploadData.path]);
          throw new Error(`DB Insert failed: ${dbError?.message}`);
        }

        sessionStorage.setItem('currentSessionId', sessionData.id);
        sessionStorage.removeItem('omninauka_upload_recovery');
        navigate('/app/analysis');
      } catch (err: any) {
        console.error('Document upload error:', err);
        setError(t('upload.errors.docSaveError'));
        setIsAnalyzing(false);
      }
      return;
    }

    // ── IMAGE FLOW ──
    const ready = images.filter(im => !!im.compressedBase64);
    if (ready.length === 0) return;

    if (!user || isDemoMode) {
      sessionStorage.setItem('demoImageBase64', ready[0].compressedBase64!);
      sessionStorage.setItem('currentSessionId', 'demo-session');
      await new Promise(r => setTimeout(r, 2000));
      navigate('/app/analysis');
      return;
    }

    try {
      const uploadedPaths: string[] = [];
      for (const img of ready) {
        const res = await fetch(img.compressedBase64!);
        const blob = await res.blob();
        const fileExt = blob.type.split('/')[1] || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('study-materials')
          .upload(filePath, blob, { cacheControl: '3600', upsert: false });

        if (uploadError || !uploadData) {
          if (uploadedPaths.length > 0) {
            await supabase.storage.from('study-materials').remove(uploadedPaths);
          }
          throw new Error(`Upload failed: ${uploadError?.message}`);
        }
        uploadedPaths.push(uploadData.path);
      }

      const { data: sessionData, error: dbError } = await supabase
        .from('study_sessions')
        .insert({
          user_id: user.id,
          image_url: uploadedPaths[0],
          folder_id: null,
        })
        .select()
        .single();

      if (dbError || !sessionData) {
        await supabase.storage.from('study-materials').remove(uploadedPaths);
        throw new Error(`DB Insert failed: ${dbError?.message}`);
      }

      if (uploadedPaths.length > 0) {
        const imageRows = uploadedPaths.map((path, position) => ({
          session_id: sessionData.id,
          image_url: path,
          position,
        }));
        const { error: imgInsertError } = await supabase
          .from('session_images')
          .insert(imageRows);

        if (imgInsertError) {
          console.error('[upload] session_images insert failed:', imgInsertError.message, imgInsertError.code);
          await supabase.from('study_sessions').delete().eq('id', sessionData.id);
          await supabase.storage.from('study-materials').remove(uploadedPaths);
          throw new Error(`session_images insert failed: ${imgInsertError.message}`);
        }
      }

      sessionStorage.setItem('currentSessionId', sessionData.id);
      sessionStorage.removeItem('omninauka_upload_recovery');
      navigate('/app/analysis');

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(t('upload.errors.imageSaveError'));
      setIsAnalyzing(false);
    }
  };

  // ── derived state ─────────────────────────────────────────────────────────

  const activeImage = images[activeIdx] ?? null;
  const readyCount = images.filter(im => !!im.compressedBase64).length;
  const allReady = images.length > 0 && readyCount === images.length;
  const someReady = readyCount > 0;
  const currentlyCropping = activeImage?.isCropping && !activeImage?.compressedBase64;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">{t('upload.title')}</h1>
        <p className="text-[var(--omni-text-muted)]">
          {t('upload.subtitle', { maxImages: MAX_IMAGES })}
        </p>
        {isDemoMode && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-3 text-sm border border-blue-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{t('upload.demoMode')}</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Loading state for document extraction */}
      {isExtractingText && (
        <div className="omni-card p-12 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-10 h-10 text-[var(--omni-accent)] animate-spin mb-4" />
          <h3 className="font-medium text-lg text-[var(--omni-text)] mb-2">{t('upload.states.extractingDoc')}</h3>
          <p className="text-sm text-[var(--omni-text-muted)]">{t('upload.states.justAMoment')}</p>
        </div>
      )}

      {/* ── Document state ── */}
      {documentFile && !isExtractingText && (
        <div className="omni-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-[var(--omni-text)] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {t('upload.states.selectedDoc')}
            </h3>
            <button
              type="button"
              onClick={() => setDocumentFile(null)}
              disabled={isAnalyzing}
              className="p-2 text-[var(--omni-text-muted)] hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--omni-text)] truncate">{documentFile.file.name}</p>
              <p className="text-sm text-[var(--omni-text-muted)]">{t('upload.states.readSize', { size: (documentFile.text.length / 1024).toFixed(1) })}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full omni-btn-primary disabled:opacity-50"
          >
            {isAnalyzing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                <span>{t('upload.states.uploadingAndAnalyzing')}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>{t('upload.actions.analyzeDoc')}</span>
                <ArrowRight className="w-5 h-5" />
              </div>
            )}
          </button>
        </div>
      )}

      {/* ── Empty state: drop zone ── */}
      {images.length === 0 && !documentFile && !isExtractingText && (
        <div className="space-y-4 flex flex-col-reverse md:flex-col gap-4 md:gap-0 md:space-y-4">
          {/* Camera — PRIMARY on mobile (rendered last in DOM but shown first via col-reverse) */}
          <div>
            <button
              type="button"
              onClick={() => {
                console.log('[upload-debug] camera button clicked');
                cameraInputRef.current?.click();
              }}
              className="w-full omni-btn-primary flex items-center justify-center gap-3 py-5 text-lg rounded-2xl shadow-lg active:scale-[0.98] transition-all"
            >
              <Camera className="w-7 h-7" />
              {t('upload.cameraCta')}
            </button>
            <input
            type="file"
            ref={cameraInputRef}
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              console.log('[upload-debug] camera input change', {
                filesLength: e.target.files?.length,
                firstName: e.target.files?.[0]?.name,
                firstType: e.target.files?.[0]?.type,
                firstSize: e.target.files?.[0]?.size,
              });
              const files = Array.from(e.target.files || []);
              if (files.length > 0) addFiles(files);
            }}
          />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400 font-medium">{t('upload.or')}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Drop zone — PRIMARY on desktop, SECONDARY on mobile */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 lg:p-12 text-center cursor-pointer transition-all ${isDragActive
              ? 'border-[var(--omni-accent)] bg-[var(--omni-accent)]/5'
              : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 bg-[var(--omni-lavender)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Images className="w-7 h-7 text-[var(--omni-text)]" />
            </div>
            <p className="font-medium text-[var(--omni-text)] mb-1">
              {isDragActive ? t('upload.states.dropHere') : t('upload.chooseFiles')}
            </p>
            <p className="text-sm text-[var(--omni-text-muted)]">
              {t('upload.supportedFormats')}
            </p>
            <p className="text-xs text-[var(--omni-text-muted)] mt-1">
              {t('upload.limitInfo')}
            </p>
          </div>
        </div>
      )}

      {/* ── With images: thumbnail strip + crop/preview ── */}
      {images.length > 0 && (
        <div className="space-y-5">
          {/* Thumbnail strip + add more button */}
          <div className="omni-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[var(--omni-text)]">
                {t('upload.states.imageCount', { current: images.length, max: MAX_IMAGES })}
                {' '}
                <span className="text-[var(--omni-text-muted)]">{t('upload.states.readyCount', { ready: readyCount })}</span>
              </span>
              {images.length < MAX_IMAGES && !isAnalyzing && (
                <div {...getRootProps()} className="cursor-pointer">
                  <input {...getInputProps()} />
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-[var(--omni-accent)] hover:underline font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    {t('upload.actions.addMore')}
                  </button>
                </div>
              )}
            </div>

            <ThumbnailStrip
              images={images}
              activeIdx={activeIdx}
              onSelect={setActiveIdx}
              onRemove={removeImage}
            />
          </div>

          {/* Crop panel for active image (if not yet processed) */}
          {activeImage && currentlyCropping && (
            <ImageCropPanel
              img={activeImage}
              onCropChange={crop => updateImage(activeIdx, { crop })}
              onZoomChange={zoom => updateImage(activeIdx, { zoom })}
              onCropComplete={croppedArea => updateImage(activeIdx, { croppedArea })}
              onConfirm={handleConfirmCrop}
              onSkip={handleSkipCrop}
              isCompressing={isCompressing}
            />
          )}

          {/* Preview for processed image */}
          {activeImage && !currentlyCropping && activeImage.compressedBase64 && (
            <div className="omni-card p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[var(--omni-text)] flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  {t('upload.states.previewIndex', { index: activeIdx + 1 })}
                </h3>
                <button
                  type="button"
                  onClick={() => removeImage(activeIdx)}
                  disabled={isAnalyzing}
                  className="p-2 text-[var(--omni-text-muted)] hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="relative rounded-xl overflow-hidden mb-4 bg-gray-100 flex items-center justify-center min-h-[180px]">
                <img
                  src={activeImage.compressedBase64}
                  alt="Preview"
                  className="w-full max-h-[360px] object-contain"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm font-medium text-[var(--omni-text)] truncate pr-2">{activeImage.name}</p>
                <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              </div>
            </div>
          )}

          {/* Analyze button — shows when at least one image is ready */}
          {someReady && !currentlyCropping && (
            <div className="space-y-3">
              {!allReady && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3 border border-amber-100">
                  {t('upload.states.unprocessed', { remaining: images.length - readyCount })}
                </p>
              )}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !allReady}
                className="w-full omni-btn-primary disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{t('upload.states.uploadingAndAnalyzing')}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>{t('upload.actions.analyzeImages', { count: readyCount, suffix: readyCount === 1 ? 'e' : 'a' })}</span>
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="omni-card p-4 lg:p-6 bg-[var(--omni-lavender)]/30 border-none">
        <h4 className="font-semibold text-[var(--omni-text)] mb-3">{t('upload.tips.title')}</h4>
        <ul className="space-y-2 text-sm text-[var(--omni-text-muted)]">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">{t('upload.tips.readable')}</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">{t('upload.tips.angle')}</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">{t('upload.tips.multiplePages')}</span>
          </li>
        </ul>
      </div>

      {/* Safety/Privacy Notice */}
      <div className="omni-card p-4 lg:p-6 bg-blue-50/50 border-blue-100/50">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-1">{t('upload.safety.title')}</h4>
            <div className="text-sm text-blue-800/80 space-y-2 leading-relaxed">
              <p>
                {t('upload.safety.line1')}
              </p>
              <p>
                {t('upload.safety.line2')}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
