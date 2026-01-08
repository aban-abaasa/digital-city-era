import { supabase, handleSupabaseError, getCurrentUser } from './supabaseClient';

// Generic API service using Supabase
export const apiService = {
  // GET request - fetch data from a table
  get: async (table, options = {}) => {
    try {
      let query = supabase.from(table).select(options.select || '*');
      
      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (key.includes('_like')) {
              const column = key.replace('_like', '');
              query = query.ilike(column, `%${value}%`);
            } else if (key.includes('_gt')) {
              const column = key.replace('_gt', '');
              query = query.gt(column, value);
            } else if (key.includes('_lt')) {
              const column = key.replace('_lt', '');
              query = query.lt(column, value);
            } else if (key.includes('_gte')) {
              const column = key.replace('_gte', '');
              query = query.gte(column, value);
            } else if (key.includes('_lte')) {
              const column = key.replace('_lte', '');
              query = query.lte(column, value);
            } else if (key.includes('_in')) {
              const column = key.replace('_in', '');
              query = query.in(column, Array.isArray(value) ? value : [value]);
            } else {
              query = query.eq(key, value);
            }
          }
        });
      }

      // Apply ordering
      if (options.orderBy) {
        const { column, ascending = true } = options.orderBy;
        query = query.order(column, { ascending });
      }

      // Apply pagination
      if (options.page && options.limit) {
        const from = (options.page - 1) * options.limit;
        const to = from + options.limit - 1;
        query = query.range(from, to);
      } else if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error, count } = await query;
      
      if (error) throw handleSupabaseError(error);
      
      return {
        data,
        count,
        page: options.page || 1,
        limit: options.limit || data?.length || 0
      };
    } catch (error) {
      throw error;
    }
  },

  // GET single record by ID
  getById: async (table, id, options = {}) => {
    try {
      const { data, error } = await supabase
        .from(table)
        .select(options.select || '*')
        .eq('id', id)
        .single();
      
      if (error) throw handleSupabaseError(error);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // POST request - insert new data
  post: async (table, data) => {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // POST multiple records
  postMany: async (table, dataArray) => {
    try {
      const { data, error } = await supabase
        .from(table)
        .insert(dataArray)
        .select();
      
      if (error) throw handleSupabaseError(error);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // PUT request - update existing data
  put: async (table, id, data) => {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // PATCH request - update multiple records
  patch: async (table, data, filters = {}) => {
    try {
      let query = supabase.from(table).update(data);
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data: result, error } = await query.select();
      
      if (error) throw handleSupabaseError(error);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // DELETE request
  delete: async (table, id) => {
    try {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw handleSupabaseError(error);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // DELETE multiple records
  deleteMany: async (table, filters = {}) => {
    try {
      let query = supabase.from(table).delete();
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query.select();
      
      if (error) throw handleSupabaseError(error);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Count records
  count: async (table, filters = {}) => {
    try {
      let query = supabase.from(table).select('*', { count: 'exact', head: true });
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });

      const { count, error } = await query;
      
      if (error) throw handleSupabaseError(error);
      return count;
    } catch (error) {
      throw error;
    }
  },

  // Execute custom RPC function
  rpc: async (functionName, params = {}) => {
    try {
      const { data, error } = await supabase.rpc(functionName, params);
      
      if (error) throw handleSupabaseError(error);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Subscribe to real-time changes
  subscribe: (table, callback, filter = null) => {
    let channel = supabase
      .channel(`public:${table}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: table,
          filter: filter
        }, 
        callback
      );
    
    channel.subscribe();
    return channel;
  },

  // Unsubscribe from real-time changes
  unsubscribe: (channel) => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  }
};

export default apiService;
