import { APIGatewayEvent } from "aws-lambda";
import * as mysql from "mysql2/promise";
import { getDbSecrets } from "../utils/getSecrets.js"; //TODO utils not getting deployed

const dbSecret = await getDbSecrets(process.env.DB_SECRET_NAME || "mysecret");

const mySqlClient = await mysql.createConnection({
  host: dbSecret.host,
  user: dbSecret.username,
  password: dbSecret.password,
  database: dbSecret.dbname,
  port: dbSecret.port,
});

exports.handler = async (event: APIGatewayEvent) => {
  console.log(event);

  const path = event.path.split("/");

  let rows;
  let fields;

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
