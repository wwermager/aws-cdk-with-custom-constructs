import * as mysql from "mysql2/promise";
import { getDbSecrets } from "./getSecrets.js";
import { randomUUID } from "crypto";

const dbSecret = await getDbSecrets(process.env.DB_SECRET_NAME || "mysecret");

const mySqlClient = await mysql.createConnection({
  host: dbSecret.host,
  user: dbSecret.username,
  password: dbSecret.password,
  database: dbSecret.dbname,
  port: dbSecret.port,
});

export const handler = async (event: any) => {
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
  console.info(queryText);
  const [rows] = await mySqlClient.execute(queryText);

  return {
    statusCode: 200,
    body: JSON.stringify(rows),
  };
};
