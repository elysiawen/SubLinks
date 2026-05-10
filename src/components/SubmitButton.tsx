'use client';

import React from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';

interface SubmitButtonProps {
    children?: React.ReactNode;
    text?: string;
    className?: string;
    isLoading?: boolean;
    onClick?: () => void;
    type?: "submit" | "button" | "reset";
    disabled?: boolean;
}

export function SubmitButton({ children, text, className = '', isLoading, onClick, type = "submit", disabled }: SubmitButtonProps) {
    const t = useTranslations('common.submitButton');
    const { pending } = useFormStatus();
    const isPending = isLoading !== undefined ? isLoading : pending;
    const displayText = text || t('submit');

    // Default classes
    const baseClasses = "px-4 py-2 bg-accent-foreground text-white rounded-lg hover:bg-accent-foreground/90 transition flex items-center justify-center font-medium shadow-sm";
    const disabledClasses = "opacity-70 cursor-not-allowed";

    return (
        <button
            type={type}
            disabled={isPending || disabled}
            onClick={onClick}
            className={`${baseClasses} ${isPending ? disabledClasses : ''} ${className}`}
        >
            {isPending && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {isPending ? `${displayText}...` : (children || displayText)}
        </button>
    );
}
