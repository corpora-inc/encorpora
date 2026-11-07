/**
 * AMP for Schools, running locally with a synthetic school to show: one teacher
 * with 30 students, a 1,000-student school, or a 10,000-student district, built
 * through setup, import, the reconciler and seats, with a hero class whose
 * students answered real problems through the practice API. The real API and
 * Vite run on loopback over a throwaway schema in the test database; open
 * `/demo` to choose who you are. Everyone in it is made up.
 *
 *     AMP_TEST_DATABASE_URL=... npm run school:demo -- --size 1000 --port 4420 [--keep]
 *
 * Ports 4420 to 4429. Ctrl-C stops it and drops the schema (unless --keep).
 */
import {
  buildDemo,
  demoSizes,
  startDemoServer,
  type DemoSize,
} from "./school-demo-world";

const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const size = Number(argument("--size") ?? 1000) as DemoSize;
if (!demoSizes.includes(size))
  throw new Error(`--size is one of ${demoSizes.join(", ")}`);
const port = Number(argument("--port") ?? 4420);
if (!Number.isInteger(port) || port < 4420 || port > 4429)
  throw new Error("--port is between 4420 and 4429");
const keep = process.argv.includes("--keep");

const server = await startDemoServer({
  webPort: port,
  cacheDir: `node_modules/.vite-school-demo-${port}`,
});
console.log(
  `Building a ${size.toLocaleString("en-US")}-student demo; ${server.origin}/demo shows progress.`,
);
let stopping = false;
async function stop(code: number) {
  if (stopping) return;
  stopping = true;
  await server.close({ keep }).catch((error) => console.error(error));
  if (keep) console.log(`Kept schema ${server.schema}`);
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => void stop(0));
try {
  const world = await buildDemo(server, size);
  server.setPicker({ world });
  console.log(`\nReady: ${server.origin}/demo`);
  console.log(`  School overview  ${server.origin}/school/${world.school.id}`);
  if (world.district)
    console.log(
      `  District         ${server.origin}/school/${world.district.id}`,
    );
  console.log(
    `  Today            ${server.origin}/school/${world.school.id}/classes/${world.hero.classId}/today`,
  );
  console.log(`  Class code       ${world.hero.joinCode}`);
  console.log("Ctrl-C to stop.");
} catch (error) {
  console.error(error);
  await stop(1);
}
