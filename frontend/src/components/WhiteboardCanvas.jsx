import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Text, Arrow, Line, Group } from 'react-konva';
import { useWhiteboardStore } from '../store/whiteboardStore';

const TOOLBAR_HEIGHT = 72;
const ZOOM_SCALE_BY = 1.08;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const GRID_SIZE = 25;

export default function WhiteboardCanvas() {
  const stageRef = useRef(null);
  const containerRef = useRef(null);
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

  // Handle mouse down
  const handleMouseDown = useCallback((e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

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
        setSelectedObjects([]);
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

      case 'arrow':
        setNewObject({
          type: 'arrow',
          position: { x: 0, y: 0 },
          properties: {
            points: [pos.x, pos.y, pos.x, pos.y],
            stroke: '#34495e',
            strokeWidth: 3,
            pointerLength: 10,
            pointerWidth: 10
          }
        });
        break;
    }
  }, [tool, getWorldPos, setSelectedObjects, textInputPos, isSpaceHeld, stagePos]);

  // Commit inline text input
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

    if (!isDrawing || !newObject) return;

    const startX = newObject.position.x;
    const startY = newObject.position.y;

    switch (newObject.type) {
      case 'rectangle':
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

      case 'arrow':
        setNewObject({
          ...newObject,
          properties: {
            ...newObject.properties,
            points: [startX, startY, pos.x, pos.y]
          }
        });
        break;
    }
  }, [isPanning, isDrawing, newObject, updateCursor, getWorldPos]);

  // Handle mouse up
  const handleMouseUp = useCallback((e) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDrawing && newObject) {
      const isValid = newObject.type === 'rectangle'
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
  }, [isPanning, isDrawing, newObject, addObject]);

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
      draggable: tool === 'select' && !isPanning && !isSpaceHeld && !obj.id?.startsWith('temp'),
      onClick: () => {
        if (tool === 'select' && !isPanning) {
          setSelectedObjects([obj.id]);
        }
      },
      onDragEnd: (e) => {
        updateObject(obj.id, {
          position: { x: e.target.x(), y: e.target.y() }
        });
      }
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

      case 'arrow':
        return (
          <Arrow
            {...commonProps}
            points={obj.properties.points}
            stroke={isSelected ? '#f39c12' : obj.properties.stroke}
            strokeWidth={isSelected ? 4 : obj.properties.strokeWidth}
            pointerLength={obj.properties.pointerLength}
            pointerWidth={obj.properties.pointerWidth}
          />
        );

      case 'sticky_note': {
        const noteWidth = obj.properties.width || 200;
        const noteHeight = obj.properties.height || 200;
        return (
          <Group {...commonProps} x={position.x} y={position.y}>
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

  // Render collaborative cursors
  const renderCursors = () => {
    return Object.entries(cursors).map(([userId, cursor]) => {
      const user = users[userId];
      if (!user) return null;

      return (
        <React.Fragment key={userId}>
          <Circle
            x={cursor.x}
            y={cursor.y}
            radius={5}
            fill={user.color}
            listening={false}
          />
          <Text
            x={cursor.x + 10}
            y={cursor.y + 10}
            text={cursor.userName || user.name}
            fontSize={12}
            fill={user.color}
            listening={false}
          />
        </React.Fragment>
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
        <Layer>
          {objects.map((obj, index) => renderObject(obj, index))}
          {newObject && renderObject(newObject, 'new')}
          {renderCursors()}
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
    </div>
  );
}
