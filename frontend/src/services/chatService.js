import { supabase, supabaseConfig } from './supabase';
import { getLocalStaffSession } from './localBusinessStaffService';

const GUEST_KEY = 'chat_guest_identity_v1';
const CONV_PREFIX = 'chat_conversation_id_v1_';
const TEAM_CONV_PREFIX = 'business-team:';
const teamScopeByConversationId = new Map();

const newMessageId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    return (char === 'x' ? random : (random & 3 | 8)).toString(16);
  });
};

const makeTeamConversation = ({ businessType, businessId, legacyConversationId = null }) => {
  const id = `${TEAM_CONV_PREFIX}${businessType}:${businessId}`;
  teamScopeByConversationId.set(id, { businessType, businessId, legacyConversationId });
  return { id, kind: 'team', supermarket_id: businessId, last_message_at: new Date().toISOString() };
};

const mapBusinessTeamMessage = (row) => ({
  id: row.id,
  event_id: row.id,
  conversation_id: row.conversation_id || null,
  sender_role: row.sender_role,
  sender_name: row.sender_name,
  sender_avatar_url: null,
  body: row.body,
  attachment_url: null,
  attachment_type: null,
  attachment_name: null,
  created_at: row.created_at,
});

const mapLegacyTeamMessage = (row) => ({
  ...row,
  sender_avatar_url: row.sender_avatar_url || null,
});

const isMissingTeamSyncRpc = (error) => ['PGRST202', '42883'].includes(error?.code);

export const getGuestIdentity = () => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || 'null');
  } catch {
    return null;
  }
};

export const setGuestIdentity = (identity) => {
  localStorage.setItem(GUEST_KEY, JSON.stringify(identity));
};

export const getStoredConversationId = (scopeKey) =>
  localStorage.getItem(CONV_PREFIX + scopeKey);

export const storeConversationId = (scopeKey, conversationId) => {
  localStorage.setItem(CONV_PREFIX + scopeKey, conversationId);
};

export const clearStoredConversationId = (scopeKey) => {
  localStorage.removeItem(CONV_PREFIX + scopeKey);
};

