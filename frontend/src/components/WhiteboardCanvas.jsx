import React, { useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Text, Arrow, Line, Group } from 'react-konva';
import { useWhiteboardStore } from '../store/whiteboardStore';

const TOOLBAR_HEIGHT = 72;
const ZOOM_SCALE_BY = 1.05;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;

export default function WhiteboardCanvas() {
  const stageRef = useRef(null);
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

  // Inline text input state
  const [textInputPos, setTextInputPos] = useState(null);
  const [textInputValue, setTextInputValue] = useState('');
  const textInputRef = useRef(null);

  // Convert viewport pointer position to world coordinates
  const getWorldPos = useCallback((stage) => {
    const pointer = stage.getPointerPosition();
    return {
      x: (pointer.x - stagePos.x) / stageScale,
      y: (pointer.y - stagePos.y) / stageScale,
    };
  }, [stagePos, stageScale]);

  // Handle scroll-to-zoom
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

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
  }, [stageScale, stagePos]);

  // Handle mouse down
  const handleMouseDown = useCallback((e) => {
    // Close text input if clicking elsewhere
    if (textInputPos && tool !== 'text') {
      commitTextInput();
    }

    if (tool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedObjects([]);
      }
      return;
    }

    const stage = e.target.getStage();
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
        // Show inline text input at click position
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
  }, [tool, getWorldPos, setSelectedObjects, textInputPos]);

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
  }, [isDrawing, newObject, updateCursor, getWorldPos]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isDrawing && newObject) {
      // Only add if object has meaningful size
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
  }, [isDrawing, newObject, addObject]);

  // Handle stage drag end (panning)
  const handleStageDragEnd = useCallback((e) => {
    if (e.target === e.target.getStage()) {
      setStagePos({ x: e.target.x(), y: e.target.y() });
    }
  }, []);

  // Render object based on type
  const renderObject = (obj, index) => {
    const isSelected = selectedObjectIds.includes(obj.id);
    const commonProps = {
      key: obj.id || `temp-${index}`,
      draggable: tool === 'select' && !obj.id?.startsWith('temp'),
      onClick: () => {
        if (tool === 'select') {
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

  React.useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight - TOOLBAR_HEIGHT
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Stage
        ref={stageRef}
        width={viewportSize.width}
        height={viewportSize.height}
        draggable={tool === 'select'}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDragEnd={handleStageDragEnd}
        style={{ background: '#f8f9fa' }}
      >
        <Layer>
          {/* Render existing objects */}
          {objects.map((obj, index) => renderObject(obj, index))}

          {/* Render object being drawn */}
          {newObject && renderObject(newObject, 'new')}

          {/* Render collaborative cursors */}
          {renderCursors()}
        </Layer>
      </Stage>

      {/* Zoom indicator */}
      {stageScale !== 1 && (
        <div className="absolute bottom-4 left-4 bg-white bg-opacity-80 px-3 py-1 rounded-full text-sm text-gray-600 shadow-sm">
          {Math.round(stageScale * 100)}%
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
