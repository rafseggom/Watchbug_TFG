export const WIDGET_CSS = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  .wb-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    z-index: 2147483647;
  }

  .wb-button {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #1a73e8;
    color: white;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .wb-button:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }

  .wb-button:active {
    transform: scale(0.98);
  }

  .wb-button-label {
    position: absolute;
    right: 64px;
    background: #333;
    color: white;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  }

  .wb-button-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .wb-button-wrapper:hover .wb-button-label {
    opacity: 1;
  }

  .wb-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
  }

  .wb-overlay[hidden] {
    display: none !important;
  }

  .wb-toolbar {
    height: 48px;
    background: white;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 8px;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
  }

  .wb-toolbar button {
    padding: 6px 12px;
    border: 1px solid #dadce0;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: #3c4043;
  }

  .wb-toolbar button:hover {
    background: #f1f3f4;
  }

  .wb-canvas {
    flex: 1;
    cursor: crosshair;
    background: #f8f9fa;
    display: block;
    width: 100%;
  }

  .wb-close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: white;
    color: #5f6368;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    z-index: 1;
  }

  .wb-close:hover {
    background: #f1f3f4;
  }

  .wb-overlay-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 48px;
    background: white;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
  }

  .wb-overlay-title {
    font-size: 16px;
    font-weight: 500;
    color: #202124;
  }
`;
