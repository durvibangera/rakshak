/**
 * FILE: LoadingSkeleton.js
 * PURPOSE: Placeholder loading UI with animated skeleton elements.
 *
 * CONTEXT: Used throughout the app while data is being fetched from Supabase
 *          or API routes. Provides visual feedback that content is loading.
 *          Must look good on the dark (#0F172A) background.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - LoadingSkeleton: React component with configurable rows and style
 *
 * KEY DEPENDENCIES: None (Tailwind CSS only)
 *
 * TODO:
 *   [ ] Create card skeleton variant
 *   [ ] Create list skeleton variant
 *   [ ] Create map skeleton variant
 */

'use client';

/**
 * @param {{ rows?: number, className?: string }} props
 */
export default function LoadingSkeleton({ rows = 3, className = '' }) {
  return (
    <div className={`animate-pulse space-y-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-3/4" />
          <div className="h-4 bg-slate-700 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
