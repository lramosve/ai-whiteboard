import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import { supabaseConfig } from '../config/supabase.js';
import { redisClient } from '../config/redis.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an AI assistant that helps users manipulate a collaborative whiteboard.

You can create shapes, text, and arrows using the provided tools. The board uses a pixel coordinate system with (0,0) at the top-left. The canvas is typically 1200x800 pixels.

When given a command:
1. Check the current board state if needed
2. Use tools to create or modify objects
3. Provide a brief, friendly description of what you did

Default to good design: align elements, use consistent spacing (80-150px), and choose harmonious colors.`;

const BOARD_TOOLS = [
  {
    name: 'create_rectangle',
    description: 'Create a rectangle on the whiteboard',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        width: { type: 'number', description: 'Width in pixels' },
        height: { type: 'number', description: 'Height in pixels' },
        fill: { type: 'string', description: 'Fill color hex', default: '#3498db' },
        stroke: { type: 'string', description: 'Border color hex', default: '#2980b9' },
        strokeWidth: { type: 'number', default: 2 },
        cornerRadius: { type: 'number', default: 0 }
      },
      required: ['x', 'y', 'width', 'height']
    }
  },
  {
    name: 'create_circle',
    description: 'Create a circle on the whiteboard',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Center X coordinate' },
        y: { type: 'number', description: 'Center Y coordinate' },
        radius: { type: 'number', description: 'Radius in pixels' },
        fill: { type: 'string', default: '#e74c3c' },
        stroke: { type: 'string', default: '#c0392b' },
        strokeWidth: { type: 'number', default: 2 }
      },
      required: ['x', 'y', 'radius']
    }
  },
  {
    name: 'create_text',
    description: 'Create a text element on the whiteboard',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        text: { type: 'string' },
        fontSize: { type: 'number', default: 18 },
        fill: { type: 'string', default: '#2c3e50' },
        fontStyle: { type: 'string', default: 'normal' },
        align: { type: 'string', default: 'left' }
      },
      required: ['x', 'y', 'text']
    }
  },
  {
    name: 'create_arrow',
    description: 'Create an arrow or connector between points',
    input_schema: {
      type: 'object',
      properties: {
        points: {
          type: 'array',
          description: 'Flat array of coordinates [x1, y1, x2, y2]',
          items: { type: 'number' }
        },
        stroke: { type: 'string', default: '#34495e' },
        strokeWidth: { type: 'number', default: 2 },
        pointerLength: { type: 'number', default: 10 },
        pointerWidth: { type: 'number', default: 10 }
      },
      required: ['points']
    }
  },
  {
    name: 'get_board_state',
    description: 'Get all current objects on the board',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional: filter by type (rectangle, circle, text, arrow)' }
      }
    }
  },
  {
    name: 'update_object',
    description: 'Update properties of an existing object',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' },
        updates: { type: 'object', description: 'Properties to update' }
      },
      required: ['objectId', 'updates']
    }
  },
  {
    name: 'delete_object',
    description: 'Delete an object from the board',
    input_schema: {
      type: 'object',
      properties: {
        objectId: { type: 'string' }
      },
      required: ['objectId']
    }
  }
];

export async function handleAICommand({ boardId, userId, command, io }) {
  const startTime = Date.now();

  try {
    const lockValue = await redisClient.acquireLock(boardId, 30000);
    if (!lockValue) {
      throw new Error('Another AI operation is in progress. Please wait.');
    }

    try {
      const boardState = await getBoardState(boardId);

      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Current board state:\n${JSON.stringify(boardState, null, 2)}\n\nUser command: ${command}`
        }],
        tools: BOARD_TOOLS
      });

      const results = await processToolCalls(response, boardId, userId, io);

      await supabaseConfig.createAICommand({
        boardId, userId, command,
        response: results,
        executionTimeMs: Date.now() - startTime,
      });

      const textResponse = response.content.find(b => b.type === 'text')?.text
        || 'Done! Objects created successfully.';

      return {
        success: true,
        message: textResponse,
        actions: results,
        executionTime: Date.now() - startTime
      };

    } finally {
      await redisClient.releaseLock(boardId, lockValue);
    }

  } catch (error) {
    logger.error('AI command error', { error: error.message, command, boardId });
    return { success: false, message: error.message || 'Failed to process command' };
  }
}

async function processToolCalls(response, boardId, userId, io) {
  const results = [];
  for (const block of response.content) {
    if (block.type === 'tool_use') {
      const result = await executeToolCall(block.name, block.input, boardId, userId, io);
      results.push({ tool: block.name, input: block.input, result });
    }
  }
  return results;
}

async function executeToolCall(toolName, input, boardId, userId, io) {
  logger.info(`AI tool: ${toolName}`, { boardId });

  switch (toolName) {
    case 'create_rectangle':
      return createShape('rectangle', {
        position: { x: input.x, y: input.y },
        properties: {
          width: input.width, height: input.height,
          fill: input.fill || '#3498db', stroke: input.stroke || '#2980b9',
          strokeWidth: input.strokeWidth || 2, cornerRadius: input.cornerRadius || 0
        }
      }, boardId, userId, io);

    case 'create_circle':
      return createShape('circle', {
        position: { x: input.x, y: input.y },
        properties: {
          radius: input.radius,
          fill: input.fill || '#e74c3c', stroke: input.stroke || '#c0392b',
          strokeWidth: input.strokeWidth || 2
        }
      }, boardId, userId, io);

    case 'create_text':
      return createShape('text', {
        position: { x: input.x, y: input.y },
        properties: {
          text: input.text, fontSize: input.fontSize || 18,
          fill: input.fill || '#2c3e50', fontStyle: input.fontStyle || 'normal',
          align: input.align || 'left'
        }
      }, boardId, userId, io);

    case 'create_arrow':
      return createShape('arrow', {
        position: { x: 0, y: 0 },
        properties: {
          points: input.points,
          stroke: input.stroke || '#34495e', strokeWidth: input.strokeWidth || 2,
          pointerLength: input.pointerLength || 10, pointerWidth: input.pointerWidth || 10
        }
      }, boardId, userId, io);

    case 'get_board_state':
      return getBoardState(boardId, input.filter);

    case 'update_object': {
      await supabaseConfig.updateObject(input.objectId, input.updates);
      io.to(`board:${boardId}`).emit('object_updated', {
        objectId: input.objectId, updates: input.updates, userId: 'ai_agent'
      });
      return { success: true };
    }

    case 'delete_object': {
      await supabaseConfig.deleteObject(input.objectId);
      io.to(`board:${boardId}`).emit('object_deleted', {
        objectId: input.objectId, userId: 'ai_agent'
      });
      return { success: true };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function createShape(objectType, { position, properties }, boardId, userId, io) {
  const object = await supabaseConfig.createObject({
    boardId, objectType, position, properties, createdBy: userId
  });
  io.to(`board:${boardId}`).emit('object_created', { object, userId: 'ai_agent' });
  return { success: true, objectId: object.id };
}

async function getBoardState(boardId, filter = null) {
  const objects = await supabaseConfig.getObjects(boardId);
  const filtered = filter ? objects.filter(o => o.objectType === filter) : objects;
  return {
    totalObjects: filtered.length,
    objects: filtered.map(o => ({
      id: o.id, type: o.objectType, position: o.position, properties: o.properties
    }))
  };
}
