import { supabase } from './supabase';

const requireSuccess = (data, error) => {
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Local server request failed.');
  return data;
};

const businessArgs = ({ businessType, businessId }) => ({
  p_business_type: businessType,
  p_business_id: businessId,
});

export const businessLocalServerService = {
  async getProtocolInfo() {
    const { data, error } = await supabase.rpc('business_local_sync_protocol_info');
    return requireSuccess(data, error);
  },

  async listBusinesses() {
    const { data, error } = await supabase.rpc('list_business_local_sync_businesses');
    return requireSuccess(data, error).businesses || [];
  },

  async createPairing({ businessType, businessId, nodeName = 'Business local server' }) {
    const { data, error } = await supabase.rpc('create_business_local_sync_pairing', {
      ...businessArgs({ businessType, businessId }),
      p_node_name: nodeName,
    });
    return requireSuccess(data, error);
  },

  async listNodes({ businessType, businessId }) {
    const { data, error } = await supabase.rpc('list_business_local_sync_nodes',
      businessArgs({ businessType, businessId })
    );
    return requireSuccess(data, error).nodes || [];
  },

  async revokeNode(nodeId) {
    const { data, error } = await supabase.rpc('revoke_business_local_sync_node', {
      p_node_id: nodeId,
    });
    return requireSuccess(data, error);
  },

  async queueCloudEvent({ businessType, businessId, eventId, eventType, payload }) {
    const { data, error } = await supabase.rpc('queue_business_local_sync_event', {
      ...businessArgs({ businessType, businessId }),
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload,
    });
    return requireSuccess(data, error);
  },
};

export default businessLocalServerService;
