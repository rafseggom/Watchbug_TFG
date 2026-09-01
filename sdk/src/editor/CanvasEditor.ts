import { createPencilTool, type Tool as PencilTool } from './tools/pencil';
import { createArrowTool } from './tools/arrow';
import { createTextTool } from './tools/text';
import { createMaskRectTool, createMaskPaintTool } from './tools/mask';

export type Tool = {
  name: string;
  onPointerDown(e: PointerEvent): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;
  onPointerLeave(e: PointerEvent): void;
};

export type Annotation = {
  tool: string;
  x: number;
  y: number;
  payload?: unknown;
};

export class CanvasEditor {
  private canvas: HTMLCanvasElement;
  private toolbar: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private toolMap: Map<string, Tool> = new Map();
  private activeToolName: string | null = null;
  private annotations: Annotation[] = [];
  private boundDown: (e: PointerEvent) => void = () => {};
  private boundMove: (e: PointerEvent) => void = () => {};
  private boundUp: (e: PointerEvent) => void = () => {};
  private boundLeave: (e: PointerEvent) => void = () => {};
  private toolbarHandler: ((e: Event) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, toolbar: HTMLElement) {
    this.canvas = canvas;
    this.toolbar = toolbar;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D | null;
    } catch {
      ctx = null;
    }
    if (!ctx) {
      throw new Error('[Watchbug] CanvasEditor: 2D context not available');
    }
    this.ctx = ctx as CanvasRenderingContext2D;

    // Register tools
    this.toolMap.set('pencil', createPencilTool(this.ctx) as unknown as Tool);
    this.toolMap.set('arrow', createArrowTool(this.ctx) as unknown as Tool);
    this.toolMap.set('text', createTextTool(this.ctx) as unknown as Tool);
    this.toolMap.set('mask-rect', createMaskRectTool(this.ctx) as unknown as Tool);
    this.toolMap.set('mask-paint', createMaskPaintTool(this.ctx) as unknown as Tool);

    // Also allow 'maskRect' alias for convenience
    this.toolMap.set('maskRect', createMaskRectTool(this.ctx) as unknown as Tool);
    this.toolMap.set('maskPaint', createMaskPaintTool(this.ctx) as unknown as Tool);

    // Default tool
    this.activeToolName = 'pencil';

    this._bindCanvasEvents();
    this._bindToolbar();
    this._updateToolbarActiveStates();
  }

  private _bindCanvasEvents(): void {
    this.boundDown = (e: PointerEvent) => {
      const tool = this.activeToolName ? this.toolMap.get(this.activeToolName) : null;
      tool?.onPointerDown(e);
    };
    this.boundMove = (e: PointerEvent) => {
      const tool = this.activeToolName ? this.toolMap.get(this.activeToolName) : null;
      tool?.onPointerMove(e);
    };
    this.boundUp = (e: PointerEvent) => {
      const tool = this.activeToolName ? this.toolMap.get(this.activeToolName) : null;
      tool?.onPointerUp(e);
    };
    this.boundLeave = (e: PointerEvent) => {
      const tool = this.activeToolName ? this.toolMap.get(this.activeToolName) : null;
      tool?.onPointerLeave(e);
    };

    this.canvas.addEventListener('pointerdown', this.boundDown as unknown as EventListener);
    this.canvas.addEventListener('pointermove', this.boundMove as unknown as EventListener);
    this.canvas.addEventListener('pointerup', this.boundUp as unknown as EventListener);
    this.canvas.addEventListener('pointerleave', this.boundLeave as unknown as EventListener);
    // Fallback mouse events for jsdom where PointerEvent not fully supported
    this.canvas.addEventListener('mousedown', this.boundDown as unknown as EventListener);
    this.canvas.addEventListener('mousemove', this.boundMove as unknown as EventListener);
    this.canvas.addEventListener('mouseup', this.boundUp as unknown as EventListener);
    this.canvas.addEventListener('mouseleave', this.boundLeave as unknown as EventListener);
  }

  private _bindToolbar(): void {
    // Delegate toolbar clicks to setTool
    this.toolbarHandler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('[data-tool]') as HTMLElement | null;
      if (!btn) return;
      const tool = btn.getAttribute('data-tool');
      if (!tool) return;
      // send is not a drawing tool — ignore for tool switching
      if (tool === 'send') return;
      if (this.toolMap.has(tool)) {
        this.setTool(tool);
      }
    };
    this.toolbar.addEventListener('click', this.toolbarHandler);
  }

  private _updateToolbarActiveStates(): void {
    const buttons = this.toolbar.querySelectorAll('[data-tool]');
    buttons.forEach((btn) => {
      const el = btn as HTMLElement;
      const tool = el.getAttribute('data-tool');
      if (tool === this.activeToolName) {
        el.setAttribute('aria-pressed', 'true');
        el.classList.add('wb-active');
      } else {
        el.setAttribute('aria-pressed', 'false');
        el.classList.remove('wb-active');
      }
    });
  }

  setTool(toolName: string): void {
    if (!this.toolMap.has(toolName)) {
      // allow alias normalization
      if (toolName === 'mask-rect' || toolName === 'maskRect') toolName = 'mask-rect';
      else if (toolName === 'mask-paint' || toolName === 'maskPaint') toolName = 'mask-paint';
      if (!this.toolMap.has(toolName)) return;
    }
    this.activeToolName = toolName;
    this._updateToolbarActiveStates();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getAnnotations(): Annotation[] {
    return [...this.annotations];
  }

  getActiveTool(): string | null {
    return this.activeToolName;
  }

  getToolNames(): string[] {
    return Array.from(this.toolMap.keys());
  }

  loadImage(dataUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const img = new (window as unknown as { Image: typeof Image }).Image();
        img.onload = () => {
          try {
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = (e) => reject(e);
        img.src = dataUrl;
      } catch (e) {
        // Fallback for jsdom where Image may not exist — resolve immediately
        try {
          // Attempt to draw placeholder
          this.ctx.fillStyle = '#ffffff';
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } catch {}
        resolve();
      }
    });
  }

  destroy(): void {
    try {
      this.canvas.removeEventListener('pointerdown', this.boundDown as unknown as EventListener);
      this.canvas.removeEventListener('pointermove', this.boundMove as unknown as EventListener);
      this.canvas.removeEventListener('pointerup', this.boundUp as unknown as EventListener);
      this.canvas.removeEventListener('pointerleave', this.boundLeave as unknown as EventListener);
      this.canvas.removeEventListener('mousedown', this.boundDown as unknown as EventListener);
      this.canvas.removeEventListener('mousemove', this.boundMove as unknown as EventListener);
      this.canvas.removeEventListener('mouseup', this.boundUp as unknown as EventListener);
      this.canvas.removeEventListener('mouseleave', this.boundLeave as unknown as EventListener);
      if (this.toolbarHandler) {
        this.toolbar.removeEventListener('click', this.toolbarHandler);
      }
    } catch {
      // ignore
    }
    this.toolMap.clear();
    this.activeToolName = null;
  }
}
