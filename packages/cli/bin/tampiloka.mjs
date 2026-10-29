#!/usr/bin/env node
import { main } from '../src/index.mjs';
main(process.argv.slice(2)).catch(error => {
  process.stderr.write(`Tampiloka: ${error.message}\n`);
  process.exitCode = 1;
});
