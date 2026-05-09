-- Create enum: oauth_identity_provider
CREATE TYPE "oauth_identity_provider" AS ENUM ('google', 'github');

-- Create enum: session_state
CREATE TYPE "session_state" AS ENUM ('step1', 'full');

-- Create enum: login_attempt_kind
CREATE TYPE "login_attempt_kind" AS ENUM ('magic_request', 'magic_consume', 'oauth', 'totp');
