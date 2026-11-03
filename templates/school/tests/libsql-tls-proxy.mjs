import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { request } from 'node:http';

const server = createServer({ key: readFileSync(process.argv[2]), cert: readFileSync(process.argv[3]) }, (req, res) => {
  const upstream = request({ hostname: '127.0.0.1', port: 18080, path: req.url, method: req.method, headers: req.headers }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  upstream.on('error', error => { console.error(error); res.writeHead(502).end(); });
  req.pipe(upstream);
});
server.listen(18443, '127.0.0.1');
