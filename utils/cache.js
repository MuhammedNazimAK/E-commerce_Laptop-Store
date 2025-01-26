const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 600 });

const getCachedData = async (key, fetchFunction) => {

  let data = cache.get(key);
  
  // If data is not in cache, fetch it and store in cache
  if (data === undefined) {
    data = await fetchFunction();
    cache.set(key, data);
  }

  // Delete expired keys (Product)
  cache.keys().forEach(key => {
    if (key.startsWith('productList_')) {
      cache.del(key);
    }
  });
  
  return data;
};

module.exports = { getCachedData };
