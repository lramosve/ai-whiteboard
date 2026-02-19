import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Text, Arrow, Line, Group, Transformer } from 'react-konva';
import { useWhiteboardStore } from '../store/whiteboardStore';
import Minimap from './Minimap';

const TOOLBAR_HEIGHT = 72;
const ZOOM_SCALE_BY = 1.08;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const GRID_SIZE = 25;
const SNAP_DISTANCE = 30;

// Get the bounding box center of an object
function getObjectCenter(obj) {
  const pos = obj.position || { x: 0, y: 0 };
  const type = obj.object_type || obj.type;
  switch (type) {
    case 'rectangle':
    case 'frame':
    case 'sticky_note':
      return {
        x: pos.x + (obj.properties.width || 200) / 2,
        y: pos.y + (obj.properties.height || 200) / 2,
      };
    case 'circle':
      return { x: pos.x, y: pos.y };
    case 'text':
      return { x: pos.x + 50, y: pos.y + 10 };
    default:
      return pos;
  }
}

// Get edge connection point on an object closest to a target point
function getEdgePoint(obj, targetX, targetY) {
  const pos = obj.position || { x: 0, y: 0 };
  const type = obj.object_type || obj.type;
  const center = getObjectCenter(obj);
  const dx = targetX - center.x;
  const dy = targetY - center.y;
  const angle = Math.atan2(dy, dx);

  switch (type) {
    case 'circle': {
      const r = obj.properties.radius || 50;
      return { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
    }
    case 'rectangle':
    case 'frame':
    case 'sticky_note': {
      const w = (obj.properties.width || 200) / 2;
      const h = (obj.properties.height || 200) / 2;
      // Find intersection of ray from center with rectangle edge
      const absCos = Math.abs(Math.cos(angle));
      const absSin = Math.abs(Math.sin(angle));
      let edgeX, edgeY;
      if (w * absSin <= h * absCos) {
        // Hits left or right edge
        edgeX = center.x + (dx > 0 ? w : -w);
        edgeY = center.y + (dx !== 0 ? w * Math.tan(angle) * (dx > 0 ? 1 : -1) : 0);
      } else {
        // Hits top or bottom edge
        edgeX = center.x + (dy !== 0 ? h / Math.tan(angle) * (dy > 0 ? 1 : -1) : 0);
        edgeY = center.y + (dy > 0 ? h : -h);
      }
      return { x: edgeX, y: edgeY };
    }
    default:
      return center;
  }
}

// Find the closest object to a given point (within snap distance)
function findSnapTarget(objects, worldX, worldY, excludeIds = []) {
  let closest = null;
  let closestDist = SNAP_DISTANCE;
  for (const obj of objects) {
    const type = obj.object_type || obj.type;
    if (['arrow', 'connector'].includes(type)) continue;
    if (excludeIds.includes(obj.id)) continue;
    const center = getObjectCenter(obj);
    const dist = Math.sqrt((center.x - worldX) ** 2 + (center.y - worldY) ** 2);
    // Also check bounding box proximity for large objects
    const pos = obj.position || { x: 0, y: 0 };
    let inBounds = false;
    if (type === 'circle') {
      inBounds = dist <= (obj.properties.radius || 50) + SNAP_DISTANCE;
    } else {
      const w = obj.properties.width || 200;
      const h = obj.properties.height || 200;
      inBounds = worldX >= pos.x - SNAP_DISTANCE && worldX <= pos.x + w + SNAP_DISTANCE &&
                 worldY >= pos.y - SNAP_DISTANCE && worldY <= pos.y + h + SNAP_DISTANCE;
    }
    if (inBounds && dist < closestDist) {
      closestDist = dist;
      closest = obj;
    }
    // For larger objects, use center distance as fallback
    if (!closest && dist < closestDist * 3) {
      closestDist = dist;
      closest = obj;
    }
  }
  return closest;
}

export default function WhiteboardCanvas() {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const layerRef = useRef(null);
  const transformerRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight - TOOLBAR_HEIGHT
  });

  const {
    objects,
    selectedObjectIds,
    tool,
    cursors,
    users,
    addObject,
    updateObject,
    setSelectedObjects,
    updateCursor
  } = useWhiteboardStore();

  const [isDrawing, setIsDrawing] = useState(false);
  const [newObject, setNewObject] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const clipboardRef = useRef([]);
  const dragStartPositionsRef = useRef({});
  const lastCursorSendRef = useRef(0);

  // Pan/zoom state
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Space-to-pan state
  const [isPanning, setIsPanning] = useState(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, stageX: 0, stageY: 0 });

  // Inline text input state
  const [textInputPos, setTextInputPos] = useState(null);
  const [textInputValue, setTextInputValue] = useState('');
  const textInputRef = useRef(null);

  // Sticky note editing state
  const [editingStickyNote, setEditingStickyNote] = useState(null); // { id, x, y, width, height, text }
  const [stickyNoteText, setStickyNoteText] = useState('');
  const stickyNoteInputRef = useRef(null);
  // Refs to access latest sticky note state in commit (avoids stale closures)
  const editingStickyNoteRef = useRef(null);
  const stickyNoteTextRef = useRef('');

  // Keep refs in sync with state
  useEffect(() => { editingStickyNoteRef.current = editingStickyNote; }, [editingStickyNote]);
  useEffect(() => { stickyNoteTextRef.current = stickyNoteText; }, [stickyNoteText]);

  // Sync Transformer nodes to current selection using Konva layer.findOne
  useEffect(() => {
    const tr = transformerRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    if (tool === 'select' && selectedObjectIds.length > 0) {
      const nodes = selectedObjectIds
        .map(id => layer.findOne('#' + id))
        .filter(Boolean);
      tr.nodes(nodes);
    } else {
      tr.nodes([]);
    }
    layer.batchDraw();
  }, [selectedObjectIds, tool, objects]);

  // Space key handling for pan mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && e.target === document.body) {
        e.preventDefault();
        setIsSpaceHeld(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Keyboard shortcuts: copy, paste, duplicate, delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const isMod = e.ctrlKey || e.metaKey;

      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectIds.length > 0) {
        e.preventDefault();
        const { deleteObject } = useWhiteboardStore.getState();
        selectedObjectIds.forEach(id => deleteObject(id));
        return;
      }

      // Ctrl+C — Copy
      if (isMod && e.key === 'c') {
        if (selectedObjectIds.length > 0) {
          clipboardRef.current = objects
            .filter(o => selectedObjectIds.includes(o.id))
            .map(o => ({ ...o, properties: { ...o.properties } }));
        }
        return;
      }

      // Ctrl+V — Paste
      if (isMod && e.key === 'v') {
        e.preventDefault();
        if (clipboardRef.current.length > 0) {
          const newIds = [];
          clipboardRef.current.forEach(o => {
            addObject({
              type: o.object_type || o.type,
              position: { x: (o.position?.x || 0) + 30, y: (o.position?.y || 0) + 30 },
              properties: { ...o.properties, rotation: o.properties.rotation || 0 },
            });
          });
          // Shift clipboard offset for subsequent pastes
          clipboardRef.current = clipboardRef.current.map(o => ({
            ...o,
            position: { x: (o.position?.x || 0) + 30, y: (o.position?.y || 0) + 30 },
          }));
        }
        return;
      }

      // Ctrl+D — Duplicate
      if (isMod && e.key === 'd') {
        e.preventDefault();
        if (selectedObjectIds.length > 0) {
          objects
            .filter(o => selectedObjectIds.includes(o.id))
            .forEach(o => {
              addObject({
                type: o.object_type || o.type,
                position: { x: (o.position?.x || 0) + 20, y: (o.position?.y || 0) + 20 },
                properties: { ...o.properties },
              });
            });
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIds, objects, addObject]);

  // Convert viewport pointer position to world coordinates
  const getWorldPos = useCallback((stage) => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return { x: 0, y: 0 };
    return {
      x: (pointer.x - stagePos.x) / stageScale,
      y: (pointer.y - stagePos.y) / stageScale,
    };
  }, [stagePos, stageScale]);

  // Handle scroll-to-zoom (Ctrl+scroll or pinch) and scroll-to-pan
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    // Pinch-to-zoom (ctrlKey is true for trackpad pinch) or regular scroll = zoom
    const isZoom = e.evt.ctrlKey || e.evt.metaKey;

    if (isZoom) {
      // Zoom toward pointer
      const oldScale = stageScale;
      const pointer = stage.getPointerPosition();
      const newScale = e.evt.deltaY > 0
        ? oldScale / ZOOM_SCALE_BY
        : oldScale * ZOOM_SCALE_BY;
      const clampedScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newScale));

      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldScale,
        y: (pointer.y - stagePos.y) / oldScale,
      };
      const newPos = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      };

      setStageScale(clampedScale);
      setStagePos(newPos);
    } else {
      // Scroll to pan
      const dx = e.evt.deltaX;
      const dy = e.evt.deltaY;
      setStagePos(prev => ({
        x: prev.x - dx,
        y: prev.y - dy,
      }));
    }
  }, [stageScale, stagePos]);

  // Commit inline text input (must be defined before handleMouseDown)
  const commitTextInput = useCallback(() => {
    if (textInputPos && textInputValue.trim()) {
      addObject({
        type: 'text',
        position: { x: textInputPos.worldX, y: textInputPos.worldY },
        properties: {
          text: textInputValue.trim(),
          fontSize: 20,
          fill: '#2c3e50'
        }
      });
    }
    setTextInputPos(null);
    setTextInputValue('');
  }, [textInputPos, textInputValue, addObject]);

  // Commit sticky note (create or update) - uses refs for reliable access
  // Must be defined before handleMouseDown to avoid TDZ
  const commitStickyNote = useCallback(() => {
    const note = editingStickyNoteRef.current;
    const text = (stickyNoteTextRef.current || '').trim();
    if (!note) return;

    // Clear state immediately to prevent double-commit
    editingStickyNoteRef.current = null;
    stickyNoteTextRef.current = '';
    setEditingStickyNote(null);
    setStickyNoteText('');

    if (!text) return;

    if (note.id) {
      // Editing existing sticky note
      updateObject(note.id, {
        properties: {
          ...note.properties,
          text,
        }
      });
    } else {
      // Creating new sticky note
      addObject({
        type: 'sticky_note',
        position: { x: note.worldX, y: note.worldY },
        properties: {
          text,
          color: '#FFFACD',
          width: note.width,
          height: note.height,
          fontSize: 16,
        }
      });
    }
  }, [addObject, updateObject]);

  // Handle transform end (resize via Transformer)
  const handleTransformEnd = useCallback((e) => {
    const node = e.target;
    const id = node.id();
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const obj = objects.find(o => o.id === id);
    if (!obj) return;

    const objType = obj.object_type || obj.type;
    const rotation = node.rotation();
    const updates = { position: { x: node.x(), y: node.y() } };

    switch (objType) {
      case 'rectangle':
      case 'frame':
      case 'sticky_note':
        updates.properties = {
          ...obj.properties,
          width: Math.max(5, (obj.properties.width || 200) * scaleX),
          height: Math.max(5, (obj.properties.height || 200) * scaleY),
          rotation,
        };
        break;
      case 'circle':
        updates.properties = {
          ...obj.properties,
          radius: Math.max(5, obj.properties.radius * Math.max(scaleX, scaleY)),
          rotation,
        };
        break;
      case 'text':
        updates.properties = {
          ...obj.properties,
          fontSize: Math.max(8, (obj.properties.fontSize || 20) * Math.max(scaleX, scaleY)),
          rotation,
        };
        break;
      case 'arrow':
        updates.properties = {
          ...obj.properties,
          points: obj.properties.points.map((p, i) => p * (i % 2 === 0 ? scaleX : scaleY)),
          rotation,
        };
        break;
      default:
        break;
    }

    // Reset node scale
    node.scaleX(1);
    node.scaleY(1);

    updateObject(id, updates);
  }, [objects, updateObject]);

  // Handle mouse down
  const handleMouseDown = useCallback((e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Commit any pending sticky note before processing new click
    if (editingStickyNoteRef.current) {
      commitStickyNote();
    }

    // Middle mouse button or space held = start panning
    if (e.evt.button === 1 || isSpaceHeld) {
      e.evt.preventDefault();
      setIsPanning(true);
      panStartRef.current = {
        x: pointer.x,
        y: pointer.y,
        stageX: stagePos.x,
        stageY: stagePos.y,
      };
      return;
    }

    // Only process left click
    if (e.evt.button !== 0) return;

    // Close text input if clicking elsewhere
    if (textInputPos && tool !== 'text') {
      commitTextInput();
    }

    if (tool === 'select') {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) {
        if (!e.evt.shiftKey) {
          setSelectedObjects([]);
        }
        // Start rubber band selection
        const pos = getWorldPos(stage);
        setSelectionBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
        setIsDrawing(true);
      }
      return;
    }

    const pos = getWorldPos(stage);
    setIsDrawing(true);

    switch (tool) {
      case 'rectangle':
        setNewObject({
          type: 'rectangle',
          position: { x: pos.x, y: pos.y },
          properties: {
            width: 0,
            height: 0,
            fill: '#3498db',
            stroke: '#2980b9',
            strokeWidth: 2
          }
        });
        break;

      case 'circle':
        setNewObject({
          type: 'circle',
          position: { x: pos.x, y: pos.y },
          properties: {
            radius: 0,
            fill: '#e74c3c',
            stroke: '#c0392b',
            strokeWidth: 2
          }
        });
        break;

      case 'text': {
        const stageContainer = stageRef.current?.container().getBoundingClientRect();
        if (stageContainer) {
          setTextInputPos({
            worldX: pos.x,
            worldY: pos.y,
            screenX: e.evt.clientX - stageContainer.left,
            screenY: e.evt.clientY - stageContainer.top,
          });
          setTextInputValue('');
          setTimeout(() => textInputRef.current?.focus(), 0);
        }
        break;
      }

      case 'sticky_note': {
        // Create a sticky note and immediately open it for editing
        const noteWidth = 200;
        const noteHeight = 200;
        const stageContainer = stageRef.current?.container().getBoundingClientRect();
        if (stageContainer) {
          setEditingStickyNote({
            id: null, // null = creating new
            worldX: pos.x,
            worldY: pos.y,
            width: noteWidth,
            height: noteHeight,
            screenX: pos.x * stageScale + stagePos.x,
            screenY: pos.y * stageScale + stagePos.y,
          });
          setStickyNoteText('');
          setIsDrawing(false);
          setTimeout(() => stickyNoteInputRef.current?.focus(), 0);
        }
        break;
      }

      case 'frame':
        setNewObject({
          type: 'frame',
          position: { x: pos.x, y: pos.y },
          properties: {
            width: 0,
            height: 0,
            fill: 'rgba(0,0,0,0.02)',
            stroke: '#95a5a6',
            strokeWidth: 2,
            title: 'Frame',
          }
        });
        break;

      case 'arrow': {
        const fromTarget = findSnapTarget(objects, pos.x, pos.y);
        const startPt = fromTarget ? getObjectCenter(fromTarget) : { x: pos.x, y: pos.y };
        setNewObject({
          type: 'arrow',
          position: { x: 0, y: 0 },
          properties: {
            points: [startPt.x, startPt.y, startPt.x, startPt.y],
            stroke: '#34495e',
            strokeWidth: 3,
            pointerLength: 10,
            pointerWidth: 10,
            fromId: fromTarget?.id || null,
            toId: null,
          }
        });
        break;
      }
    }
  }, [tool, getWorldPos, setSelectedObjects, textInputPos, isSpaceHeld, stagePos, stageScale, commitStickyNote, commitTextInput]);

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    const stage = e.target.getStage();

    // Handle panning (space+drag or middle-click drag)
    if (isPanning) {
      const pointer = stage.getPointerPosition();
      const dx = pointer.x - panStartRef.current.x;
      const dy = pointer.y - panStartRef.current.y;
      setStagePos({
        x: panStartRef.current.stageX + dx,
        y: panStartRef.current.stageY + dy,
      });
      return;
    }

    const pos = getWorldPos(stage);

    // Throttled cursor position broadcast (50ms)
    const now = Date.now();
    if (now - lastCursorSendRef.current >= 50) {
      lastCursorSendRef.current = now;
      updateCursor(pos);
    }

    if (!isDrawing) return;

    // Handle rubber band selection box
    if (selectionBox) {
      setSelectionBox(prev => ({
        ...prev,
        width: pos.x - prev.x,
        height: pos.y - prev.y,
      }));
      return;
    }

    if (!newObject) return;

    const startX = newObject.position.x;
    const startY = newObject.position.y;

    switch (newObject.type) {
      case 'rectangle':
      case 'frame':
        setNewObject({
          ...newObject,
          properties: {
            ...newObject.properties,
            width: pos.x - startX,
            height: pos.y - startY
          }
        });
        break;

      case 'circle': {
        const radius = Math.sqrt(
          Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2)
        );
        setNewObject({
          ...newObject,
          properties: {
            ...newObject.properties,
            radius
          }
        });
        break;
      }

      case 'arrow': {
        const startPts = newObject.properties.points;
        const fromId = newObject.properties.fromId;
        const toTarget = findSnapTarget(objects, pos.x, pos.y, fromId ? [fromId] : []);
        const endPt = toTarget ? getObjectCenter(toTarget) : { x: pos.x, y: pos.y };
        setNewObject({
          ...newObject,
          properties: {
            ...newObject.properties,
            points: [startPts[0], startPts[1], endPt.x, endPt.y],
            toId: toTarget?.id || null,
          }
        });
        break;
      }
    }
  }, [isPanning, isDrawing, newObject, updateCursor, getWorldPos]);

  // Get bounding box of an object for hit-testing
  const getObjectBounds = useCallback((obj) => {
    const pos = obj.position || { x: 0, y: 0 };
    const type = obj.object_type || obj.type;
    switch (type) {
      case 'rectangle':
      case 'frame':
      case 'sticky_note':
        return { x: pos.x, y: pos.y, w: obj.properties.width || 200, h: obj.properties.height || 200 };
      case 'circle': {
        const r = obj.properties.radius || 50;
        return { x: pos.x - r, y: pos.y - r, w: r * 2, h: r * 2 };
      }
      case 'text':
        return { x: pos.x, y: pos.y, w: 100, h: 24 };
      case 'arrow': {
        const pts = obj.properties.points || [0, 0, 0, 0];
        const xs = pts.filter((_, i) => i % 2 === 0);
        const ys = pts.filter((_, i) => i % 2 === 1);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
      }
      default:
        return { x: pos.x, y: pos.y, w: 50, h: 50 };
    }
  }, []);

  // Handle mouse up
  const handleMouseUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Handle rubber band selection
    if (selectionBox && isDrawing) {
      const bx = selectionBox.width < 0 ? selectionBox.x + selectionBox.width : selectionBox.x;
      const by = selectionBox.height < 0 ? selectionBox.y + selectionBox.height : selectionBox.y;
      const bw = Math.abs(selectionBox.width);
      const bh = Math.abs(selectionBox.height);

      if (bw > 3 || bh > 3) {
        const idsInBox = objects
          .filter(obj => {
            const ob = getObjectBounds(obj);
            return ob.x < bx + bw && ob.x + ob.w > bx && ob.y < by + bh && ob.y + ob.h > by;
          })
          .map(o => o.id);

        if (e.evt?.shiftKey) {
          const merged = [...new Set([...selectedObjectIds, ...idsInBox])];
          setSelectedObjects(merged);
        } else {
          setSelectedObjects(idsInBox);
        }
      }

      setSelectionBox(null);
      setIsDrawing(false);
      return;
    }

    if (isDrawing && newObject) {
      const isValid = (newObject.type === 'rectangle' || newObject.type === 'frame')
        ? Math.abs(newObject.properties.width) > 5 && Math.abs(newObject.properties.height) > 5
        : newObject.type === 'circle'
        ? newObject.properties.radius > 5
        : true;

      if (isValid) {
        addObject(newObject);
      }
    }

    setIsDrawing(false);
    setNewObject(null);
  }, [isPanning, isDrawing, newObject, addObject, selectionBox, objects, selectedObjectIds, setSelectedObjects, getObjectBounds]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    const newScale = Math.min(ZOOM_MAX, stageScale * 1.3);
    const centerX = viewportSize.width / 2;
    const centerY = viewportSize.height / 2;
    const mousePointTo = {
      x: (centerX - stagePos.x) / stageScale,
      y: (centerY - stagePos.y) / stageScale,
    };
    setStageScale(newScale);
    setStagePos({
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
    });
  }, [stageScale, stagePos, viewportSize]);

  const zoomOut = useCallback(() => {
    const newScale = Math.max(ZOOM_MIN, stageScale / 1.3);
    const centerX = viewportSize.width / 2;
    const centerY = viewportSize.height / 2;
    const mousePointTo = {
      x: (centerX - stagePos.x) / stageScale,
      y: (centerY - stagePos.y) / stageScale,
    };
    setStageScale(newScale);
    setStagePos({
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
    });
  }, [stageScale, stagePos, viewportSize]);

  const resetView = useCallback(() => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  }, []);

  // Render object based on type
  const renderObject = (obj, index) => {
    const isSelected = selectedObjectIds.includes(obj.id);
    const commonProps = {
      key: obj.id || `temp-${index}`,
      id: obj.id,
      rotation: obj.properties.rotation || 0,
      draggable: tool === 'select' && !isPanning && !isSpaceHeld && !obj.id?.startsWith('temp'),
      onClick: (e) => {
        if (tool === 'select' && !isPanning) {
          if (e.evt.shiftKey) {
            if (selectedObjectIds.includes(obj.id)) {
              setSelectedObjects(selectedObjectIds.filter(id => id !== obj.id));
            } else {
              setSelectedObjects([...selectedObjectIds, obj.id]);
            }
          } else {
            setSelectedObjects([obj.id]);
          }
        }
      },
      onDragStart: (e) => {
        if (selectedObjectIds.length > 1 && selectedObjectIds.includes(obj.id)) {
          const layer = layerRef.current;
          const positions = {};
          selectedObjectIds.forEach(id => {
            const node = layer?.findOne('#' + id);
            if (node) positions[id] = { x: node.x(), y: node.y() };
          });
          dragStartPositionsRef.current = positions;
        }
      },
      onDragMove: (e) => {
        if (selectedObjectIds.length > 1 && selectedObjectIds.includes(obj.id)) {
          const layer = layerRef.current;
          const startPos = dragStartPositionsRef.current[obj.id];
          if (!startPos) return;
          const dx = e.target.x() - startPos.x;
          const dy = e.target.y() - startPos.y;
          selectedObjectIds.forEach(id => {
            if (id !== obj.id) {
              const node = layer?.findOne('#' + id);
              const sp = dragStartPositionsRef.current[id];
              if (node && sp) {
                node.x(sp.x + dx);
                node.y(sp.y + dy);
              }
            }
          });
        }
      },
      onDragEnd: (e) => {
        if (selectedObjectIds.length > 1 && selectedObjectIds.includes(obj.id)) {
          const layer = layerRef.current;
          selectedObjectIds.forEach(id => {
            const node = layer?.findOne('#' + id);
            if (node) {
              updateObject(id, { position: { x: node.x(), y: node.y() } });
            }
          });
          dragStartPositionsRef.current = {};
        } else {
          updateObject(obj.id, {
            position: { x: e.target.x(), y: e.target.y() }
          });
        }
      },
      onTransformEnd: handleTransformEnd,
    };

    const position = obj.position || { x: 0, y: 0 };

    switch (obj.object_type || obj.type) {
      case 'rectangle':
        return (
          <Rect
            {...commonProps}
            x={position.x}
            y={position.y}
            width={obj.properties.width}
            height={obj.properties.height}
            fill={obj.properties.fill}
            stroke={isSelected ? '#f39c12' : obj.properties.stroke}
            strokeWidth={isSelected ? 3 : obj.properties.strokeWidth}
            cornerRadius={obj.properties.cornerRadius || 0}
          />
        );

      case 'circle':
        return (
          <Circle
            {...commonProps}
            x={position.x}
            y={position.y}
            radius={obj.properties.radius}
            fill={obj.properties.fill}
            stroke={isSelected ? '#f39c12' : obj.properties.stroke}
            strokeWidth={isSelected ? 3 : obj.properties.strokeWidth}
          />
        );

      case 'text':
        return (
          <Text
            {...commonProps}
            x={position.x}
            y={position.y}
            text={obj.properties.text}
            fontSize={obj.properties.fontSize}
            fontFamily={obj.properties.fontFamily || 'Arial'}
            fill={obj.properties.fill}
            fontStyle={obj.properties.fontStyle || 'normal'}
            align={obj.properties.align || 'left'}
          />
        );

      case 'arrow': {
        let arrowPoints = obj.properties.points;
        const fromObj = obj.properties.fromId ? objects.find(o => o.id === obj.properties.fromId) : null;
        const toObj = obj.properties.toId ? objects.find(o => o.id === obj.properties.toId) : null;

        if (fromObj || toObj) {
          const rawStart = fromObj
            ? getObjectCenter(fromObj)
            : { x: arrowPoints[0], y: arrowPoints[1] };
          const rawEnd = toObj
            ? getObjectCenter(toObj)
            : { x: arrowPoints[arrowPoints.length - 2], y: arrowPoints[arrowPoints.length - 1] };

          const start = fromObj ? getEdgePoint(fromObj, rawEnd.x, rawEnd.y) : rawStart;
          const end = toObj ? getEdgePoint(toObj, rawStart.x, rawStart.y) : rawEnd;
          arrowPoints = [start.x, start.y, end.x, end.y];
        }

        return (
          <Arrow
            {...commonProps}
            points={arrowPoints}
            stroke={isSelected ? '#f39c12' : obj.properties.stroke}
            strokeWidth={isSelected ? 4 : obj.properties.strokeWidth}
            pointerLength={obj.properties.pointerLength}
            pointerWidth={obj.properties.pointerWidth}
          />
        );
      }

      case 'sticky_note': {
        const noteWidth = obj.properties.width || 200;
        const noteHeight = obj.properties.height || 200;
        return (
          <Group
            {...commonProps}
            x={position.x}
            y={position.y}
            onDblClick={() => {
              if (tool === 'select') {
                setEditingStickyNote({
                  id: obj.id,
                  worldX: position.x,
                  worldY: position.y,
                  width: noteWidth,
                  height: noteHeight,
                  screenX: position.x * stageScale + stagePos.x,
                  screenY: position.y * stageScale + stagePos.y,
                  properties: obj.properties,
                });
                setStickyNoteText(obj.properties.text || '');
                setTimeout(() => stickyNoteInputRef.current?.focus(), 0);
              }
            }}
          >
            <Rect
              width={noteWidth}
              height={noteHeight}
              fill={obj.properties.color || '#FFFACD'}
              stroke={isSelected ? '#f39c12' : '#d4c95c'}
              strokeWidth={isSelected ? 3 : 1}
              shadowColor="rgba(0,0,0,0.15)"
              shadowBlur={8}
              shadowOffsetX={2}
              shadowOffsetY={2}
              cornerRadius={4}
            />
            <Text
              x={12}
              y={12}
              width={noteWidth - 24}
              height={noteHeight - 24}
              text={obj.properties.text}
              fontSize={obj.properties.fontSize || 16}
              fontFamily="Arial"
              fill="#333"
              wrap="word"
              listening={false}
            />
          </Group>
        );
      }

      case 'frame': {
        const frameWidth = obj.properties.width || 400;
        const frameHeight = obj.properties.height || 300;
        return (
          <Group {...commonProps} x={position.x} y={position.y}>
            <Rect
              width={frameWidth}
              height={frameHeight}
              fill={obj.properties.fill || 'rgba(0,0,0,0.02)'}
              stroke={isSelected ? '#f39c12' : (obj.properties.stroke || '#95a5a6')}
              strokeWidth={isSelected ? 3 : (obj.properties.strokeWidth || 2)}
              dash={[8, 4]}
              cornerRadius={8}
            />
            <Text
              x={10}
              y={-22}
              text={obj.properties.title || 'Frame'}
              fontSize={14}
              fontFamily="Arial"
              fontStyle="bold"
              fill={obj.properties.stroke || '#95a5a6'}
              listening={false}
            />
          </Group>
        );
      }

      case 'connector': {
        const fromObj = objects.find(o => o.id === obj.properties.fromId);
        const toObj = objects.find(o => o.id === obj.properties.toId);
        if (!fromObj || !toObj) return null;
        const fromPos = fromObj.position || { x: 0, y: 0 };
        const toPos = toObj.position || { x: 0, y: 0 };
        const fromCx = fromPos.x + ((fromObj.properties.width || 0) / 2);
        const fromCy = fromPos.y + ((fromObj.properties.height || 0) / 2);
        const toCx = toPos.x + ((toObj.properties.width || 0) / 2);
        const toCy = toPos.y + ((toObj.properties.height || 0) / 2);
        return (
          <Line
            key={obj.id || `temp-${index}`}
            points={[fromCx, fromCy, toCx, toCy]}
            stroke={isSelected ? '#f39c12' : (obj.properties.stroke || '#7f8c8d')}
            strokeWidth={isSelected ? 3 : (obj.properties.strokeWidth || 2)}
            dash={obj.properties.dash && obj.properties.dash.length > 0 ? obj.properties.dash : undefined}
            listening={false}
          />
        );
      }

      default:
        return null;
    }
  };

  // Render collaborative cursors with name badges
  const renderCursors = () => {
    return Object.entries(cursors).map(([userId, cursor]) => {
      const user = users[userId];
      const name = cursor.userName || user?.name || 'Guest';
      const color = user?.color || '#666';
      const labelWidth = name.length * 7 + 14;

      return (
        <Group key={userId} x={cursor.x} y={cursor.y} listening={false}>
          {/* Cursor pointer triangle */}
          <Line
            points={[0, 0, 4, 14, 10, 10]}
            fill={color}
            stroke="#ffffff"
            strokeWidth={1.5}
            closed={true}
            lineJoin="round"
          />
          {/* Name label badge */}
          <Rect
            x={10}
            y={12}
            width={labelWidth}
            height={20}
            fill={color}
            cornerRadius={4}
          />
          <Text
            x={17}
            y={15}
            text={name}
            fontSize={11}
            fontFamily="Arial"
            fontStyle="bold"
            fill="#ffffff"
          />
        </Group>
      );
    });
  };

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight - TOOLBAR_HEIGHT
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute dot-grid background style
  const gridSpacing = GRID_SIZE * stageScale;
  const gridOffsetX = stagePos.x % gridSpacing;
  const gridOffsetY = stagePos.y % gridSpacing;
  const dotSize = Math.max(1, stageScale * 1.5);

  const canvasCursor = isSpaceHeld || isPanning
    ? (isPanning ? 'grabbing' : 'grab')
    : tool === 'select' ? 'default' : 'crosshair';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: canvasCursor,
        background: `radial-gradient(circle, #ccc ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
        backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
        backgroundColor: '#f8f9fa',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={viewportSize.width}
        height={viewportSize.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <Layer ref={layerRef}>
          {objects.map((obj, index) => renderObject(obj, index))}
          {newObject && renderObject(newObject, 'new')}
          {renderCursors()}
          {selectionBox && (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill="rgba(74, 144, 217, 0.1)"
              stroke="#4A90D9"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            enabledAnchors={['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right']}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
              return newBox;
            }}
            borderStroke="#4A90D9"
            anchorFill="#FFFFFF"
            anchorStroke="#4A90D9"
            anchorSize={8}
            anchorCornerRadius={2}
          />
        </Layer>
      </Stage>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <button
          onClick={zoomOut}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors text-lg font-medium"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          onClick={resetView}
          className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors min-w-[60px] text-center"
          aria-label="Reset zoom"
        >
          {Math.round(stageScale * 100)}%
        </button>
        <button
          onClick={zoomIn}
          className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors text-lg font-medium"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      {/* Pan hint */}
      {isSpaceHeld && !isPanning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-white text-sm px-4 py-2 rounded-full pointer-events-none">
          Click and drag to pan
        </div>
      )}

      {/* Inline text input overlay */}
      {textInputPos && (
        <input
          ref={textInputRef}
          type="text"
          value={textInputValue}
          onChange={(e) => setTextInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitTextInput();
            } else if (e.key === 'Escape') {
              setTextInputPos(null);
              setTextInputValue('');
            }
          }}
          onBlur={commitTextInput}
          placeholder="Type text..."
          className="absolute border-2 border-purple-500 rounded px-2 py-1 text-base outline-none bg-white shadow-md"
          style={{
            left: textInputPos.screenX,
            top: textInputPos.screenY,
            minWidth: 150,
            zIndex: 10,
          }}
        />
      )}

      {/* Sticky note text editor overlay */}
      {editingStickyNote && (
        <div
          className="absolute"
          style={{
            left: editingStickyNote.screenX,
            top: editingStickyNote.screenY,
            width: editingStickyNote.width * stageScale,
            height: editingStickyNote.height * stageScale,
            zIndex: 10,
          }}
        >
          <textarea
            ref={stickyNoteInputRef}
            value={stickyNoteText}
            onChange={(e) => setStickyNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setEditingStickyNote(null);
                setStickyNoteText('');
              }
            }}
            onBlur={commitStickyNote}
            placeholder="Type your note..."
            className="w-full h-full resize-none outline-none rounded shadow-lg"
            style={{
              padding: `${12 * stageScale}px`,
              fontSize: `${16 * stageScale}px`,
              fontFamily: 'Arial',
              color: '#333',
              backgroundColor: editingStickyNote.properties?.color || '#FFFACD',
              border: '2px solid #f39c12',
            }}
          />
        </div>
      )}

      {/* Minimap */}
      <Minimap
        objects={objects}
        stageScale={stageScale}
        stagePos={stagePos}
        viewportSize={viewportSize}
        onNavigate={setStagePos}
      />
    </div>
  );
}
