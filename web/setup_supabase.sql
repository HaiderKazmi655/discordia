-- Run this script in your Supabase SQL Editor

-- 1. Enable UUID extension (optional but recommended)
create extension if not exists "uuid-ossp";
-- Count total users
SELECT COUNT(*) FROM users;

-- Get all usernames
SELECT username FROM users;




-- 2. Create Users table
create table if not exists users (
  username text primary key,
  "displayName" text,
  "passwordHash" text,
  salt text,
  avatar text,
  online boolean default false
);

-- 3. Create Friend Requests table
create table if not exists friend_requests (
  id uuid default uuid_generate_v4() primary key,
  "from" text references users(username),
  "to" text references users(username),
  status text check (status in ('pending', 'accepted', 'declined')),
  created_at timestamp with time zone default now()
);

-- 4. Create DMs table
create table if not exists dms (
  id uuid default uuid_generate_v4() primary key,
  pair_a text,
  pair_b text,
  "user" text references users(username),
  text text,
  time bigint
);

-- 5. Create Server Messages table
create table if not exists messages (
  id uuid default uuid_generate_v4() primary key,
  channel_id text,
  user_id text,
  username text,
  content text,
  created_at timestamp with time zone default now()
);

-- 6. Create Servers table
create table if not exists servers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  icon_url text,
  owner_id text references users(username),
  created_at timestamp with time zone default now()
);

-- 7. Create Channels table
create table if not exists channels (
  id uuid default uuid_generate_v4() primary key,
  server_id uuid references servers(id) on delete cascade,
  name text not null,
  type text check (type in ('text', 'voice')),
  created_at timestamp with time zone default now()
);

-- 8. Create Server Members table
create table if not exists server_members (
  id uuid default uuid_generate_v4() primary key,
  server_id uuid references servers(id) on delete cascade,
  user_id text references users(username) on delete cascade,
  joined_at timestamp with time zone default now(),
  unique(server_id, user_id)
);

-- 9. Enable Realtime for these tables
alter publication supabase_realtime add table friend_requests;
alter publication supabase_realtime add table dms;
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table servers;
alter publication supabase_realtime add table channels;
alter publication supabase_realtime add table server_members;

-- 10. (Optional) Disable Row Level Security (RLS) for public access during development
-- WARNING: For production, you should enable RLS and write proper policies.
alter table users disable row level security;
alter table friend_requests disable row level security;
alter table dms disable row level security;
alter table messages disable row level security;
alter table servers disable row level security;
alter table channels disable row level security;
alter table server_members disable row level security;

-- 11. Indexes for performance
create index if not exists idx_friend_requests_to_status on friend_requests("to", status);
create index if not exists idx_friend_requests_from_status on friend_requests("from", status);
create index if not exists idx_friend_requests_created_at on friend_requests(created_at);

create index if not exists idx_dms_pairs on dms(pair_a, pair_b);
create index if not exists idx_dms_time on dms(time);

create index if not exists idx_messages_channel on messages(channel_id);
create index if not exists idx_messages_created_at on messages(created_at);

create index if not exists idx_channels_server on channels(server_id);
create index if not exists idx_channels_type on channels(type);
create unique index if not exists uniq_channels_server_name on channels(server_id, name);

create index if not exists idx_server_members_server on server_members(server_id);
create index if not exists idx_server_members_user on server_members(user_id);

-- 12. Server invites
create table if not exists server_invites (
  code uuid default uuid_generate_v4() primary key,
  server_id uuid references servers(id) on delete cascade,
  created_by text references users(username),
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone
);
alter publication supabase_realtime add table server_invites;
