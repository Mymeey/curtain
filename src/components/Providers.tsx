'use client';

import { ReactNode, useState, useEffect, useRef } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clean up any DOM nodes injected by browser extensions before rendering
    const cleanupExtensionNodes = () => {
      // Remove Grammarly, Google Translate, and other common extension elements
      const selectors = [
        'grammarly-desktop-integration',
        'grammarly-extension',
        '[data-grammarly-part]',
        '[data-gramm]',
        '[data-gramm_editor]',
        '.gt-widget',
        '#google_translate_element',
        '.skiptranslate',
        '[translate="no"]',
        'deepl-inline-translate',
      ];
      
      selectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach(el => {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          });
        } catch {
          // Ignore errors
        }
      });

      // Remove any font elements inserted by extensions (common cause of hydration errors)
      document.querySelectorAll('font').forEach(el => {
        if (el.parentNode) {
          const parent = el.parentNode;
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          parent.removeChild(el);
        }
      });
    };

    // Run cleanup before mounting
    cleanupExtensionNodes();
    
    // Use requestAnimationFrame to ensure we're in the next paint cycle
    requestAnimationFrame(() => {
      setMounted(true);
    });

    // Also observe for any future mutations and clean them up
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tagName = el.tagName?.toLowerCase();
            if (
              tagName === 'grammarly-desktop-integration' ||
              tagName === 'grammarly-extension' ||
              el.hasAttribute?.('data-grammarly-part') ||
              el.hasAttribute?.('data-gramm')
            ) {
              node.parentNode?.removeChild(node);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  // Show loading skeleton until fully client-side mounted
  if (!mounted) {
    return (
      <div 
        ref={containerRef}
        className="min-h-screen bg-zinc-50 dark:bg-black" 
        suppressHydrationWarning
      >
        <div className="animate-pulse p-4" suppressHydrationWarning>
          <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded mb-4"></div>
          <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded mb-4"></div>
          <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  return <div suppressHydrationWarning>{children}</div>;
}
