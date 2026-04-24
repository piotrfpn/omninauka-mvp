import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import {
  Upload,
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
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface QueuedImage {
  id: string;
  previewUrl: string;          // object URL for display / cropper
  compressedBase64: string | null;  // null = not yet processed
  name: string;
  isCropping: boolean;
  crop: { x: number; y: number };
  zoom: number;
  croppedArea: CropArea | null;
}

const MAX_IMAGES = 5;

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
  return (
    <div className="omni-card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--omni-text)] flex items-center gap-2">
          <Crop className="w-5 h-5" />
          Przytnij zdjęcie
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
        <span className="text-sm text-[var(--omni-text-muted)]">Zoom:</span>
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
          onClick={onConfirm}
          disabled={isCompressing}
          className="flex-1 omni-btn-primary disabled:opacity-50 disabled:cursor-wait"
        >
          {isCompressing
            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
            : <Check className="w-5 h-5 flex-shrink-0" />}
          {isCompressing ? 'Przetwarzanie...' : 'Potwierdź wycięcie'}
        </button>
        <button
          onClick={onSkip}
          disabled={isCompressing}
          className="omni-btn-secondary disabled:opacity-50 disabled:cursor-wait"
        >
          Pomiń przycinanie
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
            onClick={e => { e.stopPropagation(); onRemove(idx); }}
            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow"
            title="Usuń"
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

  const [images, setImages] = useState<QueuedImage[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ── helpers ────────────────────────────────────────────────────────────────

  const addFiles = useCallback((rawFiles: File[]) => {
    setError(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const available = MAX_IMAGES - images.length;

    const toAdd: QueuedImage[] = [];
    for (const f of rawFiles.slice(0, available)) {
      if (!validTypes.includes(f.type)) {
        setError('Nieprawidłowy format. Akceptowane: JPG, PNG, WEBP');
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError('Jeden z plików jest za duży (max 10MB)');
        continue;
      }
      toAdd.push({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        previewUrl: URL.createObjectURL(f),
        compressedBase64: null,
        name: f.name,
        isCropping: true,
        crop: { x: 0, y: 0 },
        zoom: 1,
        croppedArea: null,
      });
    }

    if (toAdd.length === 0) return;
    const newImages = [...images, ...toAdd];
    setImages(newImages);
    // Jump to first newly added image for cropping
    setActiveIdx(newImages.length - toAdd.length);
  }, [images]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: addFiles,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    maxFiles: MAX_IMAGES,
    multiple: true,
    disabled: images.length >= MAX_IMAGES,
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

  const compressAndStore = async (imageUrl: string, area?: CropArea | null): Promise<string | null> => {
    setIsCompressing(true);
    try {
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
            const compressed = await imageCompression(blob as File, {
              maxSizeMB: 0.5,
              maxWidthOrHeight: 1600,
              useWebWorker: true,
            });
            const reader = new FileReader();
            reader.readAsDataURL(compressed);
            reader.onloadend = () => {
              const b64 = reader.result as string;
              if (b64.length > 4_500_000) { resolve(null); return; }
              resolve(b64);
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
    const result = await compressAndStore(img.previewUrl, img.croppedArea);
    if (!result) { setError('Błąd kompresji zdjęcia. Spróbuj ponownie.'); return; }
    updateImage(activeIdx, { compressedBase64: result, isCropping: false });
    // Auto-advance to next unprocessed image
    const nextUnprocessed = images.findIndex((im, i) => i > activeIdx && !im.compressedBase64);
    if (nextUnprocessed !== -1) setActiveIdx(nextUnprocessed);
  };

  const handleSkipCrop = async () => {
    const img = images[activeIdx];
    if (!img) return;
    const result = await compressAndStore(img.previewUrl, null);
    if (!result) { setError('Błąd kompresji zdjęcia. Spróbuj ponownie.'); return; }
    updateImage(activeIdx, { compressedBase64: result, isCropping: false });
    const nextUnprocessed = images.findIndex((im, i) => i > activeIdx && !im.compressedBase64);
    if (nextUnprocessed !== -1) setActiveIdx(nextUnprocessed);
  };

  // ── analyze (upload + DB insert) ──────────────────────────────────────────

  const handleAnalyze = async () => {
    const ready = images.filter(im => !!im.compressedBase64);
    if (ready.length === 0) return;

    setIsAnalyzing(true);
    setError(null);

    // DEMO MODE bypass — send only first image through demo flow
    if (!user || isDemoMode) {
      sessionStorage.setItem('demoImageBase64', ready[0].compressedBase64!);
      sessionStorage.setItem('currentSessionId', 'demo-session');
      await new Promise(r => setTimeout(r, 2000));
      navigate('/app/analysis');
      return;
    }

    try {
      // Upload all images to Storage & collect paths
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
          // Clean up already-uploaded files
          if (uploadedPaths.length > 0) {
            await supabase.storage.from('study-materials').remove(uploadedPaths);
          }
          throw new Error(`Upload failed: ${uploadError?.message}`);
        }
        uploadedPaths.push(uploadData.path);
      }

      // Create study_sessions row — primary image = first uploaded
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

      // Insert session_images rows for ALL uploaded images (including primary)
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
          // Fatal — without session_images rows, multi-image OCR in analyze-notes won't work
          console.error('[upload] session_images insert failed:', imgInsertError.message, imgInsertError.code);
          // Cleanup: remove the session row and storage files to avoid orphans
          await supabase.from('study_sessions').delete().eq('id', sessionData.id);
          await supabase.storage.from('study-materials').remove(uploadedPaths);
          throw new Error(`session_images insert failed: ${imgInsertError.message}`);
        }

        console.log(`[upload] session_images inserted: ${imageRows.length} rows for session ${sessionData.id}`);
      }


      sessionStorage.setItem('currentSessionId', sessionData.id);
      navigate('/app/analysis');

    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Wystąpił błąd podczas zapisywania obrazów. Spróbuj ponownie.');
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
        <h1 className="omni-heading-3 text-[var(--omni-text)] mb-2">Upload notatek</h1>
        <p className="text-[var(--omni-text-muted)]">
          Dodaj do {MAX_IMAGES} zdjęć notatek — AI przygotuje materiał ze wszystkich stron naraz.
        </p>
        {isDemoMode && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-3 text-sm border border-blue-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">Tryb demo — pierwsze zdjęcie zostanie przetworzone tylko lokalnie.</p>
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

      {/* ── Empty state: drop zone ── */}
      {images.length === 0 && (
        <div className="space-y-4 flex flex-col-reverse md:flex-col gap-4 md:gap-0 md:space-y-4">
          {/* Camera — PRIMARY on mobile (rendered last in DOM but shown first via col-reverse) */}
          <div>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full omni-btn-primary flex items-center justify-center gap-3 py-5 text-lg rounded-2xl shadow-lg active:scale-[0.98] transition-all"
            >
              <Camera className="w-7 h-7" />
              Zrób zdjęcie notatek
            </button>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); }}
              className="hidden"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400 font-medium">albo</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Drop zone — PRIMARY on desktop, SECONDARY on mobile */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 lg:p-12 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-[var(--omni-accent)] bg-[var(--omni-accent)]/5'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 bg-[var(--omni-lavender)] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Images className="w-7 h-7 text-[var(--omni-text)]" />
            </div>
            <p className="font-medium text-[var(--omni-text)] mb-1">
              {isDragActive ? 'Upuść zdjęcia tutaj...' : 'Wybierz pliki z urządzenia'}
            </p>
            <p className="text-sm text-[var(--omni-text-muted)]">
              JPG, PNG, WEBP · max {MAX_IMAGES} zdjęć · max 10MB każde
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
                {images.length} z {MAX_IMAGES} zdjęć
                {' '}
                <span className="text-[var(--omni-text-muted)]">({readyCount} gotowych)</span>
              </span>
              {images.length < MAX_IMAGES && !isAnalyzing && (
                <div {...getRootProps()} className="cursor-pointer">
                  <input {...getInputProps()} />
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-sm text-[var(--omni-accent)] hover:underline font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj więcej
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
                  Podgląd — zdjęcie {activeIdx + 1}
                </h3>
                <button
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
                  {images.length - readyCount} zdjęcie(a) jeszcze nie przetworzone. Dokończ przycinanie lub usuń nieprzetworzone.
                </p>
              )}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !allReady}
                className="w-full omni-btn-primary disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Przesyłanie i analizowanie...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Analizuj {readyCount} zdjęci{readyCount === 1 ? 'e' : 'a'}</span>
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
        <h4 className="font-semibold text-[var(--omni-text)] mb-3">Wskazówki dla lepszych wyników:</h4>
        <ul className="space-y-2 text-sm text-[var(--omni-text-muted)]">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">Upewnij się, że tekst jest czytelny i dobrze oświetlony</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">Unikaj zdjęć pod kątem — rób je poziomo z góry</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="leading-snug">Możesz dodać kilka stron jednocześnie — AI połączy je w jedną lekcję</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
