-- AMP parent accounts (Better Auth 1.7): users, sessions, linked sign-in
-- methods (password, Google, Apple, Microsoft, GitHub), email verification and
-- reset tokens, TOTP two-factor and passkeys. Generated from the server's
-- configuration (src/server/accounts.ts); column names are Better Auth's.
-- An AMP account id is 'amp|' || amp_auth_users.id.
create table "amp_auth_users" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "twoFactorEnabled" boolean);
create table "amp_auth_sessions" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "amp_auth_users" ("id") on delete cascade);
create table "amp_auth_accounts" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "amp_auth_users" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);
create table "amp_auth_verifications" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
create table "amp_auth_two_factors" ("id" text not null primary key, "secret" text not null, "backupCodes" text not null, "userId" text not null references "amp_auth_users" ("id") on delete cascade, "verified" boolean, "failedVerificationCount" integer, "lockedUntil" timestamptz);
create table "amp_auth_passkeys" ("id" text not null primary key, "name" text, "publicKey" text not null, "userId" text not null references "amp_auth_users" ("id") on delete cascade, "credentialID" text not null, "counter" integer not null, "deviceType" text not null, "backedUp" boolean not null, "transports" text, "createdAt" timestamptz, "aaguid" text);
create index "amp_auth_sessions_userId_idx" on "amp_auth_sessions" ("userId");
create index "amp_auth_accounts_userId_idx" on "amp_auth_accounts" ("userId");
create index "amp_auth_verifications_identifier_idx" on "amp_auth_verifications" ("identifier");
create index "amp_auth_two_factors_secret_idx" on "amp_auth_two_factors" ("secret");
create index "amp_auth_two_factors_userId_idx" on "amp_auth_two_factors" ("userId");
create index "amp_auth_passkeys_userId_idx" on "amp_auth_passkeys" ("userId");
create index "amp_auth_passkeys_credentialID_idx" on "amp_auth_passkeys" ("credentialID");
-- One provider identity belongs to exactly one parent account.
create unique index "amp_auth_accounts_provider_identity" on "amp_auth_accounts" ("providerId", "accountId");
