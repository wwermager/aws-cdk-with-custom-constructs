import { APIGatewayEvent } from "aws-lambda";

const mysql = require("mysql2/promise");
const { getDbSecrets } = require("../utils/getSecrets");

export const handler = async (event: APIGatewayEvent) => {
  // TODO move client out of handler
  const dbSecret = await getDbSecrets(process.env.DB_SECRET_NAME);

  const mySqlClient = await mysql.createConnection({
    host: dbSecret.host,
    user: dbSecret.username,
    password: dbSecret.password,
    database: dbSecret.dbname,
    port: dbSecret.port,
  });

  console.log(event);
  const path = event.path.split("/");

  if (!path[1]) {
    return {
      statusCode: 400,
      body: JSON.stringify("No id provided"),
    };
  }
  const queryText = `DELETE FROM ${process.env.TABLE_NAME} WHERE id = '${path[1]}'`;
  const [rows, fields] = await mySqlClient.execute(queryText);

  return {
    statusCode: 200,
    body: JSON.stringify(rows),
  };
};
