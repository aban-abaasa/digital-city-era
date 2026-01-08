// Mock service to replace backend connections with local storage

const generateId = () => Math.random().toString(36).substr(2, 9);

const getStorageKey = (table) => `supermarket_${table}`;

export const mockService = {
  get: async (table, options = {}) => {
    try {
      let data = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      
      // Apply filters if any
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            data = data.filter(item => item[key] === value);
          }
        });
      }

      // Apply ordering
      if (options.orderBy) {
        const { column, ascending = true } = options.orderBy;
        data.sort((a, b) => {
          return ascending ? 
            (a[column] > b[column] ? 1 : -1) : 
            (a[column] < b[column] ? 1 : -1);
        });
      }

      // Apply pagination
      if (options.page && options.limit) {
        const from = (options.page - 1) * options.limit;
        const to = from + options.limit;
        data = data.slice(from, to);
      } else if (options.limit) {
        data = data.slice(0, options.limit);
      }

      return {
        data,
        count: data.length,
        page: options.page || 1,
        limit: options.limit || data.length
      };
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },

  getById: async (table, id) => {
    try {
      const data = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      return data.find(item => item.id === id);
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },

  post: async (table, data) => {
    try {
      const existingData = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      const newItem = { ...data, id: generateId() };
      existingData.push(newItem);
      localStorage.setItem(getStorageKey(table), JSON.stringify(existingData));
      return newItem;
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },

  postMany: async (table, dataArray) => {
    try {
      const existingData = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      const newItems = dataArray.map(item => ({ ...item, id: generateId() }));
      existingData.push(...newItems);
      localStorage.setItem(getStorageKey(table), JSON.stringify(existingData));
      return newItems;
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },

  put: async (table, id, data) => {
    try {
      const existingData = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      const index = existingData.findIndex(item => item.id === id);
      if (index === -1) throw new Error('Item not found');
      
      const updatedItem = { ...existingData[index], ...data };
      existingData[index] = updatedItem;
      localStorage.setItem(getStorageKey(table), JSON.stringify(existingData));
      return updatedItem;
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },

  patch: async (table, data, filters = {}) => {
    try {
      let existingData = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        existingData = existingData.map(item => {
          if (item[key] === value) {
            return { ...item, ...data };
          }
          return item;
        });
      });

      localStorage.setItem(getStorageKey(table), JSON.stringify(existingData));
      return existingData;
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },

  delete: async (table, id) => {
    try {
      const existingData = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      const filteredData = existingData.filter(item => item.id !== id);
      localStorage.setItem(getStorageKey(table), JSON.stringify(filteredData));
      return { success: true };
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },

  deleteMany: async (table, filters = {}) => {
    try {
      let existingData = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        existingData = existingData.filter(item => item[key] !== value);
      });

      localStorage.setItem(getStorageKey(table), JSON.stringify(existingData));
      return { success: true };
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },

  count: async (table, filters = {}) => {
    try {
      let data = JSON.parse(localStorage.getItem(getStorageKey(table))) || [];
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          data = data.filter(item => item[key] === value);
        }
      });

      return data.length;
    } catch (error) {
      console.error('Mock Service Error:', error);
      throw error;
    }
  },
};

export default mockService;