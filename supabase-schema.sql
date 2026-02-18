-- AI Whiteboard Database Schema for Supabase
-- Run this in Supabase SQL Editor: https://app.supabase.com → SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Boards table
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'Untitled Board',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board objects table
CREATE TABLE board_objects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  position JSONB NOT NULL,
  properties JSONB NOT NULL,
  layer_index INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Board collaborators table
CREATE TABLE board_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(board_id, user_id)
);

-- AI commands table
CREATE TABLE ai_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  command TEXT NOT NULL,
  response JSONB,
  execution_time_ms INTEGER,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users metadata table (extends auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX boards_owner_id_idx ON boards(owner_id);
CREATE INDEX board_objects_board_id_idx ON board_objects(board_id);
CREATE INDEX board_objects_layer_idx ON board_objects(board_id, layer_index);
CREATE INDEX board_collaborators_board_id_idx ON board_collaborators(board_id);
CREATE INDEX board_collaborators_user_id_idx ON board_collaborators(user_id);
CREATE INDEX ai_commands_board_id_idx ON ai_commands(board_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boards_updated_at BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER board_objects_updated_at BEFORE UPDATE ON board_objects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Boards policies
CREATE POLICY "Public boards are viewable by everyone"
  ON boards FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view their own boards"
  ON boards FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view boards they collaborate on"
  ON boards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_collaborators
      WHERE board_id = boards.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create boards"
  ON boards FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own boards"
  ON boards FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own boards"
  ON boards FOR DELETE
  USING (auth.uid() = owner_id);

-- Board objects policies
CREATE POLICY "Users can view objects on accessible boards"
  ON board_objects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_id
      AND (
        boards.is_public = true
        OR boards.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM board_collaborators
          WHERE board_id = boards.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Authenticated users can create objects"
  ON board_objects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update objects on accessible boards"
  ON board_objects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_id
      AND (
        boards.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM board_collaborators
          WHERE board_id = boards.id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'editor')
        )
      )
    )
  );

CREATE POLICY "Users can delete objects on accessible boards"
  ON board_objects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_id
      AND (
        boards.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM board_collaborators
          WHERE board_id = boards.id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'editor')
        )
      )
    )
  );

-- Collaborators policies
CREATE POLICY "Users can view collaborators on accessible boards"
  ON board_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_id
      AND (boards.owner_id = auth.uid() OR boards.is_public = true)
    )
  );

CREATE POLICY "Board owners can manage collaborators"
  ON board_collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_id AND boards.owner_id = auth.uid()
    )
  );

-- AI commands policies
CREATE POLICY "Users can view AI commands on accessible boards"
  ON ai_commands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE boards.id = board_id
      AND (boards.owner_id = auth.uid() OR boards.is_public = true)
    )
  );

CREATE POLICY "Authenticated users can create AI commands"
  ON ai_commands FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users policies
CREATE POLICY "Users can view all user profiles"
  ON users FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Database schema created successfully!';
  RAISE NOTICE 'Tables: boards, board_objects, board_collaborators, ai_commands, users';
  RAISE NOTICE 'RLS policies enabled for all tables';
  RAISE NOTICE 'Auto-trigger for user profile creation enabled';
END $$;
