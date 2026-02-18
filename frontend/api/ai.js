import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

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

    // Process tool calls
    const results = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await executeToolCall(block.name, block.input, boardId, user.id, supabaseAdmin);
        results.push({ tool: block.name, input: block.input, result });
      }
    }

    const textResponse = response.content.find(b => b.type === 'text')?.text
      || 'Done! Objects created successfully.';

    return res.status(200).json({
      success: true,
      message: textResponse,
      actions: results,
    });

  } catch (error) {
    console.error('AI command error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process AI command'
    });
  }
}
