import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function deployLoginFunction() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      DEPLOYING CUSTOM LOGIN FUNCTION                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.login_user(TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.login_user(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_is_active BOOLEAN;
  v_profile_completed BOOLEAN;
  v_stored_password TEXT;
  v_full_name TEXT;
  v_password_match BOOLEAN;
BEGIN
  IF p_username IS NULL OR p_username = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Username is required'
    );
  END IF;

  IF p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Password is required'
    );
  END IF;

  SELECT id, password, role, is_active, profile_completed, full_name
  INTO v_user_id, v_stored_password, v_user_role, v_is_active, v_profile_completed, v_full_name
  FROM public.users
  WHERE username = p_username
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid username or password'
    );
  END IF;

  v_password_match := (v_stored_password = crypt(p_password, v_stored_password));

  IF NOT v_password_match THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Invalid username or password'
    );
  END IF;

  IF NOT v_is_active THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Account is pending admin approval',
      'pending_approval', TRUE
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', v_user_id,
    'username', p_username,
    'full_name', v_full_name,
    'role', v_user_role,
    'is_active', v_is_active,
    'profile_completed', v_profile_completed
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', 'Login failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.login_user(TEXT, TEXT) TO anon, authenticated;
  `;
  
  try {
    const { error } = await supabase.rpc('exec', { sql });
    
    if (error && !error.message?.includes('does not exist')) {
      console.log('Note: RPC exec not available, function must be deployed via SQL Editor');
      console.log('\nCopy the SQL from: backend/database/migrations/CREATE_LOGIN_USER_FUNCTION.sql');
      console.log('And paste it into: https://supabase.com/dashboard/projects/[project]/sql\n');
      return;
    }
    
    // Test the function
    console.log('Testing login function...\n');
    const { data: testResult, error: testError } = await supabase
      .rpc('login_user', {
        p_username: 'test',
        p_password: 'test'
      });
    
    if (testError?.message?.includes('does not exist')) {
      console.log('✗ Function not deployed yet');
      console.log('\nYou must deploy via SQL Editor first');
    } else {
      console.log('✓ Function deployed and responding');
      console.log(JSON.stringify(testResult, null, 2));
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                 DEPLOYMENT COMPLETED                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

deployLoginFunction();
