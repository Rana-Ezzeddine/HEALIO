import fs from 'fs';
import path from 'path';
import Sequelize from 'sequelize';
import configJson from '../config/config.json' assert { type: 'json' };

const basename = path.basename(import.meta.url);
const env = process.env.NODE_ENV || 'development';
const config = configJson[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const files = fs.readdirSync(__dirname).filter(file => file !== basename && file.endsWith('.js'));

// Use for…of to allow await
for (const file of files) {
  const { default: model } = await import(path.join(__dirname, file));
  db[model.name] = model(sequelize, Sequelize.DataTypes);
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;