const mysql = require("mysql2/promise");
const { getDbSecrets } = require("./getSecrets");
const { randomUUID } = require("crypto");

const dbSecret = await getDbSecrets(process.env.DB_SECRET_NAME);

const mySqlClient = await mysql.createConnection({
  host: dbSecret.host,
  user: dbSecret.username,
  password: dbSecret.password,
  database: dbSecret.dbname,
  port: dbSecret.port,
});
export const handler = async (event: any) => {
  // // TODO move client out of handler
  // const dbSecret = await getDbSecrets(process.env.DB_SECRET_NAME);
  //
  // const mySqlClient = await mysql.createConnection({
  //   host: dbSecret.host,
  //   user: dbSecret.username,
  //   password: dbSecret.password,
  //   database: dbSecret.dbname,
  //   port: dbSecret.port,
  // });

  const createQueryText = `CREATE TABLE IF NOT EXISTS ${process.env.TABLE_NAME} (id INT NOT NULL AUTO_INCREMENT, name VARCHAR(255), PRIMARY KEY (id))`;
  console.info(createQueryText);
  await mySqlClient.execute(createQueryText);

  for (let i = 0; i <= 10; i++) {
    const insertQueryText = `INSERT INTO ${
      process.env.TABLE_NAME
    } (name) VALUES ('${randomUUID()}')`;
    console.info(insertQueryText);
    await mySqlClient.execute(insertQueryText);
  }

  const queryText = `SELECT * FROM ${process.env.TABLE_NAME}`;
  const [rows, fields] = await mySqlClient.execute(queryText);

  return {
    statusCode: 200,
    body: JSON.stringify(rows),
  };
};
