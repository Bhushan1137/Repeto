const store = new Map<string, string>();

const AsyncStorageMock = {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: async (key: string) => {
    store.delete(key);
  },
  clear: async () => {
    store.clear();
  },
  getAllKeys: async () => Array.from(store.keys()),
  multiGet: async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null]),
  multiSet: async (keyValuePairs: [string, string][]) => {
    keyValuePairs.forEach(([k, v]) => store.set(k, v));
  },
  multiRemove: async (keys: string[]) => {
    keys.forEach((k) => store.delete(k));
  },
};

export default AsyncStorageMock;
