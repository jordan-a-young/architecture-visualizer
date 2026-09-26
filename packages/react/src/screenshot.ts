import type { ScreenshotOptions } from './types.js';

/** Effective opacity and stacking of the non-transformed, built-in Html labels. */
function presentation(element: HTMLElement, viewport: HTMLElement) {
  let opacity = 1;
  let order = 0;
  for (
    let current: HTMLElement | null = element;
    current && current !== viewport;
    current = current.parentElement
  ) {
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden')
      return { opacity: 0, order };
    opacity *= Number(style.opacity);
    const zIndex = Number.parseInt(style.zIndex, 10);
    if (Number.isFinite(zIndex)) order = zIndex;
  }
  return { opacity, order };
}

function paintLabel(
  context: CanvasRenderingContext2D,
  element: HTMLElement,
  origin: DOMRect,
  opacity: number,
) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height || !opacity) return;
  const style = getComputedStyle(element);
  const x = rect.left - origin.left;
  const y = rect.top - origin.top;
  const border = Number.parseFloat(style.borderTopWidth) || 0;
  context.save();
  context.globalAlpha = opacity;
  context.beginPath();
  context.roundRect(
    x + border / 2,
    y + border / 2,
    rect.width - border,
    rect.height - border,
    Number.parseFloat(style.borderTopLeftRadius) || 0,
  );
  context.fillStyle = style.backgroundColor;
  context.fill();
  if (border) {
    context.strokeStyle = style.borderTopColor;
    context.lineWidth = border;
    context.stroke();
  }
  // Measure actual text runs so padding, line height and the two-line node label
  // remain aligned with their DOM representation. No HTML serialization or assets.
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    if (!text.textContent?.trim() || !text.parentElement) continue;
    const range = document.createRange();
    range.selectNodeContents(text);
    const textRect = range.getBoundingClientRect();
    const textStyle = getComputedStyle(text.parentElement);
    context.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`;
    context.fillStyle = textStyle.color;
    context.textBaseline = 'middle';
    context.fillText(
      text.textContent,
      textRect.left - origin.left,
      textRect.top - origin.top + textRect.height / 2,
    );
  }
  context.restore();
}

/** Copy immediately after rendering: WebGL's drawing buffer is otherwise transient. */
export function captureViewport(
  canvas: HTMLCanvasElement,
  viewport: HTMLElement,
  render: () => void,
  options: ScreenshotOptions = {},
): Promise<Blob> {
  return document.fonts.ready.then(() => {
    if (!canvas.isConnected || !viewport.isConnected)
      throw new Error('The 3D view is no longer available.');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !canvas.width || !canvas.height)
      throw new Error('The 3D view has no visible size.');
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const context = output.getContext('2d');
    if (!context)
      throw new Error('Image export is unavailable in this browser.');
    render();
    context.drawImage(canvas, 0, 0);
    if (options.includeLabels !== false) {
      context.scale(output.width / rect.width, output.height / rect.height);
      const labels = [
        ...viewport.querySelectorAll<HTMLElement>('[data-av-export-label]'),
      ]
        .map((element) => ({ element, ...presentation(element, viewport) }))
        .sort((a, b) => a.order - b.order);
      for (const { element, opacity } of labels)
        paintLabel(context, element, rect, opacity);
    }
    return new Promise<Blob>((resolve, reject) =>
      output.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode the screenshot as PNG.'));
      }, 'image/png'),
    );
  });
}

export function downloadScreenshot(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'architecture.png';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to consume the URL, including browsers that defer downloads.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
