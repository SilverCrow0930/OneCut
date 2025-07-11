-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create an enum for subscription types
CREATE TYPE subscription_type AS ENUM (
    'free',
    'editor-plus-credits',
    'enterprise'
);

-- Create an enum for subscription status
CREATE TYPE subscription_status AS ENUM (
    'active',
    'cancelled',
    'expired',
    'past_due',
    'incomplete',
    'incomplete_expired'
);

-- Create the user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    -- Primary key and identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Subscription details
    subscription_type subscription_type NOT NULL DEFAULT 'free',
    plan_name VARCHAR(100) NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    
    -- Resource limits
    max_credits INTEGER NOT NULL DEFAULT 0,
    max_ai_chats INTEGER NOT NULL DEFAULT 0,
    
    -- Stripe integration fields
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    
    -- Status and timestamps
    status subscription_status NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Standard timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    CONSTRAINT fk_user_subscriptions_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Create the user_credits table for tracking credit usage
CREATE TABLE IF NOT EXISTS user_credits (
    -- Primary key and identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    
    -- Credit tracking
    credits_used INTEGER NOT NULL DEFAULT 0,
    credits_remaining INTEGER NOT NULL DEFAULT 0,
    total_credits INTEGER NOT NULL DEFAULT 0,
    
    -- Reset tracking
    last_reset_at TIMESTAMP WITH TIME ZONE,
    next_reset_at TIMESTAMP WITH TIME ZONE,
    
    -- Standard timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    CONSTRAINT fk_user_credits_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_user_credits_subscription 
        FOREIGN KEY (subscription_id) 
        REFERENCES user_subscriptions(id) 
        ON DELETE CASCADE
);

-- Create credit usage history table
CREATE TABLE IF NOT EXISTS credit_usage_history (
    -- Primary key and identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    
    -- Usage details
    credits_used INTEGER NOT NULL,
    feature_type VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Standard timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    CONSTRAINT fk_credit_usage_history_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_credit_usage_history_subscription 
        FOREIGN KEY (subscription_id) 
        REFERENCES user_subscriptions(id) 
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_subscription_id ON user_subscriptions(stripe_subscription_id);
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX idx_user_credits_subscription_id ON user_credits(subscription_id);

CREATE INDEX idx_credit_usage_history_user_id ON credit_usage_history(user_id);
CREATE INDEX idx_credit_usage_history_subscription_id ON credit_usage_history(subscription_id);
CREATE INDEX idx_credit_usage_history_created_at ON credit_usage_history(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle subscription changes
CREATE OR REPLACE FUNCTION handle_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a new subscription or status changed to active
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'active' AND NEW.status = 'active')) THEN
        -- Create or update user_credits entry
        INSERT INTO user_credits (
            user_id,
            subscription_id,
            credits_remaining,
            total_credits,
            last_reset_at,
            next_reset_at
        ) VALUES (
            NEW.user_id,
            NEW.id,
            NEW.max_credits,
            NEW.max_credits,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP + INTERVAL '1 month'
        )
        ON CONFLICT (user_id) DO UPDATE SET
            subscription_id = EXCLUDED.subscription_id,
            credits_remaining = EXCLUDED.credits_remaining,
            total_credits = EXCLUDED.total_credits,
            last_reset_at = EXCLUDED.last_reset_at,
            next_reset_at = EXCLUDED.next_reset_at;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for subscription changes
CREATE TRIGGER handle_subscription_change_trigger
    AFTER INSERT OR UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION handle_subscription_change();

-- Create function to reset credits monthly
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
    UPDATE user_credits
    SET 
        credits_remaining = total_credits,
        credits_used = 0,
        last_reset_at = CURRENT_TIMESTAMP,
        next_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 month'
    WHERE 
        next_reset_at <= CURRENT_TIMESTAMP
        AND subscription_id IN (
            SELECT id 
            FROM user_subscriptions 
            WHERE status = 'active'
        );
END;
$$ language 'plpgsql';

-- Add some helpful comments
COMMENT ON TABLE user_subscriptions IS 'Stores user subscription information including Stripe integration details';
COMMENT ON TABLE user_credits IS 'Tracks credit usage and limits for each user subscription';
COMMENT ON TABLE credit_usage_history IS 'Historical record of credit usage by feature'; 