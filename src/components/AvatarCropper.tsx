'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface AvatarCropperProps {
    image: string;
    onCropComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
}

export default function AvatarCropper({ image, onCropComplete, onCancel }: AvatarCropperProps) {
    const t = useTranslations('common.avatarCropper');
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [rotation, setRotation] = useState(0);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [scale, setScale] = useState(1);
    const [fitScale, setFitScale] = useState(1);

    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        const container = containerRef.current;

        let newFitScale = 1;
        if (container) {
            const padding = 48;
            const maxW = container.clientWidth - padding;
            const maxH = container.clientHeight - padding;
            const scaleW = maxW / naturalWidth;
            const scaleH = maxH / naturalHeight;
            newFitScale = Math.min(scaleW, scaleH, 1);
        }
        setFitScale(newFitScale);
        setScale(newFitScale);

        const size = Math.min(naturalWidth, naturalHeight) * 0.8;
        const x = (naturalWidth - size) / 2;
        const y = (naturalHeight - size) / 2;

        setCrop({
            unit: '%',
            width: (size / naturalWidth) * 100,
            height: (size / naturalHeight) * 100,
            x: (x / naturalWidth) * 100,
            y: (y / naturalHeight) * 100,
        });
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev * 1.25, 3));
    const handleZoomOut = () => setScale(prev => Math.max(prev / 1.25, fitScale * 0.5));
    const handleZoomReset = () => setScale(fitScale);

    const handleConfirm = async () => {
        if (!completedCrop || !imgRef.current) {
            alert(t('selectCropArea'));
            return;
        }

        setLoading(true);
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            canvas.width = 500;
            canvas.height = 500;

            const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
            const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

            if (rotation !== 0) {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) throw new Error('Failed to get temp canvas context');

                tempCanvas.width = imgRef.current.naturalWidth;
                tempCanvas.height = imgRef.current.naturalHeight;

                tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
                tempCtx.rotate((rotation * Math.PI) / 180);
                tempCtx.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);
                tempCtx.drawImage(imgRef.current, 0, 0);

                ctx.drawImage(
                    tempCanvas,
                    completedCrop.x * scaleX,
                    completedCrop.y * scaleY,
                    completedCrop.width * scaleX,
                    completedCrop.height * scaleY,
                    0, 0, 500, 500
                );
            } else {
                ctx.drawImage(
                    imgRef.current,
                    completedCrop.x * scaleX,
                    completedCrop.y * scaleY,
                    completedCrop.width * scaleX,
                    completedCrop.height * scaleY,
                    0, 0, 500, 500
                );
            }

            canvas.toBlob((blob) => {
                if (blob) {
                    onCropComplete(blob);
                } else {
                    alert(t('cropFailed'));
                }
                setLoading(false);
            }, 'image/webp', 0.9);
        } catch (error) {
            console.error('Crop error:', error);
            alert(t('cropFailed'));
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-card rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-zoom-in">
                {/* Header */}
                <div className="p-6 border-b border-border-strong shrink-0">
                    <h2 className="text-xl font-bold text-text-primary">{t('title')}</h2>
                    <p className="text-sm text-text-tertiary mt-1">{t('description')}</p>
                </div>

                {/* Cropper */}
                <div ref={containerRef} className="relative bg-muted flex-1 min-h-0 overflow-auto p-6 flex items-center justify-center">
                    <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={1}
                        circularCrop
                    >
                        <img
                            ref={imgRef}
                            src={image}
                            alt="Crop preview"
                            onLoad={onImageLoad}
                            style={{
                                width: imgRef.current ? imgRef.current.naturalWidth * scale : undefined,
                                height: imgRef.current ? imgRef.current.naturalHeight * scale : undefined,
                                maxWidth: 'none',
                                transform: `rotate(${rotation}deg)`,
                                transition: 'transform 0.2s ease-in-out, width 0.15s ease, height 0.15s ease',
                            }}
                        />
                    </ReactCrop>
                </div>

                {/* Zoom Controls */}
                <div className="px-6 py-3 bg-muted border-b border-border-strong shrink-0">
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-text-secondary shrink-0">
                            {t('zoom')}
                        </label>
                        <button
                            onClick={handleZoomOut}
                            className="p-1.5 bg-card border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                            </svg>
                        </button>
                        <input
                            type="range"
                            min={fitScale * 0.5}
                            max={3}
                            step={0.01}
                            value={scale}
                            onChange={(e) => setScale(Number(e.target.value))}
                            className="flex-1 h-2 bg-border-strong rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <button
                            onClick={handleZoomIn}
                            className="p-1.5 bg-card border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                            </svg>
                        </button>
                        <button
                            onClick={handleZoomReset}
                            className="px-2 py-1.5 bg-card border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors text-xs font-medium shrink-0"
                        >
                            {t('fit')}
                        </button>
                        <span className="text-xs text-text-tertiary w-12 text-right shrink-0">{Math.round(scale * 100)}%</span>
                    </div>
                </div>

                {/* Rotation Controls */}
                <div className="px-6 py-4 bg-muted border-b border-border-strong">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-text-secondary">
                                {t('rotation')}
                            </label>
                            <span className="text-sm text-text-tertiary">{rotation}°</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                                className="flex-1 px-3 py-2 bg-card border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                {t('rotateLeft')}
                            </button>
                            <button
                                onClick={() => setRotation(0)}
                                className="px-3 py-2 bg-card border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors text-sm font-medium"
                            >
                                {t('reset')}
                            </button>
                            <button
                                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                                className="flex-1 px-3 py-2 bg-card border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                {t('rotateRight')}
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                                </svg>
                            </button>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            step={1}
                            value={rotation}
                            onChange={(e) => setRotation(Number(e.target.value))}
                            className="w-full h-2 bg-border-strong rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                </div>

                {/* Buttons */}
                <div className="p-6">
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 border border-border-input text-text-secondary rounded-lg hover:bg-muted transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    {t('processing')}
                                </>
                            ) : (
                                t('confirmUpload')
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
