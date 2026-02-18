import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Text, Arrow, Line } from 'react-konva';
import { useWhiteboardStore } from '../store/whiteboardStore';

const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;

export default function WhiteboardCanvas() {
  const stageRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 120 // Account for toolbar
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

  // Handle mouse down
  const handleMouseDown = useCallback((e) => {
    if (tool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedObjects([]);
      }
      return;
    }

    const pos = e.target.getStage().getPointerPosition();
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

      case 'text':
        const text = prompt('Enter text:');
        if (text) {
          addObject({
            type: 'text',
            position: { x: pos.x, y: pos.y },
            properties: {
              text,
              fontSize: 20,
              fill: '#2c3e50'
            }
          });
        }
        break;

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
  }, [tool, addObject, setSelectedObjects]);

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    const pos = e.target.getStage().getPointerPosition();

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

      case 'circle':
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
  }, [isDrawing, newObject, updateCursor]);

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
        height: window.innerHeight - 120
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ overflow: 'auto', width: '100%', height: '100%' }}>
      <Stage
        ref={stageRef}
        width={viewportSize.width}
        height={viewportSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
    </div>
  );
}
