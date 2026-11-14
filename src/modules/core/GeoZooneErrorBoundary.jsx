import React from 'react';

/**
 * Caja de Fusibles (Error Boundary) para Módulos de GeoZoone.
 * Aísla cualquier error de renderizado o de datos dentro de un módulo nuevo
 * para que NUNCA pueda tumbar la pantalla principal, el mapa ni las fichas.
 */
class GeoZooneErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const moduleName = this.props.moduleName || 'Módulo GeoZoone';
    // eslint-disable-next-line no-console
    console.warn(`[GeoZoone SafeModule] Fallo aislado en "${moduleName}":`, error, errorInfo);
  }

  render() {
    const { hasError } = this.state;
    const { fallback = null, children } = this.props;

    if (hasError) {
      return fallback;
    }

    return children;
  }
}

export default GeoZooneErrorBoundary;

