-- Create enum: space_visibility
CREATE TYPE "space_visibility" AS ENUM ('protected', 'private');

-- Create enum: membership_role
CREATE TYPE "membership_role" AS ENUM ('owner', 'admin', 'editor', 'reader', 'guest');

-- Create enum: revision_status
CREATE TYPE "revision_status" AS ENUM ('draft', 'published');

-- Create enum: oauth_identity_provider
CREATE TYPE "oauth_identity_provider" AS ENUM ('google', 'github');

-- Create enum: session_state
CREATE TYPE "session_state" AS ENUM ('step1', 'full');

-- Create enum: login_attempt_kind
CREATE TYPE "login_attempt_kind" AS ENUM ('magic_request', 'magic_consume', 'oauth', 'totp');
