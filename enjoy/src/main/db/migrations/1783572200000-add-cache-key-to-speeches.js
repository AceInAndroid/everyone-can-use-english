import { DataTypes } from "sequelize";

async function up({ context: queryInterface }) {
  await queryInterface.addColumn("speeches", "cache_key", {
    type: DataTypes.STRING,
    allowNull: true,
  });

  await queryInterface.addIndex("speeches", ["cache_key"], {
    unique: true,
    name: "speeches_cache_key_unique",
  });
}

async function down({ context: queryInterface }) {
  await queryInterface.removeIndex("speeches", "speeches_cache_key_unique");
  await queryInterface.removeColumn("speeches", "cache_key");
}

export { up, down };