export const createConversation = async ({ name, email, userId, role, portal, supermarketId, subject }) => {
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      guest_name: name || null,
      guest_email: email || null,
      user_id: userId || null,
      role: role || 'guest',
      portal: portal || 'landing',
      supermarket_id: supermarketId || null,
      subject: subject || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchConversation = async (conversationId) => {
  const { data } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  return data;
};

export const fetchMessages = async (conversationId) => {
  const teamScope = teamScopeByConversationId.get(conversationId);
  if (teamScope) {
    const { businessType, businessId, legacyConversationId } = teamScope;
    const [businessResult, legacyResult] = await Promise.all([
      supabase.from('business_local_team_messages').select('*')
        .eq('business_type', businessType).eq('business_id', businessId)
        .order('created_at', { ascending: true }),
      legacyConversationId
        ? supabase.from('chat_messages').select('*').eq('conversation_id', legacyConversationId)
          .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (businessResult.error) throw businessResult.error;
    if (legacyResult.error) throw legacyResult.error;
    return [...(legacyResult.data || []).map(mapLegacyTeamMessage), ...(businessResult.data || []).map(mapBusinessTeamMessage)]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  const { data } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return data || [];
};

export const sendMessage = async (conversationId, { senderRole, senderName, senderAvatarUrl, body, attachment }) => {
  const teamScope = teamScopeByConversationId.get(conversationId);
  if (teamScope) {
    if (attachment) throw new Error('Image attachments are not available in the local team channel yet.');
    const eventId = newMessageId();
    const messageBody = String(body || '').trim();
    if (!messageBody) throw new Error('Enter a message before sending.');

    if (supabaseConfig.localBusinessServer) {
      const row = {
        id: eventId,
        business_type: teamScope.businessType,
        business_id: teamScope.businessId,
        sender_role: senderRole || 'staff',
        sender_name: senderName || 'Team member',
        body: messageBody,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('business_local_team_messages').insert(row).select().single();
      if (error) throw error;
      return mapBusinessTeamMessage(data);
    }

    const { data, error } = await supabase.rpc('send_business_local_team_message', {
      p_business_type: teamScope.businessType,
      p_business_id: teamScope.businessId,
      p_event_id: eventId,
      p_sender_role: senderRole || 'staff',
      p_sender_name: senderName || 'Team member',
      p_body: messageBody,
    });
    if (!error && data?.success && data.message) return mapBusinessTeamMessage(data.message);
    if (error && isMissingTeamSyncRpc(error) && teamScope.legacyConversationId) {
      // Older cloud deployments keep the previous chat path until the
      // business-local team-message migration is applied.
      return sendLegacyMessage(teamScope.legacyConversationId, {
        senderRole, senderName, senderAvatarUrl, body, attachment,
      });
    }
    if (error) throw error;
    throw new Error(data?.error || 'Could not send the team message.');
  }

  return sendLegacyMessage(conversationId, { senderRole, senderName, senderAvatarUrl, body, attachment });
};

const sendLegacyMessage = async (conversationId, { senderRole, senderName, senderAvatarUrl, body, attachment }) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_role: senderRole,
      sender_name: senderName || null,
      sender_avatar_url: senderAvatarUrl || null,
      body,
      attachment_url: attachment?.url || null,
      attachment_type: attachment?.type || null,
      attachment_name: attachment?.name || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const markConversationRead = async (conversationId, side) => {
  const field = side === 'dev' ? 'unread_by_dev' : 'unread_by_user';
  await supabase.from('chat_conversations').update({ [field]: false }).eq('id', conversationId);
};

export const closeConversation = async (conversationId) => {
  await supabase.from('chat_conversations').update({ status: 'closed' }).eq('id', conversationId);
};

// Dev Panel inbox only shows "support" threads — team channels are internal
// to each supermarket's own staff and don't need the dev team moderating them.
export const listConversations = async ({ kind = 'support' } = {}) => {
  let query = supabase.from('chat_conversations').select('*').order('last_message_at', { ascending: false });
  if (kind) query = query.eq('kind', kind);
  const { data } = await query;
  return data || [];
};

export const subscribeToMessages = (conversationId, onInsert) => {
  const teamScope = teamScopeByConversationId.get(conversationId);
  if (teamScope) {
    const channels = [];
    channels.push(supabase
      .channel(`business_team_messages_${teamScope.businessType}_${teamScope.businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'business_local_team_messages',
          filter: `business_id=eq.${teamScope.businessId}`,
        },
        (payload) => {
          if (payload.new.business_type === teamScope.businessType) onInsert(mapBusinessTeamMessage(payload.new));
        }
      )
      .subscribe());
    if (teamScope.legacyConversationId) {
      channels.push(supabase
        .channel(`legacy_team_messages_${teamScope.legacyConversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${teamScope.legacyConversationId}` },
          (payload) => onInsert(mapLegacyTeamMessage(payload.new))
        )
        .subscribe());
    }
    return () => channels.forEach((channel) => supabase.removeChannel(channel));
  }

  const channel = supabase
    .channel(`chat_messages_${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const subscribeToConversation = (conversationId, onUpdate) => {
  const channel = supabase
    .channel(`chat_conversation_${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'chat_conversations', filter: `id=eq.${conversationId}` },
      (payload) => onUpdate(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const subscribeToAllConversations = (onChange) => {
  const channel = supabase
    .channel('chat_conversations_all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const subscribeToAllMessages = (onInsert) => {
  const channel = supabase
    .channel('chat_messages_all')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => onInsert(payload.new))
    .subscribe();
  return () => supabase.removeChannel(channel);
};

// The hidden dev-panel login (password intercept or Google OAuth intercept in
// CustomerLogin.jsx / UnifiedAuth.jsx) sets this flag before ever touching a
// real portal — it's the one reliable signal that "this session is the developer",
// since that path often has no ordinary Supabase-authenticated `users` row.
export const isDeveloperSession = () => {
  try {
    return sessionStorage.getItem('dev_panel_auth') === 'true';
  } catch {
    return false;
  }
};

export const getOrCreateTeamConversation = async ({ supermarketId, supermarketName, portal }) => {
  if (supabaseConfig.localBusinessServer && supabaseConfig.businessType && supabaseConfig.businessId) {
    return makeTeamConversation({
      businessType: supabaseConfig.businessType,
      businessId: supabaseConfig.businessId,
    });
  }

  let businessType = 'supermarket';
  let businessId = supermarketId;
  if (businessId) {
    const { data: resolvedScope, error: resolveError } = await supabase.rpc(
      'resolve_business_local_team_chat_scope',
      { p_supermarket_id: supermarketId }
    );
    if (!resolveError && resolvedScope?.success) {
      businessType = resolvedScope.businessType;
      businessId = resolvedScope.businessId;
    }

    const { error: syncTableError } = await supabase
      .from('business_local_team_messages')
      .select('id')
      .eq('business_type', businessType)
      .eq('business_id', businessId)
      .limit(1);
    if (!syncTableError) {
      const { data: legacy } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('kind', 'team')
        .eq('supermarket_id', supermarketId)
        .maybeSingle();
      return makeTeamConversation({ businessType, businessId, legacyConversationId: legacy?.id || null });
    }
  }

  const { data: existing } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('kind', 'team')
    .eq('supermarket_id', supermarketId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      kind: 'team',
      supermarket_id: supermarketId,
      portal: portal || 'admin',
      role: 'team',
      subject: supermarketName ? `${supermarketName} team chat` : 'Store team chat',
    })
    .select()
    .single();

  if (error) {
    // Unique index race — someone else created it a moment earlier.
    const { data: retry } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('kind', 'team')
      .eq('supermarket_id', supermarketId)
      .maybeSingle();
    if (retry) return retry;
    throw error;
  }
  return data;
};

// Resolve who's chatting: real portal user (via auth_id -> public.users) or null for guest
export const resolveChatIdentity = async () => {
  try {
    if (supabaseConfig.localBusinessServer && supabaseConfig.businessType && supabaseConfig.businessId) {
      const localStaff = getLocalStaffSession()?.user;
      if (!localStaff) return null;
      return {
        userId: localStaff.id,
        authId: localStaff.id,
        name: localStaff.name || localStaff.full_name || localStaff.username,
        email: '',
        role: localStaff.role || 'staff',
        supermarketId: supabaseConfig.businessId,
        avatarUrl: null,
        isLocalBusinessIdentity: true,
      };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('id, full_name, email, role, supermarket_id, avatar_url')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!profile) return null;

    return {
      userId: profile.id,
      // Canonical cross-app identity (auth.uid()) — used for tables shared
      // across all 4 apps like landing_messages/ican_user_wallets, which key
      // off auth.users(id) directly rather than this app's local users.id.
      authId: user.id,
      name: profile.full_name || profile.email || 'User',
      email: profile.email || user.email || '',
      role: profile.role || 'customer',
      supermarketId: profile.supermarket_id || null,
      avatarUrl: profile.avatar_url || null,
    };
  } catch {
    return null;
  }
};
