'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface AvatarCropperProps {
    image: string;
    onCropComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
}

export default function AvatarCropper({ image, onCropComplete, onCancel }: AvatarCropperProps) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [rotation, setRotation] = useState(0);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Prevent scrolling when open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    // Initialize crop when image loads
    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const size = Math.min(width, height) * 0.8;
        const x = (width - size) / 2;
        const y = (height - size) / 2;

        setCrop({
            unit: 'px',
            width: size,
            height: size,
            x: x,
            y: y,
        });
    };

    const handleConfirm = async () => {
        if (!completedCrop || !imgRef.current) {
            alert('请先选择裁剪区域');
            return;
        }

        setLoading(true);
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                throw new Error('Failed to get canvas context');
            }

            // Set canvas size to 500x500 (final size)
            canvas.width = 500;
            canvas.height = 500;

            const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
            const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

            // If rotation is needed, create a temporary canvas for rotation
            if (rotation !== 0) {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) throw new Error('Failed to get temp canvas context');

                // Set temp canvas to original image size
                tempCanvas.width = imgRef.current.naturalWidth;
                tempCanvas.height = imgRef.current.naturalHeight;

                // Translate to center, rotate, then translate back
                tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
                tempCtx.rotate((rotation * Math.PI) / 180);
                tempCtx.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);

                // Draw rotated image
                tempCtx.drawImage(imgRef.current, 0, 0);

                // Draw cropped area from rotated image
                ctx.drawImage(
                    tempCanvas,
                    completedCrop.x * scaleX,
                    completedCrop.y * scaleY,
                    completedCrop.width * scaleX,
                    completedCrop.height * scaleY,
                    0,
                    0,
                    500,
                    500
                );
            } else {
                // Draw cropped image scaled to 500x500 (no rotation)
                ctx.drawImage(
                    imgRef.current,
                    completedCrop.x * scaleX,
                    completedCrop.y * scaleY,
                    completedCrop.width * scaleX,
                    completedCrop.height * scaleY,
                    0,
                    0,
                    500,
                    500
                );
            }

            // Convert to blob
            canvas.toBlob((blob) => {
                if (blob) {
                    onCropComplete(blob);
                } else {
                    alert('裁剪失败，请重试');
                }
                setLoading(false);
            }, 'image/webp', 0.9);
        } catch (error) {
            console.error('Crop error:', error);
            alert('裁剪失败，请重试');
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl animate-zoom-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">裁剪头像</h2>
                    <p className="text-sm text-gray-500 mt-1">拖动和调整裁剪框来选择区域</p>
                </div>

                {/* Cropper */}
                <div className="relative bg-gray-100 p-8 flex items-center justify-center max-h-[60vh] overflow-hidden">
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
                            className="max-w-full max-h-[50vh] object-contain"
                            style={{
                                transform: `rotate(${rotation}deg)`,
                                transition: 'transform 0.2s ease-in-out',
                            }}
                        />
                    </ReactCrop>
                </div>

                {/* Rotation Controls */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700">
                                旋转角度
                            </label>
                            <span className="text-sm text-gray-500">{rotation}°</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                                className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                左转 90°
                            </button>
                            <button
                                onClick={() => setRotation(0)}
                                className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                            >
                                重置
                            </button>
                            <button
                                onClick={() => setRotation((prev) => (prev + 90) % 360)}
                                className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                                右转 90°
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
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                </div>

                {/* Buttons */}
                <div className="p-6">
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    处理中...
                                </>
                            ) : (
                                '确认上传'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
