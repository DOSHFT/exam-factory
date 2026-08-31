export function parseArgs(argv, requiredNames) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing required argument --${name}`);
    args[name] = value;
    index += 1;
  }
  for (const name of requiredNames) {
    if (!(name in args)) throw new Error(`Missing required argument --${name}`);
  }
  return args;
}
