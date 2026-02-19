import React, { useRef, useEffect, useCallback, useState } from 'react';

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const PADDING = 20;

const TYPE_COLORS = {
  rectangle: '#3498db',
  circle: '#e74c3c',
  text: '#2c3e50',
  arrow: '#34495e',
  sticky_note: '#f1c40f',
  frame: '#95a5a6',
  connector: '#7f8c8d',
};

export default function Minimap({ objects, stageScale, stagePos, viewportSize, onNavigate }) {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Get world bounding box of all objects + viewport
  const getWorldBounds = useCallback(() => {
    // Viewport in world coords
    const vpLeft = -stagePos.x / stageScale;
    const vpTop = -stagePos.y / stageScale;
    const vpRight = vpLeft + viewportSize.width / stageScale;
    const vpBottom = vpTop + viewportSize.height / stageScale;

    let minX = vpLeft;
    let minY = vpTop;
    let maxX = vpRight;
    let maxY = vpBottom;

    for (const obj of objects) {
      const pos = obj.position || { x: 0, y: 0 };
      const type = obj.object_type || obj.type;
      let left = pos.x;
      let top = pos.y;
      let right = pos.x;
      let bottom = pos.y;

      switch (type) {
        case 'rectangle':
        case 'frame':
        case 'sticky_note':
          right = pos.x + (obj.properties.width || 200);
          bottom = pos.y + (obj.properties.height || 200);
          break;
        case 'circle':
          left = pos.x - (obj.properties.radius || 50);
          top = pos.y - (obj.properties.radius || 50);
          right = pos.x + (obj.properties.radius || 50);
          bottom = pos.y + (obj.properties.radius || 50);
          break;
        case 'text':
          right = pos.x + 100;
          bottom = pos.y + 30;
          break;
        case 'arrow': {
          const pts = obj.properties.points || [];
          for (let i = 0; i < pts.length; i += 2) {
            left = Math.min(left, pts[i]);
            right = Math.max(right, pts[i]);
            top = Math.min(top, pts[i + 1]);
            bottom = Math.max(bottom, pts[i + 1]);
          }
          break;
        }
        default:
          break;
      }

      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    }

    // Add padding
    minX -= PADDING;
    minY -= PADDING;
    maxX += PADDING;
    maxY += PADDING;

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, [objects, stageScale, stagePos, viewportSize]);

  // Convert minimap click to world coords and navigate
  const navigateToPoint = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const bounds = getWorldBounds();
    const scale = Math.min(
      (MINIMAP_WIDTH - 10) / bounds.width,
      (MINIMAP_HEIGHT - 10) / bounds.height
    );
    const offsetX = (MINIMAP_WIDTH - bounds.width * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - bounds.height * scale) / 2;

    // Convert minimap coords to world coords
    const worldX = (mx - offsetX) / scale + bounds.minX;
    const worldY = (my - offsetY) / scale + bounds.minY;

    // Center viewport on this world point
    const newStagePos = {
      x: -(worldX - viewportSize.width / (2 * stageScale)) * stageScale,
      y: -(worldY - viewportSize.height / (2 * stageScale)) * stageScale,
    };
    onNavigate(newStagePos);
  }, [getWorldBounds, viewportSize, stageScale, onNavigate]);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    navigateToPoint(e);
  }, [navigateToPoint]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      navigateToPoint(e);
    }
  }, [isDragging, navigateToPoint]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const bounds = getWorldBounds();
    const scale = Math.min(
      (MINIMAP_WIDTH - 10) / bounds.width,
      (MINIMAP_HEIGHT - 10) / bounds.height
    );
    const offsetX = (MINIMAP_WIDTH - bounds.width * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - bounds.height * scale) / 2;

    // Clear
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw objects
    for (const obj of objects) {
      const pos = obj.position || { x: 0, y: 0 };
      const type = obj.object_type || obj.type;
      const color = TYPE_COLORS[type] || '#999';
      ctx.fillStyle = color;

      const x = (pos.x - bounds.minX) * scale + offsetX;
      const y = (pos.y - bounds.minY) * scale + offsetY;

      switch (type) {
        case 'rectangle':
        case 'frame':
        case 'sticky_note': {
          const w = Math.max(3, (obj.properties.width || 200) * scale);
          const h = Math.max(3, (obj.properties.height || 200) * scale);
          ctx.fillRect(x, y, w, h);
          break;
        }
        case 'circle': {
          const r = Math.max(2, (obj.properties.radius || 50) * scale);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'text':
          ctx.fillRect(x, y, Math.max(3, 60 * scale), Math.max(2, 14 * scale));
          break;
        case 'arrow': {
          const pts = obj.properties.points || [];
          if (pts.length >= 4) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(
              (pts[0] - bounds.minX) * scale + offsetX,
              (pts[1] - bounds.minY) * scale + offsetY
            );
            for (let i = 2; i < pts.length; i += 2) {
              ctx.lineTo(
                (pts[i] - bounds.minX) * scale + offsetX,
                (pts[i + 1] - bounds.minY) * scale + offsetY
              );
            }
            ctx.stroke();
          }
          break;
        }
        default:
          break;
      }
    }

    // Draw viewport indicator
    const vpLeft = -stagePos.x / stageScale;
    const vpTop = -stagePos.y / stageScale;
    const vpW = viewportSize.width / stageScale;
    const vpH = viewportSize.height / stageScale;

    const vx = (vpLeft - bounds.minX) * scale + offsetX;
    const vy = (vpTop - bounds.minY) * scale + offsetY;
    const vw = vpW * scale;
    const vh = vpH * scale;

    ctx.strokeStyle = '#4A90D9';
    ctx.lineWidth = 2;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = 'rgba(74, 144, 217, 0.1)';
    ctx.fillRect(vx, vy, vw, vh);
  }, [objects, stageScale, stagePos, viewportSize, getWorldBounds]);

  return (
    <canvas
      ref={canvasRef}
      width={MINIMAP_WIDTH}
      height={MINIMAP_HEIGHT}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 80,
        borderRadius: 8,
        border: '1px solid #d1d5db',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        zIndex: 5,
      }}
    />
  );
}
