// Metro config: ship the prebuilt recipe database (assets/db/recipes.db) as an asset.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('db');

module.exports = config;
