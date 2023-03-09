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

export const handler = async (event: APIGatewayEvent) => {
  // This functioon will only be invoked if the user provided path matches <api>/name/{id}
  // ["","name","<ID>"]
  const path = event.path.split("/");
  const id = path[2];

  // Expecting a body with a name property
  if (!event.body || !JSON.parse(event.body).name) {
    return {
      statusCode: 400,
      body: JSON.stringify("missing body or name property"),
    };
  }

  const { name } = JSON.parse(event.body);
  const queryText = `INSERT INTO ${process.env.TABLE_NAME} (id,name) VALUES (${id},'${name}') ON DUPLICATE KEY UPDATE name='${name}'`;
  console.info(queryText);
  const [rows]: any = await mySqlClient.execute(queryText);

  return {
    statusCode: 200,
    body: JSON.stringify(rows[0]),
  };
};
