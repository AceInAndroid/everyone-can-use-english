const INDEX_NAME = "chat_agents_preset_source_unique";

async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query(`
    UPDATE chat_agents
    SET source = NULL
    WHERE source LIKE 'preset:%'
      AND rowid NOT IN (
        SELECT MIN(rowid)
        FROM chat_agents
        WHERE source LIKE 'preset:%'
        GROUP BY type, source
      )
  `);

  await queryInterface.sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX_NAME}
    ON chat_agents (type, source)
    WHERE source LIKE 'preset:%'
  `);
}

async function down({ context: queryInterface }) {
  await queryInterface.removeIndex("chat_agents", INDEX_NAME);
}

export { up, down };
