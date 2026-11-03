// Module resolve hook for the workbook UI capture: the workbook routes'
// import of ./compose.js resolves to a shim that composes with the
// editor's learner key and clock (see workbooks-ui-compose-shim.ts).
const shim = new URL("./workbooks-ui-compose-shim.ts", import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (
    (specifier === "./compose.js" || specifier === "./compose.ts") &&
    context.parentURL &&
    context.parentURL.includes("/src/workbook/routes.ts")
  )
    return next(shim, context);
  return next(specifier, context);
}
