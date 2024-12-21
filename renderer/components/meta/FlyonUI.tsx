'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { IStaticMethods } from 'flyonui/flyonui';
declare global {
    interface Window {
        HSStaticMethods: IStaticMethods;
    }
}

export default () => {
    const path = usePathname();

    useEffect(() => {
        const loadFlyonui = async () => {
            await import('flyonui/flyonui');
            setTimeout(() => window.HSStaticMethods.autoInit(), 1000);
        };
        loadFlyonui();
    }, [path]);

    return null;
}