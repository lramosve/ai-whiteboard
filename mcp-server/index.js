#!/usr/bin/env node

/**
 * AI Whiteboard MCP Server
 * 
 * This MCP server allows AI assistants to interact with the whiteboard
 * through a standardized protocol, enabling:
 * - Creating shapes, text, and diagrams
 * - Querying board state
 * - Manipulating existing objects
 * - Real-time collaboration features
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { io } from 'socket.io-client';
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const DEFAULT_BOARD_ID = process.env.DEFAULT_BOARD_ID || 'mcp-board';

class WhiteboardMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'whiteboard-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.socket = null;
    this.boardState = [];
    this.setupSocketConnection();
    this.setupHandlers();
  }

  setupSocketConnection() {
    this.socket = io(BACKEND_URL, {
      auth: {
        userId: 'mcp-server',
        userName: 'MCP Server',
      },
    });

    this.socket.on('connect', () => {
      console.error('Connected to whiteboard backend');
      this.socket.emit('join_board', { boardId: DEFAULT_BOARD_ID });
    });

    this.socket.on('board_state', ({ objects }) => {
      this.boardState = objects;
      console.error(`Board state updated: ${objects.length} objects`);
    });

    this.socket.on('object_created', ({ object }) => {
      this.boardState.push(object);
    });

    this.socket.on('object_updated', ({ objectId, updates }) => {
      const index = this.boardState.findIndex(obj => obj.id === objectId);
      if (index !== -1) {
        this.boardState[index] = { ...this.boardState[index], ...updates };
      }
    });

    this.socket.on('object_deleted', ({ objectId }) => {
      this.boardState = this.boardState.filter(obj => obj.id !== objectId);
    });
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_shape',
          description: 'Create a shape on the whiteboard (rectangle, circle, triangle)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['rectangle', 'circle'],
                description: 'Type of shape to create',
              },
              x: { type: 'number', description: 'X coordinate' },
              y: { type: 'number', description: 'Y coordinate' },
              width: { type: 'number', description: 'Width (for rectangle)' },
              height: { type: 'number', description: 'Height (for rectangle)' },
              radius: { type: 'number', description: 'Radius (for circle)' },
              fill: { type: 'string', description: 'Fill color', default: '#3498db' },
              stroke: { type: 'string', description: 'Border color', default: '#2980b9' },
            },
            required: ['type', 'x', 'y'],
          },
        },
        {
          name: 'create_text',
          description: 'Create a text element on the whiteboard',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Text content' },
              x: { type: 'number', description: 'X coordinate' },
              y: { type: 'number', description: 'Y coordinate' },
              fontSize: { type: 'number', description: 'Font size', default: 20 },
              fill: { type: 'string', description: 'Text color', default: '#2c3e50' },
            },
            required: ['text', 'x', 'y'],
          },
        },
        {
          name: 'create_arrow',
          description: 'Create an arrow connecting two points',
          inputSchema: {
            type: 'object',
            properties: {
              x1: { type: 'number', description: 'Start X coordinate' },
              y1: { type: 'number', description: 'Start Y coordinate' },
              x2: { type: 'number', description: 'End X coordinate' },
              y2: { type: 'number', description: 'End Y coordinate' },
              stroke: { type: 'string', description: 'Arrow color', default: '#34495e' },
            },
            required: ['x1', 'y1', 'x2', 'y2'],
          },
        },
        {
          name: 'get_board_state',
          description: 'Get the current state of all objects on the whiteboard',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter by object type',
              },
            },
          },
        },
        {
          name: 'update_object',
          description: 'Update properties of an existing object',
          inputSchema: {
            type: 'object',
            properties: {
              objectId: { type: 'string', description: 'ID of object to update' },
              x: { type: 'number', description: 'New X coordinate' },
              y: { type: 'number', description: 'New Y coordinate' },
              fill: { type: 'string', description: 'New fill color' },
              stroke: { type: 'string', description: 'New stroke color' },
            },
            required: ['objectId'],
          },
        },
        {
          name: 'delete_object',
          description: 'Delete an object from the whiteboard',
          inputSchema: {
            type: 'object',
            properties: {
              objectId: { type: 'string', description: 'ID of object to delete' },
            },
            required: ['objectId'],
          },
        },
        {
          name: 'create_diagram',
          description: 'Create a complete diagram (flowchart, org chart, mind map)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['flowchart', 'mindmap', 'orgchart'],
                description: 'Type of diagram',
              },
              nodes: {
                type: 'array',
                description: 'Array of node labels',
                items: { type: 'string' },
              },
              startX: { type: 'number', description: 'Starting X coordinate', default: 100 },
              startY: { type: 'number', description: 'Starting Y coordinate', default: 100 },
            },
            required: ['type', 'nodes'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_shape':
            return await this.createShape(args);
          case 'create_text':
            return await this.createText(args);
          case 'create_arrow':
            return await this.createArrow(args);
          case 'get_board_state':
            return await this.getBoardState(args);
          case 'update_object':
            return await this.updateObject(args);
          case 'delete_object':
            return await this.deleteObject(args);
          case 'create_diagram':
            return await this.createDiagram(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async createShape(args) {
    return new Promise((resolve) => {
      const object = {
        type: args.type,
        position: { x: args.x, y: args.y },
        properties: {
          ...(args.type === 'rectangle' && {
            width: args.width || 100,
            height: args.height || 100,
          }),
          ...(args.type === 'circle' && {
            radius: args.radius || 50,
          }),
          fill: args.fill || '#3498db',
          stroke: args.stroke || '#2980b9',
          strokeWidth: 2,
        },
      };

      this.socket.emit('create_object', {
        boardId: DEFAULT_BOARD_ID,
        object,
      });

      setTimeout(() => {
        resolve({
          content: [
            {
              type: 'text',
              text: `Created ${args.type} at (${args.x}, ${args.y})`,
            },
          ],
        });
      }, 100);
    });
  }

  async createText(args) {
    return new Promise((resolve) => {
      const object = {
        type: 'text',
        position: { x: args.x, y: args.y },
        properties: {
          text: args.text,
          fontSize: args.fontSize || 20,
          fill: args.fill || '#2c3e50',
          fontFamily: 'Arial',
        },
      };

      this.socket.emit('create_object', {
        boardId: DEFAULT_BOARD_ID,
        object,
      });

      setTimeout(() => {
        resolve({
          content: [
            {
              type: 'text',
              text: `Created text "${args.text}" at (${args.x}, ${args.y})`,
            },
          ],
        });
      }, 100);
    });
  }

  async createArrow(args) {
    return new Promise((resolve) => {
      const object = {
        type: 'arrow',
        position: { x: 0, y: 0 },
        properties: {
          points: [args.x1, args.y1, args.x2, args.y2],
          stroke: args.stroke || '#34495e',
          strokeWidth: 3,
          pointerLength: 10,
          pointerWidth: 10,
        },
      };

      this.socket.emit('create_object', {
        boardId: DEFAULT_BOARD_ID,
        object,
      });

      setTimeout(() => {
        resolve({
          content: [
            {
              type: 'text',
              text: `Created arrow from (${args.x1}, ${args.y1}) to (${args.x2}, ${args.y2})`,
            },
          ],
        });
      }, 100);
    });
  }

  async getBoardState(args) {
    let objects = this.boardState;

    if (args.filter) {
      objects = objects.filter((obj) => obj.object_type === args.filter);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              totalObjects: objects.length,
              objects: objects.map((obj) => ({
                id: obj.id,
                type: obj.object_type,
                position: obj.position,
                properties: obj.properties,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async updateObject(args) {
    return new Promise((resolve) => {
      const updates = {
        ...(args.x !== undefined && { position: { x: args.x, y: args.y || 0 } }),
        ...(args.fill && { properties: { fill: args.fill } }),
        ...(args.stroke && { properties: { stroke: args.stroke } }),
      };

      this.socket.emit('update_object', {
        boardId: DEFAULT_BOARD_ID,
        objectId: args.objectId,
        updates,
      });

      setTimeout(() => {
        resolve({
          content: [
            {
              type: 'text',
              text: `Updated object ${args.objectId}`,
            },
          ],
        });
      }, 100);
    });
  }

  async deleteObject(args) {
    return new Promise((resolve) => {
      this.socket.emit('delete_object', {
        boardId: DEFAULT_BOARD_ID,
        objectId: args.objectId,
      });

      setTimeout(() => {
        resolve({
          content: [
            {
              type: 'text',
              text: `Deleted object ${args.objectId}`,
            },
          ],
        });
      }, 100);
    });
  }

  async createDiagram(args) {
    const { type, nodes, startX = 100, startY = 100 } = args;
    const spacing = 150;
    const createdObjects = [];

    for (let i = 0; i < nodes.length; i++) {
      // Create node
      await this.createShape({
        type: 'rectangle',
        x: startX,
        y: startY + i * spacing,
        width: 200,
        height: 80,
        fill: '#3498db',
        stroke: '#2980b9',
      });

      // Create label
      await this.createText({
        text: nodes[i],
        x: startX + 100,
        y: startY + i * spacing + 40,
        fontSize: 16,
        fill: '#ffffff',
      });

      // Create connector to next node
      if (i < nodes.length - 1) {
        await this.createArrow({
          x1: startX + 100,
          y1: startY + i * spacing + 80,
          x2: startX + 100,
          y2: startY + (i + 1) * spacing,
          stroke: '#34495e',
        });
      }

      createdObjects.push(nodes[i]);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Created ${type} with ${nodes.length} nodes: ${createdObjects.join(', ')}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Whiteboard MCP server running on stdio');
  }
}

const server = new WhiteboardMCPServer();
server.run().catch(console.error);
