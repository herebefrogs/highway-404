// Storage wrapper API

/**
 * Save a value in localStorage under a key, automatically prefixed by the JS13KGAMES year and game title (hardcoded)
 * @params {*} key to save value under
 * @params {*} value to save
 */
export const saveToStorage = (key, value, prefix = '2020.highway-404.') => localStorage.setItem(prefix + key, value);

/**
 * Retrieve a value in localStorage from its key, automatically prefixed by the JS13KGAMES year and game title (hardcoded)
 * @params {*} key to load value from
 */
export const loadFromStorage = (key, prefix = '2020.highway-404.') => localStorage.getItem(prefix + key);
