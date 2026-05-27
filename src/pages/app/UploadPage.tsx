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
  ShieldCheck,
  Clipboard,
  Trash,
  Upload
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

type AnalysisStep =
  | 'idle'
  | 'preparing'
  | 'compressing'
  | 'uploading'
  | 'creating_session'
  | 'navigating'
  | 'error';

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
  isProcessing,
}: {
  images: QueuedImage[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  onRemove: (idx: number) => void;
  isProcessing?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`flex gap-3 flex-wrap ${isProcessing ? 'opacity-60 pointer-events-none cursor-not-allowed' : ''}`}>
      {images.map((img, idx) => (
        <div
          key={img.id}
          className={`relative group rounded-xl overflow-hidden border-2 transition-all
            ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer'}
            ${activeIdx === idx
              ? 'border-[var(--omni-accent)] shadow-lg scale-105'
              : 'border-gray-200 hover:border-indigo-300'}`}
          style={{ width: 72, height: 72 }}
          onClick={() => {
            if (isProcessing) return;
            onSelect(idx);
          }}
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
          {!isProcessing && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(idx); }}
              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
              title={t('upload.actions.remove')}
            >
              <X className="w-3 h-3" />
            </button>
          )}
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
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
  const [activeIdx, setActiveIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isProcessing = analysisStep !== 'idle' && analysisStep !== 'error';
  const isExtractingText = analysisStep === 'preparing' && !documentFile && images.length === 0;
  const isCompressing = analysisStep === 'compressing';
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [hasRestoredUploadRecovery, setHasRestoredUploadRecovery] = useState(false);

  // ── Debug Diagnostics ──────────────────────────────────────────────────────
  const hasUploadDebugParam = new URLSearchParams(window.location.search).get('uploadDebug') === '1';
  const DEBUG_ALLOWED_EMAILS = ['bojki@tlen.pl'];
  const isAllowedUser = !!user?.email && DEBUG_ALLOWED_EMAILS.includes(user.email.toLowerCase());
  const isUploadDebugEnabled = import.meta.env.DEV || (hasUploadDebugParam && isAllowedUser);
  
  const [uploadDebugEvents, setUploadDebugEvents] = useState<string[]>([]);

  // ── Mobile Stability Constants ───────────────────────────────────────────
  const MOBILE_DIRECT_DATA_URL_MAX_BYTES = 3_200_000;

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return a string'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
      reader.readAsDataURL(file);
    });
  };

  const uploadDebug = useCallback((message: string, data?: unknown) => {
    if (!isUploadDebugEnabled) return;

    const timestamp = new Date().toLocaleTimeString();
    const dataStr = data ? ' | ' + (typeof data === 'object' ? JSON.stringify(data) : String(data)) : '';
    const line = `[${timestamp}] ${message}${dataStr}`;

    console.log('[upload-debug]', message, data);

    setUploadDebugEvents(prev => {
      const next = [...prev, line].slice(-50);
      try {
        sessionStorage.setItem('omninauka_upload_debug_events', JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [isUploadDebugEnabled]);

  // Restore debug events on mount
  useEffect(() => {
    if (isUploadDebugEnabled) {
      try {
        const saved = sessionStorage.getItem('omninauka_upload_debug_events');
        if (saved) setUploadDebugEvents(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, [isUploadDebugEnabled]);

  // Lifecycle logs
  useEffect(() => {
    uploadDebug('UploadPage mounted', {
      pathname: window.location.pathname,
      isMobile: isMobileUploadDevice(),
    });

    const onBeforeUnload = () => {
      uploadDebug('beforeunload event detected');
    };

    const onPageShow = (event: PageTransitionEvent) => {
      uploadDebug('pageshow event', { persisted: event.persisted });
    };

    const onVisibilityChange = () => {
      uploadDebug('visibilitychange', document.visibilityState);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      uploadDebug('UploadPage unmounted');
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [uploadDebug]);

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
            uploadDebug('Restored images from recovery', restored.length);
            setImages(restored);
            setActiveIdx(0);
          }
        }
      }
    } catch (e) {
      uploadDebug('Recovery restore failed', e instanceof Error ? e.message : String(e));
      try {
        sessionStorage.removeItem('omninauka_upload_recovery');
      } catch {
        // ignore cleanup failure
      }
    } finally {
      setHasRestoredUploadRecovery(true);
    }
  }, [uploadDebug]);

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
          uploadDebug('Saving state to recovery storage', lightweightState.length);
          sessionStorage.setItem('omninauka_upload_recovery', JSON.stringify(lightweightState));
        } else {
          sessionStorage.removeItem('omninauka_upload_recovery');
        }
      } else {
        sessionStorage.removeItem('omninauka_upload_recovery');
      }
    } catch (e) {
      uploadDebug('Recovery save failed', e instanceof Error ? e.message : String(e));
    }
  }, [images, hasRestoredUploadRecovery, uploadDebug]);

  // ── helpers ────────────────────────────────────────────────────────────────

  const handleDocumentUpload = async (file: File) => {
    const docStart = performance.now();
    setAnalysisStep('preparing');
    setError(null);
    uploadDebug('Starting document upload/extraction', { fileType: file.type, size: file.size });
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
          setAnalysisStep('error');
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
      const elapsedMs = performance.now() - docStart;
      uploadDebug('Document text extraction completed', { elapsedMs: elapsedMs.toFixed(1), textLen: extractedText.length });
      setAnalysisStep('idle');
    } catch (err) {
      uploadDebug('Doc extraction failed', err instanceof Error ? err.message : String(err));
      console.error('Doc extraction error:', err);
      setError(t('upload.errors.docRead'));
      setAnalysisStep('error');
    }
  };

  const addFiles = useCallback((rawFiles: File[]) => {
    if (isProcessing) return;
    setError(null);
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validDocTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    const unsupportedFiles = rawFiles.filter(f =>
      !validImageTypes.includes(f.type) &&
      !validDocTypes.includes(f.type) &&
      !f.name.toLowerCase().endsWith('.pdf') &&
      !f.name.toLowerCase().endsWith('.docx') &&
      !f.name.toLowerCase().endsWith('.jpg') &&
      !f.name.toLowerCase().endsWith('.jpeg') &&
      !f.name.toLowerCase().endsWith('.png') &&
      !f.name.toLowerCase().endsWith('.webp')
    );

    if (unsupportedFiles.length > 0) {
      setError(t('upload.errors.invalidType', 'Nieobsługiwany typ pliku. Możesz przesyłać tylko zdjęcia (JPG, PNG, WEBP) oraz dokumenty (PDF, DOCX).'));
      return;
    }

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

      uploadDebug('addFiles triggered', {
        count: droppedImages.length,
        isMobile,
        files: droppedImages.map(f => ({
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

      if (toAdd.length === 0) {
        uploadDebug('No valid files to add');
        return;
      }
      const newImages = [...images, ...toAdd];
      uploadDebug('Updating images state', {
        prev: images.length,
        next: newImages.length,
        mobilePath: isMobile
      });
      setImages(newImages);
      setActiveIdx(newImages.length - toAdd.length);

      // MOBILE NO-CROP: Trigger direct processing/pass-through
      if (isMobile) {
        toAdd.forEach(async (img) => {
          if (!img.file) return;

          // If file is small, still try to get Base64 for recovery safety
          if (img.file.size <= MOBILE_DIRECT_DATA_URL_MAX_BYTES) {
            uploadDebug('Mobile: direct FileReader start (for recovery)', { id: img.id, size: img.file.size });
            try {
              const dataUrl = await readFileAsDataUrl(img.file);
              uploadDebug('Mobile: direct FileReader success', { id: img.id, len: dataUrl.length });
              setImages(prev => prev.map(p => p.id === img.id ? { ...p, compressedBase64: dataUrl } : p));
            } catch (err) {
              uploadDebug('Mobile: direct FileReader failed (non-fatal)', err instanceof Error ? err.message : String(err));
            }
          } else {
            uploadDebug('Mobile: using File pass-through for large image', { size: img.file.size });
            // For large files, we don't set compressedBase64, 
            // but the image is "ready" because isMobile && !!file && !isCropping is true.
          }
        });
      }
    }
  }, [images, documentFile, uploadDebug, t, isProcessing]);

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
    disabled: isProcessing || images.length >= MAX_IMAGES || documentFile !== null,
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
    const compStart = performance.now();
    setAnalysisStep('compressing');
    uploadDebug('compressAndStore start', { hasArea: !!area, hasFile: !!originalFile });
    try {
      const compressionOptions = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };

      let b64Result: string | null = null;

      if (!area && originalFile) {
        try {
          const compressed = await imageCompression(originalFile, compressionOptions);
          b64Result = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(compressed);
            reader.onloadend = () => {
              const b64 = reader.result as string;
              resolve(b64.length > 4_500_000 ? null : b64);
            };
          });
        } catch (err) {
          uploadDebug('Direct compression failed', err instanceof Error ? err.message : String(err));
        }
      }

      if (!b64Result) {
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

        b64Result = await new Promise<string | null>((resolve, reject) => {
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
      }

      const elapsedMs = performance.now() - compStart;
      uploadDebug('Compression complete', { elapsedMs: elapsedMs.toFixed(1), resultLen: b64Result?.length });
      return b64Result;
    } catch (err) {
      uploadDebug('Compression failed', err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setAnalysisStep(prev => prev === 'compressing' ? 'idle' : prev);
    }
  };

  const handleConfirmCrop = async () => {
    const img = images[activeIdx];
    if (!img) return;
    uploadDebug('handleConfirmCrop clicked', { id: img.id });
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
    uploadDebug('handleSkipCrop clicked', { id: img.id });
    const result = await compressAndStore(img.previewUrl, null, img.file);
    if (!result) { setError(t('upload.errors.compressionError')); return; }
    updateImage(activeIdx, { compressedBase64: result, isCropping: false });
    const nextUnprocessed = images.findIndex((im, i) => i > activeIdx && !im.compressedBase64);
    if (nextUnprocessed !== -1) setActiveIdx(nextUnprocessed);
  };

  // ── analyze (upload + DB insert) ──────────────────────────────────────────

  const handleAnalyze = async () => {
    if (images.length === 0 && !documentFile) return;

    const tStart = performance.now();
    const logTime = (stepName: string, meta?: any) => {
      const elapsed = performance.now() - tStart;
      uploadDebug(`Timing checkpoint: ${stepName}`, { elapsedMs: elapsed.toFixed(1), ...meta });
    };

    setAnalysisStep('preparing');
    setError(null);
    logTime('prepare_files_start', { images: images.length, hasDoc: !!documentFile });

    // ── DOCUMENT FLOW ──
    if (documentFile) {
      if (!user || isDemoMode) {
        logTime('demo_analysis_doc_start');
        sessionStorage.setItem('demoImageBase64', 'document_placeholder');
        sessionStorage.setItem('currentSessionId', 'demo-session');
        await new Promise(r => setTimeout(r, 2000));
        logTime('navigation_start');
        setAnalysisStep('navigating');
        navigate('/app/analysis');
        return;
      }

      try {
        const safeName = documentFile.file.name
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .replace(/_{2,}/g, '_');
        const uniqueId = typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15);
        const uniqueFileName = `${Date.now()}_${uniqueId}_${safeName}`;
        const filePath = `${user.id}/uploads/${uniqueFileName}`;

        setAnalysisStep('uploading');
        logTime('storage_upload_start', { kind: 'document' });
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('study-materials')
          .upload(filePath, documentFile.file, { cacheControl: '3600', upsert: false });

        if (uploadError || !uploadData) throw new Error(`Upload failed: ${uploadError.message}`);
        logTime('storage_upload_done', { kind: 'document' });

        setAnalysisStep('creating_session');
        logTime('create_session_start');
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
        logTime('create_session_done', { sessionId: sessionData.id.substring(0, 8) });

        sessionStorage.setItem('currentSessionId', sessionData.id);
        sessionStorage.removeItem('omninauka_upload_recovery');

        setAnalysisStep('navigating');
        logTime('navigation_start');
        navigate('/app/analysis');
      } catch (err: any) {
        logTime('analyze_failed', { error: err?.message });
        console.error('Document upload error:', err);
        setError(t('upload.errors.docSaveError'));
        setAnalysisStep('error');
      }
      return;
    }

    // ── IMAGE FLOW ──
    const readyImages = images.filter(im => !!im.compressedBase64 || (isMobileUploadDevice() && !!im.file && !im.isCropping));
    logTime('image_flow_start', { ready: readyImages.length });
    if (readyImages.length === 0) {
      uploadDebug('No ready images found');
      setAnalysisStep('idle');
      return;
    }

    if (!user || isDemoMode) {
      logTime('demo_analysis_images_start');
      const demoSource = readyImages[0].compressedBase64 || readyImages[0].previewUrl;
      sessionStorage.setItem('demoImageBase64', demoSource);
      sessionStorage.setItem('currentSessionId', 'demo-session');
      await new Promise(r => setTimeout(r, 2000));
      logTime('navigation_start');
      setAnalysisStep('navigating');
      navigate('/app/analysis');
      return;
    }

    try {
      const uploadedPaths: string[] = [];
      
      setAnalysisStep('creating_session');
      logTime('create_session_start');
      const { data: sessionData, error: dbError } = await supabase
        .from('study_sessions')
        .insert({ user_id: user.id, image_url: '', folder_id: null })
        .select()
        .single();
      if (dbError || !sessionData) throw new Error('Failed to create session');
      const sessionId = sessionData.id;
      logTime('create_session_done', { sessionId: sessionId.substring(0, 8) });

      setAnalysisStep('uploading');
      logTime('storage_upload_start', { count: readyImages.length });

      for (let i = 0; i < readyImages.length; i++) {
        const img = readyImages[i];
        const fileExt = img.file ? img.file.name.split('.').pop() : 'jpg';
        const filePath = `${user.id}/${sessionId}/img_${i}.${fileExt}`;

        let uploadBody: Blob | File;
        
        if (img.compressedBase64) {
          uploadDebug('Uploading Base64 blob', { id: img.id });
          const res = await fetch(img.compressedBase64);
          uploadBody = await res.blob();
        } else if (img.file) {
          uploadDebug('Uploading original File (pass-through)', { id: img.id, size: img.file.size });
          uploadBody = img.file;
        } else {
          throw new Error('No upload source for image');
        }

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('study-materials')
          .upload(filePath, uploadBody, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError || !uploadData) {
          if (uploadedPaths.length > 0) {
            await supabase.storage.from('study-materials').remove(uploadedPaths);
          }
          throw new Error(`Upload failed: ${uploadError?.message}`);
        }
        uploadedPaths.push(uploadData.path);
        logTime(`image_upload_${i}_done`, { imageIndex: i });
      }
      logTime('storage_upload_done', { totalUploaded: uploadedPaths.length });

      setAnalysisStep('creating_session');
      logTime('session_update_start');
      const { error: updateError } = await supabase
        .from('study_sessions')
        .update({ image_url: uploadedPaths[0] })
        .eq('id', sessionId);

      if (updateError) {
        await supabase.storage.from('study-materials').remove(uploadedPaths);
        throw new Error(`DB update failed: ${updateError.message}`);
      }
      logTime('session_update_done');

      if (uploadedPaths.length > 0) {
        logTime('session_images_insert_start');
        const imageRows = uploadedPaths.map((path, position) => ({
          session_id: sessionId,
          image_url: path,
          position,
        }));
        const { error: imgInsertError } = await supabase
          .from('session_images')
          .insert(imageRows);

        if (imgInsertError) {
          uploadDebug('session_images insert failed', imgInsertError instanceof Error ? imgInsertError.message : String(imgInsertError));
          await supabase.from('study_sessions').delete().eq('id', sessionId);
          await supabase.storage.from('study-materials').remove(uploadedPaths);
          throw new Error(`session_images insert failed: ${imgInsertError.message}`);
        }
        logTime('session_images_insert_done');
      }

      sessionStorage.setItem('currentSessionId', sessionId);
      sessionStorage.removeItem('omninauka_upload_recovery');

      setAnalysisStep('navigating');
      logTime('navigation_start');
      navigate('/app/analysis');

    } catch (err: any) {
      logTime('analyze_failed', { error: err?.message });
      console.error('Upload error:', err);
      setError(t('upload.errors.imageSaveError'));
      setAnalysisStep('error');
    }
  };

  // ── derived state ─────────────────────────────────────────────────────────

  const activeImage = images[activeIdx] ?? null;
  const readyImages = images.filter(im => !!im.compressedBase64 || (isMobileUploadDevice() && !!im.file && !im.isCropping));
  const allReady = images.length > 0 && readyImages.length === images.length;
  const readyCount = readyImages.length;
  const someReady = readyCount > 0;
  const currentlyCropping = activeImage?.isCropping && !activeImage?.compressedBase64;
  const getAnalysisStepText = () => {
    switch (analysisStep) {
      case 'preparing':
        return t('upload.steps.preparing', 'Przygotowuje material...');
      case 'compressing':
        return t('upload.steps.compressing', 'Kompresuje pliki...');
      case 'uploading':
        return t('upload.steps.uploading', 'Wysylam pliki...');
      case 'creating_session':
        return t('upload.steps.creating_session', 'Tworze sesje lekcji...');
      case 'navigating':
        return t('upload.steps.navigating', 'Wczytuje podsumowanie...');
      default:
        return t('upload.states.uploadingAndAnalyzing', 'Przetwarzam material...');
    }
  };

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
              disabled={isProcessing}
              className="p-2 text-[var(--omni-text-muted)] hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            disabled={isProcessing}
            className="w-full omni-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                <span>{getAnalysisStepText()}</span>
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
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                if (isProcessing) return;
                uploadDebug('Camera button clicked - triggering native input');
                cameraInputRef.current?.click();
              }}
              disabled={isProcessing}
              className="w-full omni-btn-primary flex items-center justify-center gap-3 py-5 text-lg rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-7 h-7" />
              {t('upload.cameraCta')}
            </button>

            {/* Stable Native Mobile Input - Visible but styled as a fallback link or small button if needed */}
            {isMobileUploadDevice() && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] text-[var(--omni-text-muted)] opacity-50">
                  Problemy z aparatem? Użyj przycisku poniżej:
                </p>
                <label className={`omni-btn-secondary py-3 px-6 rounded-xl text-sm flex items-center gap-2 cursor-pointer border-dashed ${isProcessing ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                  <Upload className="w-4 h-4" />
                  <span>Wybierz z galerii</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    disabled={isProcessing}
                    onChange={(e) => {
                      if (isProcessing) return;
                      uploadDebug('Native stable input change detected', {
                        filesLength: e.target.files?.length,
                      });
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) addFiles(files);
                    }}
                  />
                </label>
              </div>
            )}

            <input
              type="file"
              ref={cameraInputRef}
              className="hidden"
              accept="image/*"
              capture="environment"
              disabled={isProcessing}
              onChange={(e) => {
                if (isProcessing) return;
                uploadDebug('Camera input change detected', {
                  filesLength: e.target.files?.length,
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
            className={`border-2 border-dashed rounded-2xl p-8 lg:p-12 text-center transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed pointer-events-none border-gray-200 bg-gray-50' : 'cursor-pointer'} ${isDragActive
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
              {images.length < MAX_IMAGES && !isProcessing && (
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
              isProcessing={isProcessing}
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
          {activeImage && !currentlyCropping && (activeImage.compressedBase64 || (isMobileUploadDevice() && activeImage.file)) && (
            <div className="omni-card p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[var(--omni-text)] flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  {t('upload.states.previewIndex', { index: activeIdx + 1 })}
                </h3>
                <button
                  type="button"
                  onClick={() => removeImage(activeIdx)}
                  disabled={isProcessing}
                  className="p-2 text-[var(--omni-text-muted)] hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="relative rounded-xl overflow-hidden mb-4 bg-gray-100 flex items-center justify-center min-h-[180px]">
                <img
                  src={activeImage.compressedBase64 ?? activeImage.previewUrl}
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
                disabled={isProcessing || !allReady}
                className="w-full omni-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
                    <span>{getAnalysisStepText()}</span>
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
      <div className="flex items-center justify-center gap-2 text-xs text-[var(--omni-text-muted)]">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Twoje dane są bezpieczne i szyfrowane</span>
      </div>

      {/* ── Debug Panel (only if ?uploadDebug=1) ── */}
      {isUploadDebugEnabled && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] max-h-80 overflow-hidden flex flex-col rounded-2xl bg-black/90 backdrop-blur-md text-white text-[10px] shadow-2xl border border-white/20">
          <div className="p-3 border-b border-white/10 flex items-center justify-between bg-black/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-bold tracking-wider uppercase text-[10px]">Upload Diagnostics</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(uploadDebugEvents.join('\n'));
                  alert('Logi skopiowane!');
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="Kopiuj logi"
              >
                <Clipboard className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadDebugEvents([]);
                  sessionStorage.removeItem('omninauka_upload_debug_events');
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-red-400"
                title="Wyczyść logi"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 font-mono leading-relaxed">
            {uploadDebugEvents.length === 0 ? (
              <div className="text-white/30 italic">No events logged yet...</div>
            ) : (
              uploadDebugEvents.map((line, idx) => (
                <div key={idx} className="mb-1 last:mb-0 break-words">
                  {line}
                </div>
              ))
            )}
            <div id="debug-bottom" />
          </div>
        </div>
      )}
    </div>
  );
}
