import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import test from "node:test";
import { createDatabasePool } from "../src/server/database";

/** Just enough of Postgres to connect and answer a query, so a test can drop
 * the connection the way a restarting proxy or a failover does. */
function fakePostgres() {
  const sockets: Socket[] = [];
  const message = (type: string, body: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length + 4);
    return Buffer.concat([Buffer.from(type), length, body]);
  };
  const ready = message("Z", Buffer.from("I"));
  const server = createServer((socket) => {
    sockets.push(socket);
    socket.on("error", () => {});
    let started = false;
    socket.on("data", (data) => {
      if (!started) {
        started = true;
        socket.write(Buffer.concat([message("R", Buffer.alloc(4)), ready]));
        return;
      }
      // A query that ends in ";" answers; anything else never does.
      if (data.toString("utf8").includes(";"))
        socket.write(
          Buffer.concat([message("C", Buffer.from("SELECT 0\0")), ready]),
        );
    });
  });
  return { server, sockets };
}

async function poolOn(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  return createDatabasePool({
    connectionString: `postgres://x:y@127.0.0.1:${port}/x`,
  });
}
const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

test("losing an idle connection doesn't end the process, and the pool recovers", async () => {
  const { server, sockets } = fakePostgres();
  const pool = await poolOn(server);
  try {
    const client = await pool.connect();
    client.release();
    sockets[0]!.destroy();
    await settled();
    assert.equal(pool.idleCount, 0, "the lost connection is gone");
    const replacement = await pool.connect();
    await replacement.query("SELECT 1;");
    replacement.release();
    assert.equal(sockets.length, 2);
  } finally {
    await pool.end();
    server.close();
  }
});

test("losing a connection mid-transaction fails that request, not the process", async () => {
  const { server, sockets } = fakePostgres();
  const pool = await poolOn(server);
  try {
    const client = await pool.connect();
    // Between queries: nothing is waiting on the connection when it goes.
    sockets[0]!.destroy();
    await settled();
    await assert.rejects(client.query("SELECT 1;"));
    // Released as `transaction()` does, with no hint that it failed.
    client.release();
    const replacement = await pool.connect();
    await replacement.query("SELECT 1;");
    replacement.release();

    // During a query: the waiting request gets the error.
    const waiting = await pool.connect();
    const query = waiting.query("no answer");
    await settled();
    sockets.at(-1)!.destroy();
    await assert.rejects(query);
    waiting.release();
    await settled();
    const next = await pool.connect();
    await next.query("SELECT 1;");
    next.release();
  } finally {
    await pool.end();
    server.close();
  }
});
