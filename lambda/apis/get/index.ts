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
  console.log(event);
  let rows, fields;

  const path = event.path.split("/");

  if (path.length > 1) {
    const queryText = `SELECT * FROM ${process.env.TABLE_NAME} WHERE id = '${path[1]}'`;
    [rows, fields] = await mySqlClient.execute(queryText);
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify("No id provided"),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(rows),
  };
};
