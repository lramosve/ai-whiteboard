import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

class SupabaseConfig {
  constructor() {
    this.client = null;
    this.adminClient = null;
  }

  async initialize() {
    try {
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing required Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY');
      }

      // Public client (for auth)
      this.client = createClient(supabaseUrl, supabaseAnonKey);

      // Admin client (for bypassing RLS)
      if (supabaseServiceKey) {
        this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        logger.info('Supabase initialized with admin client');
      } else {
        this.adminClient = this.client;
        logger.warn('No SUPABASE_SERVICE_ROLE_KEY provided, using anon client (RLS will be enforced)');
      }

      logger.info('Supabase initialized successfully');
    } catch (error) {
      logger.error('Supabase initialization failed', error);
      throw error;
    }
  }

  // Board operations
  async createBoard(boardData) {
    const board = {
      name: boardData.name || 'Untitled Board',
      owner_id: boardData.ownerId,
      settings: boardData.settings || {},
      is_public: boardData.isPublic || false,
    };

    const { data, error } = await this.adminClient
      .from('boards')
      .insert(board)
      .select()
      .single();

    if (error) throw error;
    return this.mapBoard(data);
  }

  async getBoard(boardId) {
    const { data, error } = await this.adminClient
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return this.mapBoard(data);
  }

  async updateBoard(boardId, updates) {
    const { error } = await this.adminClient
      .from('boards')
      .update(updates)
      .eq('id', boardId);

    if (error) throw error;
  }

  async deleteBoard(boardId) {
    // Delete related objects first
    await this.adminClient
      .from('board_objects')
      .delete()
      .eq('board_id', boardId);

    // Delete board
    const { error } = await this.adminClient
      .from('boards')
      .delete()
      .eq('id', boardId);

    if (error) throw error;
  }

  // Object operations
  async createObject(objectData) {
    const object = {
      board_id: objectData.boardId,
      object_type: objectData.objectType,
      position: objectData.position,
      properties: objectData.properties,
      layer_index: objectData.layerIndex || 0,
      created_by: objectData.createdBy,
    };

    const { data, error } = await this.adminClient
      .from('board_objects')
      .insert(object)
      .select()
      .single();

    if (error) throw error;
    return this.mapObject(data);
  }

  async getObjects(boardId) {
    const { data, error } = await this.adminClient
      .from('board_objects')
      .select('*')
      .eq('board_id', boardId)
      .order('layer_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(obj => this.mapObject(obj));
  }

  async updateObject(objectId, updates) {
    const { error } = await this.adminClient
      .from('board_objects')
      .update(updates)
      .eq('id', objectId);

    if (error) throw error;
  }

  async deleteObject(objectId) {
    const { error } = await this.adminClient
      .from('board_objects')
      .delete()
      .eq('id', objectId);

    if (error) throw error;
  }

  async getBoardsByOwner(userId) {
    const { data, error } = await this.adminClient
      .from('boards')
      .select('*')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data.map(b => ({ ...this.mapBoard(b), role: 'owner' }));
  }

  async getBoardsByCollaborator(userId) {
    const { data, error } = await this.adminClient
      .from('board_collaborators')
      .select('board_id, role, boards(*)')
      .eq('user_id', userId);

    if (error) throw error;
    return data.map(row => ({
      ...this.mapBoard(row.boards),
      role: row.role || 'collaborator',
    }));
  }

  // Collaborator operations
  async addCollaborator(boardId, userId, role = 'editor') {
    const { data, error } = await this.adminClient
      .from('board_collaborators')
      .insert({
        board_id: boardId,
        user_id: userId,
        role,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapCollaborator(data);
  }

  async getCollaborators(boardId) {
    const { data, error } = await this.adminClient
      .from('board_collaborators')
      .select('*')
      .eq('board_id', boardId);

    if (error) throw error;
    return data.map(collab => this.mapCollaborator(collab));
  }

  async removeCollaborator(boardId, userId) {
    const { error } = await this.adminClient
      .from('board_collaborators')
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  // AI command operations
  async createAICommand(commandData) {
    const { data, error } = await this.adminClient
      .from('ai_commands')
      .insert({
        board_id: commandData.boardId,
        user_id: commandData.userId,
        command: commandData.command,
        response: commandData.response,
        execution_time_ms: commandData.executionTimeMs,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapAICommand(data);
  }

  async getAICommands(boardId, limit = 50) {
    const { data, error } = await this.adminClient
      .from('ai_commands')
      .select('*')
      .eq('board_id', boardId)
      .order('executed_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map(cmd => this.mapAICommand(cmd));
  }

  // User operations
  async createUser(userData) {
    const { data, error } = await this.client.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          display_name: userData.displayName,
        }
      }
    });

    if (error) throw error;

    return {
      uid: data.user.id,
      email: data.user.email,
      displayName: userData.displayName,
    };
  }

  async getUser(uid) {
    const { data, error } = await this.adminClient
      .from('users')
      .select('*')
      .eq('id', uid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return {
      uid: data.id,
      email: data.email,
      displayName: data.raw_user_meta_data?.display_name || data.email,
    };
  }

  async updateUserLastLogin(uid) {
    const { error } = await this.adminClient
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', uid);

    if (error) {
      // User might not exist in users table yet, that's okay
      logger.debug('Could not update last login', { uid, error: error.message });
    }
  }

  async verifyIdToken(token) {
    const { data, error } = await this.client.auth.getUser(token);

    if (error) throw error;

    await this.updateUserLastLogin(data.user.id);

    return {
      uid: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.display_name || data.user.email,
    };
  }

  // Real-time subscriptions
  subscribeToBoard(boardId, callback) {
    const channel = this.client
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'boards',
          filter: `id=eq.${boardId}`
        },
        (payload) => {
          callback(this.mapBoard(payload.new));
        }
      )
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  }

  subscribeToBoardObjects(boardId, callback) {
    const channel = this.client
      .channel(`board_objects:${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_objects',
          filter: `board_id=eq.${boardId}`
        },
        async () => {
          // Re-fetch all objects when any change occurs
          const objects = await this.getObjects(boardId);
          callback(objects);
        }
      )
      .subscribe();

    return () => {
      this.client.removeChannel(channel);
    };
  }

  // Mapping functions (convert snake_case to camelCase)
  mapBoard(data) {
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      ownerId: data.owner_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      settings: data.settings,
      isPublic: data.is_public,
    };
  }

  mapObject(data) {
    if (!data) return null;
    return {
      id: data.id,
      boardId: data.board_id,
      objectType: data.object_type,
      position: data.position,
      properties: data.properties,
      layerIndex: data.layer_index,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  mapCollaborator(data) {
    if (!data) return null;
    return {
      id: data.id,
      boardId: data.board_id,
      userId: data.user_id,
      role: data.role,
      joinedAt: data.joined_at,
    };
  }

  mapAICommand(data) {
    if (!data) return null;
    return {
      id: data.id,
      boardId: data.board_id,
      userId: data.user_id,
      command: data.command,
      response: data.response,
      executionTimeMs: data.execution_time_ms,
      executedAt: data.executed_at,
    };
  }
}

export const supabaseConfig = new SupabaseConfig();
