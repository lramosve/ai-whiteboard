import React, { useRef, useEffect, useCallback, useState } from 'react';

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const PADDING = 40;

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
  const isDraggingRef = useRef(false);

  // Get world bounding box of all objects + viewport
  const getWorldBounds = useCallback(() => {
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
        case 'sticky_note': {
          const w = Math.abs(obj.properties.width || 200);
          const h = Math.abs(obj.properties.height || 200);
          left = Math.min(pos.x, pos.x + (obj.properties.width || 200));
          top = Math.min(pos.y, pos.y + (obj.properties.height || 200));
          right = left + w;
          bottom = top + h;
          break;
        }
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

    minX -= PADDING;
    minY -= PADDING;
    maxX += PADDING;
    maxY += PADDING;

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, [objects, stageScale, stagePos, viewportSize]);

  // Compute minimap scale and offset from bounds
  const getScaleAndOffset = useCallback((bounds) => {
    const scale = Math.min(
      (MINIMAP_WIDTH - 10) / Math.max(bounds.width, 1),
      (MINIMAP_HEIGHT - 10) / Math.max(bounds.height, 1)
    );
    const offsetX = (MINIMAP_WIDTH - bounds.width * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - bounds.height * scale) / 2;
    return { scale, offsetX, offsetY };
  }, []);

  // Convert minimap click to world coords and navigate
  const navigateToPoint = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    const bounds = getWorldBounds();
    const { scale, offsetX, offsetY } = getScaleAndOffset(bounds);

    const worldX = (mx - offsetX) / scale + bounds.minX;
    const worldY = (my - offsetY) / scale + bounds.minY;

    const newX = -(worldX - viewportSize.width / (2 * stageScale)) * stageScale;
    const newY = -(worldY - viewportSize.height / (2 * stageScale)) * stageScale;

    // Guard against NaN/Infinity
    if (!isFinite(newX) || !isFinite(newY)) return;

    onNavigate({ x: newX, y: newY });
  }, [getWorldBounds, getScaleAndOffset, viewportSize, stageScale, onNavigate]);

  // Use window-level listeners for drag to handle mouse leaving the canvas
  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    navigateToPoint(e);

    const handleWindowMouseMove = (e) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        navigateToPoint(e);
      }
    };
    const handleWindowMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  }, [navigateToPoint]);

  // Draw minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const bounds = getWorldBounds();
    const { scale, offsetX, offsetY } = getScaleAndOffset(bounds);

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

      switch (type) {
        case 'rectangle':
        case 'frame':
        case 'sticky_note': {
          const rawW = obj.properties.width || 200;
          const rawH = obj.properties.height || 200;
          const objX = Math.min(pos.x, pos.x + rawW);
          const objY = Math.min(pos.y, pos.y + rawH);
          const w = Math.max(4, Math.abs(rawW) * scale);
          const h = Math.max(4, Math.abs(rawH) * scale);
          const drawX = (objX - bounds.minX) * scale + offsetX;
          const drawY = (objY - bounds.minY) * scale + offsetY;
          ctx.fillRect(drawX, drawY, w, h);
          break;
        }
        case 'circle': {
          const cx = (pos.x - bounds.minX) * scale + offsetX;
          const cy = (pos.y - bounds.minY) * scale + offsetY;
          const r = Math.max(2, (obj.properties.radius || 50) * scale);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'text': {
          const tx = (pos.x - bounds.minX) * scale + offsetX;
          const ty = (pos.y - bounds.minY) * scale + offsetY;
          ctx.fillRect(tx, ty, Math.max(3, 60 * scale), Math.max(2, 14 * scale));
          break;
        }
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
  }, [objects, stageScale, stagePos, viewportSize, getWorldBounds, getScaleAndOffset]);

  return (
    <canvas
      ref={canvasRef}
      width={MINIMAP_WIDTH}
      height={MINIMAP_HEIGHT}
      onMouseDown={handleMouseDown}
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
