import { create } from 'zustand';
import { supabase } from '../services/supabase';

// Map snake_case DB row to camelCase frontend object
function mapObject(row) {
  if (!row) return null;
  return {
    id: row.id,
    boardId: row.board_id,
    type: row.object_type,
    position: row.position,
    properties: row.properties,
    layerIndex: row.layer_index,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const useWhiteboardStore = create((set, get) => ({
  // Board state
  boardId: null,
  objects: [],
  selectedObjectIds: [],
  tool: 'select',

  // Collaboration state
  users: {},
  cursors: {},

  // AI state
  aiProcessing: false,
  aiCommand: '',
  aiMessages: [],

  // Realtime channel
  _channel: null,
  _userId: null,
  _userName: null,
  connected: false,

  // Actions
  joinBoard: async (boardId) => {
    const { _channel: oldChannel } = get();
    if (oldChannel) {
      supabase.removeChannel(oldChannel);
    }

    set({ boardId, objects: [], users: {}, cursors: {}, connected: false });

    // Fetch initial objects
    const { data, error } = await supabase
      .from('board_objects')
      .select('*')
      .eq('board_id', boardId)
      .order('layer_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch board objects:', error);
    } else {
      set({ objects: (data || []).map(mapObject) });
    }

    // Set up Realtime channel
    const channel = supabase
      .channel(`board:${boardId}`)
      // Postgres Changes for object CRUD
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'board_objects',
          filter: `board_id=eq.${boardId}`
        },
        (payload) => {
          const newObj = mapObject(payload.new);
          set((state) => {
            // Deduplicate: skip if already exists (optimistic add)
            if (state.objects.some(o => o.id === newObj.id)) return state;
            return { objects: [...state.objects, newObj] };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'board_objects',
          filter: `board_id=eq.${boardId}`
        },
        (payload) => {
          const updated = mapObject(payload.new);
          set((state) => ({
            objects: state.objects.map(o =>
              o.id === updated.id ? updated : o
            )
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'board_objects',
          filter: `board_id=eq.${boardId}`
        },
        (payload) => {
          const deletedId = payload.old.id;
          set((state) => ({
            objects: state.objects.filter(o => o.id !== deletedId),
            selectedObjectIds: state.selectedObjectIds.filter(id => id !== deletedId)
          }));
        }
      )
      // Broadcast for cursors
      .on('broadcast', { event: 'cursor_move' }, ({ payload }) => {
        set((state) => ({
          cursors: {
            ...state.cursors,
            [payload.userId]: { x: payload.x, y: payload.y, userName: payload.userName }
          }
        }));
      })
      // Presence for user tracking
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users = {};
        Object.values(presenceState).forEach(presences => {
          presences.forEach(p => {
            users[p.userId] = { id: p.userId, name: p.userName, color: p.color };
          });
        });
        set({ users });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        set((state) => {
          const newCursors = { ...state.cursors };
          leftPresences.forEach(p => {
            delete newCursors[p.userId];
          });
          return { cursors: newCursors };
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence and cache user info for cursor broadcasts
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id || `anon_${Math.random().toString(36).slice(2, 8)}`;
          const userName = session?.user?.user_metadata?.display_name || 'Guest';
          const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
          const color = colors[Math.floor(Math.random() * colors.length)];
          set({ connected: true, _userId: userId, _userName: userName });
          channel.track({ userId, userName, color });
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          set({ connected: false });
        }
      });

    set({ _channel: channel });
  },

  leaveBoard: () => {
    const { _channel } = get();
    if (_channel) {
      supabase.removeChannel(_channel);
    }
    set({ _channel: null, boardId: null, objects: [], users: {}, cursors: {}, connected: false });
  },

  setTool: (tool) => set({ tool }),

  addObject: async (object) => {
    const { boardId } = get();
    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase
      .from('board_objects')
      .insert({
        board_id: boardId,
        object_type: object.type,
        position: object.position,
        properties: object.properties,
        layer_index: 0,
        created_by: session?.user?.id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create object:', error);
      return;
    }

    // Optimistic add (Realtime INSERT will deduplicate)
    set((state) => {
      if (state.objects.some(o => o.id === data.id)) return state;
      return { objects: [...state.objects, mapObject(data)] };
    });
  },

  updateObject: async (objectId, updates) => {
    // Optimistic update
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === objectId ? { ...obj, ...updates } : obj
      )
    }));

    // Build the DB update payload
    const dbUpdates = {};
    if (updates.position) dbUpdates.position = updates.position;
    if (updates.properties) dbUpdates.properties = updates.properties;

    const { error } = await supabase
      .from('board_objects')
      .update(dbUpdates)
      .eq('id', objectId);

    if (error) {
      console.error('Failed to update object:', error);
    }
  },

  deleteObject: async (objectId) => {
    // Optimistic delete
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== objectId),
      selectedObjectIds: state.selectedObjectIds.filter((id) => id !== objectId)
    }));

    const { error } = await supabase
      .from('board_objects')
      .delete()
      .eq('id', objectId);

    if (error) {
      console.error('Failed to delete object:', error);
    }
  },

  setSelectedObjects: (ids) => set({ selectedObjectIds: ids }),

  updateCursor: (position) => {
    const { _channel, _userId, _userName } = get();
    if (!_channel) return;
    _channel.send({
      type: 'broadcast',
      event: 'cursor_move',
      payload: { userId: _userId, userName: _userName, x: position.x, y: position.y },
    });
  },

  sendAICommand: async (command) => {
    const { boardId } = get();
    set({
      aiProcessing: true,
      aiCommand: command,
      aiMessages: [
        ...get().aiMessages,
        { type: 'processing', text: `Processing: ${command}`, timestamp: Date.now() }
      ]
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('You must be signed in to use AI commands');
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const res = await fetch(`${backendUrl}/api/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ boardId, command }),
      });

      const data = await res.json();

      set((state) => ({
        aiProcessing: false,
        aiMessages: [
          ...state.aiMessages,
          {
            type: data.success ? 'success' : 'error',
            text: data.message,
            actions: data.actions,
            timestamp: Date.now()
          }
        ]
      }));
    } catch (error) {
      set((state) => ({
        aiProcessing: false,
        aiMessages: [
          ...state.aiMessages,
          { type: 'error', text: error.message || 'Failed to process AI command', timestamp: Date.now() }
        ]
      }));
    }
  },
}));
