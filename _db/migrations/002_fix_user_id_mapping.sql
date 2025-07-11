-- Fix user ID mapping in subscriptions system
ALTER TABLE user_subscriptions ADD COLUMN auth_id UUID;

-- Update auth_id column from users table
UPDATE user_subscriptions us
SET auth_id = u.auth_id
FROM users u
WHERE us.user_id = u.id;

-- Add not null constraint after data is migrated
ALTER TABLE user_subscriptions ALTER COLUMN auth_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_user_subscriptions_auth_id ON user_subscriptions(auth_id);

-- Add foreign key constraint to users table auth_id
ALTER TABLE user_subscriptions
ADD CONSTRAINT fk_user_subscriptions_auth_id
FOREIGN KEY (auth_id) REFERENCES users(auth_id); 