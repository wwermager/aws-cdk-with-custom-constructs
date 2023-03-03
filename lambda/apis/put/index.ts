import { APIGatewayEvent } from "aws-lambda";

const mysql = require("mysql2/promise");
const { getDbSecrets } = require("../utils/getSecrets");

exports.handler = async (event: APIGatewayEvent) => {
  // TODO move client out of handler
  const dbSecret = await getDbSecrets(process.env.DB_SECRET_NAME);

  const mySqlClient = await mysql.createConnection({
    host: dbSecret.host,
    user: dbSecret.username,
    password: dbSecret.password,
    database: dbSecret.dbname,
    port: dbSecret.port,
  });
  // Expecting a body with a name property
  if (!event.body || JSON.parse(event.body).name) {
    return {
      statusCode: 400,
      body: JSON.stringify("missing body or name property"),
    };
  }

  const { name } = JSON.parse(event.body);
  const queryText = `INSERT INTO ${process.env.TABLE_NAME} (name) VALUES ('${name}') ON DUPLICATE KEY UPDATE name='${name}'`;
  const [rows, fields] = await mySqlClient.execute(queryText);

  return {
    statusCode: 200,
    body: JSON.stringify(rows),
  };
};
