'use client';

import { Component } from 'react';

/**
 * Catches JS errors in child components so the rest of the app still works.
 * If OfflineBanner or another layout child throws, buttons and navigation keep working.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
