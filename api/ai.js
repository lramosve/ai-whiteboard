import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const MAX_TOOL_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are an AI assistant that helps users manipulate a collaborative whiteboard.

You can create shapes, text, sticky notes, frames, connectors, and arrows using the provided tools. The board uses a pixel coordinate system with (0,0) at the top-left. The canvas is typically 1200x800 pixels.

When given a command:
1. Check the current board state if needed
2. Use tools to create or modify objects
3. Provide a brief, friendly description of what you did

Default to good design: align elements, use consistent spacing (80-150px), and choose harmonious colors.
For sticky notes, use warm colors like #FFFACD (lemon), #FFE4B5 (moccasin), #FFB6C1 (light pink), #98FB98 (pale green), #87CEEB (sky blue).
For frames, use subtle borders to group related elements.`;

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
    name: 'create_sticky_note',
    description: 'Create a sticky note with editable text on the whiteboard',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        text: { type: 'string', description: 'Text content of the sticky note' },
        color: { type: 'string', description: 'Background color hex', default: '#FFFACD' },
        width: { type: 'number', description: 'Width in pixels', default: 200 },
        height: { type: 'number', description: 'Height in pixels', default: 200 },
        fontSize: { type: 'number', default: 16 }
      },
      required: ['x', 'y', 'text']
    }
  },
  {
    name: 'create_frame',
    description: 'Create a frame to group and label related elements on the whiteboard',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
        width: { type: 'number', description: 'Width in pixels' },
        height: { type: 'number', description: 'Height in pixels' },
        title: { type: 'string', description: 'Frame title label' },
        stroke: { type: 'string', description: 'Border color hex', default: '#95a5a6' },
        strokeWidth: { type: 'number', default: 2 },
        fill: { type: 'string', description: 'Background fill (use transparent or very light)', default: 'rgba(0,0,0,0.02)' }
      },
      required: ['x', 'y', 'width', 'height', 'title']
    }
  },
  {
    name: 'create_connector',
    description: 'Create a connector line between two existing objects by their IDs',
    input_schema: {
      type: 'object',
      properties: {
        fromId: { type: 'string', description: 'ID of the source object' },
        toId: { type: 'string', description: 'ID of the target object' },
        stroke: { type: 'string', default: '#7f8c8d' },
        strokeWidth: { type: 'number', default: 2 },
        dash: {
          type: 'array',
          description: 'Dash pattern, e.g. [10, 5] for dashed line',
          items: { type: 'number' }
        }
      },
      required: ['fromId', 'toId']
    }
  },
  {
    name: 'get_board_state',
    description: 'Get all current objects on the board',
    input_schema: {
      type: 'object',
      properties: {
        filter: { type: 'string', description: 'Optional: filter by type (rectangle, circle, text, arrow, sticky_note, frame, connector)' }
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

function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getBoardState(supabaseAdmin, boardId, filter = null) {
  const { data, error } = await supabaseAdmin
    .from('board_objects')
    .select('*')
    .eq('board_id', boardId)
    .order('layer_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  const objects = data.map(o => ({
    id: o.id,
    type: o.object_type,
    position: o.position,
    properties: o.properties
  }));

  const filtered = filter ? objects.filter(o => o.type === filter) : objects;
  return { totalObjects: filtered.length, objects: filtered };
}

async function executeToolCall(toolName, input, boardId, userId, supabaseAdmin) {
  switch (toolName) {
    case 'create_rectangle':
      return createShape(supabaseAdmin, 'rectangle', {
        position: { x: input.x, y: input.y },
        properties: {
          width: input.width, height: input.height,
          fill: input.fill || '#3498db', stroke: input.stroke || '#2980b9',
          strokeWidth: input.strokeWidth || 2, cornerRadius: input.cornerRadius || 0
        }
      }, boardId, userId);

    case 'create_circle':
      return createShape(supabaseAdmin, 'circle', {
        position: { x: input.x, y: input.y },
        properties: {
          radius: input.radius,
          fill: input.fill || '#e74c3c', stroke: input.stroke || '#c0392b',
          strokeWidth: input.strokeWidth || 2
        }
      }, boardId, userId);

    case 'create_text':
      return createShape(supabaseAdmin, 'text', {
        position: { x: input.x, y: input.y },
        properties: {
          text: input.text, fontSize: input.fontSize || 18,
          fill: input.fill || '#2c3e50', fontStyle: input.fontStyle || 'normal',
          align: input.align || 'left'
        }
      }, boardId, userId);

    case 'create_arrow':
      return createShape(supabaseAdmin, 'arrow', {
        position: { x: 0, y: 0 },
        properties: {
          points: input.points,
          stroke: input.stroke || '#34495e', strokeWidth: input.strokeWidth || 2,
          pointerLength: input.pointerLength || 10, pointerWidth: input.pointerWidth || 10
        }
      }, boardId, userId);

    case 'create_sticky_note':
      return createShape(supabaseAdmin, 'sticky_note', {
        position: { x: input.x, y: input.y },
        properties: {
          text: input.text,
          color: input.color || '#FFFACD',
          width: input.width || 200,
          height: input.height || 200,
          fontSize: input.fontSize || 16
        }
      }, boardId, userId);

    case 'create_frame':
      return createShape(supabaseAdmin, 'frame', {
        position: { x: input.x, y: input.y },
        properties: {
          width: input.width, height: input.height,
          title: input.title,
          stroke: input.stroke || '#95a5a6',
          strokeWidth: input.strokeWidth || 2,
          fill: input.fill || 'rgba(0,0,0,0.02)'
        }
      }, boardId, userId);

    case 'create_connector':
      return createShape(supabaseAdmin, 'connector', {
        position: { x: 0, y: 0 },
        properties: {
          fromId: input.fromId,
          toId: input.toId,
          stroke: input.stroke || '#7f8c8d',
          strokeWidth: input.strokeWidth || 2,
          dash: input.dash || []
        }
      }, boardId, userId);

    case 'get_board_state':
      return getBoardState(supabaseAdmin, boardId, input.filter);

    case 'update_object': {
      const { error } = await supabaseAdmin
        .from('board_objects')
        .update(input.updates)
        .eq('id', input.objectId);
      if (error) throw error;
      return { success: true };
    }

    case 'delete_object': {
      const { error } = await supabaseAdmin
        .from('board_objects')
        .delete()
        .eq('id', input.objectId);
      if (error) throw error;
      return { success: true };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function createShape(supabaseAdmin, objectType, { position, properties }, boardId, userId) {
  const { data, error } = await supabaseAdmin
    .from('board_objects')
    .insert({
      board_id: boardId,
      object_type: objectType,
      position,
      properties,
      layer_index: 0,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, objectId: data.id };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const token = authHeader.slice(7);
    const supabaseAdmin = getSupabaseAdmin();

    // Verify JWT
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { boardId, command } = req.body;
    if (!boardId || !command) {
      return res.status(400).json({ error: 'Missing boardId or command' });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const boardState = await getBoardState(supabaseAdmin, boardId);

    // Multi-turn tool use loop
    let messages = [{
      role: 'user',
      content: `Current board state:\n${JSON.stringify(boardState, null, 2)}\n\nUser command: ${command}`
    }];

    const allResults = [];
    let lastTextResponse = '';

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools: BOARD_TOOLS
      });

      // Extract text response
      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock) {
        lastTextResponse = textBlock.text;
      }

      // Find tool use blocks
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

      if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
        break;
      }

      // Execute tool calls and build tool results
      const toolResults = [];
      for (const block of toolUseBlocks) {
        const result = await executeToolCall(block.name, block.input, boardId, user.id, supabaseAdmin);
        allResults.push({ tool: block.name, input: block.input, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result)
        });
      }

      // If stop_reason is not "tool_use", we're done
      if (response.stop_reason !== 'tool_use') {
        break;
      }

      // Add assistant response and tool results for next iteration
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }

    return res.status(200).json({
      success: true,
      message: lastTextResponse || 'Done! Objects created successfully.',
      actions: allResults,
    });

  } catch (error) {
    console.error('AI command error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process AI command'
    });
  }
}
