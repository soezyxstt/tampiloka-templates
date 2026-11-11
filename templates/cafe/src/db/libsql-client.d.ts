// The installed package supplies its own types; this declaration also permits workspace
// typechecking before the newly selected provider dependency has been installed.
declare module '@libsql/client' {
  export function createClient(config: { url: string; authToken?: string }): any;
}
