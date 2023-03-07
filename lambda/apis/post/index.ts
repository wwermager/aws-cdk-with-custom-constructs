import { APIGatewayEvent } from "aws-lambda";
import * as mysql from "mysql2/promise";
import { getDbSecrets } from "../utils/getSecrets.js";

const dbSecret = await getDbSecrets(process.env.DB_SECRET_NAME || "mysecret");

const mySqlClient = await mysql.createConnection({
  host: dbSecret.host,
  user: dbSecret.username,
  password: dbSecret.password,
  database: dbSecret.dbname,
  port: dbSecret.port,
});

exports.handler = async (event: APIGatewayEvent) => {
  // Expecting a body with a name property
  if (!event.body || !JSON.parse(event.body).name) {
    return {
      statusCode: 400,
      body: JSON.stringify("No body provided or name property is missing"),
    };
  }

  const { name } = JSON.parse(event.body);
  const queryText = `INSERT INTO ${process.env.TABLE_NAME} (name) VALUES ('${name}')`;
  const [rows, fields] = await mySqlClient.execute(queryText);

  return {
    statusCode: 200,
    body: JSON.stringify(rows),
  };
};